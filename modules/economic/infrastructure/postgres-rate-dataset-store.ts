import { createHash } from 'node:crypto';
import { sql, type Kysely } from 'kysely';
import { AppError } from '../../../platform/contracts/src/index.js';
import type { Database } from '../../../platform/database/src/types.js';
import type { JsonObject, JsonValue } from '../../metadata/api/contracts.js';
import type {
  RateDataset,
  RateObservation,
  RateRole
} from '../api/contracts.js';
import type {
  PublishRateDatasetInput,
  RateDatasetStore
} from '../api/rate-store.js';

function canonical(value: JsonValue): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const object = value as JsonObject;
  return `{${Object.keys(object).sort().map((key) =>
    `${JSON.stringify(key)}:${canonical(object[key] ?? null)}`
  ).join(',')}}`;
}

function digestInput(input: PublishRateDatasetInput): string {
  const observations = [...input.observations]
    .map((observation) => ({
      role: observation.role,
      sourceUnit: observation.sourceUnit,
      targetUnit: observation.targetUnit,
      rate: observation.rate,
      effectiveAt: observation.effectiveAt.toISOString(),
      precision: observation.precision,
      metadata: observation.metadata ?? {}
    }))
    .sort((a,b) =>
      a.role.localeCompare(b.role) ||
      a.sourceUnit.localeCompare(b.sourceUnit) ||
      a.targetUnit.localeCompare(b.targetUnit) ||
      a.effectiveAt.localeCompare(b.effectiveAt)
    );

  const semantic: JsonObject = {
    code: input.code,
    version: input.version,
    provider: input.provider,
    config: input.config ?? {},
    observations
  };
  return createHash('sha256').update(canonical(semantic)).digest('hex');
}

function fail(code: string, message: string): never {
  throw new AppError({ code, message, module: 'economic', operation: 'rate-dataset' });
}

function asDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date;
  }
  fail('RATE_DATASET_TIMESTAMP_INVALID', 'Database returned an invalid rate timestamp.');
}

function datasetFromRow(row: {
  id: string;
  enterprise_id: string | null;
  code: string;
  version: number;
  status: 'DRAFT' | 'PUBLISHED' | 'RETIRED';
  provider: string;
  semantic_digest: string;
  config: Record<string, unknown>;
}): RateDataset {
  return {
    id: row.id,
    ...(row.enterprise_id !== null ? { enterpriseId: row.enterprise_id } : {}),
    code: row.code,
    version: row.version,
    status: row.status,
    provider: row.provider,
    digest: row.semantic_digest,
    config: row.config as JsonObject
  };
}

export class PostgresRateDatasetStore implements RateDatasetStore {
  constructor(private readonly db: Kysely<Database>) {}

  async publish(input: PublishRateDatasetInput): Promise<RateDataset> {
    if (!Number.isInteger(input.version) || input.version < 1) {
      fail('RATE_DATASET_VERSION_INVALID', 'Rate dataset version must be a positive integer.');
    }
    if (input.observations.length === 0) {
      fail('RATE_DATASET_EMPTY', 'A published rate dataset must contain at least one observation.');
    }

    const semanticDigest = digestInput(input);

    return this.db.transaction().execute(async (trx) => {
      let existingQuery = trx.selectFrom('rate_dataset')
        .selectAll()
        .where('code','=',input.code)
        .where('version','=',input.version);

      existingQuery = input.enterpriseId === undefined
        ? existingQuery.where('enterprise_id','is',null)
        : existingQuery.where('enterprise_id','=',input.enterpriseId);

      const existing = await existingQuery.executeTakeFirst();
      if (existing !== undefined) {
        if (existing.semantic_digest !== semanticDigest) {
          fail(
            'RATE_DATASET_VERSION_DRIFT',
            `Rate dataset ${input.code} v${input.version} is immutable; publish a new version.`
          );
        }
        return datasetFromRow(existing);
      }

      const dataset = await trx.insertInto('rate_dataset').values({
        enterprise_id: input.enterpriseId ?? null,
        code: input.code,
        version: input.version,
        status: 'PUBLISHED',
        provider: input.provider,
        semantic_digest: semanticDigest,
        config: input.config ?? {},
        published_at: sql`now()`
      }).returningAll().executeTakeFirstOrThrow();

      for (const observation of input.observations) {
        if (observation.rate === '' || observation.precision < 0 || observation.precision > 18) {
          fail('RATE_OBSERVATION_INVALID', 'Rate observation contains invalid rate or precision.');
        }
        await trx.insertInto('rate_observation').values({
          enterprise_id: input.enterpriseId ?? null,
          rate_dataset_id: dataset.id,
          rate_dataset_version: dataset.version,
          role: observation.role,
          source_unit: observation.sourceUnit,
          target_unit: observation.targetUnit,
          convention: 'TARGET_PER_SOURCE',
          rate: observation.rate,
          effective_at: observation.effectiveAt,
          provider: input.provider,
          precision: observation.precision,
          metadata: observation.metadata ?? {}
        }).execute();
      }

      return datasetFromRow(dataset);
    });
  }

  async get(code: string, version: number, enterpriseId?: string): Promise<RateDataset | null> {
    let query = this.db.selectFrom('rate_dataset')
      .selectAll()
      .where('code','=',code)
      .where('version','=',version);

    query = enterpriseId === undefined
      ? query.where('enterprise_id','is',null)
      : query.where('enterprise_id','=',enterpriseId);

    const row = await query.executeTakeFirst();
    return row === undefined ? null : datasetFromRow(row);
  }

  async getById(datasetId: string): Promise<RateDataset | null> {
    const row = await this.db.selectFrom('rate_dataset')
      .selectAll()
      .where('id','=',datasetId)
      .executeTakeFirst();
    return row === undefined ? null : datasetFromRow(row);
  }

  async listObservations(datasetId: string): Promise<readonly RateObservation[]> {
    const dataset = await this.db.selectFrom('rate_dataset')
      .select(['id','version','semantic_digest'])
      .where('id','=',datasetId)
      .executeTakeFirst();

    if (dataset === undefined) return [];

    const rows = await this.db.selectFrom('rate_observation')
      .selectAll()
      .where('rate_dataset_id','=',datasetId)
      .orderBy('effective_at')
      .orderBy('source_unit')
      .orderBy('target_unit')
      .execute();

    return rows.map((row) => ({
      id: row.id,
      dataset: {
        datasetId: dataset.id,
        version: dataset.version,
        digest: dataset.semantic_digest
      },
      role: row.role as RateRole,
      sourceUnit: row.source_unit,
      targetUnit: row.target_unit,
      convention: row.convention,
      rate: row.rate,
      effectiveAt: asDate(row.effective_at),
      provider: row.provider,
      precision: row.precision,
      metadata: row.metadata as JsonObject
    }));
  }
}

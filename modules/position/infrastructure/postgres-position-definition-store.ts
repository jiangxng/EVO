import { createHash } from 'node:crypto';
import { sql, type Kysely } from 'kysely';
import { AppError } from '../../../platform/contracts/src/index.js';
import type { Database } from '../../../platform/database/src/types.js';
import type { JsonObject, JsonValue } from '../../metadata/api/contracts.js';
import type {
  PositionDefinition,
  PositionDefinitionStore,
  PositionDimensionMapping,
  PositionSourceRule,
  PublishPositionDefinitionInput
} from '../api/contracts.js';

function canonical(value: JsonValue): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const object = value as JsonObject;
  return `{${Object.keys(object).sort().map((key) =>
    `${JSON.stringify(key)}:${canonical(object[key] ?? null)}`
  ).join(',')}}`;
}

function fail(code: string, message: string): never {
  throw new AppError({ code, message, module: 'position', operation: 'definition-store' });
}

function semanticDigest(input: PublishPositionDefinitionInput): string {
  const semantic: JsonObject = {
    code: input.code,
    version: input.version,
    dimensions: input.dimensions as unknown as JsonValue,
    sourceRules: input.sourceRules as unknown as JsonValue,
    config: input.config ?? {}
  };
  return createHash('sha256').update(canonical(semantic)).digest('hex');
}

function mapDefinition(row: {
  id:string;
  enterprise_id:string|null;
  code:string;
  name:string;
  version:number;
  status:'DRAFT'|'PUBLISHED'|'RETIRED';
  semantic_digest:string;
  dimensions:readonly unknown[];
  source_rules:readonly unknown[];
  config:Record<string, unknown>;
}): PositionDefinition {
  return {
    id: row.id,
    ...(row.enterprise_id !== null ? { enterpriseId: row.enterprise_id } : {}),
    code: row.code,
    name: row.name,
    version: row.version,
    status: row.status,
    digest: row.semantic_digest,
    dimensions: row.dimensions as unknown as readonly PositionDimensionMapping[],
    sourceRules: row.source_rules as unknown as readonly PositionSourceRule[],
    config: row.config as JsonObject
  };
}

export class PostgresPositionDefinitionStore implements PositionDefinitionStore {
  constructor(private readonly db: Kysely<Database>) {}

  async publish(input: PublishPositionDefinitionInput): Promise<PositionDefinition> {
    if (!Number.isInteger(input.version) || input.version < 1) {
      fail('POSITION_DEFINITION_VERSION_INVALID','Position definition version must be positive.');
    }
    if (input.dimensions.length === 0) {
      fail('POSITION_DEFINITION_DIMENSIONS_REQUIRED','Position definition requires dimensions.');
    }
    if (input.sourceRules.length === 0) {
      fail('POSITION_DEFINITION_SOURCE_RULES_REQUIRED','Position definition requires source rules.');
    }

    const digest = semanticDigest(input);

    return this.db.transaction().execute(async (trx) => {
      let existingQuery = trx.selectFrom('position_definition')
        .selectAll()
        .where('code','=',input.code)
        .where('version','=',input.version);

      existingQuery = input.enterpriseId === undefined
        ? existingQuery.where('enterprise_id','is',null)
        : existingQuery.where('enterprise_id','=',input.enterpriseId);

      const existing = await existingQuery.executeTakeFirst();
      if (existing !== undefined) {
        if (existing.semantic_digest !== digest) {
          fail(
            'POSITION_DEFINITION_VERSION_DRIFT',
            `Position definition ${input.code} v${input.version} is immutable; publish a new version.`
          );
        }
        return mapDefinition(existing);
      }

      const row = await trx.insertInto('position_definition').values({
        enterprise_id: input.enterpriseId ?? null,
        code: input.code,
        name: input.name,
        version: input.version,
        status: 'PUBLISHED',
        semantic_digest: digest,
        dimensions: input.dimensions,
        source_rules: input.sourceRules,
        config: input.config ?? {},
        published_at: sql`now()`
      }).returningAll().executeTakeFirstOrThrow();

      return mapDefinition(row);
    });
  }

  async getById(definitionId: string): Promise<PositionDefinition | null> {
    const row = await this.db.selectFrom('position_definition')
      .selectAll()
      .where('id','=',definitionId)
      .executeTakeFirst();
    return row === undefined ? null : mapDefinition(row);
  }

  async get(
    code: string,
    version: number,
    enterpriseId?: string
  ): Promise<PositionDefinition | null> {
    let query = this.db.selectFrom('position_definition')
      .selectAll()
      .where('code','=',code)
      .where('version','=',version);

    query = enterpriseId === undefined
      ? query.where('enterprise_id','is',null)
      : query.where('enterprise_id','=',enterpriseId);

    const row = await query.executeTakeFirst();
    return row === undefined ? null : mapDefinition(row);
  }
}

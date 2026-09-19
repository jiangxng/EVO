import { createHash } from 'node:crypto';
import { sql, type Kysely } from 'kysely';
import type { Database } from '../../../platform/database/src/types.js';
import type { CostCheckpointStateBuilder } from '../../cost/api/checkpoint-builder.js';
import type { CostMethod } from '../../cost/api/contracts.js';
import type { JsonObject, JsonValue } from '../../metadata/api/contracts.js';
import type {
  CheckpointCostPoolMaterialization,
  ReplayCheckpointMaterializationService
} from '../api/checkpoint-materialization.js';

function canonical(value: JsonValue): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const object = value as JsonObject;
  return `{${Object.keys(object).sort().map((key) =>
    `${JSON.stringify(key)}:${canonical(object[key] ?? null)}`
  ).join(',')}}`;
}

function digest(value: JsonValue): string {
  return createHash('sha256').update(canonical(value)).digest('hex');
}

function asDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date;
  }
  throw new Error('Checkpoint materialization contains an invalid timestamp.');
}

function asBigInt(value: unknown): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isInteger(value)) return BigInt(value);
  if (typeof value === 'string' && /^-?\d+$/.test(value)) return BigInt(value);
  throw new Error('Checkpoint materialization contains an invalid boundary sequence.');
}

function isCostMethod(value: string | null): value is CostMethod {
  return value === 'FIFO' ||
    value === 'LIFO' ||
    value === 'MOVING_AVERAGE' ||
    value === 'SPECIFIC_IDENTIFICATION';
}

function mapRow(row: {
  id:string;
  checkpoint_id:string;
  payload:JsonObject;
  semantic_digest:string;
  created_at:unknown;
}): CheckpointCostPoolMaterialization {
  const actual = digest(row.payload as JsonValue);
  if (actual !== row.semantic_digest) {
    throw new Error(
      `Checkpoint materialization ${row.id} digest mismatch; stored prefix state is not trustworthy.`
    );
  }

  return {
    id: row.id,
    checkpointId: row.checkpoint_id,
    state: row.payload as unknown as CheckpointCostPoolMaterialization['state'],
    semanticDigest: row.semantic_digest,
    createdAt: asDate(row.created_at)
  };
}

export class PostgresReplayCheckpointMaterializationService
implements ReplayCheckpointMaterializationService {
  constructor(
    private readonly db: Kysely<Database>,
    private readonly costStates: CostCheckpointStateBuilder
  ) {}

  async captureCostPools(
    checkpointId: string
  ): Promise<readonly CheckpointCostPoolMaterialization[]> {
    const checkpoint = await this.db.selectFrom('replay_checkpoint')
      .select([
        'id','enterprise_id','boundary_sequence','source_replay_run_id','status'
      ])
      .where('id','=',checkpointId)
      .where('status','=','ACTIVE')
      .executeTakeFirstOrThrow();

    if (checkpoint.source_replay_run_id === null) {
      throw new Error('Cost-pool checkpoint capture requires a source Full ReplayRun.');
    }

    const replay = await this.db.selectFrom('replay_run')
      .select([
        'id','mode','status','validation_status','cost_method',
        'valuation_policy_id','valuation_policy_version'
      ])
      .where('id','=',checkpoint.source_replay_run_id)
      .executeTakeFirstOrThrow();

    if (
      replay.mode !== 'FULL' ||
      replay.status !== 'COMPLETED' ||
      replay.validation_status !== 'MATCH'
    ) {
      throw new Error('Cost-pool checkpoint capture requires a completed MATCH Full Replay.');
    }

    if (replay.cost_method === null) return [];
    if (!isCostMethod(replay.cost_method)) {
      throw new Error(`Unsupported replay cost method ${replay.cost_method}.`);
    }
    if (
      replay.valuation_policy_id === null ||
      replay.valuation_policy_version === null
    ) {
      throw new Error('Cost-pool checkpoint capture requires pinned ValuationPolicy.');
    }

    const states = await this.costStates.build({
      enterpriseId: checkpoint.enterprise_id,
      method: replay.cost_method,
      valuationPolicyId: replay.valuation_policy_id,
      valuationPolicyVersion: replay.valuation_policy_version,
      boundarySequence: asBigInt(checkpoint.boundary_sequence)
    });

    for (const state of states) {
      const payload = state as unknown as JsonObject;
      const semanticDigest = digest(payload as JsonValue);

      const existing = await this.db.selectFrom('replay_checkpoint_materialization')
        .select(['id','semantic_digest'])
        .where('checkpoint_id','=',checkpoint.id)
        .where('family','=','COST_POOL')
        .where('scope_key','=',state.poolKey)
        .where('schema_version','=',state.schemaVersion)
        .executeTakeFirst();

      if (existing !== undefined) {
        if (existing.semantic_digest !== semanticDigest) {
          throw new Error(
            `Checkpoint COST_POOL ${state.poolKey} drifted after capture; create a new checkpoint.`
          );
        }
        continue;
      }

      await this.db.insertInto('replay_checkpoint_materialization')
        .values({
          enterprise_id: checkpoint.enterprise_id,
          checkpoint_id: checkpoint.id,
          family: 'COST_POOL',
          scope_key: state.poolKey,
          schema_version: state.schemaVersion,
          payload,
          semantic_digest: semanticDigest
        })
        .execute();
    }

    return this.loadCostPools(checkpoint.id);
  }

  async loadCostPools(
    checkpointId: string
  ): Promise<readonly CheckpointCostPoolMaterialization[]> {
    const rows = await this.db.selectFrom('replay_checkpoint_materialization')
      .select(['id','checkpoint_id','payload','semantic_digest','created_at'])
      .where('checkpoint_id','=',checkpointId)
      .where('family','=','COST_POOL')
      .where('schema_version','=',1)
      .orderBy('scope_key')
      .execute();

    return rows.map((row)=>mapRow({
      ...row,
      payload: row.payload as JsonObject
    }));
  }
}

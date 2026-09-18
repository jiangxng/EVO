import { sql, type Kysely } from 'kysely';
import type { Database } from '../../../platform/database/src/types.js';
import type { JsonObject } from '../../metadata/api/contracts.js';
import type {
  AllocationInstruction,
  AllocationRelation,
  AllocationRun,
  AllocationSourceSelector
} from '../api/contracts.js';
import type {
  AllocationStore,
  RecordAllocationInstructionInput,
  RecordAllocationRelationInput,
  StartAllocationRunInput
} from '../api/store.js';

function sourceSelectorJson(selector: AllocationSourceSelector): JsonObject {
  const result: Record<string, string | JsonObject> = { kind: selector.kind };
  if (selector.businessDataId !== undefined) result.businessDataId = selector.businessDataId;
  if (selector.positionId !== undefined) result.positionId = selector.positionId;
  if (selector.dimensions !== undefined) result.dimensions = selector.dimensions;
  if (selector.selectorValue !== undefined) result.selectorValue = selector.selectorValue;
  return result;
}

function parseSourceSelector(value: JsonObject): AllocationSourceSelector {
  const kind = String(value.kind ?? '');
  if (kind !== 'BUSINESS_DATA' && kind !== 'POSITION' && kind !== 'DIMENSION_QUERY') {
    throw new Error(`Invalid persisted allocation selector kind: ${kind}`);
  }
  return {
    kind,
    ...(typeof value.businessDataId === 'string' ? { businessDataId: value.businessDataId } : {}),
    ...(typeof value.positionId === 'string' ? { positionId: value.positionId } : {}),
    ...(value.dimensions !== null && typeof value.dimensions === 'object' && !Array.isArray(value.dimensions)
      ? { dimensions: value.dimensions as JsonObject }
      : {}),
    ...(typeof value.selectorValue === 'string' ? { selectorValue: value.selectorValue } : {})
  };
}

function asDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date;
  }
  throw new Error('Database returned an invalid allocation timestamp.');
}

function errorJson(error: unknown): JsonObject {
  if (error instanceof Error) {
    return { name: error.name, message: error.message };
  }
  return { message: String(error) };
}

export class PostgresAllocationStore implements AllocationStore {
  constructor(private readonly db: Kysely<Database>) {}

  async recordInstruction(
    input: RecordAllocationInstructionInput
  ): Promise<AllocationInstruction> {
    const inserted = await this.db.insertInto('allocation_instruction').values({
      enterprise_id: input.enterpriseId,
      consumer_business_data_id: input.consumerBusinessDataId,
      mode: input.mode,
      source_selector: sourceSelectorJson(input.sourceSelector),
      actor_type: input.actorType,
      actor_id: input.actorId,
      effective_at: input.effectiveAt,
      reason: input.reason ?? null,
      allocation_policy_id: input.allocationPolicyId,
      allocation_policy_version: input.allocationPolicyVersion,
      supersedes_instruction_id: input.supersedesInstructionId ?? null,
      idempotency_key: input.idempotencyKey,
      metadata: {}
    }).onConflict((oc) => oc
      .columns(['enterprise_id','consumer_business_data_id','idempotency_key'])
      .doNothing())
      .returning([
        'id','enterprise_id','consumer_business_data_id','mode','source_selector',
        'actor_type','actor_id','effective_at','recorded_at','reason',
        'allocation_policy_id','allocation_policy_version',
        'supersedes_instruction_id','idempotency_key'
      ])
      .executeTakeFirst();

    const row = inserted ?? await this.db.selectFrom('allocation_instruction')
      .select([
        'id','enterprise_id','consumer_business_data_id','mode','source_selector',
        'actor_type','actor_id','effective_at','recorded_at','reason',
        'allocation_policy_id','allocation_policy_version',
        'supersedes_instruction_id','idempotency_key'
      ])
      .where('enterprise_id','=',input.enterpriseId)
      .where('consumer_business_data_id','=',input.consumerBusinessDataId)
      .where('idempotency_key','=',input.idempotencyKey)
      .executeTakeFirstOrThrow();

    return {
      id: row.id,
      enterpriseId: row.enterprise_id,
      consumerBusinessDataId: row.consumer_business_data_id,
      mode: row.mode,
      sourceSelector: parseSourceSelector(row.source_selector as JsonObject),
      actorType: row.actor_type,
      actorId: row.actor_id,
      effectiveAt: asDate(row.effective_at),
      recordedAt: asDate(row.recorded_at),
      ...(row.reason !== null ? { reason: row.reason } : {}),
      allocationPolicyId: row.allocation_policy_id,
      allocationPolicyVersion: row.allocation_policy_version,
      ...(row.supersedes_instruction_id !== null
        ? { supersedesInstructionId: row.supersedes_instruction_id }
        : {}),
      idempotencyKey: row.idempotency_key
    };
  }

  async getInstruction(id: string): Promise<AllocationInstruction | null> {
    const row = await this.db.selectFrom('allocation_instruction')
      .select([
        'id','enterprise_id','consumer_business_data_id','mode','source_selector',
        'actor_type','actor_id','effective_at','recorded_at','reason',
        'allocation_policy_id','allocation_policy_version',
        'supersedes_instruction_id','idempotency_key'
      ])
      .where('id','=',id)
      .executeTakeFirst();

    if (row === undefined) return null;

    return {
      id: row.id,
      enterpriseId: row.enterprise_id,
      consumerBusinessDataId: row.consumer_business_data_id,
      mode: row.mode,
      sourceSelector: parseSourceSelector(row.source_selector as JsonObject),
      actorType: row.actor_type,
      actorId: row.actor_id,
      effectiveAt: asDate(row.effective_at),
      recordedAt: asDate(row.recorded_at),
      ...(row.reason !== null ? { reason: row.reason } : {}),
      allocationPolicyId: row.allocation_policy_id,
      allocationPolicyVersion: row.allocation_policy_version,
      ...(row.supersedes_instruction_id !== null
        ? { supersedesInstructionId: row.supersedes_instruction_id }
        : {}),
      idempotencyKey: row.idempotency_key
    };
  }

  async startRun(input: StartAllocationRunInput): Promise<AllocationRun> {
    const row = await this.db.insertInto('allocation_run').values({
      enterprise_id: input.enterpriseId,
      allocation_policy_id: input.allocationPolicyId,
      allocation_policy_version: input.allocationPolicyVersion,
      input_digest: input.inputDigest,
      status: 'PROCESSING',
      completed_at: null,
      error: null
    }).returning([
      'id','enterprise_id','allocation_policy_id','allocation_policy_version',
      'input_digest','status','started_at','completed_at'
    ]).executeTakeFirstOrThrow();

    return {
      id: row.id,
      enterpriseId: row.enterprise_id,
      allocationPolicyId: row.allocation_policy_id,
      allocationPolicyVersion: row.allocation_policy_version,
      status: row.status,
      inputDigest: row.input_digest,
      startedAt: asDate(row.started_at),
      ...(row.completed_at !== null ? { completedAt: asDate(row.completed_at) } : {})
    };
  }

  async recordRelation(input: RecordAllocationRelationInput): Promise<AllocationRelation> {
    const row = await this.db.insertInto('allocation_relation').values({
      enterprise_id: input.enterpriseId,
      allocation_run_id: input.allocationRunId,
      source_business_data_id: input.sourceBusinessDataId ?? null,
      source_position_key: input.sourcePositionId ?? null,
      consumer_business_data_id: input.consumerBusinessDataId,
      measurements: input.measurements,
      allocation_sequence: input.sequence,
      instruction_id: input.instructionId ?? null,
      allocation_policy_id: input.allocationPolicyId,
      allocation_policy_version: input.allocationPolicyVersion,
      lineage: input.lineage
    }).returning('id').executeTakeFirstOrThrow();

    return { id: row.id, ...input };
  }

  async completeRun(runId: string): Promise<void> {
    await this.db.updateTable('allocation_run').set({
      status: 'COMPLETED',
      completed_at: sql`now()`,
      error: null
    }).where('id','=',runId).execute();
  }

  async failRun(runId: string, error: unknown): Promise<void> {
    await this.db.updateTable('allocation_run').set({
      status: 'FAILED',
      completed_at: sql`now()`,
      error: errorJson(error)
    }).where('id','=',runId).execute();
  }
}

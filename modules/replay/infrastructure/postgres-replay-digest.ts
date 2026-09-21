import { createHash } from 'node:crypto';
import type { Kysely } from 'kysely';
import type { Database } from '../../../platform/database/src/types.js';
import type { JsonObject, JsonValue } from '../../metadata/api/contracts.js';

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

export function digestEconomicRuntimeSemantic(
  semantic: JsonObject
): string {
  return digest(semantic);
}

export function digestEconomicRuntimeFamily(
  family: JsonValue
): string {
  return digest(family);
}

function asBigInt(value: unknown): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isInteger(value)) return BigInt(value);
  if (typeof value === 'string' && /^-?\d+$/.test(value)) return BigInt(value);
  throw new Error('Replay digest source contains an invalid sequence.');
}

function iso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  throw new Error('Replay digest source contains an invalid timestamp.');
}

export async function computeReplayInputDigest(
  db: Kysely<Database>,
  enterpriseId: string,
  consistencyDomain: string,
  boundarySequence: bigint
): Promise<{ readonly digest: string; readonly lastIncludedFactId?: string; readonly count: number }> {
  const facts = await db.selectFrom('posting_input as p')
    .innerJoin('business_data as b','b.id','p.business_data_id')
    .select([
      'p.posting_sequence',
      'p.posting_priority',
      'p.metadata_version as posting_metadata_version',
      'p.application_instance_id',
      'p.effective_at as posting_effective_at',
      'b.id as business_data_id',
      'b.business_data_type',
      'b.business_object_key',
      'b.business_object_version',
      'b.metadata_version as business_metadata_version',
      'b.payload',
      'b.effective_at as business_effective_at'
    ])
    .where('p.enterprise_id','=',enterpriseId)
    .where('p.consistency_domain','=',consistencyDomain)
    .where('p.posting_sequence','<=',boundarySequence)
    .orderBy('p.posting_sequence')
    .orderBy('b.id')
    .execute();

  const instructions = await db.selectFrom('allocation_instruction as a')
    .innerJoin('business_data as b','b.id','a.consumer_business_data_id')
    .innerJoin('posting_input as p','p.business_data_id','b.id')
    .select([
      'a.id',
      'a.consumer_business_data_id',
      'a.mode',
      'a.source_selector',
      'a.actor_type',
      'a.actor_id',
      'a.effective_at',
      'a.reason',
      'a.allocation_policy_id',
      'a.allocation_policy_version',
      'a.supersedes_instruction_id',
      'a.idempotency_key',
      'p.posting_sequence'
    ])
    .where('a.enterprise_id','=',enterpriseId)
    .where('p.consistency_domain','=',consistencyDomain)
    .where('p.posting_sequence','<=',boundarySequence)
    .orderBy('p.posting_sequence')
    .orderBy('a.id')
    .execute();

  const semantic: JsonObject = {
    businessFacts: facts.map((row) => ({
      postingSequence: asBigInt(row.posting_sequence).toString(),
      postingPriority: row.posting_priority,
      postingMetadataVersion: row.posting_metadata_version,
      applicationInstanceId: row.application_instance_id,
      postingEffectiveAt: iso(row.posting_effective_at),
      businessDataId: row.business_data_id,
      businessDataType: row.business_data_type,
      businessObjectKey: row.business_object_key,
      businessObjectVersion: asBigInt(row.business_object_version).toString(),
      businessMetadataVersion: row.business_metadata_version,
      businessEffectiveAt: iso(row.business_effective_at),
      payload: row.payload as JsonObject
    })),
    allocationInstructions: instructions.map((row) => ({
      id: row.id,
      consumerBusinessDataId: row.consumer_business_data_id,
      mode: row.mode,
      sourceSelector: row.source_selector as JsonObject,
      actorType: row.actor_type,
      actorId: row.actor_id,
      effectiveAt: iso(row.effective_at),
      reason: row.reason,
      allocationPolicyId: row.allocation_policy_id,
      allocationPolicyVersion: row.allocation_policy_version,
      supersedesInstructionId: row.supersedes_instruction_id,
      idempotencyKey: row.idempotency_key,
      postingSequence: asBigInt(row.posting_sequence).toString()
    }))
  };

  return {
    digest: digest(semantic),
    ...(facts.at(-1) !== undefined ? { lastIncludedFactId: facts.at(-1)!.business_data_id } : {}),
    count: facts.length + instructions.length
  };
}

export async function computeEconomicRuntimeDigest(
  db: Kysely<Database>,
  enterpriseId: string,
  consistencyDomain: string,
  boundarySequence: bigint
): Promise<string> {
  const [
    entries,
    balances,
    costs,
    allocations,
    valuationPositions,
    valuationResults,
    workItems
  ] = await Promise.all([
    db.selectFrom('ledger_entry as e')
      .innerJoin('ledger_definition as d','d.id','e.ledger_definition_id')
      .select([
        'd.code as ledger',
        'e.business_data_id',
        'e.posting_rule_id',
        'e.posting_rule_schema_version',
        'e.effect_index',
        'e.quantity',
        'e.amount',
        'e.unit',
        'e.currency',
        'e.dimensions',
        'e.dimension_hash',
        'e.effective_at',
        'e.posting_priority',
        'e.posting_sequence',
        'e.entry_source_kind',
        'e.valuation_rule_id',
        'e.valuation_rule_version'
      ])
      .where('e.enterprise_id','=',enterpriseId)
      .where('e.consistency_domain','=',consistencyDomain)
      .where('e.posting_sequence','<=',boundarySequence)
      .orderBy('e.posting_sequence')
      .orderBy('d.code')
      .orderBy('e.effect_index')
      .execute(),

    db.selectFrom('ledger_balance as b')
      .innerJoin('ledger_definition as d','d.id','b.ledger_definition_id')
      .innerJoin('ledger_dataset as ds','ds.id','b.ledger_dataset_id')
      .select([
        'd.code as ledger',
        'b.dimension_hash',
        'b.dimensions',
        'b.quantity',
        'b.amount',
        'b.last_posting_sequence'
      ])
      .where('b.enterprise_id','=',enterpriseId)
      .where('b.consistency_domain','=',consistencyDomain)
      .where('ds.status','=','ACTIVE')
      .orderBy('d.code')
      .orderBy('b.dimension_hash')
      .execute(),

    db.selectFrom('cost_result')
      .select([
        'business_data_id','pool_key','method','quantity','unit_cost','total_cost',
        'valuation_rule_id','valuation_rule_version'
      ])
      .where('enterprise_id','=',enterpriseId)
      .orderBy('business_data_id')
      .orderBy('pool_key')
      .execute(),

    db.selectFrom('allocation_relation')
      .select([
        'source_business_data_id','source_position_key','consumer_business_data_id',
        'measurements','allocation_sequence','instruction_id',
        'allocation_policy_id','allocation_policy_version'
      ])
      .where('enterprise_id','=',enterpriseId)
      .orderBy('consumer_business_data_id')
      .orderBy('allocation_sequence')
      .execute(),

    db.selectFrom('valuation_position')
      .select([
        'business_data_id','valuation_rule_id','valuation_rule_version','total_cost'
      ])
      .where('enterprise_id','=',enterpriseId)
      .orderBy('business_data_id')
      .orderBy('valuation_rule_id')
      .execute(),

    db.selectFrom('valuation_result')
      .select([
        'result_kind','position_key','source_business_data_ids','dimensions',
        'source_measurements','target_measurements','delta_amount','delta_unit'
      ])
      .where('enterprise_id','=',enterpriseId)
      .orderBy('result_kind')
      .orderBy('position_key')
      .execute(),

    db.selectFrom('work_item')
      .select([
        'work_type','title','status','priority','source_ledger_code',
        'source_dimension_hash','source_dimensions','source_quantity','source_amount',
        'assigned_actor_type','assigned_actor_id'
      ])
      .where('enterprise_id','=',enterpriseId)
      .orderBy('work_type')
      .orderBy('source_ledger_code')
      .orderBy('source_dimension_hash')
      .execute()
  ]);

  const semantic: JsonObject = {
    ledgerEntries: entries.map((row) => ({
      ledger: row.ledger,
      businessDataId: row.business_data_id,
      postingRuleId: row.posting_rule_id,
      postingRuleSchemaVersion: row.posting_rule_schema_version,
      effectIndex: row.effect_index,
      quantity: row.quantity,
      amount: row.amount,
      unit: row.unit,
      currency: row.currency,
      dimensions: row.dimensions as JsonObject,
      dimensionHash: row.dimension_hash,
      effectiveAt: iso(row.effective_at),
      postingPriority: row.posting_priority,
      postingSequence: asBigInt(row.posting_sequence).toString(),
      entrySourceKind: row.entry_source_kind,
      valuationRuleId: row.valuation_rule_id,
      valuationRuleVersion: row.valuation_rule_version
    })),
    ledgerBalances: balances.map((row) => ({
      ledger: row.ledger,
      dimensionHash: row.dimension_hash,
      dimensions: row.dimensions as JsonObject,
      quantity: row.quantity,
      amount: row.amount,
      lastPostingSequence: asBigInt(row.last_posting_sequence).toString()
    })),
    costResults: costs.map((row) => ({
      businessDataId: row.business_data_id,
      poolKey: row.pool_key,
      method: row.method,
      quantity: row.quantity,
      unitCost: row.unit_cost,
      totalCost: row.total_cost,
      valuationRuleId: row.valuation_rule_id,
      valuationRuleVersion: row.valuation_rule_version
    })),
    allocationRelations: allocations.map((row) => ({
      sourceBusinessDataId: row.source_business_data_id,
      sourcePositionKey: row.source_position_key,
      consumerBusinessDataId: row.consumer_business_data_id,
      measurements: row.measurements as unknown as JsonValue,
      sequence: row.allocation_sequence,
      instructionId: row.instruction_id,
      allocationPolicyId: row.allocation_policy_id,
      allocationPolicyVersion: row.allocation_policy_version
    })),
    valuationPositions: valuationPositions.map((row) => ({
      businessDataId: row.business_data_id,
      valuationRuleId: row.valuation_rule_id,
      valuationRuleVersion: row.valuation_rule_version,
      totalCost: row.total_cost
    })),
    valuationResults: valuationResults.map((row) => ({
      resultKind: row.result_kind,
      positionKey: row.position_key,
      sourceBusinessDataIds: row.source_business_data_ids as unknown as JsonValue,
      dimensions: row.dimensions as JsonObject,
      sourceMeasurements: row.source_measurements as unknown as JsonValue,
      targetMeasurements: row.target_measurements as unknown as JsonValue,
      deltaAmount: row.delta_amount,
      deltaUnit: row.delta_unit
    })),
    workItems: workItems.map((row) => ({
      workType: row.work_type,
      title: row.title,
      status: row.status,
      priority: row.priority,
      sourceLedgerCode: row.source_ledger_code,
      sourceDimensionHash: row.source_dimension_hash,
      sourceDimensions: row.source_dimensions as JsonObject,
      sourceQuantity: row.source_quantity,
      sourceAmount: row.source_amount,
      assignedActorType: row.assigned_actor_type,
      assignedActorId: row.assigned_actor_id
    }))
  };

  return digest(semantic);
}

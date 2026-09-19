import type { Kysely } from 'kysely';
import type { Database } from '../../../platform/database/src/types.js';
import type { JsonObject, JsonValue } from '../../metadata/api/contracts.js';
import type {
  CandidateEconomicRuntimeDigestRequest,
  CandidateEconomicRuntimeDigestResult,
  CandidateEconomicRuntimeDigestService
} from '../api/candidate-digest.js';
import { digestEconomicRuntimeSemantic } from './postgres-replay-digest.js';

function asBigInt(value: unknown): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isInteger(value)) return BigInt(value);
  if (typeof value === 'string' && /^-?\d+$/.test(value)) return BigInt(value);
  throw new Error('Candidate digest source contains an invalid sequence.');
}

function iso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  throw new Error('Candidate digest source contains an invalid timestamp.');
}

export class PostgresCandidateEconomicRuntimeDigestService
implements CandidateEconomicRuntimeDigestService {
  constructor(private readonly db: Kysely<Database>) {}

  async compute(
    request: CandidateEconomicRuntimeDigestRequest
  ): Promise<CandidateEconomicRuntimeDigestResult> {
    const checkpoint = await this.db.selectFrom('replay_checkpoint')
      .select(['id','enterprise_id','consistency_domain','boundary_sequence','status'])
      .where('id','=',request.checkpointId)
      .where('status','=','ACTIVE')
      .executeTakeFirstOrThrow();

    const checkpointBoundary = asBigInt(checkpoint.boundary_sequence);
    if (request.targetBoundarySequence <= checkpointBoundary) {
      throw new Error('Candidate digest target boundary must be after checkpoint boundary.');
    }

    const candidate = await this.db.selectFrom('economic_runtime_dataset')
      .select([
        'id','enterprise_id','consistency_domain','kind','status',
        'source_checkpoint_id','boundary_sequence'
      ])
      .where('id','=',request.candidateRuntimeDatasetId)
      .executeTakeFirstOrThrow();

    if (
      candidate.enterprise_id !== checkpoint.enterprise_id ||
      candidate.consistency_domain !== checkpoint.consistency_domain ||
      candidate.kind !== 'CANDIDATE' ||
      !['BUILDING','VERIFIED'].includes(candidate.status) ||
      candidate.source_checkpoint_id !== checkpoint.id ||
      candidate.boundary_sequence === null ||
      asBigInt(candidate.boundary_sequence) !== request.targetBoundarySequence
    ) {
      throw new Error('Candidate digest requires the exact checkpoint-bound candidate scope.');
    }

    const candidateLedger = await this.db.selectFrom('ledger_dataset')
      .select('id')
      .where('enterprise_id','=',checkpoint.enterprise_id)
      .where('consistency_domain','=',checkpoint.consistency_domain)
      .where('economic_runtime_dataset_id','=',candidate.id)
      .where('kind','=','CANDIDATE')
      .where('status','=','BUILDING')
      .executeTakeFirstOrThrow();

    const prefixEntries = await this.db.selectFrom('ledger_entry as e')
      .innerJoin('ledger_definition as d','d.id','e.ledger_definition_id')
      .innerJoin('ledger_dataset as ds','ds.id','e.ledger_dataset_id')
      .select([
        'd.code as ledger','e.business_data_id','e.posting_rule_id',
        'e.posting_rule_schema_version','e.effect_index','e.quantity','e.amount',
        'e.unit','e.currency','e.dimensions','e.dimension_hash','e.effective_at',
        'e.posting_priority','e.posting_sequence','e.entry_source_kind',
        'e.valuation_rule_id','e.valuation_rule_version'
      ])
      .where('e.enterprise_id','=',checkpoint.enterprise_id)
      .where('e.consistency_domain','=',checkpoint.consistency_domain)
      .where('ds.status','=','ACTIVE')
      .where('e.posting_sequence','<=',checkpointBoundary)
      .execute();

    const suffixEntries = await this.db.selectFrom('ledger_entry as e')
      .innerJoin('ledger_definition as d','d.id','e.ledger_definition_id')
      .select([
        'd.code as ledger','e.business_data_id','e.posting_rule_id',
        'e.posting_rule_schema_version','e.effect_index','e.quantity','e.amount',
        'e.unit','e.currency','e.dimensions','e.dimension_hash','e.effective_at',
        'e.posting_priority','e.posting_sequence','e.entry_source_kind',
        'e.valuation_rule_id','e.valuation_rule_version'
      ])
      .where('e.ledger_dataset_id','=',candidateLedger.id)
      .where('e.posting_sequence','>',checkpointBoundary)
      .where('e.posting_sequence','<=',request.targetBoundarySequence)
      .execute();

    const entries = [...prefixEntries,...suffixEntries].sort((left,right) => {
      const sequence = Number(asBigInt(left.posting_sequence) - asBigInt(right.posting_sequence));
      if (sequence !== 0) return sequence;
      const ledger = left.ledger.localeCompare(right.ledger);
      if (ledger !== 0) return ledger;
      return left.effect_index - right.effect_index;
    });

    const balances = await this.db.selectFrom('ledger_balance as b')
      .innerJoin('ledger_definition as d','d.id','b.ledger_definition_id')
      .select([
        'd.code as ledger','b.dimension_hash','b.dimensions',
        'b.quantity','b.amount','b.last_posting_sequence'
      ])
      .where('b.ledger_dataset_id','=',candidateLedger.id)
      .orderBy('d.code')
      .orderBy('b.dimension_hash')
      .execute();

    const prefixCosts = await this.db.selectFrom('cost_result as c')
      .innerJoin('cost_run as r','r.id','c.cost_run_id')
      .innerJoin('posting_input as p','p.business_data_id','c.business_data_id')
      .select([
        'c.business_data_id','c.pool_key','c.method','c.quantity','c.unit_cost',
        'c.total_cost','c.valuation_rule_id','c.valuation_rule_version'
      ])
      .where('c.enterprise_id','=',checkpoint.enterprise_id)
      .where('p.posting_sequence','<=',checkpointBoundary)
      .where('r.economic_runtime_dataset_id','is',null)
      .execute();

    const suffixCosts = await this.db.selectFrom('cost_result as c')
      .innerJoin('cost_run as r','r.id','c.cost_run_id')
      .innerJoin('posting_input as p','p.business_data_id','c.business_data_id')
      .select([
        'c.business_data_id','c.pool_key','c.method','c.quantity','c.unit_cost',
        'c.total_cost','c.valuation_rule_id','c.valuation_rule_version'
      ])
      .where('c.enterprise_id','=',checkpoint.enterprise_id)
      .where('r.economic_runtime_dataset_id','=',candidate.id)
      .where('p.posting_sequence','>',checkpointBoundary)
      .where('p.posting_sequence','<=',request.targetBoundarySequence)
      .execute();

    const costs = [...prefixCosts,...suffixCosts]
      .sort((a,b)=>a.business_data_id.localeCompare(b.business_data_id) || a.pool_key.localeCompare(b.pool_key));

    const prefixAllocations = await this.db.selectFrom('allocation_relation as a')
      .innerJoin('allocation_run as r','r.id','a.allocation_run_id')
      .innerJoin('posting_input as p','p.business_data_id','a.consumer_business_data_id')
      .select([
        'a.source_business_data_id','a.source_position_key','a.consumer_business_data_id',
        'a.measurements','a.allocation_sequence','a.instruction_id',
        'a.allocation_policy_id','a.allocation_policy_version'
      ])
      .where('a.enterprise_id','=',checkpoint.enterprise_id)
      .where('p.posting_sequence','<=',checkpointBoundary)
      .where('r.economic_runtime_dataset_id','is',null)
      .execute();

    const suffixAllocations = await this.db.selectFrom('allocation_relation as a')
      .innerJoin('allocation_run as r','r.id','a.allocation_run_id')
      .innerJoin('posting_input as p','p.business_data_id','a.consumer_business_data_id')
      .select([
        'a.source_business_data_id','a.source_position_key','a.consumer_business_data_id',
        'a.measurements','a.allocation_sequence','a.instruction_id',
        'a.allocation_policy_id','a.allocation_policy_version'
      ])
      .where('a.enterprise_id','=',checkpoint.enterprise_id)
      .where('r.economic_runtime_dataset_id','=',candidate.id)
      .where('p.posting_sequence','>',checkpointBoundary)
      .where('p.posting_sequence','<=',request.targetBoundarySequence)
      .execute();

    const allocations = [...prefixAllocations,...suffixAllocations]
      .sort((a,b)=>a.consumer_business_data_id.localeCompare(b.consumer_business_data_id) || a.allocation_sequence-b.allocation_sequence);

    const prefixPositions = await this.db.selectFrom('valuation_position as v')
      .innerJoin('posting_input as p','p.business_data_id','v.business_data_id')
      .select([
        'v.business_data_id','v.valuation_rule_id','v.valuation_rule_version','v.total_cost'
      ])
      .where('v.enterprise_id','=',checkpoint.enterprise_id)
      .where('v.economic_runtime_dataset_id','is',null)
      .where('p.posting_sequence','<=',checkpointBoundary)
      .execute();

    const suffixPositions = await this.db.selectFrom('valuation_position as v')
      .innerJoin('posting_input as p','p.business_data_id','v.business_data_id')
      .select([
        'v.business_data_id','v.valuation_rule_id','v.valuation_rule_version','v.total_cost'
      ])
      .where('v.enterprise_id','=',checkpoint.enterprise_id)
      .where('v.economic_runtime_dataset_id','=',candidate.id)
      .where('p.posting_sequence','>',checkpointBoundary)
      .where('p.posting_sequence','<=',request.targetBoundarySequence)
      .execute();

    const valuationPositions = [...prefixPositions,...suffixPositions]
      .sort((a,b)=>a.business_data_id.localeCompare(b.business_data_id) || a.valuation_rule_id.localeCompare(b.valuation_rule_id));

    const prefixValuationResults = await this.db.selectFrom('valuation_result as v')
      .innerJoin('valuation_run as r','r.id','v.valuation_run_id')
      .select([
        'v.result_kind','v.position_key','v.source_business_data_ids','v.dimensions',
        'v.source_measurements','v.target_measurements','v.delta_amount','v.delta_unit'
      ])
      .where('v.enterprise_id','=',checkpoint.enterprise_id)
      .where('r.economic_runtime_dataset_id','is',null)
      .execute();

    const suffixValuationResults = await this.db.selectFrom('valuation_result as v')
      .innerJoin('valuation_run as r','r.id','v.valuation_run_id')
      .select([
        'v.result_kind','v.position_key','v.source_business_data_ids','v.dimensions',
        'v.source_measurements','v.target_measurements','v.delta_amount','v.delta_unit'
      ])
      .where('v.enterprise_id','=',checkpoint.enterprise_id)
      .where('r.economic_runtime_dataset_id','=',candidate.id)
      .execute();

    const valuationResults = [...prefixValuationResults,...suffixValuationResults]
      .sort((a,b)=>a.result_kind.localeCompare(b.result_kind) || a.position_key.localeCompare(b.position_key));

    const workItems = await this.db.selectFrom('work_item')
      .select([
        'work_type','title','status','priority','source_ledger_code',
        'source_dimension_hash','source_dimensions','source_quantity','source_amount',
        'assigned_actor_type','assigned_actor_id'
      ])
      .where('enterprise_id','=',checkpoint.enterprise_id)
      .where('economic_runtime_dataset_id','=',candidate.id)
      .orderBy('work_type')
      .orderBy('source_ledger_code')
      .orderBy('source_dimension_hash')
      .execute();

    const semantic: JsonObject = {
      ledgerEntries: entries.map((row)=>({
        ledger:row.ledger,
        businessDataId:row.business_data_id,
        postingRuleId:row.posting_rule_id,
        postingRuleSchemaVersion:row.posting_rule_schema_version,
        effectIndex:row.effect_index,
        quantity:row.quantity,
        amount:row.amount,
        unit:row.unit,
        currency:row.currency,
        dimensions:row.dimensions as JsonObject,
        dimensionHash:row.dimension_hash,
        effectiveAt:iso(row.effective_at),
        postingPriority:row.posting_priority,
        postingSequence:asBigInt(row.posting_sequence).toString(),
        entrySourceKind:row.entry_source_kind,
        valuationRuleId:row.valuation_rule_id,
        valuationRuleVersion:row.valuation_rule_version
      })),
      ledgerBalances: balances.map((row)=>({
        ledger:row.ledger,
        dimensionHash:row.dimension_hash,
        dimensions:row.dimensions as JsonObject,
        quantity:row.quantity,
        amount:row.amount,
        lastPostingSequence:asBigInt(row.last_posting_sequence).toString()
      })),
      costResults: costs.map((row)=>({
        businessDataId:row.business_data_id,
        poolKey:row.pool_key,
        method:row.method,
        quantity:row.quantity,
        unitCost:row.unit_cost,
        totalCost:row.total_cost,
        valuationRuleId:row.valuation_rule_id,
        valuationRuleVersion:row.valuation_rule_version
      })),
      allocationRelations: allocations.map((row)=>({
        sourceBusinessDataId:row.source_business_data_id,
        sourcePositionKey:row.source_position_key,
        consumerBusinessDataId:row.consumer_business_data_id,
        measurements:row.measurements as unknown as JsonValue,
        sequence:row.allocation_sequence,
        instructionId:row.instruction_id,
        allocationPolicyId:row.allocation_policy_id,
        allocationPolicyVersion:row.allocation_policy_version
      })),
      valuationPositions: valuationPositions.map((row)=>({
        businessDataId:row.business_data_id,
        valuationRuleId:row.valuation_rule_id,
        valuationRuleVersion:row.valuation_rule_version,
        totalCost:row.total_cost
      })),
      valuationResults: valuationResults.map((row)=>({
        resultKind:row.result_kind,
        positionKey:row.position_key,
        sourceBusinessDataIds:row.source_business_data_ids as unknown as JsonValue,
        dimensions:row.dimensions as JsonObject,
        sourceMeasurements:row.source_measurements as unknown as JsonValue,
        targetMeasurements:row.target_measurements as unknown as JsonValue,
        deltaAmount:row.delta_amount,
        deltaUnit:row.delta_unit
      })),
      workItems: workItems.map((row)=>({
        workType:row.work_type,
        title:row.title,
        status:row.status,
        priority:row.priority,
        sourceLedgerCode:row.source_ledger_code,
        sourceDimensionHash:row.source_dimension_hash,
        sourceDimensions:row.source_dimensions as JsonObject,
        sourceQuantity:row.source_quantity,
        sourceAmount:row.source_amount,
        assignedActorType:row.assigned_actor_type,
        assignedActorId:row.assigned_actor_id
      }))
    };

    return {
      digest: digestEconomicRuntimeSemantic(semantic),
      familyCounts: {
        ledgerEntries: entries.length,
        ledgerBalances: balances.length,
        costResults: costs.length,
        allocationRelations: allocations.length,
        valuationPositions: valuationPositions.length,
        valuationResults: valuationResults.length,
        workItems: workItems.length
      }
    };
  }
}

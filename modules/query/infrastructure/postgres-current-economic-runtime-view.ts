import { createHash } from 'node:crypto';
import type { Kysely } from 'kysely';
import type { Database } from '../../../platform/database/src/types.js';
import type { JsonObject, JsonValue } from '../../metadata/api/contracts.js';
import type {
  CurrentEconomicRuntimeView,
  CurrentEconomicRuntimeViewService
} from '../api/current-economic-runtime-view.js';

type RuntimeRow = {
  id: string;
  enterprise_id: string;
  consistency_domain: string;
  kind: 'CURRENT'|'CANDIDATE'|'ORACLE'|'ARCHIVED';
  status: 'BUILDING'|'ACTIVE'|'VERIFIED'|'FAILED'|'ARCHIVED';
  parent_dataset_id: string|null;
  start_sequence: unknown|null;
  boundary_sequence: unknown|null;
  semantic_digest: string|null;
};

type Segment = {
  dataset: RuntimeRow;
  sourceRuntimeDatasetId: string|null;
  startSequence: bigint;
  endSequence: bigint;
};

function asBigInt(value: unknown): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isInteger(value)) return BigInt(value);
  if (typeof value === 'string' && /^-?\d+$/.test(value)) return BigInt(value);
  throw new Error('Current runtime overlay contains an invalid sequence.');
}

function iso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  throw new Error('Current runtime overlay contains an invalid timestamp.');
}

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

export class PostgresCurrentEconomicRuntimeViewService
implements CurrentEconomicRuntimeViewService {
  constructor(private readonly db: Kysely<Database>) {}

  async read(
    enterpriseId: string,
    consistencyDomain: string
  ): Promise<CurrentEconomicRuntimeView> {
    return this.db.transaction().setIsolationLevel('repeatable read').execute(async (trx) => {
      const active = await trx.selectFrom('economic_runtime_dataset')
        .select([
          'id','enterprise_id','consistency_domain','kind','status',
          'parent_dataset_id','start_sequence','boundary_sequence','semantic_digest'
        ])
        .where('enterprise_id','=',enterpriseId)
        .where('consistency_domain','=',consistencyDomain)
        .where('status','=','ACTIVE')
        .forShare()
        .executeTakeFirstOrThrow() as RuntimeRow;

      if (active.kind !== 'CURRENT') {
        throw new Error('Current runtime overlay requires one CURRENT/ACTIVE generation.');
      }

      const leafToRoot: RuntimeRow[] = [];
      const visited = new Set<string>();
      let cursor: RuntimeRow|undefined = active;
      while (cursor !== undefined) {
        if (visited.has(cursor.id)) {
          throw new Error('Current runtime overlay generation lineage contains a cycle.');
        }
        if (
          cursor.enterprise_id !== enterpriseId ||
          cursor.consistency_domain !== consistencyDomain
        ) {
          throw new Error('Current runtime overlay generation lineage crosses a semantic scope.');
        }
        visited.add(cursor.id);
        leafToRoot.push(cursor);
        if (cursor.parent_dataset_id === null) break;
        cursor = await trx.selectFrom('economic_runtime_dataset')
          .select([
            'id','enterprise_id','consistency_domain','kind','status',
            'parent_dataset_id','start_sequence','boundary_sequence','semantic_digest'
          ])
          .where('id','=',cursor.parent_dataset_id)
          .executeTakeFirstOrThrow() as RuntimeRow;
      }

      const chain = leafToRoot.reverse();
      if (chain.length > 1 && active.semantic_digest === null) {
        throw new Error('Activated incremental generation is missing its certified semantic digest.');
      }

      for (let index = 1; index < chain.length; index += 1) {
        const parent = chain[index - 1]!;
        const child = chain[index]!;
        if (parent.status !== 'ARCHIVED' || parent.kind !== 'ARCHIVED') {
          throw new Error('Every parent of the active runtime generation must be ARCHIVED.');
        }
        if (child.start_sequence === null || child.boundary_sequence === null) {
          throw new Error('Incremental runtime generation is missing its sequence interval.');
        }
        const start = asBigInt(child.start_sequence);
        const boundary = asBigInt(child.boundary_sequence);
        if (start <= 0n || boundary < start) {
          throw new Error('Incremental runtime generation has an invalid sequence interval.');
        }
        if (
          parent.boundary_sequence !== null &&
          start !== asBigInt(parent.boundary_sequence) + 1n
        ) {
          throw new Error('Current runtime overlay generation intervals are not contiguous.');
        }

        const certification = await trx.selectFrom('runtime_equivalence_certification')
          .select([
            'parent_dataset_id','candidate_semantic_digest','status','activated_at'
          ])
          .where('candidate_dataset_id','=',child.id)
          .where('status','=','CERTIFIED')
          .executeTakeFirst();
        if (
          certification === undefined ||
          certification.parent_dataset_id !== parent.id ||
          certification.activated_at === null ||
          certification.candidate_semantic_digest !== child.semantic_digest
        ) {
          throw new Error('Current runtime overlay contains an uncertified generation transition.');
        }
      }

      const activeBoundary = active.boundary_sequence === null
        ? (() => 0n)()
        : asBigInt(active.boundary_sequence);
      const effectiveActiveBoundary = active.boundary_sequence === null
        ? asBigInt((await trx.selectFrom('enterprise_runtime_state')
            .select('last_posted_sequence')
            .where('enterprise_id','=',enterpriseId)
            .where('consistency_domain','=',consistencyDomain)
            .executeTakeFirstOrThrow()).last_posted_sequence ?? 0)
        : activeBoundary;
      const segments: Segment[] = [];
      for (let index = 0; index < chain.length; index += 1) {
        const dataset = chain[index]!;
        const next = chain[index + 1];
        const startSequence = dataset.start_sequence === null
          ? 1n
          : asBigInt(dataset.start_sequence);
        const endSequence = next?.start_sequence !== null && next?.start_sequence !== undefined
          ? asBigInt(next.start_sequence) - 1n
          : effectiveActiveBoundary;
        const linkedLedger = await trx.selectFrom('ledger_dataset')
          .select('id')
          .where('economic_runtime_dataset_id','=',dataset.id)
          .executeTakeFirst();
        segments.push({
          dataset,
          sourceRuntimeDatasetId: linkedLedger === undefined && index === 0
            ? null
            : dataset.id,
          startSequence,
          endSequence
        });
      }

      const ledgerEntries: Array<Record<string,unknown>> = [];
      const costResults: Array<Record<string,unknown>> = [];
      const allocationRelations: Array<Record<string,unknown>> = [];
      const valuationPositions: Array<Record<string,unknown>> = [];
      const valuationResults: Array<Record<string,unknown>> = [];

      for (const segment of segments) {
        let entryQuery = trx.selectFrom('ledger_entry as e')
          .innerJoin('ledger_definition as d','d.id','e.ledger_definition_id')
          .innerJoin('ledger_dataset as ds','ds.id','e.ledger_dataset_id')
          .select([
            'd.code as ledger','e.business_data_id','e.posting_rule_id',
            'e.posting_rule_schema_version','e.effect_index','e.quantity','e.amount',
            'e.unit','e.currency','e.dimensions','e.dimension_hash','e.effective_at',
            'e.posting_priority','e.posting_sequence','e.entry_source_kind',
            'e.valuation_rule_id','e.valuation_rule_version'
          ])
          .where('e.enterprise_id','=',enterpriseId)
          .where('e.consistency_domain','=',consistencyDomain)
          .where('e.posting_sequence','>=',segment.startSequence)
          .where('e.posting_sequence','<=',segment.endSequence);
        entryQuery = segment.sourceRuntimeDatasetId === null
          ? entryQuery.where('ds.economic_runtime_dataset_id','is',null)
          : entryQuery.where('ds.economic_runtime_dataset_id','=',segment.sourceRuntimeDatasetId);
        ledgerEntries.push(...await entryQuery.execute());

        let costQuery = trx.selectFrom('cost_result as c')
          .innerJoin('cost_run as r','r.id','c.cost_run_id')
          .innerJoin('posting_input as p','p.business_data_id','c.business_data_id')
          .select([
            'c.business_data_id','c.pool_key','c.method','c.quantity','c.unit_cost',
            'c.total_cost','c.valuation_rule_id','c.valuation_rule_version'
          ])
          .where('c.enterprise_id','=',enterpriseId)
          .where('p.consistency_domain','=',consistencyDomain)
          .where('p.posting_sequence','>=',segment.startSequence)
          .where('p.posting_sequence','<=',segment.endSequence);
        costQuery = segment.sourceRuntimeDatasetId === null
          ? costQuery.where('r.economic_runtime_dataset_id','is',null)
          : costQuery.where('r.economic_runtime_dataset_id','=',segment.sourceRuntimeDatasetId);
        costResults.push(...await costQuery.execute());

        let allocationQuery = trx.selectFrom('allocation_relation as a')
          .innerJoin('allocation_run as r','r.id','a.allocation_run_id')
          .innerJoin('posting_input as p','p.business_data_id','a.consumer_business_data_id')
          .select([
            'a.source_business_data_id','a.source_position_key','a.consumer_business_data_id',
            'a.measurements','a.allocation_sequence','a.instruction_id',
            'a.allocation_policy_id','a.allocation_policy_version'
          ])
          .where('a.enterprise_id','=',enterpriseId)
          .where('p.consistency_domain','=',consistencyDomain)
          .where('p.posting_sequence','>=',segment.startSequence)
          .where('p.posting_sequence','<=',segment.endSequence);
        allocationQuery = segment.sourceRuntimeDatasetId === null
          ? allocationQuery.where('r.economic_runtime_dataset_id','is',null)
          : allocationQuery.where('r.economic_runtime_dataset_id','=',segment.sourceRuntimeDatasetId);
        allocationRelations.push(...await allocationQuery.execute());

        let positionQuery = trx.selectFrom('valuation_position as v')
          .innerJoin('posting_input as p','p.business_data_id','v.business_data_id')
          .select([
            'v.business_data_id','v.valuation_rule_id','v.valuation_rule_version','v.total_cost'
          ])
          .where('v.enterprise_id','=',enterpriseId)
          .where('p.consistency_domain','=',consistencyDomain)
          .where('p.posting_sequence','>=',segment.startSequence)
          .where('p.posting_sequence','<=',segment.endSequence);
        positionQuery = segment.sourceRuntimeDatasetId === null
          ? positionQuery.where('v.economic_runtime_dataset_id','is',null)
          : positionQuery.where('v.economic_runtime_dataset_id','=',segment.sourceRuntimeDatasetId);
        valuationPositions.push(...await positionQuery.execute());

        let resultQuery = trx.selectFrom('valuation_result as v')
          .innerJoin('valuation_run as r','r.id','v.valuation_run_id')
          .select([
            'v.result_kind','v.position_key','v.source_business_data_ids','v.dimensions',
            'v.source_measurements','v.target_measurements','v.delta_amount','v.delta_unit'
          ])
          .where('v.enterprise_id','=',enterpriseId);
        resultQuery = segment.sourceRuntimeDatasetId === null
          ? resultQuery.where('r.economic_runtime_dataset_id','is',null)
          : resultQuery.where('r.economic_runtime_dataset_id','=',segment.sourceRuntimeDatasetId);
        valuationResults.push(...await resultQuery.execute());
      }

      ledgerEntries.sort((left,right) => {
        const sequence = Number(asBigInt(left.posting_sequence) - asBigInt(right.posting_sequence));
        if (sequence !== 0) return sequence;
        const ledger = String(left.ledger).localeCompare(String(right.ledger));
        if (ledger !== 0) return ledger;
        const effect = Number(left.effect_index) - Number(right.effect_index);
        if (effect !== 0) return effect;
        const priority = Number(left.posting_priority) - Number(right.posting_priority);
        if (priority !== 0) return priority;
        const source = String(left.entry_source_kind).localeCompare(String(right.entry_source_kind));
        if (source !== 0) return source;
        const business = String(left.business_data_id).localeCompare(String(right.business_data_id));
        if (business !== 0) return business;
        const valuationRule = String(left.valuation_rule_id ?? '').localeCompare(String(right.valuation_rule_id ?? ''));
        if (valuationRule !== 0) return valuationRule;
        return String(left.dimension_hash).localeCompare(String(right.dimension_hash));
      });
      costResults.sort((a,b) => String(a.business_data_id).localeCompare(String(b.business_data_id)) || String(a.pool_key).localeCompare(String(b.pool_key)));
      allocationRelations.sort((a,b) => String(a.consumer_business_data_id).localeCompare(String(b.consumer_business_data_id)) || Number(a.allocation_sequence)-Number(b.allocation_sequence));
      valuationPositions.sort((a,b) => String(a.business_data_id).localeCompare(String(b.business_data_id)) || String(a.valuation_rule_id).localeCompare(String(b.valuation_rule_id)));
      valuationResults.sort((a,b) => String(a.result_kind).localeCompare(String(b.result_kind)) || String(a.position_key).localeCompare(String(b.position_key)));

      const linkedActiveLedger = await trx.selectFrom('ledger_dataset')
        .select('id')
        .where('enterprise_id','=',enterpriseId)
        .where('consistency_domain','=',consistencyDomain)
        .where('economic_runtime_dataset_id','=',active.id)
        .where('kind','=','CURRENT')
        .where('status','=','ACTIVE')
        .executeTakeFirst();
      const activeLedger = linkedActiveLedger ?? (
        chain.length === 1 && active.parent_dataset_id === null
          ? await trx.selectFrom('ledger_dataset')
              .select('id')
              .where('enterprise_id','=',enterpriseId)
              .where('consistency_domain','=',consistencyDomain)
              .where('economic_runtime_dataset_id','is',null)
              .where('kind','=','CURRENT')
              .where('status','=','ACTIVE')
              .executeTakeFirstOrThrow()
          : (() => { throw new Error('CURRENT runtime generation has no active Ledger dataset.'); })()
      );
      const balances = await trx.selectFrom('ledger_balance as b')
        .innerJoin('ledger_definition as d','d.id','b.ledger_definition_id')
        .select([
          'd.code as ledger','b.dimension_hash','b.dimensions',
          'b.quantity','b.amount','b.last_posting_sequence'
        ])
        .where('b.ledger_dataset_id','=',activeLedger.id)
        .orderBy('d.code').orderBy('b.dimension_hash')
        .execute();
      let workQuery = trx.selectFrom('work_item')
        .select([
          'work_type','title','status','priority','source_ledger_code',
          'source_dimension_hash','source_dimensions','source_quantity','source_amount',
          'assigned_actor_type','assigned_actor_id'
        ])
        .where('enterprise_id','=',enterpriseId);
      workQuery = linkedActiveLedger === undefined && chain.length === 1
        ? workQuery.where('economic_runtime_dataset_id','is',null)
        : workQuery.where('economic_runtime_dataset_id','=',active.id);
      const workItems = await workQuery
        .orderBy('work_type').orderBy('source_ledger_code').orderBy('source_dimension_hash')
        .execute();

      const semantic: JsonObject = {
        ledgerEntries: ledgerEntries.map((row)=>({
          ledger:String(row.ledger), businessDataId:String(row.business_data_id),
          postingRuleId:row.posting_rule_id as string|null,
          postingRuleSchemaVersion:Number(row.posting_rule_schema_version),
          effectIndex:Number(row.effect_index), quantity:row.quantity as string|null,
          amount:row.amount as string|null, unit:row.unit as string|null,
          currency:row.currency as string|null, dimensions:row.dimensions as JsonObject,
          dimensionHash:String(row.dimension_hash), effectiveAt:iso(row.effective_at),
          postingPriority:Number(row.posting_priority), postingSequence:asBigInt(row.posting_sequence).toString(),
          entrySourceKind:String(row.entry_source_kind), valuationRuleId:row.valuation_rule_id as string|null,
          valuationRuleVersion:row.valuation_rule_version as number|null
        })),
        ledgerBalances: balances.map((row)=>({
          ledger:row.ledger, dimensionHash:row.dimension_hash,
          dimensions:row.dimensions as JsonObject, quantity:row.quantity, amount:row.amount,
          lastPostingSequence:asBigInt(row.last_posting_sequence).toString()
        })),
        costResults: costResults.map((row)=>({
          businessDataId:row.business_data_id as string, poolKey:row.pool_key as string,
          method:row.method as string, quantity:row.quantity as string,
          unitCost:row.unit_cost as string|null, totalCost:row.total_cost as string|null,
          valuationRuleId:row.valuation_rule_id as string|null,
          valuationRuleVersion:row.valuation_rule_version as number|null
        })),
        allocationRelations: allocationRelations.map((row)=>({
          sourceBusinessDataId:row.source_business_data_id as string|null,
          sourcePositionKey:row.source_position_key as string|null,
          consumerBusinessDataId:row.consumer_business_data_id as string,
          measurements:row.measurements as JsonValue, sequence:Number(row.allocation_sequence),
          instructionId:row.instruction_id as string|null,
          allocationPolicyId:row.allocation_policy_id as string,
          allocationPolicyVersion:Number(row.allocation_policy_version)
        })),
        valuationPositions: valuationPositions.map((row)=>({
          businessDataId:row.business_data_id as string,
          valuationRuleId:row.valuation_rule_id as string,
          valuationRuleVersion:Number(row.valuation_rule_version), totalCost:row.total_cost as string
        })),
        valuationResults: valuationResults.map((row)=>({
          resultKind:row.result_kind as string, positionKey:row.position_key as string,
          sourceBusinessDataIds:row.source_business_data_ids as JsonValue,
          dimensions:row.dimensions as JsonObject,
          sourceMeasurements:row.source_measurements as JsonValue,
          targetMeasurements:row.target_measurements as JsonValue,
          deltaAmount:row.delta_amount as string, deltaUnit:row.delta_unit as string
        })),
        workItems: workItems.map((row)=>({
          workType:row.work_type, title:row.title, status:row.status, priority:row.priority,
          sourceLedgerCode:row.source_ledger_code,
          sourceDimensionHash:row.source_dimension_hash,
          sourceDimensions:row.source_dimensions as JsonObject,
          sourceQuantity:row.source_quantity, sourceAmount:row.source_amount,
          assignedActorType:row.assigned_actor_type, assignedActorId:row.assigned_actor_id
        }))
      };
      const computedSemanticDigest = digest(semantic);
      if (
        active.semantic_digest !== null &&
        computedSemanticDigest !== active.semantic_digest
      ) {
        throw new Error(
          `CURRENT runtime overlay digest mismatch: certified=${active.semantic_digest}, computed=${computedSemanticDigest}`
        );
      }

      return {
        activeRuntimeDatasetId: active.id,
        generationChain: chain.map((dataset)=>dataset.id),
        certifiedActivationDigest: active.semantic_digest,
        computedSemanticDigest,
        semantic,
        familyCounts: {
          ledgerEntries: ledgerEntries.length,
          ledgerBalances: balances.length,
          costResults: costResults.length,
          allocationRelations: allocationRelations.length,
          valuationPositions: valuationPositions.length,
          valuationResults: valuationResults.length,
          workItems: workItems.length
        }
      };
    });
  }
}

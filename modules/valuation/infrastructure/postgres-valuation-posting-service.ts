import { sql, type Kysely } from 'kysely';
import { AppError } from '../../../platform/contracts/src/index.js';
import type { Database } from '../../../platform/database/src/types.js';
import type { DatabaseTransaction } from '../../../platform/database/src/transaction.js';
import type { JsonObject, JsonValue } from '../../metadata/api/contracts.js';
import type { MaterializationContext } from '../../materialization/api/context.js';
import { dimensionHash } from '../../ledger/domain/canonical-json.js';
import { evaluateExpression } from '../../posting/domain/expression-engine.js';
import { validateDimensionPolicy } from '../../dimensions/domain/dimension-policy.js';
import type { LedgerDimensionPolicy } from '../../dimensions/api/contracts.js';
import type { ValuationPostingResult, ValuationPostingService } from '../api/contracts.js';
import { valuationDelta } from '../domain/valuation-delta.js';

function isJsonValue(value: unknown): value is JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJsonValue);
  if (typeof value === 'object') return Object.values(value as Record<string, unknown>).every(isJsonValue);
  return false;
}
function asJsonObject(value: Record<string, unknown>, label: string): JsonObject {
  if (!isJsonValue(value) || Array.isArray(value)) {
    throw new AppError({code:'VALUATION_JSON_INVALID',message:`${label} must contain JSON values only.`,module:'valuation',operation:'postCostResult'});
  }
  return value;
}

export class PostgresValuationPostingService implements ValuationPostingService {
  constructor(private readonly db: Kysely<Database>) {}

  async postCostResult(
    costResultId: string,
    materialization?: MaterializationContext
  ): Promise<ValuationPostingResult> {
    return this.db.transaction().execute(async (trx) => {
      const cost = await trx.selectFrom('cost_result').selectAll().where('id', '=', costResultId).executeTakeFirstOrThrow();
      if (cost.total_cost === null || cost.valuation_rule_id === null || cost.valuation_rule_version === null) {
        throw new AppError({code:'VALUATION_COST_RESULT_NOT_PINNED',message:'CostResult must pin a valuation rule and contain total_cost.',module:'valuation',operation:'postCostResult',details:{costResultId}});
      }
      const rule = await trx.selectFrom('valuation_rule').selectAll().where('id','=',cost.valuation_rule_id).where('version','=',cost.valuation_rule_version).executeTakeFirstOrThrow();
      const business = await trx.selectFrom('business_data').select(['id','payload','effective_at']).where('id','=',cost.business_data_id).executeTakeFirstOrThrow();
      const postingInput = await trx.selectFrom('posting_input').select(['consistency_domain','posting_priority','posting_sequence']).where('business_data_id','=',business.id).executeTakeFirstOrThrow();
      let existingQuery = trx.selectFrom('valuation_position')
        .selectAll()
        .where('enterprise_id','=',cost.enterprise_id)
        .where('business_data_id','=',cost.business_data_id)
        .where('valuation_rule_id','=',rule.id);
      existingQuery = materialization === undefined
        ? existingQuery.where('economic_runtime_dataset_id','is',null)
        : existingQuery.where('economic_runtime_dataset_id','=',materialization.runtimeDatasetId);
      const existing = await existingQuery.forUpdate().executeTakeFirst();
      const { previous, target, delta } = valuationDelta(existing?.total_cost ?? '0', cost.total_cost);
      const run = await trx.insertInto('valuation_posting_run').values({enterprise_id:cost.enterprise_id,cost_run_id:cost.cost_run_id,cost_result_id:cost.id,business_data_id:cost.business_data_id,valuation_rule_id:rule.id,valuation_rule_version:rule.version,previous_total_cost:previous.toString(),target_total_cost:target.toString(),delta_total_cost:delta.toString(),status:delta.isZero()?'NO_CHANGE':'PROCESSING',completed_at:delta.isZero()?sql`now()`:null,error:null}).returning('id').executeTakeFirstOrThrow();
      if (delta.isZero()) {
        if (existing === undefined) await trx.insertInto('valuation_position').values({
          enterprise_id:cost.enterprise_id,
          economic_runtime_dataset_id:materialization?.runtimeDatasetId ?? null,
          business_data_id:cost.business_data_id,
          valuation_rule_id:rule.id,
          valuation_rule_version:rule.version,
          total_cost:target.toString(),
          last_cost_result_id:cost.id
        }).execute();
        return {valuationPostingRunId:run.id,status:'NO_CHANGE',ledgerEffectCount:0,deltaTotalCost:'0'};
      }
      const mapping=asJsonObject(rule.dimension_mapping,'valuation_rule.dimension_mapping');
      const payload=asJsonObject(business.payload,'business_data.payload');
      const dimensions = this.resolveDimensions(mapping, payload);
      const datasetId = await this.ensureDataset(
        trx,
        cost.enterprise_id,
        postingInput.consistency_domain,
        materialization
      );
      const knownRows = await trx.selectFrom('dimension_definition').select('code').where('status','=','PUBLISHED').where((eb)=>eb.or([eb('enterprise_id','is',null),eb('enterprise_id','=',cost.enterprise_id)])).execute();
      const known = new Set(knownRows.map((row)=>row.code));
      const effects=[{ledgerCode:rule.inventory_ledger_code,amount:delta.negated()},{ledgerCode:rule.cogs_ledger_code,amount:delta}] as const;
      for(let index=0;index<effects.length;index+=1){
        const effect=effects[index]!;
        const ledger=await trx.selectFrom('ledger_definition').select(['id','code','dimension_schema']).where('code','=',effect.ledgerCode).executeTakeFirst();
        if(ledger===undefined) throw new AppError({code:'VALUATION_LEDGER_NOT_FOUND',message:`Valuation rule targets unknown ledger ${effect.ledgerCode}.`,module:'valuation',operation:'postCostResult'});
        validateDimensionPolicy(ledger.code,ledger.dimension_schema as unknown as LedgerDimensionPolicy,dimensions,known);
        const hash=dimensionHash(dimensions);
        await trx.insertInto('ledger_entry').values({enterprise_id:cost.enterprise_id,consistency_domain:postingInput.consistency_domain,ledger_dataset_id:datasetId,ledger_definition_id:ledger.id,posting_run_id:null,posting_input_id:null,business_data_id:cost.business_data_id,posting_rule_id:null,posting_rule_schema_version:0,effect_index:index,quantity:'0',amount:effect.amount.toString(),unit:null,currency:null,dimensions,dimension_hash:hash,effective_at:business.effective_at,posting_priority:postingInput.posting_priority+1000000,posting_sequence:postingInput.posting_sequence,entry_source_kind:'VALUATION',valuation_posting_run_id:run.id,cost_result_id:cost.id,valuation_rule_id:rule.id,valuation_rule_version:rule.version}).execute();
        await trx.insertInto('ledger_balance').values({enterprise_id:cost.enterprise_id,consistency_domain:postingInput.consistency_domain,ledger_dataset_id:datasetId,ledger_definition_id:ledger.id,dimension_hash:hash,dimensions,quantity:'0',amount:effect.amount.toString(),last_effective_at:business.effective_at,last_posting_priority:postingInput.posting_priority+1000000,last_posting_sequence:postingInput.posting_sequence}).onConflict((oc)=>oc.columns(['ledger_dataset_id','ledger_definition_id','dimension_hash']).doUpdateSet({
          amount:sql`ledger_balance.amount + excluded.amount`,
          last_effective_at:sql`case when (excluded.last_effective_at, excluded.last_posting_priority, excluded.last_posting_sequence) > (ledger_balance.last_effective_at, ledger_balance.last_posting_priority, ledger_balance.last_posting_sequence) then excluded.last_effective_at else ledger_balance.last_effective_at end`,
          last_posting_priority:sql`case when (excluded.last_effective_at, excluded.last_posting_priority, excluded.last_posting_sequence) > (ledger_balance.last_effective_at, ledger_balance.last_posting_priority, ledger_balance.last_posting_sequence) then excluded.last_posting_priority else ledger_balance.last_posting_priority end`,
          last_posting_sequence:sql`case when (excluded.last_effective_at, excluded.last_posting_priority, excluded.last_posting_sequence) > (ledger_balance.last_effective_at, ledger_balance.last_posting_priority, ledger_balance.last_posting_sequence) then excluded.last_posting_sequence else ledger_balance.last_posting_sequence end`,
          updated_at:sql`now()`
        })).execute();
      }
      await trx.insertInto('valuation_position').values({
        enterprise_id:cost.enterprise_id,
        economic_runtime_dataset_id:materialization?.runtimeDatasetId ?? null,
        business_data_id:cost.business_data_id,
        valuation_rule_id:rule.id,
        valuation_rule_version:rule.version,
        total_cost:target.toString(),
        last_cost_result_id:cost.id
      }).onConflict((oc)=>oc.columns([
        'enterprise_id',
        'economic_runtime_dataset_id',
        'business_data_id',
        'valuation_rule_id'
      ]).doUpdateSet({
        valuation_rule_version:rule.version,
        total_cost:target.toString(),
        last_cost_result_id:cost.id,
        updated_at:sql`now()`
      })).execute();
      await trx.updateTable('valuation_posting_run').set({status:'COMPLETED',completed_at:sql`now()`}).where('id','=',run.id).execute();
      return {valuationPostingRunId:run.id,status:'POSTED',ledgerEffectCount:2,deltaTotalCost:delta.toString()};
    });
  }

  private resolveDimensions(mapping: Readonly<Record<string, JsonValue>>, payload: JsonObject): JsonObject {
    const result: Record<string, JsonValue> = {};
    for (const [code, expression] of Object.entries(mapping)) {
      if (expression === null) continue;
      const value = evaluateExpression(expression, { payload });
      if (value !== null && value !== '') result[code] = value;
    }
    return result;
  }

  private async ensureDataset(
    trx: DatabaseTransaction,
    enterpriseId: string,
    consistencyDomain: string,
    materialization?: MaterializationContext
  ): Promise<string> {
    if (materialization !== undefined && materialization.mode !== 'CURRENT') {
      const existing = await trx.selectFrom('ledger_dataset')
        .select('id')
        .where('enterprise_id','=',enterpriseId)
        .where('consistency_domain','=',consistencyDomain)
        .where('economic_runtime_dataset_id','=',materialization.runtimeDatasetId)
        .where('kind','=','CANDIDATE')
        .where('status','=','BUILDING')
        .executeTakeFirst();
      if (existing !== undefined) return existing.id;

      return (await trx.insertInto('ledger_dataset').values({
        enterprise_id:enterpriseId,
        consistency_domain:consistencyDomain,
        economic_runtime_dataset_id:materialization.runtimeDatasetId,
        kind:'CANDIDATE',
        status:'BUILDING',
        posting_boundary_sequence:null,
        activated_at:null
      }).returning('id').executeTakeFirstOrThrow()).id;
    }

    let query = trx.selectFrom('ledger_dataset')
      .select('id')
      .where('enterprise_id','=',enterpriseId)
      .where('consistency_domain','=',consistencyDomain)
      .where('status','=','ACTIVE');

    if (materialization !== undefined) {
      query = query.where(
        'economic_runtime_dataset_id',
        '=',
        materialization.runtimeDatasetId
      );
    }

    const existing = await query.executeTakeFirst();
    if(existing!==undefined)return existing.id;

    if (materialization !== undefined) {
      const legacy = await trx.selectFrom('ledger_dataset')
        .select('id')
        .where('enterprise_id','=',enterpriseId)
        .where('consistency_domain','=',consistencyDomain)
        .where('status','=','ACTIVE')
        .where('economic_runtime_dataset_id','is',null)
        .executeTakeFirst();
      if (legacy !== undefined) {
        await trx.updateTable('ledger_dataset')
          .set({ economic_runtime_dataset_id: materialization.runtimeDatasetId })
          .where('id','=',legacy.id)
          .where('economic_runtime_dataset_id','is',null)
          .execute();
        return legacy.id;
      }
    }

    return (await trx.insertInto('ledger_dataset').values({
      enterprise_id:enterpriseId,
      consistency_domain:consistencyDomain,
      economic_runtime_dataset_id:materialization?.runtimeDatasetId ?? null,
      kind:'CURRENT',
      status:'ACTIVE',
      posting_boundary_sequence:null,
      activated_at:sql`now()`
    }).returning('id').executeTakeFirstOrThrow()).id;
  }
}

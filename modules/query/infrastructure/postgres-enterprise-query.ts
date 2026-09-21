import { createHash } from 'node:crypto';
import type { Kysely } from 'kysely';
import type { Database } from '../../../platform/database/src/types.js';
import type {
  EnterpriseDashboard,
  EnterpriseQuery
} from '../api/contracts.js';
import type { CurrentEconomicRuntimeViewService } from '../api/current-economic-runtime-view.js';

export class PostgresEnterpriseQuery implements EnterpriseQuery {
  constructor(
    private readonly db: Kysely<Database>,
    private readonly currentRuntime: CurrentEconomicRuntimeViewService
  ) {}

  async dashboard(enterpriseId: string): Promise<EnterpriseDashboard> {
    const runtime = await this.db.selectFrom('enterprise_runtime_state')
      .selectAll()
      .where('enterprise_id','=',enterpriseId)
      .executeTakeFirstOrThrow();
    const activeGeneration = await this.db.selectFrom('economic_runtime_dataset')
      .select('id')
      .where('enterprise_id','=',enterpriseId)
      .where('consistency_domain','=',runtime.consistency_domain)
      .where('status','=','ACTIVE')
      .executeTakeFirst();
    const current = activeGeneration === undefined
      ? null
      : await this.currentRuntime.read(
          enterpriseId,
          runtime.consistency_domain
        );

    const [enterprise, recentBusinessData, postingInputs, costRuns, valuationPostingRuns, flowTraces, replayRuns] =
      await Promise.all([
        this.db.selectFrom('enterprise').selectAll().where('id','=',enterpriseId).executeTakeFirst(),
        this.db.selectFrom('business_data').select([
          'id','business_data_type','business_object_key','business_object_version','effective_at','payload'
        ]).where('enterprise_id','=',enterpriseId)
          .orderBy('created_at','desc').limit(30).execute(),
        this.db.selectFrom('posting_input').select([
          'id','status','retroactive','effective_at','posting_priority','posting_sequence'
        ]).where('enterprise_id','=',enterpriseId)
          .orderBy('posting_sequence','desc').limit(30).execute(),
        this.db.selectFrom('cost_run').selectAll().where('enterprise_id','=',enterpriseId)
          .orderBy('started_at','desc').limit(10).execute(),
        this.db.selectFrom('valuation_posting_run').selectAll().where('enterprise_id','=',enterpriseId)
          .orderBy('created_at','desc').limit(30).execute(),
        this.db.selectFrom('flow_trace as t')
          .innerJoin('flow_definition as f','f.id','t.flow_definition_id')
          .innerJoin('flow_instance as i','i.id','t.flow_instance_id')
          .select(['t.id','f.code as flow','i.instance_key','t.step_code','t.business_data_id','t.command_execution_id','t.correlation_id','t.causation_id','t.created_at'])
          .where('t.enterprise_id','=',enterpriseId)
          .orderBy('t.created_at','desc').limit(50).execute(),
        this.db.selectFrom('replay_run').selectAll().where('enterprise_id','=',enterpriseId)
          .orderBy('started_at','desc').limit(10).execute()
      ]);

    const balances = current === null
      ? await this.db.selectFrom('ledger_balance as b')
          .innerJoin('ledger_definition as d','d.id','b.ledger_definition_id')
          .innerJoin('ledger_dataset as ds','ds.id','b.ledger_dataset_id')
          .select(['d.code as ledger','b.dimensions','b.quantity','b.amount','b.last_posting_sequence'])
          .where('b.enterprise_id','=',enterpriseId)
          .where('b.consistency_domain','=',runtime.consistency_domain)
          .where('ds.economic_runtime_dataset_id','is',null)
          .where('ds.kind','=','CURRENT')
          .where('ds.status','=','ACTIVE')
          .orderBy('d.code').execute()
      : Array.isArray(current.semantic.ledgerBalances)
        ? current.semantic.ledgerBalances
        : [];
    const workItems = current === null
      ? await this.db.selectFrom('work_item').selectAll()
          .where('enterprise_id','=',enterpriseId)
          .where('economic_runtime_dataset_id','is',null)
          .orderBy('priority','desc').orderBy('created_at','desc').limit(50).execute()
      : Array.isArray(current.semantic.workItems)
        ? current.semantic.workItems
        : [];
    const costResults = current === null
      ? await this.db.selectFrom('cost_result as c')
          .innerJoin('cost_run as r','r.id','c.cost_run_id')
          .selectAll('c')
          .where('c.enterprise_id','=',enterpriseId)
          .where('r.economic_runtime_dataset_id','is',null)
          .orderBy('c.created_at','desc').limit(30).execute()
      : Array.isArray(current.semantic.costResults)
        ? current.semantic.costResults
        : [];

    return { enterprise, runtime, balances, workItems, recentBusinessData, postingInputs, costRuns, costResults, valuationPostingRuns, flowTraces, replayRuns };
  }

  async balanceDigest(enterpriseId: string): Promise<string> {
    const runtime = await this.db.selectFrom('enterprise_runtime_state')
      .select('consistency_domain')
      .where('enterprise_id','=',enterpriseId)
      .executeTakeFirstOrThrow();
    const activeGeneration = await this.db.selectFrom('economic_runtime_dataset')
      .select('id')
      .where('enterprise_id','=',enterpriseId)
      .where('consistency_domain','=',runtime.consistency_domain)
      .where('status','=','ACTIVE')
      .executeTakeFirst();
    const balances = activeGeneration === undefined
      ? await this.db.selectFrom('ledger_balance as b')
          .innerJoin('ledger_definition as d','d.id','b.ledger_definition_id')
          .innerJoin('ledger_dataset as ds','ds.id','b.ledger_dataset_id')
          .select(['d.code as ledger','b.dimension_hash','b.quantity','b.amount'])
          .where('b.enterprise_id','=',enterpriseId)
          .where('b.consistency_domain','=',runtime.consistency_domain)
          .where('ds.economic_runtime_dataset_id','is',null)
          .where('ds.kind','=','CURRENT')
          .where('ds.status','=','ACTIVE')
          .orderBy('d.code').orderBy('b.dimension_hash').execute()
      : (() => null)();
    const routedBalances = balances ?? (() => {
      throw new Error('Generation-aware balance digest routing was not resolved.');
    })();

    return createHash('sha256')
      .update(JSON.stringify(
        activeGeneration === undefined
          ? routedBalances
          : await this.currentRuntime.read(
              enterpriseId,
              runtime.consistency_domain
            ).then((view) => Array.isArray(view.semantic.ledgerBalances)
              ? view.semantic.ledgerBalances
              : [])
      ))
      .digest('hex');
  }
}

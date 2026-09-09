import { createHash } from 'node:crypto';
import type { Kysely } from 'kysely';
import type { Database } from '../../../platform/database/src/types.js';
import type {
  EnterpriseDashboard,
  EnterpriseQuery
} from '../api/contracts.js';

export class PostgresEnterpriseQuery implements EnterpriseQuery {
  constructor(private readonly db: Kysely<Database>) {}

  async dashboard(enterpriseId: string): Promise<EnterpriseDashboard> {
    const [enterprise, runtime, balances, workItems, recentBusinessData, postingInputs, costRuns, replayRuns] =
      await Promise.all([
        this.db.selectFrom('enterprise').selectAll().where('id','=',enterpriseId).executeTakeFirst(),
        this.db.selectFrom('enterprise_runtime_state').selectAll().where('enterprise_id','=',enterpriseId).executeTakeFirst(),
        this.db.selectFrom('ledger_balance as b')
          .innerJoin('ledger_definition as d','d.id','b.ledger_definition_id')
          .select(['d.code as ledger','b.dimensions','b.quantity','b.amount','b.last_posting_sequence'])
          .where('b.enterprise_id','=',enterpriseId)
          .orderBy('d.code').execute(),
        this.db.selectFrom('work_item').selectAll()
          .where('enterprise_id','=',enterpriseId)
          .orderBy('priority','desc').orderBy('created_at','desc').limit(50).execute(),
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
        this.db.selectFrom('replay_run').selectAll().where('enterprise_id','=',enterpriseId)
          .orderBy('started_at','desc').limit(10).execute()
      ]);

    return { enterprise, runtime, balances, workItems, recentBusinessData, postingInputs, costRuns, replayRuns };
  }

  async balanceDigest(enterpriseId: string): Promise<string> {
    const rows = await this.db
      .selectFrom('ledger_balance as b')
      .innerJoin('ledger_definition as d','d.id','b.ledger_definition_id')
      .select(['d.code as ledger','b.dimension_hash','b.quantity','b.amount'])
      .where('b.enterprise_id','=',enterpriseId)
      .orderBy('d.code').orderBy('b.dimension_hash').execute();

    return createHash('sha256')
      .update(JSON.stringify(rows))
      .digest('hex');
  }
}

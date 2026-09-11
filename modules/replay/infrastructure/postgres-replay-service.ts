import { createHash } from 'node:crypto';
import { sql, type Kysely } from 'kysely';
import type { Database } from '../../../platform/database/src/types.js';
import type {
  ReplayResult,
  ReplayService
} from '../api/contracts.js';

export class PostgresReplayService implements ReplayService {
  constructor(private readonly db: Kysely<Database>) {}

  async prepareFullReplay(enterpriseId: string): Promise<ReplayResult> {
    return this.db.transaction().execute(async (trx) => {
      const runtime = await trx
        .selectFrom('enterprise_runtime_state')
        .selectAll()
        .where('enterprise_id', '=', enterpriseId)
        .forUpdate()
        .executeTakeFirstOrThrow();

      const boundary = BigInt(runtime.next_posting_sequence) - 1n;

      const balances = await trx
        .selectFrom('ledger_balance as b')
        .innerJoin('ledger_definition as d','d.id','b.ledger_definition_id')
        .select(['d.code as ledger','b.dimension_hash','b.quantity','b.amount'])
        .where('b.enterprise_id', '=', enterpriseId)
        .orderBy('d.code')
        .orderBy('b.dimension_hash')
        .execute();

      const beforeSnapshot = balances.map((row) => ({
        ledger: row.ledger,
        dimension_hash: row.dimension_hash,
        quantity: row.quantity,
        amount: row.amount
      }));
      const beforeDigest = createHash('sha256')
        .update(JSON.stringify(beforeSnapshot))
        .digest('hex');

      const run = await trx
        .insertInto('replay_run')
        .values({
          enterprise_id: enterpriseId,
          consistency_domain: runtime.consistency_domain,
          mode: 'FULL',
          status: 'REBUILDING',
          boundary_sequence: boundary,
          before_digest: beforeDigest,
          before_snapshot: beforeSnapshot,
          after_digest: null,
          validation_status: 'NOT_VALIDATED',
          completed_at: null,
          error: null
        })
        .returning('id')
        .executeTakeFirstOrThrow();

      await trx
        .updateTable('enterprise_runtime_state')
        .set({
          posting_mode: 'REPLAYING',
          replay_required: false,
          last_posted_effective_at: null,
          last_posted_priority: null,
          last_posted_sequence: null,
          active_replay_run_id: run.id,
          updated_at: sql`now()`
        })
        .where('enterprise_id', '=', enterpriseId)
        .execute();

      const datasetIds = await trx
        .selectFrom('ledger_dataset')
        .select('id')
        .where('enterprise_id', '=', enterpriseId)
        .execute();

      const ids = datasetIds.map((x) => x.id);
      if (ids.length > 0) {
        await trx.deleteFrom('ledger_balance')
          .where('ledger_dataset_id', 'in', ids).execute();
        await trx.deleteFrom('ledger_entry')
          .where('ledger_dataset_id', 'in', ids).execute();
      }

      await trx.deleteFrom('posting_run')
        .where('enterprise_id', '=', enterpriseId).execute();
      await trx.deleteFrom('posting_failure')
        .where('enterprise_id', '=', enterpriseId).execute();

      await trx
        .updateTable('posting_input')
        .set({
          status: 'QUEUED',
          retroactive: false,
          posted_at: null
        })
        .where('enterprise_id', '=', enterpriseId)
        .where('posting_sequence', '<=', boundary)
        .execute();

      await trx
        .updateTable('enterprise_runtime_state')
        .set({
          posting_mode: 'NORMAL',
          updated_at: sql`now()`
        })
        .where('enterprise_id', '=', enterpriseId)
        .execute();

      return {
        replayRunId: run.id,
        boundarySequence: boundary,
        beforeDigest
      };
    });
  }

  async completeFullReplay(
    replayRunId: string,
    enterpriseId: string,
    afterDigest: string
  ): Promise<void> {
    await this.db.transaction().execute(async (trx) => {
      const run = await trx.selectFrom('replay_run')
        .select('before_digest')
        .where('id', '=', replayRunId)
        .executeTakeFirstOrThrow();

      await trx.updateTable('replay_run')
        .set({
          status: 'COMPLETED',
          after_digest: afterDigest,
          validation_status: run.before_digest === afterDigest ? 'MATCH' : 'MISMATCH',
          completed_at: sql`now()`
        })
        .where('id', '=', replayRunId)
        .execute();

      await trx.updateTable('enterprise_runtime_state')
        .set({
          active_replay_run_id: null,
          posting_mode: 'NORMAL',
          updated_at: sql`now()`
        })
        .where('enterprise_id', '=', enterpriseId)
        .execute();
    });
  }
}

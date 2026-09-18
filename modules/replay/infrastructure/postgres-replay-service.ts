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

      const latestCostRun = await trx.selectFrom('cost_run')
        .select(['id','method','valuation_policy_id','valuation_policy_version','allocation_policy_id','allocation_policy_version'])
        .where('enterprise_id','=',enterpriseId)
        .where('status','=','COMPLETED')
        .orderBy('started_at','desc')
        .executeTakeFirst();

      const valuationRulePins: Record<string, { id: string; version: number }> = {};
      if (latestCostRun !== undefined) {
        const pinnedRows = await trx.selectFrom('cost_result as c')
          .innerJoin('business_data as b','b.id','c.business_data_id')
          .select(['b.business_data_type','c.valuation_rule_id','c.valuation_rule_version'])
          .where('c.cost_run_id','=',latestCostRun.id)
          .where('c.valuation_rule_id','is not',null)
          .where('c.valuation_rule_version','is not',null)
          .execute();
        for (const row of pinnedRows) {
          if (row.valuation_rule_id !== null && row.valuation_rule_version !== null) {
            valuationRulePins[row.business_data_type] = {
              id: row.valuation_rule_id,
              version: row.valuation_rule_version
            };
          }
        }
      }

      // node-postgres serializes top-level arrays as PostgreSQL array literals. These columns are jsonb,
      // so serialize explicitly at the infrastructure boundary to preserve the JSON array/object shape.
      const beforeSnapshotJson = JSON.stringify(beforeSnapshot);
      const valuationRulePinsJson = JSON.stringify(valuationRulePins);

      const run = await trx
        .insertInto('replay_run')
        .values({
          enterprise_id: enterpriseId,
          consistency_domain: runtime.consistency_domain,
          mode: 'FULL',
          status: 'REBUILDING',
          boundary_sequence: boundary,
          before_digest: beforeDigest,
          before_snapshot: sql`${beforeSnapshotJson}::jsonb`,
          after_digest: null,
          validation_status: 'NOT_VALIDATED',
          completed_at: null,
          error: null,
          cost_method: latestCostRun?.method ?? null,
          valuation_policy_id: latestCostRun?.valuation_policy_id ?? null,
          valuation_policy_version: latestCostRun?.valuation_policy_version ?? null,
          allocation_policy_id: latestCostRun?.allocation_policy_id ?? null,
          allocation_policy_version: latestCostRun?.allocation_policy_version ?? null,
          valuation_rule_pins: sql`${valuationRulePinsJson}::jsonb`
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

      await trx.deleteFrom('valuation_position')
        .where('enterprise_id', '=', enterpriseId).execute();
      await trx.deleteFrom('valuation_posting_run')
        .where('enterprise_id', '=', enterpriseId).execute();

      // Generic valuation runs/results (including FX period-end and realized settlement)
      // are derived interpretation state. Canonical BusinessData and RateDataset survive replay.
      const valuationRunIds = await trx.selectFrom('valuation_run')
        .select('id')
        .where('enterprise_id','=',enterpriseId)
        .execute();
      const derivedValuationRunIds = valuationRunIds.map((row) => row.id);
      if (derivedValuationRunIds.length > 0) {
        await trx.deleteFrom('valuation_result')
          .where('valuation_run_id','in',derivedValuationRunIds)
          .execute();
        await trx.deleteFrom('valuation_run')
          .where('id','in',derivedValuationRunIds)
          .execute();
      }
      await trx.deleteFrom('cost_result')
        .where('enterprise_id', '=', enterpriseId).execute();
      await trx.deleteFrom('cost_run')
        .where('enterprise_id', '=', enterpriseId).execute();

      // Allocation instructions are canonical business intent and must survive replay.
      // Allocation runs/relations are derived interpretation results and are rebuilt.
      const allocationRunIds = await trx.selectFrom('allocation_run')
        .select('id')
        .where('enterprise_id','=',enterpriseId)
        .execute();
      const derivedAllocationRunIds = allocationRunIds.map((row) => row.id);
      if (derivedAllocationRunIds.length > 0) {
        await trx.deleteFrom('allocation_relation')
          .where('allocation_run_id','in',derivedAllocationRunIds)
          .execute();
        await trx.deleteFrom('allocation_run')
          .where('id','in',derivedAllocationRunIds)
          .execute();
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
        beforeDigest,
        costMethod: latestCostRun?.method ?? null,
        costPins: latestCostRun === undefined ? null : {
          ...(latestCostRun.valuation_policy_id !== null && latestCostRun.valuation_policy_version !== null
            ? { valuationPolicyId: latestCostRun.valuation_policy_id, valuationPolicyVersion: latestCostRun.valuation_policy_version }
            : {}),
          ...(latestCostRun.allocation_policy_id !== null && latestCostRun.allocation_policy_version !== null
            ? { allocationPolicyId: latestCostRun.allocation_policy_id, allocationPolicyVersion: latestCostRun.allocation_policy_version }
            : {}),
          valuationRules: valuationRulePins
        }
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

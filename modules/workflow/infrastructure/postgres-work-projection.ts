import { sql, type Kysely } from 'kysely';
import type { Database } from '../../../platform/database/src/types.js';
import type { JsonObject } from '../../metadata/api/contracts.js';
import type { MaterializationContext } from '../../materialization/api/context.js';
import type {
  WorkItemView,
  WorkProjection
} from '../api/contracts.js';

const workTypeByLedger: Record<string, { type: string; title: string; priority: number }> = {
  pending_production: { type: 'PRODUCE', title: '待生产', priority: 30 },
  pending_shipment: { type: 'SHIP', title: '待出库/发货', priority: 20 },
  receivable: { type: 'COLLECT', title: '待收款', priority: 10 }
};

export class PostgresWorkProjection implements WorkProjection {
  constructor(private readonly db: Kysely<Database>) {}

  async refresh(
    enterpriseId: string,
    materialization?: MaterializationContext
  ): Promise<number> {
    let query = this.db
      .selectFrom('ledger_balance as b')
      .innerJoin('ledger_definition as d', 'd.id', 'b.ledger_definition_id')
      .innerJoin('ledger_dataset as ds', 'ds.id', 'b.ledger_dataset_id')
      .select([
        'd.code as ledger_code',
        'b.dimension_hash',
        'b.dimensions',
        'b.quantity',
        'b.amount'
      ])
      .where('b.enterprise_id', '=', enterpriseId);

    query = materialization?.mode === 'CANDIDATE'
      ? query
          .where('ds.economic_runtime_dataset_id','=',materialization.runtimeDatasetId)
          .where('ds.kind','=','CANDIDATE')
          .where('ds.status','=','BUILDING')
      : query.where('ds.status', '=', 'ACTIVE');

    const balances = await query.execute();

    let changed = 0;
    for (const row of balances) {
      const mapping = workTypeByLedger[row.ledger_code];
      if (mapping === undefined) continue;

      const positive =
        Number(row.quantity) > 0 || Number(row.amount) > 0;

      await this.db
        .insertInto('work_item')
        .values({
          enterprise_id: enterpriseId,
          economic_runtime_dataset_id: materialization?.runtimeDatasetId ?? null,
          work_type: mapping.type,
          title: mapping.title,
          status: positive ? 'OPEN' : 'DONE',
          priority: mapping.priority,
          source_ledger_code: row.ledger_code,
          source_dimension_hash: row.dimension_hash,
          source_dimensions: row.dimensions,
          source_quantity: row.quantity,
          source_amount: row.amount,
          assigned_actor_type: null,
          assigned_actor_id: null,
          completed_at: positive ? null : sql`now()`
        })
        .onConflict((oc) =>
          oc.columns([
            'enterprise_id',
            'economic_runtime_dataset_id',
            'work_type',
            'source_ledger_code',
            'source_dimension_hash'
          ]).doUpdateSet({
            status: positive ? 'OPEN' : 'DONE',
            source_quantity: row.quantity,
            source_amount: row.amount,
            updated_at: sql`now()`,
            completed_at: positive ? null : sql`now()`
          })
        )
        .execute();
      changed += 1;
    }

    return changed;
  }

  async listOpen(
    enterpriseId: string,
    materialization?: MaterializationContext
  ): Promise<readonly WorkItemView[]> {
    let query = this.db
      .selectFrom('work_item')
      .selectAll()
      .where('enterprise_id', '=', enterpriseId)
      .where('status', 'in', ['OPEN', 'IN_PROGRESS']);

    query = materialization === undefined
      ? query.where('economic_runtime_dataset_id','is',null)
      : query.where('economic_runtime_dataset_id','=',materialization.runtimeDatasetId);

    const rows = await query
      .orderBy('priority', 'desc')
      .orderBy('created_at')
      .execute();

    return rows.map((row) => ({
      id: row.id,
      workType: row.work_type,
      title: row.title,
      status: row.status,
      priority: row.priority,
      sourceLedgerCode: row.source_ledger_code,
      dimensions: row.source_dimensions as JsonObject,
      quantity: row.source_quantity,
      amount: row.source_amount
    }));
  }
}

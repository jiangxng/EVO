import { sql, type Kysely } from 'kysely';
import type { Database } from '../../../platform/database/src/types.js';
import type { JsonObject } from '../../metadata/api/contracts.js';
import type { MaterializationContext } from '../../materialization/api/context.js';
import type {
  WorkItemView,
  WorkProjection
} from '../api/contracts.js';


type CurrentWorkScope = {
  readonly consistencyDomain: string;
  readonly runtimeDatasetId: string | null;
};

async function resolveCurrentWorkScope(
  db: Kysely<Database>,
  enterpriseId: string
): Promise<CurrentWorkScope> {
  const runtime = await db.selectFrom('enterprise_runtime_state')
    .select('consistency_domain')
    .where('enterprise_id','=',enterpriseId)
    .executeTakeFirstOrThrow();
  const current = await db.selectFrom('economic_runtime_dataset')
    .select(['id','kind','status','parent_dataset_id'])
    .where('enterprise_id','=',enterpriseId)
    .where('consistency_domain','=',runtime.consistency_domain)
    .where('status','=','ACTIVE')
    .executeTakeFirst();
  if (current === undefined) {
    return {
      consistencyDomain: runtime.consistency_domain,
      runtimeDatasetId: null
    };
  }
  if (current.kind !== 'CURRENT') {
    throw new Error('WorkProjection requires one CURRENT/ACTIVE runtime generation.');
  }
  const linkedLedger = await db.selectFrom('ledger_dataset')
    .select('id')
    .where('enterprise_id','=',enterpriseId)
    .where('consistency_domain','=',runtime.consistency_domain)
    .where('economic_runtime_dataset_id','=',current.id)
    .where('kind','=','CURRENT')
    .where('status','=','ACTIVE')
    .executeTakeFirst();

  if (linkedLedger !== undefined) {
    return {
      consistencyDomain: runtime.consistency_domain,
      runtimeDatasetId: current.id
    };
  }
  if (current.parent_dataset_id !== null) {
    throw new Error('CURRENT runtime generation has no active Ledger dataset.');
  }
  return {
    consistencyDomain: runtime.consistency_domain,
    runtimeDatasetId: null
  };
}

const workTypeByLedger: Record<string, { type: string; title: string; priority: number }> = {
  pending_production: { type: 'PRODUCE', title: '待生产', priority: 30 },
  pending_shipment: { type: 'SHIP', title: '待出库/发货', priority: 20 },
  receivable: { type: 'COLLECT', title: '待收款', priority: 10 },
  pending_purchase: { type: 'RECEIVE', title: '待收货', priority: 30 },
  payable: { type: 'PAY', title: '待付款', priority: 10 },
  pending_exchange: { type: 'EXCHANGE', title: '待换货', priority: 20 },
  pending_refund: { type: 'REFUND', title: '待退款', priority: 10 },
  pending_red_invoice: { type: 'RED_INVOICE', title: '待红字发票', priority: 10 },
  pending_transfer: { type: 'TRANSFER', title: '待调拨收货', priority: 20 }
};

export class PostgresWorkProjection implements WorkProjection {
  constructor(private readonly db: Kysely<Database>) {}

  async refresh(
    enterpriseId: string,
    materialization?: MaterializationContext
  ): Promise<number> {
    const currentScope = materialization === undefined
      ? await resolveCurrentWorkScope(this.db,enterpriseId)
      : null;
    const effectiveRuntimeDatasetId = materialization?.runtimeDatasetId
      ?? currentScope?.runtimeDatasetId
      ?? null;

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

    query = materialization !== undefined && materialization.mode !== 'CURRENT'
      ? query
          .where('ds.economic_runtime_dataset_id','=',materialization.runtimeDatasetId)
          .where('ds.kind','=','CANDIDATE')
          .where('ds.status','=','BUILDING')
      : effectiveRuntimeDatasetId === null
        ? query
            .where('ds.economic_runtime_dataset_id','is',null)
            .where('ds.kind','=','CURRENT')
            .where('ds.status', '=', 'ACTIVE')
        : query
            .where('ds.economic_runtime_dataset_id','=',effectiveRuntimeDatasetId)
            .where('ds.kind','=','CURRENT')
            .where('ds.status', '=', 'ACTIVE');

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
          economic_runtime_dataset_id: effectiveRuntimeDatasetId,
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
    const currentScope = materialization === undefined
      ? await resolveCurrentWorkScope(this.db,enterpriseId)
      : null;
    const effectiveRuntimeDatasetId = materialization?.runtimeDatasetId
      ?? currentScope?.runtimeDatasetId
      ?? null;

    let query = this.db
      .selectFrom('work_item')
      .selectAll()
      .where('enterprise_id', '=', enterpriseId)
      .where('status', 'in', ['OPEN', 'IN_PROGRESS']);

    query = effectiveRuntimeDatasetId === null
      ? query.where('economic_runtime_dataset_id','is',null)
      : query.where('economic_runtime_dataset_id','=',effectiveRuntimeDatasetId);

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

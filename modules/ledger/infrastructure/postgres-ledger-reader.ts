import type { Kysely } from 'kysely';
import type { Database } from '../../../platform/database/src/types.js';
import type { JsonObject } from '../../metadata/api/contracts.js';
import type {
  LedgerBalanceView
} from '../api/contracts.js';
import type { LedgerReader } from '../api/ledger-reader.js';

export class PostgresLedgerReader implements LedgerReader {
  constructor(private readonly db: Kysely<Database>) {}

  async getBalances(
    enterpriseId: string,
    ledgerCode: string
  ): Promise<readonly LedgerBalanceView[]> {
    const runtime = await this.db.selectFrom('enterprise_runtime_state')
      .select('consistency_domain')
      .where('enterprise_id','=',enterpriseId)
      .executeTakeFirstOrThrow();
    const current = await this.db.selectFrom('economic_runtime_dataset')
      .select(['id','kind','status','parent_dataset_id'])
      .where('enterprise_id','=',enterpriseId)
      .where('consistency_domain','=',runtime.consistency_domain)
      .where('status','=','ACTIVE')
      .executeTakeFirst();
    if (current !== undefined && current.kind !== 'CURRENT') {
      throw new Error('LedgerReader requires one CURRENT/ACTIVE runtime generation.');
    }
    const linkedLedger = current === undefined
      ? undefined
      : await this.db.selectFrom('ledger_dataset')
      .select('id')
      .where('enterprise_id','=',enterpriseId)
      .where('consistency_domain','=',runtime.consistency_domain)
      .where('economic_runtime_dataset_id','=',current.id)
      .where('kind','=','CURRENT')
      .where('status','=','ACTIVE')
      .executeTakeFirst();
    const ledgerDatasetId = linkedLedger?.id ?? (
      current === undefined || current.parent_dataset_id === null
        ? (await this.db.selectFrom('ledger_dataset')
            .select('id')
            .where('enterprise_id','=',enterpriseId)
            .where('consistency_domain','=',runtime.consistency_domain)
            .where('economic_runtime_dataset_id','is',null)
            .where('kind','=','CURRENT')
            .where('status','=','ACTIVE')
            .executeTakeFirstOrThrow()).id
        : (() => { throw new Error('CURRENT runtime generation has no active Ledger dataset.'); })()
    );

    const rows = await this.db
      .selectFrom('ledger_balance as b')
      .innerJoin(
        'ledger_definition as d',
        'd.id',
        'b.ledger_definition_id'
      )
      .innerJoin(
        'ledger_dataset as ds',
        'ds.id',
        'b.ledger_dataset_id'
      )
      .select([
        'd.code as ledger_code',
        'b.dimensions',
        'b.quantity',
        'b.amount',
        'b.last_posting_sequence'
      ])
      .where('b.enterprise_id', '=', enterpriseId)
      .where('b.consistency_domain','=',runtime.consistency_domain)
      .where('b.ledger_dataset_id','=',ledgerDatasetId)
      .where('d.code', '=', ledgerCode)
      .where('ds.kind','=','CURRENT')
      .where('ds.status', '=', 'ACTIVE')
      .orderBy('b.dimension_hash')
      .execute();

    return rows.map((row) => ({
      ledgerCode: row.ledger_code,
      dimensions: row.dimensions as JsonObject,
      quantity: row.quantity,
      amount: row.amount,
      lastPostingSequence: BigInt(row.last_posting_sequence)
    }));
  }
}

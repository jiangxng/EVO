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
      .where('d.code', '=', ledgerCode)
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

import type { LedgerBalanceView } from './contracts.js';

export interface LedgerReader {
  getBalances(
    enterpriseId: string,
    ledgerCode: string
  ): Promise<readonly LedgerBalanceView[]>;
}

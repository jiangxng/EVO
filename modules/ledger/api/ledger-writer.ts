import type {
  DatabaseTransaction
} from '../../../platform/database/src/transaction.js';
import type {
  LedgerEffect,
  LedgerPostingContext
} from './contracts.js';

export interface LedgerWriter {
  applyPosting(
    transaction: DatabaseTransaction,
    context: LedgerPostingContext,
    effects: readonly LedgerEffect[]
  ): Promise<void>;
}

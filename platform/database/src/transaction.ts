import type { Kysely, Transaction } from 'kysely';
import type { Database } from './types.js';

export type DatabaseTransaction = Transaction<Database>;

export interface DatabaseTransactionRunner {
  run<T>(
    work: (transaction: DatabaseTransaction) => Promise<T>
  ): Promise<T>;
}

export function createTransactionRunner(
  db: Kysely<Database>
): DatabaseTransactionRunner {
  return {
    run<T>(
      work: (transaction: DatabaseTransaction) => Promise<T>
    ): Promise<T> {
      return db.transaction().execute(work);
    }
  };
}

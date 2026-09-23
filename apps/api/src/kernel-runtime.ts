import type { DatabaseHandle } from '../../../platform/database/src/index.js';
import { createTransactionRunner } from '../../../platform/database/src/index.js';
import { PostgresPostingMetadataReader } from '../../../modules/metadata/infrastructure/postgres-posting-metadata-reader.js';
import { PostgresBusinessDataReader } from '../../../modules/business-data/infrastructure/postgres-business-data-reader.js';
import { PostgresPostingStateStore } from '../../../modules/posting/infrastructure/postgres-posting-state-store.js';
import { PostingService } from '../../../modules/posting/application/posting-service.js';
import { PostgresLedgerWriter } from '../../../modules/ledger/infrastructure/postgres-ledger-writer.js';
import { PostgresLedgerReader } from '../../../modules/ledger/infrastructure/postgres-ledger-reader.js';

/**
 * EVO-WORK-PACKET: CORE-BOUNDARY-AUDIT-v0.1
 *
 * Transitional Kernel composition root.
 *
 * This file intentionally wires only the minimum synchronous posting path:
 * BusinessData -> Posting Rule evaluation -> Ledger Entry -> Balance read.
 *
 * Posting metadata still comes from the legacy metadata module in this first
 * extraction slice. A later slice will split Ledger/Posting definition metadata
 * from Application/Field metadata without changing this runtime contract.
 */
export function createEvoKernelRuntime(database: DatabaseHandle) {
  const db = database.db;
  const state = new PostgresPostingStateStore(db);
  const businessData = new PostgresBusinessDataReader(db);
  const postingMetadata = new PostgresPostingMetadataReader(db);
  const ledgerWriter = new PostgresLedgerWriter();
  const transactions = createTransactionRunner(db);
  const posting = new PostingService(
    state,
    state,
    businessData,
    postingMetadata,
    ledgerWriter,
    transactions
  );
  const ledger = new PostgresLedgerReader(db);

  return {
    db,
    state,
    businessData,
    postingMetadata,
    ledgerWriter,
    transactions,
    posting,
    ledger
  };
}

export type EvoKernelRuntime = ReturnType<typeof createEvoKernelRuntime>;

/**
 * Drain only the authoritative posting queue.
 *
 * Deliberately does NOT refresh Work, reporting, finance, cost, valuation,
 * analytics or any other installed capability.
 */
export async function drainKernelPosting(
  runtime: Pick<EvoKernelRuntime, 'posting'>,
  enterpriseId: string
): Promise<number> {
  let count = 0;
  for (let i = 0; i < 10000; i += 1) {
    const result = await runtime.posting.processNext(enterpriseId);
    if (
      result.status === 'IDLE' ||
      result.status === 'BLOCKED_REPLAY_REQUIRED'
    ) {
      break;
    }
    if (result.status === 'RACE_RETRY') continue;
    if (result.status === 'FAILED') {
      throw new Error(`Posting failed: ${result.errorCode}`);
    }
    count += 1;
  }
  return count;
}

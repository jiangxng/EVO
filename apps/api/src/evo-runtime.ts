import type { DatabaseHandle } from '../../../platform/database/src/index.js';
import { createTransactionRunner } from '../../../platform/database/src/index.js';
import { MetadataCommandCapabilityResolver } from '../../../modules/command/application/metadata-command-capability-resolver.js';
import { CommandService } from '../../../modules/command/application/command-service.js';
import { PostgresCommandTransaction } from '../../../modules/command/infrastructure/postgres-command-transaction.js';
import { PostgresMetadataRepository } from '../../../modules/metadata/infrastructure/postgres-metadata-repository.js';
import { PostgresPostingMetadataReader } from '../../../modules/metadata/infrastructure/postgres-posting-metadata-reader.js';
import { PostgresBusinessDataReader } from '../../../modules/business-data/infrastructure/postgres-business-data-reader.js';
import { PostgresPostingStateStore } from '../../../modules/posting/infrastructure/postgres-posting-state-store.js';
import { PostingService } from '../../../modules/posting/application/posting-service.js';
import { PostgresLedgerWriter } from '../../../modules/ledger/infrastructure/postgres-ledger-writer.js';
import { PostgresWorkProjection } from '../../../modules/workflow/infrastructure/postgres-work-projection.js';
import { PostgresAuthorizationService } from '../../../modules/identity/infrastructure/postgres-authorization-service.js';
import { PostgresReplayService } from '../../../modules/replay/infrastructure/postgres-replay-service.js';
import { PostgresCostEngine } from '../../../modules/cost/infrastructure/postgres-cost-engine.js';
import { PostgresEnterpriseQuery } from '../../../modules/query/infrastructure/postgres-enterprise-query.js';
import { PostgresAiCapabilityCatalog } from '../../../modules/ai/infrastructure/postgres-ai-capability-catalog.js';

export function createEvoRuntime(database: DatabaseHandle) {
  const db = database.db;
  const metadata = new PostgresMetadataRepository(db);
  const capabilities = new MetadataCommandCapabilityResolver(metadata);
  const command = new CommandService(
    capabilities,
    new PostgresCommandTransaction(db)
  );
  const state = new PostgresPostingStateStore(db);
  const posting = new PostingService(
    state,
    state,
    new PostgresBusinessDataReader(db),
    new PostgresPostingMetadataReader(db),
    new PostgresLedgerWriter(),
    createTransactionRunner(db)
  );

  return {
    db,
    command,
    posting,
    work: new PostgresWorkProjection(db),
    auth: new PostgresAuthorizationService(db),
    replay: new PostgresReplayService(db),
    cost: new PostgresCostEngine(db),
    query: new PostgresEnterpriseQuery(db),
    ai: new PostgresAiCapabilityCatalog(db)
  };
}

export async function demoIds(runtime: ReturnType<typeof createEvoRuntime>) {
  const enterprise = await runtime.db.selectFrom('enterprise')
    .select(['id']).where('code','=','EVO_DEMO').executeTakeFirstOrThrow();
  const apps = await runtime.db.selectFrom('application_instance')
    .select(['id','code']).where('enterprise_id','=',enterprise.id).execute();

  return {
    enterpriseId: enterprise.id,
    salesAppId: apps.find(x => x.code === 'sales')?.id ?? '',
    inventoryAppId: apps.find(x => x.code === 'inventory')?.id ?? ''
  };
}

export async function drainPosting(
  runtime: ReturnType<typeof createEvoRuntime>,
  enterpriseId: string
): Promise<number> {
  let count = 0;
  for (let i = 0; i < 10000; i += 1) {
    const result = await runtime.posting.processNext(enterpriseId);
    if (result.status === 'IDLE') break;
    if (result.status === 'BLOCKED_REPLAY_REQUIRED') break;
    if (result.status === 'RACE_RETRY') continue;
    if (result.status === 'FAILED') {
      throw new Error(`Posting failed: ${result.errorCode}`);
    }
    count += 1;
  }
  await runtime.work.refresh(enterpriseId);
  return count;
}

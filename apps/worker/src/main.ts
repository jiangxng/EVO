import { createDatabase } from '../../../platform/database/src/index.js';
import { createLogger } from '../../../platform/observability/src/logger.js';
import { loadRuntimeConfig } from '../../../platform/runtime/src/config.js';
import { createEvoRuntime, drainPosting } from '../../api/src/evo-runtime.js';
import { LogOutboxPublisher } from '../../../modules/integration/infrastructure/log-outbox-publisher.js';

const config = loadRuntimeConfig();
const logger = createLogger(
  { service: 'evo-worker', environment: config.nodeEnv },
  config.logLevel
);
const database = createDatabase(config.databaseUrl);
const runtime = createEvoRuntime(database);
const outbox = new LogOutboxPublisher(database.db, logger);
let stopping = false;

async function runCycle(): Promise<void> {
  const enterprises = await database.db.selectFrom('enterprise')
    .select('id').where('status','=','ACTIVE').execute();

  for (const enterprise of enterprises) {
    try {
      await drainPosting(runtime, enterprise.id);
    } catch (error) {
      logger.error({ err: error, enterpriseId: enterprise.id }, 'Posting cycle failed.');
    }
  }
  await outbox.publishBatch(100);
}

async function run(): Promise<void> {
  logger.info({ pollIntervalMs: config.workerPollIntervalMs }, 'EVO worker started.');
  while (!stopping) {
    await runCycle();
    await new Promise((resolve) => setTimeout(resolve, config.workerPollIntervalMs));
  }
  await database.destroy();
  logger.info('EVO worker stopped.');
}

function stop(signal: string): void {
  logger.info({ signal }, 'Worker shutdown requested.');
  stopping = true;
}
process.once('SIGINT', () => stop('SIGINT'));
process.once('SIGTERM', () => stop('SIGTERM'));
await run();

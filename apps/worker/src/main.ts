import { createLogger } from '../../../platform/observability/src/logger.js';
import { loadRuntimeConfig } from '../../../platform/runtime/src/config.js';

const config = loadRuntimeConfig();
const logger = createLogger(
  {
    service: 'evo-worker',
    environment: config.nodeEnv
  },
  config.logLevel
);

let stopping = false;

async function runCycle(): Promise<void> {
  // M0 deliberately performs no business work.
  // Posting/Cost/Outbox loops are introduced by their owning milestones.
  logger.debug('Worker heartbeat.');
}

async function run(): Promise<void> {
  logger.info(
    { pollIntervalMs: config.workerPollIntervalMs },
    'EVO worker started.'
  );

  while (!stopping) {
    await runCycle();
    await new Promise((resolve) =>
      setTimeout(resolve, config.workerPollIntervalMs)
    );
  }

  logger.info('EVO worker stopped.');
}

function stop(signal: string): void {
  logger.info({ signal }, 'Worker shutdown requested.');
  stopping = true;
}

process.once('SIGINT', () => stop('SIGINT'));
process.once('SIGTERM', () => stop('SIGTERM'));

await run();

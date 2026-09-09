import { buildApp } from './build-app.js';
import { createDatabase } from '../../../platform/database/src/index.js';
import { loadRuntimeConfig } from '../../../platform/runtime/src/config.js';

const config = loadRuntimeConfig();
const database = createDatabase(config.databaseUrl);
const app = buildApp({
  database,
  loggerLevel: config.logLevel
});

async function shutdown(signal: string): Promise<void> {
  app.log.info({ signal }, 'Shutting down EVO API.');
  await app.close();
  await database.destroy();
  process.exit(0);
}

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));

try {
  await app.listen({ host: config.host, port: config.port });
} catch (error) {
  app.log.fatal({ err: error }, 'Failed to start EVO API.');
  await database.destroy();
  process.exit(1);
}

/**
 * Dedicated B2D3 plugin-owned finance verifier executable.
 *
 * Operator must explicitly start this isolated app with a real database
 * connection and POSTGRES trust authority. This executable intentionally
 * does not load the general EVO HTTP application or worker.
 * Database runtime credential requires only the bounded read/nonce/lock
 * grants documented in the B2D3 deployment decision.
 */
import { buildFinanceOwnerReadOnlyAppV010 } from './finance-owner-readonly-app.js';
import { createDatabase } from '../../../platform/database/src/index.js';
import { loadRuntimeConfig } from '../../../platform/runtime/src/config.js';

if (process.env.EVO_FINANCE_OWNER_ISOLATED_READONLY !== 'true') {
  throw new Error('EVO_FINANCE_OWNER_EXPLICIT_ISOLATED_ENABLE_REQUIRED');
}
if (process.env.EVO_FINANCE_TRUST_AUTHORITY !== 'POSTGRES') {
  throw new Error('EVO_FINANCE_OWNER_POSTGRES_TRUST_REQUIRED');
}
if (!process.env.DATABASE_URL?.trim()) {
  throw new Error('EVO_FINANCE_OWNER_DATABASE_CREDENTIAL_REQUIRED');
}
if (process.env.EVO_FINANCE_TRUSTED_INSTALLATIONS_JSON?.trim()) {
  throw new Error('EVO_FINANCE_OWNER_NO_STARTUP_TRUST_FALLBACK');
}
if (!process.env.HOST?.trim() || !process.env.PORT?.trim()) {
  throw new Error('EVO_FINANCE_OWNER_EXPLICIT_LISTEN_ADDRESS_REQUIRED');
}

const config = loadRuntimeConfig();
const database = createDatabase(config.databaseUrl);
const app = buildFinanceOwnerReadOnlyAppV010(database.db, config.logLevel);

async function shutdown(signal: string): Promise<void> {
  app.log.info({ signal }, 'Shutting down isolated finance owner.');
  await app.close();
  await database.destroy();
}
process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));

try {
  await app.listen({ host: config.host, port: config.port });
} catch (error) {
  app.log.fatal({ err: error }, 'Failed to start isolated finance owner.');
  await app.close();
  await database.destroy();
  process.exitCode = 1;
}

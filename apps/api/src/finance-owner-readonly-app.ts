import Fastify, { type FastifyInstance } from 'fastify';
import { sql, type Kysely } from 'kysely';
import type { Database } from '../../../platform/database/src/types.js';
import {
  registerFinanceOwnerDelegationRouteV010
} from './finance-owner-delegation-route.js';

/**
 * B2D3 operator-deployed, plugin-owned *read-only* trust verifier.
 * Intentionally NOT buildApp(): this isolated process must not mount
 * demo, business submission, command, Ledger mutation or admin routes.
 * Actual grant/revoke remains the restricted operator CLI only.
 */
export function buildFinanceOwnerReadOnlyAppV010(
  db: Kysely<Database>, loggerLevel: string = 'info'
): FastifyInstance {
  const app = Fastify({ logger: { level: loggerLevel } });

  app.get('/health/live', async () => ({ status: 'ok', component: 'finance-owner-readonly' }));
  app.get('/health/ready', async () => {
    await sql`select 1 as ready`.execute(db);
    return { status: 'ready', component: 'finance-owner-readonly' };
  });

  registerFinanceOwnerDelegationRouteV010(app, db, [], {
    trustAuthority: 'POSTGRES'
  });
  return app;
}

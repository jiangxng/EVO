import { describe, expect, it } from 'vitest';
import type { Kysely } from 'kysely';
import type { Database } from '../../../platform/database/src/types.js';
import {
  buildFinanceOwnerReadOnlyAppV010
} from '../../../apps/api/src/finance-owner-readonly-app.js';
import {
  FINANCE_OWNER_PATH_V010
} from '../../../apps/api/src/finance-owner-delegation-route.js';

describe('B2D3 isolated trusted finance read-only process boundary', () => {
  it('exposes ONLY liveness/readiness and the plugin-owner signed verification route', async () => {
    // Malformed signed requests must be rejected *before* any DB query.
    const db = {} as Kysely<Database>;
    const app = buildFinanceOwnerReadOnlyAppV010(db, 'silent');
    try {
      const live = await app.inject({ method: 'GET', url: '/health/live' });
      expect(live.statusCode).toBe(200);
      expect(live.json()).toEqual({
        status: 'ok', component: 'finance-owner-readonly'
      });
      const untrusted = await app.inject({
        method: 'POST', url: FINANCE_OWNER_PATH_V010,
        payload: { assertion: 'unsigned-caller' }
      });
      expect(untrusted.statusCode).toBe(401);
      expect(untrusted.json()).toMatchObject({
        status: 'DENIED', executionAllowed: false
      });
      for (const url of [
        '/api/v1/commands',
        '/api/v1/demo/cost/recalculate',
        '/api/v1/demo/sales-orders/approve',
        '/api/v1/configurator/business-data',
        '/api/v1/ledgers/demo/balances',
        '/api/v1/plugins/finance/execute',
        '/api/v1/apps'
      ]) {
        for (const method of ['GET','POST'] as const) {
          const res = await app.inject({ method, url });
          expect(res.statusCode, method + ' ' + url).toBe(404);
        }
      }
    } finally {
      await app.close();
    }
  });
});

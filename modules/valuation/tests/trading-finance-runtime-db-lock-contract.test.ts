import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('B2D3 restricted database runtime trust key locking', () => {
  const migration = readFileSync(
    new URL('../../../migrations/schema/202610100040_finance_runtime_key_lock_function.sql', import.meta.url),
    'utf8'
  );
  const route = readFileSync(
    new URL('../../../apps/api/src/finance-owner-delegation-route.ts', import.meta.url),
    'utf8'
  );

  it('uses scoped SECURITY DEFINER with no caller-controlled search path or public execute', () => {
    expect(migration).toMatch(/security definer/i);
    expect(migration).toMatch(/set search_path = pg_catalog/i);
    expect(migration).toMatch(/from public\.finance_trusted_signing_key as k/i);
    expect(migration).toMatch(/for share of k/i);
    expect(migration).toMatch(/revoke all on function public\.finance_lock_active_signing_key_v010\(text,text,text\) from public/i);
    expect(migration).not.toMatch(/execute\s+(?:format|p_issuer|p_key_id)/i);
  });

  it('only delegates the immutable active-key lookup to the controlled routine', () => {
    expect(route).toContain('public.finance_lock_active_signing_key_v010(');
    expect(route).toContain('authenticateFinanceDelegationV010(token, keys)');
    expect(route).toContain('await consumeOnce(trx, c)');
    expect(route).not.toMatch(/from finance_trusted_signing_key\s+where[\s\S]*for share/u);
  });
});

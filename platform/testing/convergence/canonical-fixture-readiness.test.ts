import { describe, expect, it } from 'vitest';
import {
  convergenceFixturePath,
  loadExternalConvergenceFixture
} from './external-fixtures.js';

type Json = Record<string, unknown>;

const certificationEnabled =
  process.env['EVO_CONVERGENCE_FIXTURE_ROOT'] !== undefined;
const certification = certificationEnabled ? describe : describe.skip;

async function fixture(path: string): Promise<Json> {
  return (await loadExternalConvergenceFixture<Json>(convergenceFixturePath(path))).value;
}

certification('Convergence v0.2.1 canonical fixture readiness', () => {
  it('preserves semantic observation identity across duplicate delivery', async () => {
    const value = await fixture('enterprise-observation/duplicate-delivery.valid.json');
    const first = value['first'] as Json;
    const retry = value['retry'] as Json;
    expect(first['observationId']).toBe(retry['observationId']);
    expect(first['deliveryId']).not.toBe(retry['deliveryId']);
  });

  it('requires observation source tenant to agree with envelope tenant', async () => {
    const value = await fixture('enterprise-observation/cross-tenant.invalid.json');
    const source = value['source'] as Json;
    expect(source['enterpriseId']).not.toBe(value['enterpriseId']);
  });

  it('treats proposal authorization claims as untrusted input', async () => {
    const value = await fixture('command-proposal/fake-authorization.invalid.json');
    expect(value['authorizationResult']).toBeDefined();
    // The EVO admission adapter must reject this canonical invalid fixture;
    // it must never map the claim to EVO authorization state.
  });

  it('keeps proposal identity distinct from command idempotency identity', async () => {
    const value = await fixture('command-proposal/use-alternate-supplier.valid.json');
    expect(value['proposalId']).not.toBe(value['commandIdempotencyKey']);
    expect(value['commandCode']).toBe('procurement.use-alternate-supplier');
  });

  it('treats confirmation evidence as evidence, not authorization', async () => {
    const value = await fixture('action-request/approve-action.valid.json');
    const confirmation = value['confirmationEvidence'] as Json;
    expect(confirmation['confirmed']).toBe(true);
    expect(confirmation['authorized']).toBeUndefined();
  });

  it('detects tampered confirmation authorization semantics', async () => {
    const value = await fixture('action-request/tampered-confirmation.invalid.json');
    const confirmation = value['confirmationEvidence'] as Json;
    expect(confirmation['authorized']).toBe(true);
  });

  it('recognizes stale operational-change base version as fail-closed input', async () => {
    const value = await fixture('operational-change/stale-base-version.invalid.json');
    expect(value['baseVersion']).not.toBe(value['expectedCurrentVersion']);
    expect(value['expectedValidation']).toBe('STALE_BASE_VERSION');
  });

  it('recognizes arbitrary JSON Patch as invalid operational-change vocabulary', async () => {
    const value = await fixture('operational-change/json-patch.invalid.json');
    const operations = value['operations'] as Json[];
    expect(operations[0]?.['op']).toBe('replace');
  });

  it('requires simulation to remain hypothetical', async () => {
    const valid = await fixture('simulation/fifo-cost.valid.json');
    const invalid = await fixture('simulation/actual-write.invalid.json');
    expect(valid['namespace']).toBe('HYPOTHETICAL');
    expect(invalid['namespace']).toBe('ACTUAL');
    expect(invalid['writeActual']).toBe(true);
  });

  it('preserves causal chain while EVO reevaluates authorization', async () => {
    const value = await fixture('integration/apm-causal-chain.valid.json');
    const chain = value['chain'] as Json[];
    const admission = chain.find((item) => item['kind'] === 'CommandAdmission');
    expect(admission?.['authorization']).toBe('EVO_REEVALUATES');
    expect(value['invariant']).toContain('neither is authorization');
  });
});

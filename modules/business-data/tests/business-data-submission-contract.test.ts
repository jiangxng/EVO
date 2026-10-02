import { describe, expect, it } from 'vitest';
import type {
  BusinessDataSubmissionV010,
  BusinessDataSubmissionPortV010
} from '../api/contracts.js';

describe('BusinessDataSubmissionV010 target contract', () => {
  it('requires only minimal runtime routing and business fact inputs', async () => {
    const request: BusinessDataSubmissionV010 = {
      contractVersion: '0.1.0',
      scopeKey: 'enterprise:demo',
      applicationId: 'trading-lite',
      businessDataType: 'sales.order',
      businessObjectKey: 'SO-1001',
      effectiveAt: new Date('2026-10-02T00:00:00.000Z'),
      payload: { amount: '100.00' },
      correlationId: 'corr-1',
      idempotencyKey: 'idem-1'
    };

    const port: BusinessDataSubmissionPortV010 = {
      async submit(input) {
        expect(input.applicationId).toBe('trading-lite');
        return {
          contractVersion: '0.1.0',
          businessDataId: 'bd-1',
          businessObjectVersion: 1n,
          postingInputId: 'pi-1',
          postingSequence: 1n,
          postingStatus: 'QUEUED',
          retroactive: false,
          replayRequired: false,
          idempotentReplay: false
        };
      }
    };

    const result = await port.submit(request);
    expect(result.businessDataId).toBe('bd-1');

    const keys = Object.keys(request).sort();
    expect(keys).not.toContain('applicationInstanceId');
    expect(keys).not.toContain('commandCode');
    expect(keys).not.toContain('metadataVersion');
    expect(keys).not.toContain('actor');
  });
});

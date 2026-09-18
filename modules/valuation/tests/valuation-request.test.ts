import { describe, expect, it } from 'vitest';
import { parseValuationRequestPayload } from '../domain/valuation-request.js';

describe('valuation request BusinessData', () => {
  it('parses an explicitly pinned FX period-end request', () => {
    const parsed = parseValuationRequestPayload('valuation.requested',{
      requestCode: 'FX-2026-09',
      valuationKind: 'FX_PERIOD_END',
      valuationAt: '2026-09-30T23:59:59.000Z',
      scope: {
        kind: 'EXPLICIT_POSITIONS',
        positionKeys: ['dealer:USD:ACME']
      },
      rateDataset: {
        datasetId: 'dataset-1',
        version: 3,
        digest: 'a'.repeat(64)
      },
      policy: { amountScale: 2, roundingMode: 'HALF_UP' }
    });

    expect(parsed.valuationKind).toBe('FX_PERIOD_END');
    expect(parsed.rateDataset.version).toBe(3);
    expect(parsed.scope.kind).toBe('EXPLICIT_POSITIONS');
  });

  it('rejects an unpinned rate dataset', () => {
    expect(() => parseValuationRequestPayload('valuation.requested',{
      requestCode: 'FX-2026-09',
      valuationKind: 'FX_PERIOD_END',
      valuationAt: '2026-09-30T23:59:59.000Z',
      scope: { kind: 'DIMENSION_QUERY', dimensions: {} },
      rateDataset: {
        datasetId: 'dataset-1',
        version: 0,
        digest: 'a'.repeat(64)
      },
      policy: {}
    })).toThrow('positive integer');
  });
});

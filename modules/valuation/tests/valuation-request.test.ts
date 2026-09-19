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
      positionDefinition: {
        definitionId: 'position-def-1',
        version: 1,
        digest: 'c'.repeat(64)
      },
      rateDataset: {
        datasetId: 'dataset-1',
        version: 3,
        digest: 'a'.repeat(64)
      },
      policy: { amountScale: 2, roundingMode: 'HALF_UP' }
    });

    expect(parsed.valuationKind).toBe('FX_PERIOD_END');
    if (parsed.valuationKind !== 'FX_PERIOD_END') throw new Error('Expected period-end request.');
    expect(parsed.rateDataset.version).toBe(3);
    expect(parsed.scope.kind).toBe('EXPLICIT_POSITIONS');
  });

  it('parses a pinned FX realized settlement request', () => {
    const parsed = parseValuationRequestPayload('valuation.requested',{
      requestCode: 'FX-SETTLE-1',
      valuationKind: 'FX_REALIZED_SETTLEMENT',
      valuationAt: '2026-10-01T01:00:00.000Z',
      scope: { kind: 'DIMENSION_QUERY', dimensions: { order_no: 'SO-1' } },
      positionDefinition: {
        definitionId: 'position-def-1',
        version: 1,
        digest: 'c'.repeat(64)
      },
      settlementBusinessDataId: 'payment-1',
      allocationPolicy: { id: 'policy-1', version: 2 },
      instructionId: 'instruction-1',
      settlementMapping: {
        foreignValueField: 'foreignAmount',
        foreignUnitField: 'foreignCurrency',
        localValueField: 'localAmount',
        localUnitField: 'localCurrency'
      }
    });

    expect(parsed.valuationKind).toBe('FX_REALIZED_SETTLEMENT');
    if (parsed.valuationKind !== 'FX_REALIZED_SETTLEMENT') throw new Error('Expected settlement request.');
    expect(parsed.allocationPolicy.version).toBe(2);
    expect(parsed.settlementMapping.localValueField).toBe('localAmount');
  });

  it('rejects an unpinned rate dataset', () => {
    expect(() => parseValuationRequestPayload('valuation.requested',{
      requestCode: 'FX-2026-09',
      valuationKind: 'FX_PERIOD_END',
      valuationAt: '2026-09-30T23:59:59.000Z',
      scope: { kind: 'DIMENSION_QUERY', dimensions: {} },
      positionDefinition: {
        definitionId: 'position-def-1',
        version: 1,
        digest: 'c'.repeat(64)
      },
      rateDataset: {
        datasetId: 'dataset-1',
        version: 0,
        digest: 'a'.repeat(64)
      },
      policy: {}
    })).toThrow('positive integer');
  });
});

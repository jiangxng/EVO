import { describe, expect, it } from 'vitest';
import type { RateObservation } from '../../economic/api/contracts.js';
import { revalueFxPosition } from '../domain/fx-period-end.js';

const rate: RateObservation = {
  id: 'rate-1',
  dataset: {
    datasetId: 'dataset-1',
    version: 1,
    digest: 'a'.repeat(64)
  },
  role: 'PERIOD_END_VALUATION',
  sourceUnit: 'USD',
  targetUnit: 'CNY',
  convention: 'TARGET_PER_SOURCE',
  rate: '7.123456',
  effectiveAt: new Date('2026-09-30T00:00:00Z'),
  provider: 'TEST',
  precision: 6
};

describe('FX period-end revaluation', () => {
  it('revalues open foreign quantity without changing the foreign measurement', () => {
    const result = revalueFxPosition({
      positionKey: 'AR:customer-1:USD',
      sourceBusinessDataIds: ['fact-1'],
      dimensions: { customer: 'customer-1' },
      foreign: {
        value: '100',
        unit: 'USD',
        role: 'RESOURCE_QUANTITY'
      },
      carrying: {
        value: '700',
        unit: 'CNY',
        role: 'VALUATION_AMOUNT'
      }
    }, rate, {
      amountScale: 2,
      roundingMode: 'HALF_UP'
    });

    expect(result.foreign.value).toBe('100');
    expect(result.foreign.unit).toBe('USD');
    expect(result.carryingAfter.value).toBe('712.35');
    expect(result.delta.value).toBe('12.35');
    expect(result.delta.unit).toBe('CNY');
    expect(result.rateObservationId).toBe('rate-1');
  });

  it('rejects a rate whose source currency does not match the position', () => {
    expect(() => revalueFxPosition({
      positionKey: 'AR:customer-1:EUR',
      sourceBusinessDataIds: ['fact-1'],
      dimensions: {},
      foreign: {
        value: '100',
        unit: 'EUR',
        role: 'RESOURCE_QUANTITY'
      },
      carrying: {
        value: '700',
        unit: 'CNY',
        role: 'VALUATION_AMOUNT'
      }
    }, rate, {
      amountScale: 2,
      roundingMode: 'HALF_UP'
    })).toThrow(/source unit mismatch/);
  });
});

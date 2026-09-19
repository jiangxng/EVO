import { describe, expect, it } from 'vitest';
import { closeFxPosition } from '../domain/fx-settlement.js';

describe('FX realized settlement closure', () => {
  it('realizes the difference between actual local settlement and remaining carrying basis', () => {
    const result = closeFxPosition({
      positionKey: 'AR:C1:USD',
      sourceBusinessDataIds: ['invoice-1'],
      dimensions: { customer: 'C1' },
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
    }, {
      value: '100',
      unit: 'USD',
      role: 'SETTLEMENT_QUANTITY'
    }, {
      value: '712',
      unit: 'CNY',
      role: 'DIRECT_BUSINESS_AMOUNT'
    });

    expect(result.foreignConsumed.value).toBe('100');
    expect(result.carryingBasis.value).toBe('700');
    expect(result.settlementLocal.value).toBe('712');
    expect(result.realizedDelta.value).toBe('12');
    expect(result.realizedDelta.unit).toBe('CNY');
  });

  it('requires full closure in the first settlement implementation', () => {
    expect(() => closeFxPosition({
      positionKey: 'AR:C1:USD',
      sourceBusinessDataIds: ['invoice-1'],
      dimensions: {},
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
    }, {
      value: '60',
      unit: 'USD',
      role: 'SETTLEMENT_QUANTITY'
    }, {
      value: '425',
      unit: 'CNY',
      role: 'DIRECT_BUSINESS_AMOUNT'
    })).toThrow(/exact remaining foreign position/);
  });

  it('rejects foreign and local unit mismatches', () => {
    expect(() => closeFxPosition({
      positionKey: 'AR:C1:USD',
      sourceBusinessDataIds: ['invoice-1'],
      dimensions: {},
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
    }, {
      value: '100',
      unit: 'EUR',
      role: 'SETTLEMENT_QUANTITY'
    }, {
      value: '700',
      unit: 'CNY',
      role: 'DIRECT_BUSINESS_AMOUNT'
    })).toThrow(/foreign unit mismatch/);
  });
});

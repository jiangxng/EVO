import { describe, expect, it } from 'vitest';
import type { AllocationStore } from '../../allocation/api/store.js';
import type { BusinessDataReader } from '../../business-data/api/business-data-reader.js';
import type { FxPositionResolver } from '../api/position-resolver.js';
import type {
  FxPeriodEndRequest,
  FxSettlementService,
  FxValuationService
} from '../api/fx.js';
import { DefaultValuationRequestInterpreter } from '../application/valuation-request-interpreter.js';

const unusedSettlement: FxSettlementService = {
  async closePosition() { throw new Error('settlement should not run'); }
};

const unusedBusinessData: BusinessDataReader = {
  async getBusinessData() { return null; }
};

const unusedAllocations: AllocationStore = {
  async recordInstruction() { throw new Error('allocation should not run'); },
  async getInstruction() { return null; },
  async startRun() { throw new Error('allocation should not run'); },
  async recordRelation() { throw new Error('allocation should not run'); },
  async completeRun() { throw new Error('allocation should not run'); },
  async failRun() { throw new Error('allocation should not run'); }
};

describe('valuation request interpreter', () => {
  it('replays an accepted FX period-end request with pinned dataset', async () => {
    const captured: { request?: FxPeriodEndRequest } = {};

    const resolver: FxPositionResolver = {
      async resolve() {
        return [{
          positionKey: 'dealer:USD:ACME',
          sourceBusinessDataIds: ['fact-1'],
          dimensions: { dealer: 'ACME' },
          foreign: { value: '100', unit: 'USD', role: 'RESOURCE_QUANTITY' },
          carrying: { value: '700', unit: 'CNY', role: 'VALUATION_AMOUNT' }
        }];
      }
    };

    const fx: FxValuationService = {
      async revaluePeriodEnd(request) {
        captured.request = request;
        return { valuationRunId: 'run-1', inputDigest: 'a'.repeat(64), results: [] };
      }
    };

    const effectiveAt = new Date('2026-09-30T23:59:59.000Z');
    const interpreter = new DefaultValuationRequestInterpreter(
      resolver,
      fx,
      unusedSettlement,
      unusedBusinessData,
      unusedAllocations
    );

    await interpreter.replayAcceptedRequest({
      businessDataId: 'request-fact',
      enterpriseId: 'e1',
      effectiveAt,
      payload: {
        requestCode: 'FX-2026-09',
        valuationKind: 'FX_PERIOD_END',
        valuationAt: effectiveAt.toISOString(),
        scope: { kind: 'EXPLICIT_POSITIONS', positionKeys: ['dealer:USD:ACME'] },
        positionDefinition: {
          definitionId: 'position-def-1',
          version: 1,
          digest: 'c'.repeat(64)
        },
        rateDataset: { datasetId: 'rates-1', version: 2, digest: 'b'.repeat(64) },
        policy: { amountScale: 2, roundingMode: 'HALF_UP' }
      }
    });

    expect(captured.request?.requestBusinessDataId).toBe('request-fact');
    expect(captured.request?.rateDataset.version).toBe(2);
    expect(captured.request?.positions).toHaveLength(1);
  });

  it('rejects divergence between fact effective time and valuation time', async () => {
    const interpreter = new DefaultValuationRequestInterpreter(
      { async resolve() { return []; } },
      { async revaluePeriodEnd() { throw new Error('should not run'); } },
      unusedSettlement,
      unusedBusinessData,
      unusedAllocations
    );

    await expect(interpreter.replayAcceptedRequest({
      businessDataId: 'request-fact',
      enterpriseId: 'e1',
      effectiveAt: new Date('2026-09-30T00:00:00Z'),
      payload: {
        requestCode: 'FX-2026-09',
        valuationKind: 'FX_PERIOD_END',
        valuationAt: '2026-09-30T23:59:59.000Z',
        scope: { kind: 'DIMENSION_QUERY', dimensions: {} },
        positionDefinition: {
          definitionId: 'position-def-1',
          version: 1,
          digest: 'c'.repeat(64)
        },
        rateDataset: { datasetId: 'rates-1', version: 1, digest: 'b'.repeat(64) },
        policy: { amountScale: 2, roundingMode: 'HALF_UP' }
      }
    })).rejects.toThrow('effectiveAt');
  });
});

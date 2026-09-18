import { describe, expect, it } from 'vitest';
import type { AllocationStore } from '../../allocation/api/store.js';
import type { BusinessDataReader } from '../../business-data/api/business-data-reader.js';
import type { FxPositionResolver } from '../api/position-resolver.js';
import type {
  FxPeriodEndRequest,
  FxSettlementClosureRequest,
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

  it('replays a canonical FX settlement request with explicit instruction', async () => {
    const captured: { request?: FxSettlementClosureRequest } = {};
    const effectiveAt = new Date('2026-10-01T01:00:00.000Z');

    const interpreter = new DefaultValuationRequestInterpreter(
      {
        async resolve() {
          return [{
            positionKey: 'dealer:USD:ACME',
            sourceBusinessDataIds: ['sale-1'],
            dimensions: { dealer: 'ACME' },
            foreign: { value: '100', unit: 'USD', role: 'RESOURCE_QUANTITY' },
            carrying: { value: '720', unit: 'CNY', role: 'VALUATION_AMOUNT' }
          }];
        }
      },
      { async revaluePeriodEnd() { throw new Error('period-end should not run'); } },
      {
        async closePosition(request) {
          captured.request = request;
          return {
            valuationRunId: 'valuation-run-1',
            allocationRunId: 'allocation-run-1',
            inputDigest: 'a'.repeat(64),
            result: {
              positionKey: request.position.positionKey,
              foreignConsumed: request.settlementForeign,
              carryingBasis: request.position.carrying,
              settlementLocal: request.settlementLocal,
              realizedDelta: {
                value: '10',
                unit: 'CNY',
                role: 'VALUATION_AMOUNT'
              }
            }
          };
        }
      },
      {
        async getBusinessData() {
          return {
            id: 'payment-1',
            enterpriseId: 'e1',
            applicationInstanceId: 'app-1',
            commandExecutionId: 'cmd-1',
            businessDataType: 'customer_payment.received',
            businessObjectKey: 'PAY-1',
            businessObjectVersion: 1n,
            effectiveAt,
            metadataVersion: 1,
            payload: {
              foreignAmount: '100',
              foreignCurrency: 'USD',
              localAmount: '730',
              localCurrency: 'CNY'
            }
          };
        }
      },
      {
        async getInstruction() {
          return {
            id: 'instruction-1',
            enterpriseId: 'e1',
            consumerBusinessDataId: 'payment-1',
            mode: 'EXPLICIT',
            sourceSelector: {
              kind: 'BUSINESS_DATA',
              businessDataId: 'sale-1'
            },
            actorType: 'HUMAN',
            actorId: 'u1',
            effectiveAt,
            recordedAt: effectiveAt,
            allocationPolicyId: 'policy-1',
            allocationPolicyVersion: 1,
            idempotencyKey: 'idem-1'
          };
        },
        async recordInstruction() { throw new Error('should not run'); },
        async startRun() { throw new Error('should not run'); },
        async recordRelation() { throw new Error('should not run'); },
        async completeRun() { throw new Error('should not run'); },
        async failRun() { throw new Error('should not run'); }
      }
    );

    await interpreter.replayAcceptedRequest({
      businessDataId: 'request-settle-1',
      enterpriseId: 'e1',
      effectiveAt,
      payload: {
        requestCode: 'FX-SETTLE-1',
        valuationKind: 'FX_REALIZED_SETTLEMENT',
        valuationAt: effectiveAt.toISOString(),
        scope: { kind: 'DIMENSION_QUERY', dimensions: { dealer: 'ACME' } },
        positionDefinition: {
          definitionId: 'position-def-1',
          version: 1,
          digest: 'c'.repeat(64)
        },
        settlementBusinessDataId: 'payment-1',
        allocationPolicy: { id: 'policy-1', version: 1 },
        instructionId: 'instruction-1',
        settlementMapping: {
          foreignValueField: 'foreignAmount',
          foreignUnitField: 'foreignCurrency',
          localValueField: 'localAmount',
          localUnitField: 'localCurrency'
        }
      }
    });

    expect(captured.request?.requestBusinessDataId).toBe('request-settle-1');
    expect(captured.request?.settlementForeign.value).toBe('100');
    expect(captured.request?.settlementLocal.value).toBe('730');
    expect(captured.request?.position.carrying.value).toBe('720');
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

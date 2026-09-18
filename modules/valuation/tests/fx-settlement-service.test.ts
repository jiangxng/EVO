import { describe, expect, it } from 'vitest';
import type {
  AllocationInstruction,
  AllocationRelation,
  AllocationRun
} from '../../allocation/api/contracts.js';
import type {
  AllocationStore,
  RecordAllocationInstructionInput,
  RecordAllocationRelationInput,
  StartAllocationRunInput
} from '../../allocation/api/store.js';
import type {
  RecordValuationResultInput,
  StartValuationRunInput,
  ValuationStore
} from '../api/store.js';
import { DefaultFxSettlementService } from '../application/fx-settlement-service.js';

class FakeAllocationStore implements AllocationStore {
  readonly relations: RecordAllocationRelationInput[] = [];
  readonly runs: StartAllocationRunInput[] = [];
  completed: string[] = [];
  failed: string[] = [];

  async recordInstruction(_: RecordAllocationInstructionInput): Promise<AllocationInstruction> {
    throw new Error('not used');
  }
  async getInstruction(_: string): Promise<AllocationInstruction | null> {
    return null;
  }
  async startRun(input: StartAllocationRunInput): Promise<AllocationRun> {
    this.runs.push(input);
    return {
      id: 'allocation-run-1',
      enterpriseId: input.enterpriseId,
      allocationPolicyId: input.allocationPolicyId,
      allocationPolicyVersion: input.allocationPolicyVersion,
      status: 'PROCESSING',
      inputDigest: input.inputDigest,
      startedAt: new Date('2026-09-18T00:00:00Z')
    };
  }
  async recordRelation(input: RecordAllocationRelationInput): Promise<AllocationRelation> {
    this.relations.push(input);
    return { id: 'relation-1', ...input };
  }
  async completeRun(runId: string): Promise<void> {
    this.completed.push(runId);
  }
  async failRun(runId: string): Promise<void> {
    this.failed.push(runId);
  }
}

class FakeValuationStore implements ValuationStore {
  readonly runs: StartValuationRunInput[] = [];
  readonly results: RecordValuationResultInput[] = [];
  completed: string[] = [];
  failed: string[] = [];

  async startRun(input: StartValuationRunInput): Promise<string> {
    this.runs.push(input);
    return 'valuation-run-1';
  }
  async recordResult(input: RecordValuationResultInput): Promise<string> {
    this.results.push(input);
    return 'valuation-result-1';
  }
  async completeRun(runId: string): Promise<void> {
    this.completed.push(runId);
  }
  async failRun(runId: string): Promise<void> {
    this.failed.push(runId);
  }
}

describe('FX settlement service', () => {
  it('persists allocation closure and realized valuation with the same semantic input digest', async () => {
    const allocations = new FakeAllocationStore();
    const valuations = new FakeValuationStore();
    const service = new DefaultFxSettlementService(allocations, valuations);

    const result = await service.closePosition({
      enterpriseId: 'enterprise-1',
      settledAt: new Date('2026-09-18T01:00:00Z'),
      settlementBusinessDataId: 'payment-1',
      position: {
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
      },
      settlementForeign: {
        value: '100',
        unit: 'USD',
        role: 'SETTLEMENT_QUANTITY'
      },
      settlementLocal: {
        value: '712',
        unit: 'CNY',
        role: 'DIRECT_BUSINESS_AMOUNT'
      },
      allocationPolicyId: 'allocation-policy-1',
      allocationPolicyVersion: 1,
      instructionId: 'instruction-1'
    });

    expect(allocations.runs).toHaveLength(1);
    expect(valuations.runs).toHaveLength(1);
    expect(allocations.runs[0]!.inputDigest).toBe(result.inputDigest);
    expect(valuations.runs[0]!.inputDigest).toBe(result.inputDigest);

    expect(allocations.relations).toHaveLength(1);
    expect(allocations.relations[0]!.sourcePositionKey).toBe('AR:C1:USD');
    expect(allocations.relations[0]!.consumerBusinessDataId).toBe('payment-1');
    expect(allocations.relations[0]!.instructionId).toBe('instruction-1');
    expect(allocations.relations[0]!.measurements[0]!.value).toBe('100');

    expect(valuations.results).toHaveLength(1);
    expect(valuations.results[0]!.resultKind).toBe('FX_REALIZED_SETTLEMENT');
    expect(valuations.results[0]!.delta.value).toBe('12');
    expect(valuations.results[0]!.sourceBusinessDataIds).toEqual([
      'invoice-1',
      'payment-1'
    ]);

    expect(allocations.completed).toEqual(['allocation-run-1']);
    expect(valuations.completed).toEqual(['valuation-run-1']);
  });
});

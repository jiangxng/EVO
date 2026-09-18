import { createHash } from 'node:crypto';
import type { AllocationStore } from '../../allocation/api/store.js';
import type { JsonObject, JsonValue } from '../../metadata/api/contracts.js';
import type { CalculationDependencyStore } from '../../lineage/api/contracts.js';
import {
  ECONOMIC_RUNTIME_DEPENDENCY_GRAPH_VERSION,
  versionedDependencyNodeId
} from '../../lineage/domain/node-identity.js';
import type {
  FxSettlementClosureRequest,
  FxSettlementRunResult,
  FxSettlementService
} from '../api/fx.js';
import type { ValuationStore } from '../api/store.js';
import { closeFxPosition } from '../domain/fx-settlement.js';

function canonical(value: JsonValue): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const object = value as JsonObject;
  return `{${Object.keys(object).sort().map((key) =>
    `${JSON.stringify(key)}:${canonical(object[key] ?? null)}`
  ).join(',')}}`;
}

function digest(request: FxSettlementClosureRequest): string {
  const semantic: JsonObject = {
    enterpriseId: request.enterpriseId,
    requestBusinessDataId: request.requestBusinessDataId ?? null,
    settledAt: request.settledAt.toISOString(),
    settlementBusinessDataId: request.settlementBusinessDataId,
    position: {
      positionKey: request.position.positionKey,
      sourceBusinessDataIds: [...request.position.sourceBusinessDataIds].sort(),
      dimensions: request.position.dimensions,
      foreign: request.position.foreign as unknown as JsonValue,
      carrying: request.position.carrying as unknown as JsonValue
    } as unknown as JsonValue,
    settlementForeign: request.settlementForeign as unknown as JsonValue,
    settlementLocal: request.settlementLocal as unknown as JsonValue,
    allocationPolicyId: request.allocationPolicyId,
    allocationPolicyVersion: request.allocationPolicyVersion,
    instructionId: request.instructionId ?? null
  };

  return createHash('sha256').update(canonical(semantic)).digest('hex');
}

export class DefaultFxSettlementService implements FxSettlementService {
  constructor(
    private readonly allocations: AllocationStore,
    private readonly valuations: ValuationStore,
    private readonly dependencies: CalculationDependencyStore
  ) {}

  async closePosition(
    request: FxSettlementClosureRequest
  ): Promise<FxSettlementRunResult> {
    const result = closeFxPosition(
      request.position,
      request.settlementForeign,
      request.settlementLocal
    );
    const inputDigest = digest(request);

    const allocationRun = await this.allocations.startRun({
      enterpriseId: request.enterpriseId,
      allocationPolicyId: request.allocationPolicyId,
      allocationPolicyVersion: request.allocationPolicyVersion,
      inputDigest
    });

    let valuationRunId: string | undefined;

    try {
      await this.allocations.recordRelation({
        enterpriseId: request.enterpriseId,
        allocationRunId: allocationRun.id,
        sourcePositionKey: request.position.positionKey,
        consumerBusinessDataId: request.settlementBusinessDataId,
        measurements: [request.settlementForeign],
        sequence: 1,
        ...(request.instructionId !== undefined
          ? { instructionId: request.instructionId }
          : {}),
        allocationPolicyId: request.allocationPolicyId,
        allocationPolicyVersion: request.allocationPolicyVersion,
        lineage: {
          semantic: 'FX_SETTLEMENT_CLOSURE',
          sourceBusinessDataIds: request.position.sourceBusinessDataIds,
          carryingBasis: request.position.carrying as unknown as JsonValue,
          settlementLocal: request.settlementLocal as unknown as JsonValue
        }
      });

      await this.dependencies.recordDependency({
        enterpriseId: request.enterpriseId,
        graphVersion: ECONOMIC_RUNTIME_DEPENDENCY_GRAPH_VERSION,
        fromKind: 'POSITION',
        fromId: request.position.positionKey,
        toKind: 'BUSINESS_FACT',
        toId: request.settlementBusinessDataId,
        edgeKind: 'VALUATION',
        effectiveFrom: request.settledAt,
        lineage: {
          semantic: 'FX_SETTLEMENT_POSITION_DEPENDENCY',
          allocationRunId: allocationRun.id
        }
      });

      for (const sourceBusinessDataId of [...request.position.sourceBusinessDataIds].sort()) {
        await this.dependencies.recordDependency({
          enterpriseId: request.enterpriseId,
          graphVersion: ECONOMIC_RUNTIME_DEPENDENCY_GRAPH_VERSION,
          fromKind: 'BUSINESS_FACT',
          fromId: sourceBusinessDataId,
          toKind: 'BUSINESS_FACT',
          toId: request.settlementBusinessDataId,
          edgeKind: 'VALUATION',
          effectiveFrom: request.settledAt,
          lineage: {
            semantic: 'FX_SETTLEMENT_SOURCE_DEPENDENCY',
            allocationRunId: allocationRun.id
          }
        });
      }

      await this.dependencies.recordDependency({
        enterpriseId: request.enterpriseId,
        graphVersion: ECONOMIC_RUNTIME_DEPENDENCY_GRAPH_VERSION,
        fromKind: 'POLICY_VERSION',
        fromId: versionedDependencyNodeId(
          request.allocationPolicyId,
          request.allocationPolicyVersion
        ),
        toKind: 'BUSINESS_FACT',
        toId: request.settlementBusinessDataId,
        edgeKind: 'ALLOCATION',
        effectiveFrom: request.settledAt,
        lineage: {
          semantic: 'FX_SETTLEMENT_ALLOCATION_POLICY_DEPENDENCY',
          allocationRunId: allocationRun.id
        }
      });

      valuationRunId = await this.valuations.startRun({
        enterpriseId: request.enterpriseId,
        ...(request.requestBusinessDataId !== undefined
          ? { requestBusinessDataId: request.requestBusinessDataId }
          : {}),
        valuationKind: 'FX_REALIZED_SETTLEMENT',
        effectiveAt: request.settledAt,
        inputDigest,
        policy: {
          closureOnly: true,
          allocationPolicyId: request.allocationPolicyId,
          allocationPolicyVersion: request.allocationPolicyVersion
        }
      });

      await this.valuations.recordResult({
        enterpriseId: request.enterpriseId,
        valuationRunId,
        resultKind: 'FX_REALIZED_SETTLEMENT',
        positionKey: request.position.positionKey,
        sourceBusinessDataIds: [
          ...request.position.sourceBusinessDataIds,
          request.settlementBusinessDataId
        ],
        dimensions: request.position.dimensions,
        sourceMeasurements: [
          request.position.foreign,
          request.position.carrying,
          request.settlementForeign,
          request.settlementLocal
        ],
        targetMeasurements: [
          result.foreignConsumed,
          result.carryingBasis,
          result.settlementLocal,
          result.realizedDelta
        ],
        delta: result.realizedDelta,
        lineage: {
          settlementBusinessDataId: request.settlementBusinessDataId,
          allocationRunId: allocationRun.id,
          ...(request.instructionId !== undefined
            ? { instructionId: request.instructionId }
            : {}),
          allocationPolicyId: request.allocationPolicyId,
          allocationPolicyVersion: request.allocationPolicyVersion
        }
      });

      await this.allocations.completeRun(allocationRun.id);
      await this.valuations.completeRun(valuationRunId);

      return {
        valuationRunId,
        allocationRunId: allocationRun.id,
        inputDigest,
        result
      };
    } catch (error) {
      await this.allocations.failRun(allocationRun.id, error);
      if (valuationRunId !== undefined) {
        await this.valuations.failRun(valuationRunId, error);
      }
      throw error;
    }
  }
}

import { createHash } from 'node:crypto';
import type { RateObservation } from '../../economic/api/contracts.js';
import type { RateDatasetStore } from '../../economic/api/rate-store.js';
import type { JsonObject, JsonValue } from '../../metadata/api/contracts.js';
import type { CalculationDependencyStore } from '../../lineage/api/contracts.js';
import {
  ECONOMIC_RUNTIME_DEPENDENCY_GRAPH_VERSION,
  versionedDependencyNodeId
} from '../../lineage/domain/node-identity.js';
import type {
  FxPeriodEndRequest,
  FxPeriodEndRunResult,
  FxValuationService
} from '../api/fx.js';
import type { ValuationStore } from '../api/store.js';
import { revalueFxPosition } from '../domain/fx-period-end.js';

function canonical(value: JsonValue): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const object = value as JsonObject;
  return `{${Object.keys(object).sort().map((key) =>
    `${JSON.stringify(key)}:${canonical(object[key] ?? null)}`
  ).join(',')}}`;
}

function inputDigest(request: FxPeriodEndRequest): string {
  const positions = [...request.positions]
    .sort((a,b) => a.positionKey.localeCompare(b.positionKey))
    .map((position) => ({
      positionKey: position.positionKey,
      sourceBusinessDataIds: [...position.sourceBusinessDataIds].sort(),
      dimensions: position.dimensions,
      foreign: position.foreign,
      carrying: position.carrying
    }));

  const semantic: JsonObject = {
    enterpriseId: request.enterpriseId,
    valuationAt: request.valuationAt.toISOString(),
    rateDataset: {
      datasetId: request.rateDataset.datasetId,
      version: request.rateDataset.version,
      digest: request.rateDataset.digest
    },
    policy: {
      amountScale: request.policy.amountScale,
      roundingMode: request.policy.roundingMode
    },
    positions: positions as unknown as JsonValue
  };

  return createHash('sha256').update(canonical(semantic)).digest('hex');
}

function selectRate(
  observations: readonly RateObservation[],
  sourceUnit: string,
  targetUnit: string,
  valuationAt: Date
): RateObservation {
  const candidates = observations
    .filter((observation) =>
      observation.role === 'PERIOD_END_VALUATION' &&
      observation.sourceUnit === sourceUnit &&
      observation.targetUnit === targetUnit &&
      observation.effectiveAt.getTime() <= valuationAt.getTime()
    )
    .sort((left,right) => {
      const time = right.effectiveAt.getTime() - left.effectiveAt.getTime();
      if (time !== 0) return time;
      return left.id.localeCompare(right.id);
    });

  const selected = candidates[0];
  if (selected === undefined) {
    throw new Error(
      `No PERIOD_END_VALUATION rate for ${sourceUnit}/${targetUnit} at ${valuationAt.toISOString()}.`
    );
  }
  return selected;
}

export class DefaultFxValuationService implements FxValuationService {
  constructor(
    private readonly rates: RateDatasetStore,
    private readonly valuations: ValuationStore,
    private readonly dependencies: CalculationDependencyStore
  ) {}

  async revaluePeriodEnd(request: FxPeriodEndRequest): Promise<FxPeriodEndRunResult> {
    if (request.positions.length === 0) {
      throw new Error('FX period-end revaluation requires at least one position.');
    }

    const keys = new Set<string>();
    for (const position of request.positions) {
      if (keys.has(position.positionKey)) {
        throw new Error(`Duplicate FX position key ${position.positionKey}.`);
      }
      keys.add(position.positionKey);
    }

    const dataset = await this.rates.getById(request.rateDataset.datasetId);
    if (
      dataset === null ||
      dataset.status !== 'PUBLISHED' ||
      dataset.version !== request.rateDataset.version ||
      dataset.digest !== request.rateDataset.digest
    ) {
      throw new Error('Pinned FX rate dataset does not match the published immutable dataset.');
    }

    const observations = await this.rates.listObservations(dataset.id);
    const digest = inputDigest(request);

    const runId = await this.valuations.startRun({
      enterpriseId: request.enterpriseId,
      valuationKind: 'FX_PERIOD_END',
      effectiveAt: request.valuationAt,
      inputDigest: digest,
      rateDataset: request.rateDataset,
      policy: {
        amountScale: request.policy.amountScale,
        roundingMode: request.policy.roundingMode
      }
    });

    const results = [];
    try {
      for (const position of [...request.positions].sort((a,b) =>
        a.positionKey.localeCompare(b.positionKey)
      )) {
        const rate = selectRate(
          observations,
          position.foreign.unit,
          position.carrying.unit,
          request.valuationAt
        );
        const result = revalueFxPosition(position, rate, request.policy);

        for (const sourceBusinessDataId of [...position.sourceBusinessDataIds].sort()) {
          await this.dependencies.recordDependency({
            enterpriseId: request.enterpriseId,
            graphVersion: ECONOMIC_RUNTIME_DEPENDENCY_GRAPH_VERSION,
            fromKind: 'BUSINESS_FACT',
            fromId: sourceBusinessDataId,
            toKind: 'POSITION',
            toId: position.positionKey,
            edgeKind: 'VALUATION',
            effectiveFrom: request.valuationAt,
            lineage: {
              semantic: 'FX_POSITION_SOURCE_DEPENDENCY',
              valuationRunId: runId
            }
          });
        }

        await this.dependencies.recordDependency({
          enterpriseId: request.enterpriseId,
          graphVersion: ECONOMIC_RUNTIME_DEPENDENCY_GRAPH_VERSION,
          fromKind: 'REFERENCE_DATASET',
          fromId: versionedDependencyNodeId(
            request.rateDataset.datasetId,
            request.rateDataset.version
          ),
          toKind: 'POSITION',
          toId: position.positionKey,
          edgeKind: 'VALUATION',
          effectiveFrom: request.valuationAt,
          lineage: {
            semantic: 'FX_PERIOD_END_RATE_DEPENDENCY',
            valuationRunId: runId,
            rateObservationId: rate.id
          }
        });

        await this.valuations.recordResult({
          enterpriseId: request.enterpriseId,
          valuationRunId: runId,
          resultKind: 'FX_PERIOD_END',
          positionKey: position.positionKey,
          sourceBusinessDataIds: position.sourceBusinessDataIds,
          dimensions: position.dimensions,
          sourceMeasurements: [position.foreign, position.carrying],
          targetMeasurements: [result.carryingAfter, result.delta],
          delta: result.delta,
          lineage: {
            rateObservationId: rate.id,
            rateDatasetId: request.rateDataset.datasetId,
            rateDatasetVersion: request.rateDataset.version,
            rateDatasetDigest: request.rateDataset.digest,
            rateEffectiveAt: rate.effectiveAt.toISOString(),
            rate: rate.rate
          }
        });

        results.push(result);
      }

      await this.valuations.completeRun(runId);
      return {
        valuationRunId: runId,
        inputDigest: digest,
        results
      };
    } catch (error) {
      await this.valuations.failRun(runId, error);
      throw error;
    }
  }
}

import type { JsonObject } from '../../metadata/api/contracts.js';
import {
  VALUATION_REQUEST_BUSINESS_DATA_TYPE,
  type FxPeriodEndValuationRequestPayload,
  type FxRealizedSettlementRequestPayload,
  type SettlementMeasurementMapping,
  type ValuationRequestPayload,
  type ValuationScopeSelector
} from '../api/request.js';

function object(value: unknown, label: string): JsonObject {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as JsonObject;
}

function string(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
  }
  return value;
}

function positiveVersion(value: unknown, label: string): number {
  if (!Number.isInteger(value) || Number(value) < 1) {
    throw new Error(`${label} must be a positive integer.`);
  }
  return Number(value);
}

function parseScope(payload: JsonObject): ValuationScopeSelector {
  const scope = object(payload.scope,'scope');
  const scopeKind = string(scope.kind,'scope.kind');
  if (scopeKind !== 'EXPLICIT_POSITIONS' && scopeKind !== 'DIMENSION_QUERY') {
    throw new Error(`Unsupported valuation scope kind ${scopeKind}.`);
  }
  return scopeKind === 'EXPLICIT_POSITIONS'
    ? {
        kind: 'EXPLICIT_POSITIONS',
        positionKeys: Array.isArray(scope.positionKeys)
          ? scope.positionKeys.map((value) => string(value,'scope.positionKeys[]'))
          : []
      }
    : {
        kind: 'DIMENSION_QUERY',
        dimensions: object(scope.dimensions ?? {},'scope.dimensions')
      };
}

function parsePositionDefinition(payload: JsonObject) {
  const positionDefinition = object(payload.positionDefinition,'positionDefinition');
  return {
    definitionId: string(positionDefinition.definitionId,'positionDefinition.definitionId'),
    version: positiveVersion(positionDefinition.version,'positionDefinition.version'),
    digest: string(positionDefinition.digest,'positionDefinition.digest')
  };
}

function parseSettlementMapping(value: unknown): SettlementMeasurementMapping {
  const mapping = object(value,'settlementMapping');
  return {
    foreignValueField: string(mapping.foreignValueField,'settlementMapping.foreignValueField'),
    foreignUnitField: string(mapping.foreignUnitField,'settlementMapping.foreignUnitField'),
    localValueField: string(mapping.localValueField,'settlementMapping.localValueField'),
    localUnitField: string(mapping.localUnitField,'settlementMapping.localUnitField')
  };
}

export function parseValuationRequestPayload(
  businessDataType: string,
  payload: JsonObject
): ValuationRequestPayload {
  if (businessDataType !== VALUATION_REQUEST_BUSINESS_DATA_TYPE) {
    throw new Error(`Unsupported valuation request BusinessData type ${businessDataType}.`);
  }

  const requestCode = string(payload.requestCode,'requestCode');
  const valuationKind = string(payload.valuationKind,'valuationKind');
  const valuationAt = string(payload.valuationAt,'valuationAt');
  const scope = parseScope(payload);
  const positionDefinition = parsePositionDefinition(payload);

  if (valuationKind === 'FX_PERIOD_END') {
    const rateDataset = object(payload.rateDataset,'rateDataset');
    const result: FxPeriodEndValuationRequestPayload = {
      requestCode,
      valuationKind,
      valuationAt,
      scope,
      positionDefinition,
      rateDataset: {
        datasetId: string(rateDataset.datasetId,'rateDataset.datasetId'),
        version: positiveVersion(rateDataset.version,'rateDataset.version'),
        digest: string(rateDataset.digest,'rateDataset.digest')
      },
      policy: object(payload.policy,'policy')
    };
    return result;
  }

  if (valuationKind === 'FX_REALIZED_SETTLEMENT') {
    const allocationPolicy = object(payload.allocationPolicy,'allocationPolicy');
    const result: FxRealizedSettlementRequestPayload = {
      requestCode,
      valuationKind,
      valuationAt,
      scope,
      positionDefinition,
      settlementBusinessDataId: string(
        payload.settlementBusinessDataId,
        'settlementBusinessDataId'
      ),
      allocationPolicy: {
        id: string(allocationPolicy.id,'allocationPolicy.id'),
        version: positiveVersion(
          allocationPolicy.version,
          'allocationPolicy.version'
        )
      },
      instructionId: string(payload.instructionId,'instructionId'),
      settlementMapping: parseSettlementMapping(payload.settlementMapping)
    };
    return result;
  }

  throw new Error(`Unsupported valuation request kind ${valuationKind}.`);
}

import type { JsonObject } from '../../metadata/api/contracts.js';
import {
  VALUATION_REQUEST_BUSINESS_DATA_TYPE,
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

export function parseValuationRequestPayload(
  businessDataType: string,
  payload: JsonObject
): ValuationRequestPayload {
  if (businessDataType !== VALUATION_REQUEST_BUSINESS_DATA_TYPE) {
    throw new Error(`Unsupported valuation request BusinessData type ${businessDataType}.`);
  }

  const valuationKind = string(payload.valuationKind,'valuationKind');
  if (valuationKind !== 'FX_PERIOD_END') {
    throw new Error(`Unsupported valuation request kind ${valuationKind}.`);
  }

  const scope = object(payload.scope,'scope');
  const scopeKind = string(scope.kind,'scope.kind');
  if (scopeKind !== 'EXPLICIT_POSITIONS' && scopeKind !== 'DIMENSION_QUERY') {
    throw new Error(`Unsupported valuation scope kind ${scopeKind}.`);
  }

  const rateDataset = object(payload.rateDataset,'rateDataset');
  const version = rateDataset.version;
  if (!Number.isInteger(version) || Number(version) < 1) {
    throw new Error('rateDataset.version must be a positive integer.');
  }

  const parsedScope: ValuationScopeSelector =
    scopeKind === 'EXPLICIT_POSITIONS'
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

  return {
    requestCode: string(payload.requestCode,'requestCode'),
    valuationKind,
    valuationAt: string(payload.valuationAt,'valuationAt'),
    scope: parsedScope,
    rateDataset: {
      datasetId: string(rateDataset.datasetId,'rateDataset.datasetId'),
      version: Number(version),
      digest: string(rateDataset.digest,'rateDataset.digest')
    },
    policy: object(payload.policy,'policy')
  };
}

import type { JsonObject, JsonValue } from '../../metadata/api/contracts.js';
import type { ValuationInputDefinition } from '../api/valuation-input.js';

function stringArray(value: JsonValue | undefined, label: string): readonly string[] {
  if (!Array.isArray(value) || value.length === 0 || value.some((item) => typeof item !== 'string' || item.length === 0)) {
    throw new Error(`${label} must be a non-empty string array.`);
  }
  return value as readonly string[];
}

function requiredString(value: JsonValue | undefined, label: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
  }
  return value;
}

function optionalString(value: JsonValue | undefined): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export function valuationInputDefinition(
  config: JsonObject,
  poolDimensionSchema: JsonObject
): ValuationInputDefinition {
  const specificIdentityField = optionalString(config.specificIdentityField);
  return {
    inboundBusinessDataTypes: stringArray(config.inboundBusinessDataTypes, 'inboundBusinessDataTypes'),
    outboundBusinessDataTypes: stringArray(config.outboundBusinessDataTypes, 'outboundBusinessDataTypes'),
    quantityField: requiredString(config.quantityField, 'quantityField'),
    quantityUnit: requiredString(config.quantityUnit, 'quantityUnit'),
    basisAmountField: requiredString(config.basisAmountField, 'basisAmountField'),
    basisUnit: requiredString(config.basisUnit, 'basisUnit'),
    ...(specificIdentityField !== undefined ? { specificIdentityField } : {}),
    poolDimensions: stringArray(poolDimensionSchema.keys, 'pool_dimension_schema.keys')
  };
}

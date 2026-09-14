import type { JsonObject } from '../../metadata/api/contracts.js';

export interface LedgerDimensionPolicy {
  readonly required?: readonly string[];
  readonly optional?: readonly string[];
  readonly forbidden?: readonly string[];
}

export interface DimensionValidationInput {
  readonly enterpriseId: string;
  readonly ledgerCode: string;
  readonly policy: LedgerDimensionPolicy;
  readonly dimensions: JsonObject;
}

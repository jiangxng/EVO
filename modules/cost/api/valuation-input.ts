import type { Measurement, EconomicOrderKey } from '../../economic/api/contracts.js';
import type { JsonObject } from '../../metadata/api/contracts.js';

export type ValuationInputDirection = 'INBOUND' | 'OUTBOUND';

export interface ValuationInputDefinition {
  readonly inboundBusinessDataTypes: readonly string[];
  readonly outboundBusinessDataTypes: readonly string[];
  readonly quantityField: string;
  readonly quantityUnit: string;
  readonly basisAmountField: string;
  readonly basisUnit: string;
  readonly specificIdentityField?: string;
  readonly poolDimensions: readonly string[];
}

export interface ValuationInput {
  readonly businessDataId: string;
  readonly businessDataType: string;
  readonly direction: ValuationInputDirection;
  readonly order: EconomicOrderKey;
  readonly poolKey: string;
  readonly poolDimensions: JsonObject;
  readonly quantity: Measurement;
  readonly basis?: Measurement;
  readonly specificIdentity?: string;
}

export interface ValuationInputReader {
  list(
    enterpriseId: string,
    definition: ValuationInputDefinition
  ): Promise<readonly ValuationInput[]>;
}

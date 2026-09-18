import type { RateDatasetPin } from '../../economic/api/contracts.js';
import type { JsonObject } from '../../metadata/api/contracts.js';
import type { PositionDefinitionPin } from '../../position/api/contracts.js';

export const VALUATION_REQUEST_BUSINESS_DATA_TYPE = 'valuation.requested';

export type ValuationRequestKind =
  | 'FX_PERIOD_END';

export type ValuationScopeSelector =
  | {
      readonly kind: 'EXPLICIT_POSITIONS';
      readonly positionKeys: readonly string[];
    }
  | {
      readonly kind: 'DIMENSION_QUERY';
      readonly dimensions: JsonObject;
    };

export interface ValuationRequestPayload {
  readonly requestCode: string;
  readonly valuationKind: ValuationRequestKind;
  readonly valuationAt: string;
  readonly scope: ValuationScopeSelector;
  readonly positionDefinition: PositionDefinitionPin;
  readonly rateDataset: RateDatasetPin;
  readonly policy: JsonObject;
}

export interface AcceptedValuationRequest {
  readonly businessDataId: string;
  readonly enterpriseId: string;
  readonly effectiveAt: Date;
  readonly payload: ValuationRequestPayload;
}

export interface ValuationRequestInterpreter {
  replayAcceptedRequest(request: AcceptedValuationRequest): Promise<void>;
}

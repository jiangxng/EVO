import type { RateDatasetPin } from '../../economic/api/contracts.js';
import type { JsonObject } from '../../metadata/api/contracts.js';

export const VALUATION_REQUEST_BUSINESS_DATA_TYPE = 'valuation.requested';

export type ValuationRequestKind =
  | 'FX_PERIOD_END';

export interface ValuationScopeSelector {
  readonly kind: 'EXPLICIT_POSITIONS' | 'DIMENSION_QUERY';
  readonly positionKeys?: readonly string[];
  readonly dimensions?: JsonObject;
}

export interface ValuationRequestPayload {
  readonly requestCode: string;
  readonly valuationKind: ValuationRequestKind;
  readonly valuationAt: string;
  readonly scope: ValuationScopeSelector;
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

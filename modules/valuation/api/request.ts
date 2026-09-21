import type { RateDatasetPin } from '../../economic/api/contracts.js';
import type { JsonObject } from '../../metadata/api/contracts.js';
import type { MaterializationContext } from '../../materialization/api/context.js';
import type { PositionDefinitionPin } from '../../position/api/contracts.js';

export const VALUATION_REQUEST_BUSINESS_DATA_TYPE = 'valuation.requested';

export type ValuationRequestKind =
  | 'FX_PERIOD_END'
  | 'FX_REALIZED_SETTLEMENT';

export type ValuationScopeSelector =
  | {
      readonly kind: 'EXPLICIT_POSITIONS';
      readonly positionKeys: readonly string[];
    }
  | {
      readonly kind: 'DIMENSION_QUERY';
      readonly dimensions: JsonObject;
    };

export interface ValuationRequestBase {
  readonly requestCode: string;
  readonly valuationKind: ValuationRequestKind;
  readonly valuationAt: string;
  readonly scope: ValuationScopeSelector;
  readonly positionDefinition: PositionDefinitionPin;
}

export interface FxPeriodEndValuationRequestPayload extends ValuationRequestBase {
  readonly valuationKind: 'FX_PERIOD_END';
  readonly rateDataset: RateDatasetPin;
  readonly policy: JsonObject;
}

export interface SettlementMeasurementMapping {
  readonly foreignValueField: string;
  readonly foreignUnitField: string;
  readonly localValueField: string;
  readonly localUnitField: string;
}

export interface FxRealizedSettlementRequestPayload extends ValuationRequestBase {
  readonly valuationKind: 'FX_REALIZED_SETTLEMENT';
  readonly settlementBusinessDataId: string;
  readonly allocationPolicy: {
    readonly id: string;
    readonly version: number;
  };
  readonly instructionId: string;
  readonly settlementMapping: SettlementMeasurementMapping;
}

export type ValuationRequestPayload =
  | FxPeriodEndValuationRequestPayload
  | FxRealizedSettlementRequestPayload;

export interface AcceptedValuationRequest {
  readonly businessDataId: string;
  readonly enterpriseId: string;
  readonly effectiveAt: Date;
  readonly payload: ValuationRequestPayload;
  readonly materialization?: MaterializationContext;
}

export interface ValuationRequestInterpreter {
  replayAcceptedRequest(request: AcceptedValuationRequest): Promise<void>;
}

export interface ValuationRequestReplayResult {
  readonly replayedRequestCount: number;
}

export interface ValuationRequestReplayService {
  replayAcceptedRequests(
    enterpriseId: string,
    consistencyDomain: string,
    boundarySequence: bigint,
    materialization?: MaterializationContext
  ): Promise<ValuationRequestReplayResult>;
}

import type {
  Measurement,
  RateDatasetPin
} from '../../economic/api/contracts.js';
import type { JsonObject } from '../../metadata/api/contracts.js';

export interface FxPositionSnapshot {
  readonly positionKey: string;
  readonly sourceBusinessDataIds: readonly string[];
  readonly dimensions: JsonObject;
  readonly foreign: Measurement;
  readonly carrying: Measurement;
}

export interface FxRevaluationPolicy {
  readonly amountScale: number;
  readonly roundingMode: 'HALF_UP';
}

export interface FxPeriodEndRequest {
  readonly enterpriseId: string;
  readonly requestBusinessDataId?: string;
  readonly valuationAt: Date;
  readonly rateDataset: RateDatasetPin;
  readonly policy: FxRevaluationPolicy;
  readonly positions: readonly FxPositionSnapshot[];
}

export interface FxRevaluationResult {
  readonly positionKey: string;
  readonly foreign: Measurement;
  readonly carryingBefore: Measurement;
  readonly carryingAfter: Measurement;
  readonly delta: Measurement;
  readonly rateObservationId: string;
  readonly rate: string;
}

export interface FxPeriodEndRunResult {
  readonly valuationRunId: string;
  readonly inputDigest: string;
  readonly results: readonly FxRevaluationResult[];
}

export interface FxValuationService {
  revaluePeriodEnd(request: FxPeriodEndRequest): Promise<FxPeriodEndRunResult>;
}


export interface FxSettlementClosureRequest {
  readonly enterpriseId: string;
  readonly requestBusinessDataId?: string;
  readonly settledAt: Date;
  readonly settlementBusinessDataId: string;
  readonly position: FxPositionSnapshot;
  readonly settlementForeign: Measurement;
  readonly settlementLocal: Measurement;
  readonly allocationPolicyId: string;
  readonly allocationPolicyVersion: number;
  readonly instructionId?: string;
}

export interface FxSettlementClosureResult {
  readonly positionKey: string;
  readonly foreignConsumed: Measurement;
  readonly carryingBasis: Measurement;
  readonly settlementLocal: Measurement;
  readonly realizedDelta: Measurement;
}

export interface FxSettlementRunResult {
  readonly valuationRunId: string;
  readonly allocationRunId: string;
  readonly inputDigest: string;
  readonly result: FxSettlementClosureResult;
}

export interface FxSettlementService {
  closePosition(
    request: FxSettlementClosureRequest
  ): Promise<FxSettlementRunResult>;
}

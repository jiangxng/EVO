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

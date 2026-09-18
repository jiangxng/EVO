import type {
  Measurement,
  RateDatasetPin
} from '../../economic/api/contracts.js';
import type { JsonObject } from '../../metadata/api/contracts.js';

export interface StartValuationRunInput {
  readonly enterpriseId: string;
  readonly requestBusinessDataId?: string;
  readonly valuationKind: string;
  readonly effectiveAt: Date;
  readonly inputDigest: string;
  readonly rateDataset?: RateDatasetPin;
  readonly policy: JsonObject;
}

export interface RecordValuationResultInput {
  readonly enterpriseId: string;
  readonly valuationRunId: string;
  readonly resultKind: string;
  readonly positionKey: string;
  readonly sourceBusinessDataIds: readonly string[];
  readonly dimensions: JsonObject;
  readonly sourceMeasurements: readonly Measurement[];
  readonly targetMeasurements: readonly Measurement[];
  readonly delta: Measurement;
  readonly lineage: JsonObject;
}

export interface ValuationStore {
  startRun(input: StartValuationRunInput): Promise<string>;
  recordResult(input: RecordValuationResultInput): Promise<string>;
  completeRun(runId: string): Promise<void>;
  failRun(runId: string, error: unknown): Promise<void>;
}

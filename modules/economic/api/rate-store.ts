import type {
  RateDataset,
  RateObservation,
  RateRole
} from './contracts.js';
import type { JsonObject } from '../../metadata/api/contracts.js';

export interface PublishRateObservationInput {
  readonly role: RateRole;
  readonly sourceUnit: string;
  readonly targetUnit: string;
  readonly rate: string;
  readonly effectiveAt: Date;
  readonly precision: number;
  readonly metadata?: JsonObject;
}

export interface PublishRateDatasetInput {
  readonly enterpriseId?: string;
  readonly code: string;
  readonly version: number;
  readonly provider: string;
  readonly config?: JsonObject;
  readonly observations: readonly PublishRateObservationInput[];
}

export interface RateDatasetStore {
  publish(input: PublishRateDatasetInput): Promise<RateDataset>;
  get(code: string, version: number, enterpriseId?: string): Promise<RateDataset | null>;
  listObservations(datasetId: string): Promise<readonly RateObservation[]>;
}

import type { JsonObject } from '../../metadata/api/contracts.js';

export type MeasurementRole =
  | 'RESOURCE_QUANTITY'
  | 'DIRECT_BUSINESS_AMOUNT'
  | 'SETTLEMENT_QUANTITY'
  | 'VALUATION_AMOUNT'
  | 'REPORTING_AMOUNT';

export interface Measurement {
  readonly value: string;
  readonly unit: string;
  readonly role: MeasurementRole;
  readonly metadata?: JsonObject;
}

export type BasisEvidenceKind =
  | 'ACQUISITION'
  | 'CONTRACT'
  | 'SETTLEMENT'
  | 'TRANSFERRED_SOURCE'
  | 'EXPLICIT_RATE_SNAPSHOT';

export interface BasisEvidence {
  readonly id: string;
  readonly enterpriseId: string;
  readonly businessDataId: string;
  readonly kind: BasisEvidenceKind;
  readonly measurements: readonly Measurement[];
  readonly effectiveAt: Date;
  readonly recordedAt: Date;
  readonly provenance: JsonObject;
}

export type RateRole =
  | 'TRANSACTION_RECOGNITION'
  | 'SETTLEMENT'
  | 'PERIOD_END_VALUATION'
  | 'REPORTING_CONVERSION';

export type RateConvention = 'TARGET_PER_SOURCE';

export interface RateDatasetPin {
  readonly datasetId: string;
  readonly version: number;
  readonly digest: string;
}

export interface RateObservation {
  readonly id: string;
  readonly dataset: RateDatasetPin;
  readonly role: RateRole;
  readonly sourceUnit: string;
  readonly targetUnit: string;
  readonly convention: RateConvention;
  readonly rate: string;
  readonly effectiveAt: Date;
  readonly provider: string;
  readonly precision: number;
  readonly metadata?: JsonObject;
}

export interface EconomicOrderKey {
  readonly effectiveAt: Date;
  readonly semanticSequence: bigint;
  readonly stableTieBreaker: string;
}

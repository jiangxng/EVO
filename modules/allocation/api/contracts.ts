import type { JsonObject } from '../../metadata/api/contracts.js';
import type { Measurement } from '../../economic/api/contracts.js';

export type AllocationMode =
  | 'EXPLICIT'
  | 'AUTOMATIC'
  | 'EXPLICIT_THEN_AUTOMATIC';

export type AllocationSourceOrdering =
  | 'OLDEST_FIRST'
  | 'NEWEST_FIRST'
  | 'EXPLICIT_ONLY'
  | 'POLICY_DEFINED';

export type NegativePositionPolicy =
  | 'REJECT'
  | 'ALLOW_PROVISIONAL'
  | 'DEFER_VALUATION'
  | 'POLICY_DEFINED';

export interface AllocationSourceSelector {
  readonly kind: 'BUSINESS_DATA' | 'POSITION' | 'DIMENSION_QUERY';
  readonly businessDataId?: string;
  readonly positionId?: string;
  readonly dimensions?: JsonObject;
  readonly selectorValue?: string;
}

export interface AllocationInstruction {
  readonly id: string;
  readonly enterpriseId: string;
  readonly consumerBusinessDataId: string;
  readonly mode: AllocationMode;
  readonly sourceSelector: AllocationSourceSelector;
  readonly actorType: 'HUMAN' | 'AI' | 'AUTOMATION' | 'EXTERNAL_SYSTEM';
  readonly actorId: string;
  readonly effectiveAt: Date;
  readonly recordedAt: Date;
  readonly reason?: string;
  readonly allocationPolicyId: string;
  readonly allocationPolicyVersion: number;
  readonly supersedesInstructionId?: string;
  readonly idempotencyKey: string;
}

export interface AllocationPrecisionPolicy {
  readonly quantityScale: number;
  readonly amountScale: number;
  readonly roundingMode: string;
  readonly residualRecipient: 'FINAL_SOURCE' | 'LARGEST_ALLOCATION' | 'POLICY_DEFINED';
}

export interface AllocationPolicy {
  readonly id: string;
  readonly version: number;
  readonly dimensions: readonly string[];
  readonly eligibility: JsonObject;
  readonly sourceOrdering: AllocationSourceOrdering;
  readonly allowPartialAllocation: boolean;
  readonly negativePositionPolicy: NegativePositionPolicy;
  readonly precision: AllocationPrecisionPolicy;
  readonly config: JsonObject;
}

export interface AllocationRelation {
  readonly id: string;
  readonly enterpriseId: string;
  readonly allocationRunId: string;
  readonly sourceBusinessDataId?: string;
  readonly sourcePositionId?: string;
  readonly consumerBusinessDataId: string;
  readonly measurements: readonly Measurement[];
  readonly sequence: number;
  readonly instructionId?: string;
  readonly allocationPolicyId: string;
  readonly allocationPolicyVersion: number;
  readonly lineage: JsonObject;
}

export interface AllocationRun {
  readonly id: string;
  readonly enterpriseId: string;
  readonly allocationPolicyId: string;
  readonly allocationPolicyVersion: number;
  readonly status: 'PROCESSING' | 'COMPLETED' | 'FAILED';
  readonly inputDigest: string;
  readonly startedAt: Date;
  readonly completedAt?: Date;
}

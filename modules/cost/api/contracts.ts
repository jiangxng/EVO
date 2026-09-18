import type {
  AllocationPrecisionPolicy,
  AllocationSourceOrdering,
  NegativePositionPolicy
} from '../../allocation/api/contracts.js';
import type { RateDatasetPin } from '../../economic/api/contracts.js';
import type { JsonObject } from '../../metadata/api/contracts.js';

export type CostMethod =
  | 'FIFO'
  | 'LIFO'
  | 'MOVING_AVERAGE'
  | 'SPECIFIC_IDENTIFICATION';

export type CostSourceSelectorMode =
  | 'ORDERED_LAYERS'
  | 'EXPLICIT_SOURCE'
  | 'VALUATION_POOL';

export type BasisCarryForwardPolicy =
  | 'PRESERVE_SOURCE_BASIS'
  | 'REVALUE'
  | 'POLICY_DEFINED';

export type ReturnRestorationPolicy =
  | 'RESTORE_ORIGINAL_BASIS'
  | 'CURRENT_POOL_BASIS'
  | 'POLICY_DEFINED';

export interface CostMethodPolicy {
  readonly id: string;
  readonly version: number;
  readonly method: CostMethod;
  readonly valuationScopeDimensions: readonly string[];
  readonly sourceEligibility: JsonObject;
  readonly sourceOrdering: AllocationSourceOrdering;
  readonly sourceSelectorMode: CostSourceSelectorMode;
  readonly negativePositionPolicy: NegativePositionPolicy;
  readonly precision: AllocationPrecisionPolicy;
  readonly basisCarryForwardPolicy: BasisCarryForwardPolicy;
  readonly returnRestorationPolicy: ReturnRestorationPolicy;
  readonly effectiveOrderingContract: string;
  readonly config: JsonObject;
}

export interface CostReplayPins {
  readonly valuationPolicyId?: string;
  readonly valuationPolicyVersion?: number;
  readonly allocationPolicyId?: string;
  readonly allocationPolicyVersion?: number;
  readonly costMethodPolicyId?: string;
  readonly costMethodPolicyVersion?: number;
  readonly rateDatasets?: Readonly<Record<string, RateDatasetPin>>;
  readonly valuationRules?: Readonly<Record<string, { readonly id: string; readonly version: number }>>;
}

export interface AuthoritativeCostRequest {
  readonly enterpriseId: string;
  readonly method: CostMethod;
  readonly policy: {
    readonly id: string;
    readonly version: number;
  };
  readonly pins: CostReplayPins;
  readonly inputBoundaryDigest: string;
}

export interface CostRecalculationResult {
  readonly costRunId: string;
  readonly method: CostMethod;
  readonly resultCount: number;
  readonly valuationPostingCount: number;
}

export interface CostEngine {
  recalculate(
    enterpriseId: string,
    method: CostMethod,
    pins?: CostReplayPins
  ): Promise<CostRecalculationResult>;
}

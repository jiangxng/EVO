import type { CostMethod, CostReplayPins } from '../../cost/api/contracts.js';
import type { JsonObject } from '../../metadata/api/contracts.js';

export type ReplayMode =
  | 'FULL'
  | 'INCREMENTAL';

export type ReplayRuntimeMode =
  | 'LIVE'
  | 'REPLAY_PREPARING'
  | 'REPLAY'
  | 'REPLAY_VERIFYING'
  | 'RECOVERY';

export type ImpactRootKind =
  | 'BUSINESS_FACT'
  | 'ALLOCATION_INSTRUCTION'
  | 'POLICY_VERSION'
  | 'REFERENCE_DATASET'
  | 'TEMPLATE_DEFINITION'
  | 'MATERIALIZATION'
  | 'RUNTIME_SEMANTIC_VERSION';

export interface ImpactRoot {
  readonly kind: ImpactRootKind;
  readonly id: string;
  readonly effectiveAt?: Date;
  readonly metadata?: JsonObject;
}

export type DependencyEdgeKind =
  | 'ALLOCATION'
  | 'VALUATION'
  | 'PROJECTION'
  | 'MATERIALIZATION'
  | 'CALCULATION';

export interface CalculationDependencyEdge {
  readonly id: string;
  readonly enterpriseId: string;
  readonly graphVersion: string;
  readonly fromKind: string;
  readonly fromId: string;
  readonly toKind: string;
  readonly toId: string;
  readonly edgeKind: DependencyEdgeKind;
  readonly effectiveFrom?: Date;
  readonly lineage: JsonObject;
}

export interface ReplayCheckpointDescriptor {
  readonly id: string;
  readonly enterpriseId: string;
  readonly consistencyDomain: string;
  readonly boundarySequence: bigint;
  readonly orderedInputDigest: string;
  readonly lastIncludedFactId?: string;
  readonly templateVersion: string;
  readonly postingPolicyPins: JsonObject;
  readonly allocationPolicyPins: JsonObject;
  readonly valuationPolicyPins: JsonObject;
  readonly referenceDatasetPins: JsonObject;
  readonly runtimeSemanticVersion: string;
  readonly dependencyGraphVersion: string;
  readonly materializationDigest: string;
  readonly validity: JsonObject;
  readonly parentCheckpointId?: string;
}

export interface IncrementalReplayPlan {
  readonly enterpriseId: string;
  readonly consistencyDomain: string;
  readonly graphVersion: string;
  readonly impactRoots: readonly ImpactRoot[];
  readonly dependencyClosure: readonly CalculationDependencyEdge[];
  readonly earliestAffectedSequence: bigint;
  readonly checkpoint?: ReplayCheckpointDescriptor;
  readonly fallbackToFullReplay: boolean;
  readonly fallbackReasons: readonly string[];
  readonly planDigest: string;
}

export interface PlanIncrementalReplayRequest {
  readonly enterpriseId: string;
  readonly consistencyDomain: string;
  readonly graphVersion: string;
  readonly runtimeSemanticVersion: string;
  readonly impactRoots: readonly ImpactRoot[];
  readonly earliestAffectedSequence: bigint;
  readonly dependencyGraphComplete: boolean;
}

export interface IncrementalReplayPlanner {
  plan(request: PlanIncrementalReplayRequest): Promise<IncrementalReplayPlan>;
}

export interface ReplayEquivalenceResult {
  readonly incrementalDigest: string;
  readonly fullReplayDigest: string;
  readonly equivalent: boolean;
}

export interface ReplayResult {
  readonly replayRunId: string;
  readonly boundarySequence: bigint;
  readonly beforeDigest: string;
  readonly costMethod: CostMethod | null;
  readonly costPins: CostReplayPins | null;
}

export interface ReplayService {
  prepareFullReplay(enterpriseId: string): Promise<ReplayResult>;
  completeFullReplay(
    replayRunId: string,
    enterpriseId: string,
    afterDigest: string
  ): Promise<void>;
}

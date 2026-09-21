import type {
  CostCheckpointStateProjector,
  CostPoolCheckpointState
} from './checkpoint-state.js';
import type { CostMethod } from './contracts.js';

export interface BuildCostCheckpointStateRequest {
  readonly enterpriseId: string;
  readonly method: CostMethod;
  readonly valuationPolicyId: string;
  readonly valuationPolicyVersion: number;
  readonly boundarySequence: bigint;
}

export interface CostCheckpointStateBuilder {
  build(
    request: BuildCostCheckpointStateRequest
  ): Promise<readonly CostPoolCheckpointState[]>;
}

export type { CostCheckpointStateProjector };

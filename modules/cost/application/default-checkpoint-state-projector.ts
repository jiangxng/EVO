import type {
  CostCheckpointStateProjector,
  CostPoolCheckpointState
} from '../api/checkpoint-state.js';
import type { CostMethod } from '../api/contracts.js';
import type { ValuationInput } from '../api/valuation-input.js';
import { projectCostPoolCheckpointStates } from '../domain/checkpoint-state.js';

export class DefaultCostCheckpointStateProjector
implements CostCheckpointStateProjector {
  project(
    method: CostMethod,
    inputs: readonly ValuationInput[]
  ): readonly CostPoolCheckpointState[] {
    return projectCostPoolCheckpointStates(method,inputs);
  }
}

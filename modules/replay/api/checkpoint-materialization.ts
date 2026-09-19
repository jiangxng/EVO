import type { CostPoolCheckpointState } from '../../cost/api/checkpoint-state.js';

export interface CheckpointCostPoolMaterialization {
  readonly id: string;
  readonly checkpointId: string;
  readonly state: CostPoolCheckpointState;
  readonly semanticDigest: string;
  readonly createdAt: Date;
}

export interface ReplayCheckpointMaterializationService {
  captureCostPools(
    checkpointId: string
  ): Promise<readonly CheckpointCostPoolMaterialization[]>;

  loadCostPools(
    checkpointId: string
  ): Promise<readonly CheckpointCostPoolMaterialization[]>;
}

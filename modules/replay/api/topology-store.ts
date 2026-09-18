import type { CalculationDependencyStore } from '../../lineage/api/contracts.js';
import type { ReplayCheckpointDescriptor } from './contracts.js';

export interface ReplayTopologyStore extends CalculationDependencyStore {
  saveCheckpoint(checkpoint: ReplayCheckpointDescriptor): Promise<void>;

  getLatestValidCheckpoint(
    enterpriseId: string,
    consistencyDomain: string,
    atOrBeforeSequence: bigint
  ): Promise<ReplayCheckpointDescriptor | null>;

  invalidateCheckpoint(
    checkpointId: string,
    reason: string
  ): Promise<void>;
}

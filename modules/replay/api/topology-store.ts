import type { CalculationDependencyStore } from '../../lineage/api/contracts.js';
import type { ReplayCheckpointDescriptor } from './contracts.js';

export interface ReplayTopologyStore extends CalculationDependencyStore {
  saveCheckpoint(checkpoint: ReplayCheckpointDescriptor): Promise<void>;

  getCheckpointBySourceReplayRun(
    replayRunId: string
  ): Promise<ReplayCheckpointDescriptor | null>;

  getLatestValidCheckpoint(
    enterpriseId: string,
    consistencyDomain: string,
    atOrBeforeSequence: bigint
  ): Promise<ReplayCheckpointDescriptor | null>;

  getLatestIncrementalSafeCheckpoint(
    enterpriseId: string,
    consistencyDomain: string,
    atOrBeforeSequence: bigint
  ): Promise<ReplayCheckpointDescriptor | null>;

  invalidateCheckpoint(
    checkpointId: string,
    reason: string
  ): Promise<void>;
}

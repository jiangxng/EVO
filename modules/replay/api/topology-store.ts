import type {
  CalculationDependencyEdge,
  ReplayCheckpointDescriptor
} from './contracts.js';

export interface ReplayTopologyStore {
  recordDependency(edge: CalculationDependencyEdge): Promise<void>;
  listDependents(
    enterpriseId: string,
    graphVersion: string,
    fromKind: string,
    fromId: string
  ): Promise<readonly CalculationDependencyEdge[]>;

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

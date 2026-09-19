import type { ReplayCheckpointDescriptor } from './contracts.js';

export interface ReplayCheckpointService {
  createFromVerifiedFullReplay(
    replayRunId: string,
    enterpriseId: string
  ): Promise<ReplayCheckpointDescriptor>;
}

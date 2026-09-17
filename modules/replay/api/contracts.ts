import type { CostMethod, CostReplayPins } from '../../cost/api/contracts.js';

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

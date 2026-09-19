import type { MaterializationContext } from '../../materialization/api/context.js';

export interface CandidatePostingReplayResult {
  readonly postingInputCount: number;
  readonly postingRunIds: readonly string[];
  readonly ledgerEffectCount: number;
}

export interface CandidatePostingReplayService {
  replayRange(
    enterpriseId: string,
    afterSequence: bigint,
    atOrBeforeSequence: bigint,
    materialization: MaterializationContext
  ): Promise<CandidatePostingReplayResult>;
}

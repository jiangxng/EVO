export interface ReplayResult {
  readonly replayRunId: string;
  readonly boundarySequence: bigint;
  readonly beforeDigest: string;
}

export interface ReplayService {
  prepareFullReplay(enterpriseId: string): Promise<ReplayResult>;
  completeFullReplay(
    replayRunId: string,
    enterpriseId: string,
    afterDigest: string
  ): Promise<void>;
}

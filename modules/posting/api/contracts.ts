import type { JsonObject } from '../../metadata/api/contracts.js';

export interface PostingCandidate {
  readonly id: string;
  readonly enterpriseId: string;
  readonly consistencyDomain: string;
  readonly businessDataId: string;
  readonly applicationInstanceId: string;
  readonly applicationDefinitionId: string;
  readonly effectiveAt: Date;
  readonly postingPriority: number;
  readonly postingSequence: bigint;
  readonly metadataVersion: number;
}

export type PostingProcessResult =
  | {
      readonly status: 'IDLE' | 'BLOCKED_REPLAY_REQUIRED' | 'RACE_RETRY';
    }
  | {
      readonly status: 'POSTED';
      readonly postingInputId: string;
      readonly postingRunId: string;
      readonly ledgerEffectCount: number;
      readonly postingSequence: bigint;
    }
  | {
      readonly status: 'FAILED';
      readonly postingInputId: string;
      readonly errorCode: string;
      readonly retryable: boolean;
    };

export interface PostingFailureInfo {
  readonly code: string;
  readonly message: string;
  readonly retryable: boolean;
  readonly context: JsonObject;
}

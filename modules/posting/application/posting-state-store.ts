import type {
  DatabaseTransaction
} from '../../../platform/database/src/transaction.js';
import type {
  PostingCandidate,
  PostingFailureInfo
} from '../api/contracts.js';

export interface PostingQueueReader {
  peekNext(enterpriseId: string): Promise<PostingCandidate | null>;
}

export interface LockedPostingState {
  readonly state:
    | 'READY'
    | 'IDLE'
    | 'BLOCKED_REPLAY_REQUIRED'
    | 'RACE_RETRY';
  readonly candidate?: PostingCandidate;
}

export interface PostingStateStore {
  lockForCommit(
    transaction: DatabaseTransaction,
    enterpriseId: string,
    expectedPostingInputId: string
  ): Promise<LockedPostingState>;

  createPostingRun(
    transaction: DatabaseTransaction,
    candidate: PostingCandidate
  ): Promise<string>;

  completePosting(
    transaction: DatabaseTransaction,
    candidate: PostingCandidate,
    postingRunId: string
  ): Promise<void>;

  markFailed(
    enterpriseId: string,
    postingInputId: string,
    failure: PostingFailureInfo
  ): Promise<void>;
}

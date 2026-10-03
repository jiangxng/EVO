import type { JsonObject } from '../../metadata/api/contracts.js';

export interface BusinessDataRecord {
  readonly id: string;
  readonly enterpriseId: string;
  readonly applicationId: string;
  readonly applicationInstanceId: string | null;
  readonly commandExecutionId: string | null;
  readonly businessDataType: string;
  readonly businessObjectKey: string;
  readonly businessObjectVersion: bigint;
  readonly effectiveAt: Date;
  readonly metadataVersion: number | null;
  readonly payload: JsonObject;
}

export interface PostingOrderKey {
  readonly effectiveAt: Date;
  readonly postingPriority: number;
  readonly postingSequence: bigint;
}

export interface EnterprisePostingState {
  readonly enterpriseId: string;
  readonly consistencyDomain: string;
  readonly postingMode: 'NORMAL' | 'REPLAYING' | 'FAILED';
  readonly replayRequired: boolean;
  readonly nextPostingSequence: bigint;
  readonly highWater: PostingOrderKey | null;
}


export const BUSINESS_DATA_SUBMISSION_VERSION_V010 = '0.1.0' as const;

export interface BusinessDataSubmissionV010 {
  readonly contractVersion: typeof BUSINESS_DATA_SUBMISSION_VERSION_V010;
  readonly scopeKey: string;
  readonly applicationId: string;
  readonly businessDataType: string;
  readonly businessObjectKey: string;
  readonly effectiveAt: Date;
  readonly payload: JsonObject;
  readonly correlationId: string;
  readonly idempotencyKey: string;
  readonly causationId?: string;
  readonly expectedBusinessVersion?: bigint;
  readonly postingPriority?: number;
}

export interface BusinessDataSubmissionResultV010 {
  readonly contractVersion: typeof BUSINESS_DATA_SUBMISSION_VERSION_V010;
  readonly businessDataId: string;
  readonly businessObjectVersion: bigint;
  readonly postingInputId: string;
  readonly postingSequence: bigint;
  readonly postingStatus: 'QUEUED' | 'BLOCKED_REPLAY_REQUIRED';
  readonly retroactive: boolean;
  readonly replayRequired: boolean;
  readonly idempotentReplay: boolean;
}

export interface BusinessDataSubmissionPortV010 {
  submit(
    request: BusinessDataSubmissionV010
  ): Promise<BusinessDataSubmissionResultV010>;
}

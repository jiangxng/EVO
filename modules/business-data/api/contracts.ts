import type { JsonObject } from '../../metadata/api/contracts.js';

export interface BusinessDataRecord {
  readonly id: string;
  readonly enterpriseId: string;
  readonly applicationInstanceId: string;
  readonly commandExecutionId: string;
  readonly businessDataType: string;
  readonly businessObjectKey: string;
  readonly businessObjectVersion: bigint;
  readonly effectiveAt: Date;
  readonly metadataVersion: number;
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

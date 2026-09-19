import type { JsonObject } from '../../metadata/api/contracts.js';

export interface ReplayCheckpointPromotion {
  readonly id: string;
  readonly enterpriseId: string;
  readonly checkpointId: string;
  readonly certificationId: string;
  readonly certificationVersion: number;
  readonly certificationSemanticDigest: string;
  readonly status: 'ACTIVE' | 'REVOKED';
  readonly promotedBy: string;
  readonly reason: string;
  readonly evidence: JsonObject;
  readonly promotionDigest: string;
  readonly promotedAt: Date;
  readonly revokedAt?: Date;
  readonly revokedBy?: string;
  readonly revokeReason?: string;
}

export interface PromoteReplayCheckpointRequest {
  readonly checkpointId: string;
  readonly certificationId: string;
  readonly promotedBy: string;
  readonly reason: string;
}

export interface ReplayCheckpointPromotionService {
  promote(request: PromoteReplayCheckpointRequest): Promise<ReplayCheckpointPromotion>;
  revoke(
    promotionId: string,
    revokedBy: string,
    reason: string
  ): Promise<void>;
}

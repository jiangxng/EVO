import type { JsonObject } from '../../metadata/api/contracts.js';
import type { EconomicRuntimeDataset } from './runtime-dataset.js';

export type RuntimeEquivalenceCertificationStatus =
  | 'CERTIFIED'
  | 'REJECTED';

export type RuntimeEquivalenceBlocker =
  | 'CANDIDATE_NOT_BUILDING'
  | 'ORACLE_NOT_VERIFIED'
  | 'ORACLE_NOT_BOUND_TO_CANDIDATE'
  | 'SEMANTIC_SCOPE_MISMATCH'
  | 'STALE_ACTIVE_PARENT'
  | 'CHECKPOINT_NOT_ACTIVE'
  | 'PROMOTION_NOT_ACTIVE'
  | 'POSTING_CURSOR_AHEAD_OF_CANDIDATE'
  | 'ORACLE_STORED_DIGEST_DRIFT'
  | 'SEMANTIC_DIGEST_MISMATCH';

export interface RuntimeEquivalenceCertification {
  readonly id: string;
  readonly enterpriseId: string;
  readonly consistencyDomain: string;
  readonly candidateDatasetId: string;
  readonly oracleDatasetId: string;
  readonly parentDatasetId: string;
  readonly sourceCheckpointId: string;
  readonly sourcePromotionId: string;
  readonly incrementalPlanDigest: string;
  readonly boundarySequence: bigint;
  readonly candidateSemanticDigest: string;
  readonly oracleSemanticDigest: string;
  readonly status: RuntimeEquivalenceCertificationStatus;
  readonly blockers: readonly RuntimeEquivalenceBlocker[];
  readonly evidence: JsonObject;
  readonly certificationDigest: string;
  readonly certifiedBy: string;
  readonly reason: string;
  readonly certifiedAt: Date;
  readonly activatedAt?: Date;
}

export interface CertifyAndActivateRuntimeCandidateRequest {
  readonly candidateDatasetId: string;
  readonly oracleDatasetId: string;
  readonly certifiedBy: string;
  readonly reason: string;
}

export interface CertifyAndActivateRuntimeCandidateResult {
  readonly certification: RuntimeEquivalenceCertification;
  readonly activatedDataset?: EconomicRuntimeDataset;
}

export interface RuntimeEquivalenceCertificationService {
  certifyAndActivate(
    request: CertifyAndActivateRuntimeCandidateRequest
  ): Promise<CertifyAndActivateRuntimeCandidateResult>;
}

export interface RuntimeSemanticDigestResult {
  readonly digest: string;
  readonly familyCounts: {
    readonly ledgerEntries: number;
    readonly ledgerBalances: number;
    readonly costResults: number;
    readonly allocationRelations: number;
    readonly valuationPositions: number;
    readonly valuationResults: number;
    readonly workItems: number;
  };
}

export interface CandidateRuntimeDigestPort {
  compute(request: {
    readonly checkpointId: string;
    readonly candidateRuntimeDatasetId: string;
    readonly targetBoundarySequence: bigint;
  }): Promise<RuntimeSemanticDigestResult>;
}

export interface OracleRuntimeDigestPort {
  compute(oracleRuntimeDatasetId: string): Promise<RuntimeSemanticDigestResult>;
}

export type EconomicRuntimeDatasetKind =
  | 'CURRENT'
  | 'CANDIDATE'
  | 'ORACLE'
  | 'ARCHIVED';

export type EconomicRuntimeDatasetStatus =
  | 'BUILDING'
  | 'ACTIVE'
  | 'VERIFIED'
  | 'FAILED'
  | 'ARCHIVED';

export interface EconomicRuntimeDataset {
  readonly id: string;
  readonly enterpriseId: string;
  readonly consistencyDomain: string;
  readonly kind: EconomicRuntimeDatasetKind;
  readonly status: EconomicRuntimeDatasetStatus;
  readonly parentDatasetId?: string;
  readonly sourceCheckpointId?: string;
  readonly sourcePromotionId?: string;
  readonly oracleOfDatasetId?: string;
  readonly incrementalPlanDigest?: string;
  readonly startSequence?: bigint;
  readonly boundarySequence?: bigint;
  readonly semanticDigest?: string;
  readonly createdAt: Date;
  readonly verifiedAt?: Date;
  readonly activatedAt?: Date;
}

export interface CreateCandidateRuntimeDatasetRequest {
  readonly enterpriseId: string;
  readonly consistencyDomain: string;
  readonly parentDatasetId: string;
  readonly sourceCheckpointId: string;
  readonly sourcePromotionId: string;
  readonly incrementalPlanDigest: string;
  readonly startSequence: bigint;
  readonly boundarySequence: bigint;
}

export interface CreateOracleRuntimeDatasetRequest {
  readonly enterpriseId: string;
  readonly consistencyDomain: string;
  readonly parentDatasetId: string;
  readonly oracleOfDatasetId: string;
  readonly boundarySequence: bigint;
}

export interface EconomicRuntimeDatasetService {
  getActive(
    enterpriseId: string,
    consistencyDomain: string
  ): Promise<EconomicRuntimeDataset>;

  createCandidate(
    request: CreateCandidateRuntimeDatasetRequest
  ): Promise<EconomicRuntimeDataset>;

  createOracle(
    request: CreateOracleRuntimeDatasetRequest
  ): Promise<EconomicRuntimeDataset>;

  markVerified(
    datasetId: string,
    semanticDigest: string
  ): Promise<EconomicRuntimeDataset>;

  activateVerified(
    datasetId: string
  ): Promise<EconomicRuntimeDataset>;

  markFailed(
    datasetId: string,
    reason: string
  ): Promise<void>;
}

import type { JsonObject } from '../../metadata/api/contracts.js';

export interface ReplayCoverageCertification {
  readonly id: string;
  readonly enterpriseId: string;
  readonly consistencyDomain: string;
  readonly runtimeSemanticVersion: string;
  readonly dependencyGraphVersion: string;
  readonly certificationVersion: number;
  readonly status: 'DRAFT' | 'CERTIFIED' | 'REVOKED';
  readonly dependencyGraphComplete: boolean;
  readonly materializationDigestComplete: boolean;
  readonly derivedRuntimeReplayComplete: boolean;
  readonly referenceDatasetPinsComplete: boolean;
  readonly templateBindingComplete: boolean;
  readonly evidence: JsonObject;
  readonly semanticDigest: string;
  readonly blockers: readonly string[];
}

export interface ReplayCoverageCertificationService {
  evaluate(
    checkpointId: string,
    certifiedBy: string
  ): Promise<ReplayCoverageCertification>;
}

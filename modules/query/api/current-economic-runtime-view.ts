import type { JsonObject } from '../../metadata/api/contracts.js';

export interface CurrentEconomicRuntimeFamilyCounts {
  readonly ledgerEntries: number;
  readonly ledgerBalances: number;
  readonly costResults: number;
  readonly allocationRelations: number;
  readonly valuationPositions: number;
  readonly valuationResults: number;
  readonly workItems: number;
}

export interface CurrentEconomicRuntimeView {
  readonly activeRuntimeDatasetId: string;
  readonly generationChain: readonly string[];
  readonly certifiedActivationDigest: string | null;
  readonly certifiedBoundarySequence: bigint;
  readonly currentBoundarySequence: bigint;
  readonly hasLiveTail: boolean;
  readonly computedSemanticDigest: string;
  readonly semantic: JsonObject;
  readonly familyCounts: CurrentEconomicRuntimeFamilyCounts;
}

export interface CurrentEconomicRuntimeViewService {
  read(
    enterpriseId: string,
    consistencyDomain: string
  ): Promise<CurrentEconomicRuntimeView>;
}

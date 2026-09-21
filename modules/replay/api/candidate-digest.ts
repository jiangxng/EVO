export interface CandidateEconomicRuntimeDigestRequest {
  readonly checkpointId: string;
  readonly candidateRuntimeDatasetId: string;
  readonly targetBoundarySequence: bigint;
}

export interface CandidateEconomicRuntimeDigestResult {
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

export interface CandidateEconomicRuntimeDigestService {
  compute(
    request: CandidateEconomicRuntimeDigestRequest
  ): Promise<CandidateEconomicRuntimeDigestResult>;
}

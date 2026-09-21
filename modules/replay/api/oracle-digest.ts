export interface OracleEconomicRuntimeDigestResult {
  readonly digest: string;
  readonly familyDigests: {
    readonly ledgerEntries: string;
    readonly ledgerBalances: string;
    readonly costResults: string;
    readonly allocationRelations: string;
    readonly valuationPositions: string;
    readonly valuationResults: string;
    readonly workItems: string;
  };
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

export interface OracleEconomicRuntimeDigestService {
  compute(
    oracleRuntimeDatasetId: string
  ): Promise<OracleEconomicRuntimeDigestResult>;
}

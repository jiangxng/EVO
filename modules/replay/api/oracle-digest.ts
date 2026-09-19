export interface OracleEconomicRuntimeDigestResult {
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

export interface OracleEconomicRuntimeDigestService {
  compute(
    oracleRuntimeDatasetId: string
  ): Promise<OracleEconomicRuntimeDigestResult>;
}

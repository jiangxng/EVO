export interface EnterpriseDashboard {
  readonly enterprise: unknown;
  readonly runtime: unknown;
  readonly balances: readonly unknown[];
  readonly workItems: readonly unknown[];
  readonly recentBusinessData: readonly unknown[];
  readonly postingInputs: readonly unknown[];
  readonly costRuns: readonly unknown[];
  readonly costResults: readonly unknown[];
  readonly flowTraces: readonly unknown[];
  readonly replayRuns: readonly unknown[];
}

export interface EnterpriseQuery {
  dashboard(enterpriseId: string): Promise<EnterpriseDashboard>;
  balanceDigest(enterpriseId: string): Promise<string>;
}

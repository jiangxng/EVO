export interface ValuationPostingResult {
  readonly valuationPostingRunId: string;
  readonly status: 'POSTED' | 'NO_CHANGE';
  readonly ledgerEffectCount: number;
  readonly deltaTotalCost: string;
}

export interface ValuationPostingService {
  postCostResult(costResultId: string): Promise<ValuationPostingResult>;
}

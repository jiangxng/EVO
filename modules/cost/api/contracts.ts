export type CostMethod =
  | 'FIFO'
  | 'LIFO'
  | 'MOVING_AVERAGE'
  | 'SPECIFIC_IDENTIFICATION';

export interface CostReplayPins {
  readonly valuationPolicyId?: string;
  readonly valuationPolicyVersion?: number;
  readonly valuationRules?: Readonly<Record<string, { readonly id: string; readonly version: number }>>;
}

export interface CostRecalculationResult {
  readonly costRunId: string;
  readonly method: CostMethod;
  readonly resultCount: number;
  readonly valuationPostingCount: number;
}

export interface CostEngine {
  recalculate(
    enterpriseId: string,
    method: CostMethod,
    pins?: CostReplayPins
  ): Promise<CostRecalculationResult>;
}

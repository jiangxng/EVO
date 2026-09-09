export type CostMethod =
  | 'FIFO'
  | 'LIFO'
  | 'MOVING_AVERAGE'
  | 'SPECIFIC_IDENTIFICATION';

export interface CostRecalculationResult {
  readonly costRunId: string;
  readonly method: CostMethod;
  readonly resultCount: number;
}

export interface CostEngine {
  recalculate(
    enterpriseId: string,
    method: CostMethod
  ): Promise<CostRecalculationResult>;
}

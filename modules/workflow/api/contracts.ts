import type { JsonObject } from '../../metadata/api/contracts.js';
import type { MaterializationContext } from '../../materialization/api/context.js';

export interface WorkItemView {
  readonly id: string;
  readonly workType: string;
  readonly title: string;
  readonly status: string;
  readonly priority: number;
  readonly sourceLedgerCode: string;
  readonly dimensions: JsonObject;
  readonly quantity: string;
  readonly amount: string;
}

export interface WorkProjection {
  refresh(
    enterpriseId: string,
    materialization?: MaterializationContext
  ): Promise<number>;

  listOpen(
    enterpriseId: string,
    materialization?: MaterializationContext
  ): Promise<readonly WorkItemView[]>;
}

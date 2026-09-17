import type { JsonObject } from '../../metadata/api/contracts.js';

export interface LedgerEffect {
  readonly postingRuleId: string;
  readonly postingRuleCode: string;
  readonly postingRuleSchemaVersion: number;
  readonly effectIndex: number;
  readonly ledgerCode: string;
  readonly quantity: string | null;
  readonly amount: string | null;
  readonly unit: string | null;
  readonly currency: string | null;
  readonly dimensions: JsonObject;
}

export interface LedgerPostingContext {
  readonly enterpriseId: string;
  readonly consistencyDomain: string;
  readonly postingRunId: string;
  readonly postingInputId: string;
  readonly businessDataId: string;
  readonly effectiveAt: Date;
  readonly postingPriority: number;
  readonly postingSequence: bigint;
}

export interface LedgerBalanceView {
  readonly ledgerCode: string;
  readonly dimensions: JsonObject;
  readonly quantity: string;
  readonly amount: string;
  readonly lastPostingSequence: bigint;
}

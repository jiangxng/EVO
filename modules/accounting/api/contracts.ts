import type { JsonObject } from '../../metadata/api/contracts.js';

export type JournalSide = 'DEBIT' | 'CREDIT';

export interface JournalLineInput {
  readonly accountId: string;
  readonly side: JournalSide;
  readonly amount: string;
  readonly currency: string;
  readonly dimensions?: JsonObject;
  readonly memo?: string;
}

export interface PostJournalRequest {
  readonly enterpriseId: string;
  readonly accountingBookId: string;
  readonly journalNo: string;
  readonly effectiveAt: Date;
  readonly accountingCurrency: string;
  readonly sourceBusinessDataId?: string;
  readonly accountingRuleCode?: string;
  readonly accountingRuleVersion?: number;
  readonly diagnosticContext?: JsonObject;
  readonly lines: readonly JournalLineInput[];
}

export interface PostJournalResult {
  readonly journalId: string;
  readonly debitTotal: string;
  readonly creditTotal: string;
  readonly lineCount: number;
}

export interface AccountingJournalService {
  post(request: PostJournalRequest): Promise<PostJournalResult>;
}

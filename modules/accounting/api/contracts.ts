export type AccountingJsonValue =
  | null
  | boolean
  | number
  | string
  | readonly AccountingJsonValue[]
  | { readonly [key:string]: AccountingJsonValue };

export type AccountingJsonObject = Readonly<Record<string,AccountingJsonValue>>;

export type JournalSide = 'DEBIT' | 'CREDIT';

export interface JournalLineInput {
  readonly accountId: string;
  readonly side: JournalSide;
  readonly amount: string;
  readonly currency: string;
  readonly dimensions?: AccountingJsonObject;
  readonly memo?: string;
}

export interface PostJournalRequest {
  readonly mode?: 'NORMAL'|'REPLAY';
  readonly enterpriseId: string;
  readonly accountingBookId: string;
  readonly journalNo: string;
  readonly effectiveAt: Date;
  readonly accountingCurrency: string;
  readonly sourceBusinessDataId?: string;
  readonly accountingRuleCode?: string;
  readonly accountingRuleVersion?: number;
  readonly diagnosticContext?: AccountingJsonObject;
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

export interface AccountingRuleEffectInput {
  readonly accountCode: string;
  readonly side: JournalSide;
  readonly amount: AccountingJsonObject;
  readonly currencyField?: string;
  readonly dimensions?: AccountingJsonObject;
  readonly memo?: string;
}

export interface RecognitionResult {
  readonly businessDataId: string;
  readonly ruleCode: string;
  readonly ruleVersion: number;
  readonly matched: boolean;
  readonly status: 'NOT_MATCHED'|'POSTED'|'REJECTED';
  readonly journalId?: string;
  readonly conditionTrace: AccountingJsonObject;
  readonly generatedEffects: readonly AccountingJsonObject[];
}

export interface AccountingRecognitionService {
  recognizeBusinessData(
    enterpriseId: string,
    accountingBookId: string,
    businessDataId: string,
    mode?: 'NORMAL'|'REPLAY'
  ): Promise<readonly RecognitionResult[]>;
}

export interface TrialBalanceRow {
  readonly accountId: string;
  readonly accountCode: string;
  readonly accountName: string;
  readonly debitTotal: string;
  readonly creditTotal: string;
  readonly netDebit: string;
  readonly netCredit: string;
}

export interface TrialBalance {
  readonly enterpriseId: string;
  readonly accountingBookId: string;
  readonly currency: string;
  readonly rows: readonly TrialBalanceRow[];
  readonly debitTotal: string;
  readonly creditTotal: string;
  readonly balanced: boolean;
}

export interface TrialBalanceService {
  compute(
    enterpriseId: string,
    accountingBookId: string
  ): Promise<TrialBalance>;
}

export interface AccountingReplayResult {
  readonly replayRunId: string;
  readonly beforeDigest: string;
  readonly afterDigest: string;
  readonly journalCountBefore: number;
  readonly journalCountAfter: number;
  readonly validationStatus: 'MATCH'|'MISMATCH';
}

export interface AccountingReplayService {
  replay(
    enterpriseId: string,
    accountingBookId: string
  ): Promise<AccountingReplayResult>;
}

export interface AccountingPeriodInput {
  readonly enterpriseId: string;
  readonly accountingBookId: string;
  readonly fiscalYear: number;
  readonly periodNo: number;
  readonly code: string;
  readonly name: string;
  readonly startsAt: Date;
  readonly endsAt: Date;
}

export interface AccountingPeriodService {
  createOpenPeriod(input: AccountingPeriodInput): Promise<{ readonly periodId: string }>;
  closePeriod(
    enterpriseId: string,
    accountingBookId: string,
    periodId: string,
    closedBy: string,
    reason: string
  ): Promise<void>;
  reopenPeriod(
    enterpriseId: string,
    accountingBookId: string,
    periodId: string
  ): Promise<void>;
}

export interface ReconciliationRuleResult {
  readonly ruleCode: string;
  readonly sourceLedgerCode: string;
  readonly sourceAmount: string;
  readonly targetAccountCode: string;
  readonly targetAmount: string;
  readonly difference: string;
  readonly matched: boolean;
}

export interface ReconciliationRunResult {
  readonly runId: string;
  readonly status: 'MATCH'|'MISMATCH';
  readonly checkedRuleCount: number;
  readonly mismatchCount: number;
  readonly results: readonly ReconciliationRuleResult[];
}

export interface AccountingReconciliationService {
  run(
    enterpriseId: string,
    accountingBookId: string,
    accountingPeriodId?: string
  ): Promise<ReconciliationRunResult>;
}

export type FinancialStatementType = 'BALANCE_SHEET'|'INCOME_STATEMENT'|'CASH_FLOW_STATEMENT';

export interface StatementProjectionLine {
  readonly code: string;
  readonly name: string;
  readonly amount: string;
  readonly semanticRole?: string;
  readonly components: readonly AccountingJsonObject[];
}

export interface StatementProjection {
  readonly runId: string;
  readonly statementDefinitionId: string;
  readonly statementType: FinancialStatementType;
  readonly statementCode: string;
  readonly statementVersion: number;
  readonly accountingPeriodId: string;
  readonly digest: string;
  readonly lines: readonly StatementProjectionLine[];
}

export interface StatementReplayResult {
  readonly replayRunId: string;
  readonly beforeProjectionRunId: string;
  readonly afterProjectionRunId: string;
  readonly beforeDigest: string;
  readonly afterDigest: string;
  readonly validationStatus: 'MATCH'|'MISMATCH';
}

export interface CoreStatementReconciliationResult {
  readonly runId: string;
  readonly status: 'MATCH'|'MISMATCH';
  readonly checks: readonly AccountingJsonObject[];
  readonly balanceSheet: StatementProjection;
  readonly incomeStatement: StatementProjection;
  readonly cashFlowStatement: StatementProjection;
}

export interface FinancialStatementProjectionService {
  project(
    enterpriseId: string,
    accountingBookId: string,
    accountingPeriodId: string,
    statementDefinitionId: string
  ): Promise<StatementProjection>;

  replay(
    enterpriseId: string,
    accountingBookId: string,
    accountingPeriodId: string,
    statementDefinitionId: string
  ): Promise<StatementReplayResult>;

  reconcileCoreStatements(
    enterpriseId: string,
    accountingBookId: string,
    accountingPeriodId: string,
    balanceSheetDefinitionId: string,
    incomeStatementDefinitionId: string,
    cashFlowDefinitionId: string
  ): Promise<CoreStatementReconciliationResult>;
}


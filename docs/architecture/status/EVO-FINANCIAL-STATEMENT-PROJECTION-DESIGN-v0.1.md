# EVO Financial Statement Projection Design — Asloop Semantic Convergence v0.1

**Status:** DESIGN BASELINE / FAI-06-07 INPUT
**Date:** 2026-09-22
**Legacy semantic source:** Asloop-Backend
**Implementation rule:** preserve semantics, do not copy mutable-balance architecture.

## 0. Core Principle

EVO financial statements are projections of authoritative accounting/ledger state. They are not a separate fact system.

```text
Canonical BusinessData
→ Accounting Recognition
→ Journal / JournalLine
→ General Ledger / Trial Balance
→ Versioned Statement Projection
→ Balance Sheet / Income Statement / Cash Flow Statement
```

A financial statement line must always be explainable back through mapping → account/ledger/classification → JournalLine → AccountingRuleExecution → BusinessData.

## 1. Asloop semantic evidence to preserve

Asloop already models this general idea through account/report projection metadata.

- `TRANS_ACCOUNT_BALANCE` acts as an account-balance/report source.
- `CHECK_DIRECTION` carries debit/credit or balance direction semantics.
- `IS_FINANCE_CHECK` marks finance-validation participation.
- `CASH_FLOW_ID` attaches cash-flow classification to account-balance records.
- `account_voucher` contains subject, direction, asset classification, statement order, total-line flag, parent, location and finance-account relationship.
- `cash_flow_contrast` contains cash-flow type, direction, statement item, sort order and indentation.
- business-to-cash-flow contrast metadata links business semantics to cash-flow presentation.

The useful legacy idea is therefore:

```text
Account / Ledger State
+ Report Mapping Metadata
= Financial Statement
```

## 2. What EVO changes

EVO does not copy mutable account-balance chains, hidden report-specific write logic, report values as independent truth, manual overwrites that break replay, or hard-coded statement SQL tied to one enterprise.

EVO instead uses immutable canonical BusinessData, explicit double-entry Journal / JournalLine, replayable Trial Balance, versioned statement definitions/mappings, explicit cash-flow classification, deterministic report projection and report-to-GL reconciliation.

## 3. Balance Sheet

Balance Sheet is primarily a point-in-time account-balance projection:

```text
Trial Balance at period end
→ Account Mapping
→ Asset / Liability / Equity statement lines
→ Aggregation / subtotal rules
→ Balance Sheet
```

The report engine never invents amounts; it selects and aggregates authoritative GL balances.

## 4. Income Statement

Income Statement is primarily a period-movement projection:

```text
JournalLine movements during period
→ Revenue / Expense account mapping
→ Income Statement lines
→ Profit subtotals
```

Statement values remain derived from the GL, not separately posted facts.

## 5. Cash Flow Statement

Cash Flow Statement needs one additional semantic layer because a cash account movement alone does not explain whether the movement is operating, investing or financing.

Asloop's `CASH_FLOW_ID`, `cash_flow_contrast`, and business contrast tables are useful semantic evidence.

EVO target:

```text
Cash-related Journal / BusinessData
→ CashFlowClassificationRule
→ OPERATING / INVESTING / FINANCING
→ Cash Flow Statement Line
```

The preferred classification source is original business/accounting lineage, not only the cash account code.

## 6. Planned EVO metadata

FAI-06/07 should add only the minimum metadata required:

```text
StatementDefinition
StatementLineDefinition
AccountStatementMapping
CashFlowClassificationRule
StatementProjectionRun / StatementSnapshot (derived, reproducible)
```

Likely statement-line metadata includes statement type, line code, display name, parent, order, indentation, aggregation type, balance/movement semantics, sign/presentation rule, effective version, and account or cash-flow-item mapping.

## 7. Reconciliation invariants

Balance Sheet must satisfy `Assets = Liabilities + Equity`, and each reported line must reconcile to mapped GL balances.

Income Statement lines must reconcile to GL revenue/expense movements for the reporting period.

Cash Flow Statement must satisfy:

```text
Opening Cash
+ Net Operating Cash Flow
+ Net Investing Cash Flow
+ Net Financing Cash Flow
+ governed FX / cash-equivalent adjustments
= Closing Cash
```

Closing cash must reconcile to the Balance Sheet / GL cash accounts.

## 8. No independent report truth

Forbidden: BusinessData → report table directly, or manual report amount becoming authoritative accounting truth.

Allowed: GL / governed ledger state → versioned report projection.

Manual presentation adjustments, if ever required, must be explicit governed adjustments with lineage, never silent overrides.

## 9. Delivery order

### FAI-06 — Accounting Period + Reconciliation + Statement Projection Metadata

- accounting year / period;
- OPEN / CLOSED baseline;
- subledger/economic-ledger ↔ GL reconciliation;
- StatementDefinition;
- StatementLineDefinition;
- AccountStatementMapping;
- CashFlowClassificationRule.

### FAI-07 — Three Core Financial Statements

- Balance Sheet projection;
- Income Statement projection;
- Cash Flow Statement projection;
- cross-statement reconciliation;
- report replay / deterministic regeneration.

## 10. Design Decision

EVO inherits Asloop's correct conceptual insight:

> Financial statements are projections of accounts/ledgers.

EVO upgrades the implementation so those projections are immutable-source driven, rule-versioned, explainable, reconcilable, replayable, LLM-readable, and independent of hidden mutable report state.

# FAI-07 — Three Core Financial Statements Certification v0.1

**Status:** CERTIFIED
**Date:** 2026-09-22
**Stage:** Financial Accounting Integrity
**Packet:** FAI-07
**Evidence:** PR #49 / CI #672

## 1. Certified Boundary

EVO now proves one bounded end-to-end accounting/reporting chain:

```text
BusinessData
→ Accounting Recognition
→ balanced Journal / JournalLine
→ General Ledger
→ versioned Statement Projection
→ Balance Sheet
→ Income Statement
→ Cash Flow Statement
→ cross-statement reconciliation
→ deterministic statement replay
```

Financial statements remain derived projections. They do not become a second source of accounting truth.

## 2. Reference Accounting Scenario

Reference business facts:

```text
Sales invoice issued: CNY 1,000
Customer cash receipt: CNY 1,000
```

Reference accounting effects:

```text
Invoice:
Dr Accounts Receivable  1,000
Cr Revenue              1,000

Receipt:
Dr Cash                 1,000
Cr Accounts Receivable  1,000
```

Final GL economics:

```text
Cash                    Dr 1,000
Accounts Receivable     0
Revenue                 Cr 1,000
```

## 3. Balance Sheet Proof

Certified result:

```text
Total Assets                 1,000.00
Liabilities + Equity         1,000.00
Cash                         1,000.00
Current Period Earnings      1,000.00
```

Hard invariant:

```text
Assets = Liabilities + Equity
```

Result: MATCH.

## 4. Income Statement Proof

Certified result:

```text
Net Income                   1,000.00
```

Cross-statement invariant:

```text
Income Statement Net Income
=
Balance Sheet Current Period Earnings
```

Result: MATCH.

## 5. Cash Flow Statement Proof

Cash-flow classification is based on BusinessData/accounting lineage, not cash-account guessing.

Reference classification:

```text
cash.received
+ semanticRole = CUSTOMER_CASH_RECEIPT
→ OPERATING
→ INFLOW
→ Cash Received from Customers
```

Certified result:

```text
Opening Cash       0.00
Net Cash Change    1,000.00
Closing Cash       1,000.00
```

Hard invariants:

```text
Opening Cash + Net Cash Change = Closing Cash
Closing Cash = Balance Sheet Cash
```

Results: MATCH.

## 6. Cross-Statement Certification

All four machine checks passed:

```text
BALANCE_SHEET_EQUATION             MATCH
NET_INCOME_TO_CURRENT_EARNINGS     MATCH
CASH_FLOW_ROLL_FORWARD             MATCH
CASH_FLOW_TO_BALANCE_SHEET_CASH    MATCH
```

## 7. Statement Replay

All three statement semantic digests reproduce identically:

```text
Balance Sheet Replay       MATCH
Income Statement Replay    MATCH
Cash Flow Statement Replay MATCH
```

The digest is based on stable statement definition/version, reporting period, line values and explainable components.

## 8. Negative Proof

A deliberately broken Balance Sheet mapping multiplied Cash by 2.

The underlying General Ledger remained balanced and unchanged, but cross-statement reconciliation returned:

```text
MISMATCH
```

This proves EVO does not equate either of the following with report correctness:

- balanced General Ledger alone;
- successful report rendering alone.

Report mapping errors are independently detectable.

## 9. Asloop Semantic Convergence

EVO preserves the useful legacy idea confirmed in Asloop:

> Financial statements are projections of accounts/ledgers plus report mapping metadata.

EVO upgrades this into immutable-source, versioned, explainable and replayable projections.

## 10. Explicitly Not Certified

FAI-07 does not yet certify the entire statutory accounting product surface, including:

- full statutory notes/disclosures;
- owners' equity statement beyond the three core reports;
- statutory filing;
- electronic voucher archival lifecycle;
- complete bank-statement reconciliation;
- consolidation;
- multi-GAAP / multi-standard reporting;
- tax filing engines.

These are separate post-three-statement requirements and must not be confused with the core-report milestone.

## 11. Final Decision

**FAI-07 — Three Core Financial Statements: CERTIFIED.**

Evidence:

- PR #49;
- CI #672 / workflow run 35727780787 — SUCCESS;
- PostgreSQL 18 reference scenario PASS;
- all four cross-statement invariants MATCH;
- all three statement replays MATCH;
- broken mapping negative proof returns MISMATCH.

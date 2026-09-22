# EVO Post-FAI-07 Finance Gap Alignment v0.1

**Status:** AUTHORITATIVE ALIGNMENT / NEXT-STAGE INPUT
**Date:** 2026-09-22
**Baseline:** main @ 223b058e149f9d45bcad278797d0444c7375b567


> **Design principle:** EVO does not digitize paper-era accounting artifacts by default. It preserves the accounting/audit semantics those artifacts carried and prefers machine-readable facts, lineage, controls, reconciliation and projections over duplicated source-of-truth tables. See `docs/architecture/principles/EVO-ACCOUNTING-AUDIT-SEMANTICS-PRINCIPLE-v0.1.md`.

## 0. Current truth

FAI-01 through FAI-07 are complete for the certified core accounting/reporting path.

Certified chain:

```text
BusinessData
→ Economic Ledger / Cost / Settlement
→ Accounting Recognition
→ AccountingRuleExecution Trace
→ balanced Journal / JournalLine
→ General Ledger
→ Trial Balance
→ Accounting Period
→ Economic Ledger ↔ GL Reconciliation
→ Balance Sheet / Income Statement / Cash Flow Statement
→ Cross-statement Reconciliation
→ deterministic GL / Statement Replay
```

The three core financial statements are therefore no longer a blocker.

## 1. Architecture boundary after FAI-07

Do not continue expanding the statement engine simply because more finance features exist.

Post-FAI-07 finance must be split into three layers:

### A. EVO Core Accounting Runtime

Cross-enterprise accounting invariants and protocols that installed finance applications depend on.

Belongs in Core:

- AccountingBook / AccountingAccount contracts;
- Journal / JournalLine and debit-credit integrity;
- AccountingPeriod state machine and posting gate;
- immutable accounting lineage to BusinessData / evidence;
- AccountingRule execution trace;
- GL / Trial Balance / Replay;
- reconciliation protocol and result contract;
- versioned statement-projection protocol;
- role/authorization hooks and audit-event contracts;
- generic evidence-reference / hash / provenance contracts;
- deterministic accounting/report replay.

Core should define the mechanism, not one country's chart of accounts, one enterprise's closing checklist, or one statutory report template.

### B. Installable Finance Applications / Packages

Business-facing finance capabilities whose existence depends on installed applications.

Recommended installable apps/packages:

- Accounts Receivable;
- Accounts Payable;
- Cash / Bank;
- Inventory Accounting;
- Expense / Reimbursement;
- Fixed Assets;
- Bank Reconciliation;
- Accounting Voucher Review / Approval;
- Period Close / Close Checklist;
- Evidence / Original Voucher Management;
- Finance Reporting Template Pack;
- Tax / Invoice integration;
- Accounting Archive / Export adapters.

These applications may publish AccountingRules, reconciliation rules, statement mappings, evidence policies and UI experiences into Core.

### C. Jurisdiction / Regulatory Packs

Country- or standard-specific metadata and controls.

Examples:

- PRC chart-of-accounts template;
- PRC financial-statement presentation template/version;
- PRC electronic accounting voucher adapters;
- archive/export policies;
- RMB statutory-presentation policy;
- statutory filing adapters;
- disclosure packs;
- future IFRS / US GAAP / other jurisdiction packs.

These must not be hard-coded into the generic accounting kernel.

## 2. Remaining gaps by priority

### P0 — Accounting control integrity

These are the next most important gaps because they protect the correctness and legal/audit usability of already-working GL/report outputs.

1. Original Evidence / Accounting Evidence chain
   - explicit evidence object/reference;
   - document hash / provenance;
   - duplicate evidence prevention;
   - BusinessData ↔ evidence ↔ Journal lineage;
   - no silent mutation.

2. Journal review / approval / posting authority
   - PREPARED / REVIEWED / POSTED or equivalent governed lifecycle;
   - incompatible-duty hooks;
   - AI/human/automation actors use the same authorization contract;
   - durable audit trail.

3. Stronger period-close governance
   - current OPEN/CLOSED baseline already exists;
   - add SOFT_CLOSED / authorized reopen or governed adjusting-entry policy only if demanded by actual close workflow;
   - close prerequisites/checklist should be application-configurable, not hard-coded into Core.

4. Reconciliation family expansion
   - current Economic Ledger ↔ GL protocol is proven;
   - add Bank Statement ↔ Cash/Bank;
   - physical inventory/cash count ↔ books;
   - voucher ↔ journal/GL;
   - explicit reconciling items.

### P1 — Complete statutory reporting package

Three core statements are certified, but a complete statutory reporting package still needs:

- Statement of Changes in Equity;
- Notes / Disclosures;
- comparative periods;
- presentation-policy versioning by effective date;
- accounting-policy-change/restatement support;
- governed aggregation/disaggregation and presentation rules.

These should use the existing Statement Projection mechanism, not a new accounting engine.

### P1 — Electronic voucher / archive lifecycle

Need installable evidence/archive capabilities for:

- electronic invoices and receipts;
- bank documents;
- national electronic-voucher standard adapters;
- authenticity/integrity checks;
- archival export;
- retention/security metadata;
- backup/recovery/audit logs.

Core owns evidence/provenance contracts; adapters and lifecycle products should be installable.

### P2 — Broader finance applications

Important but not required to claim the certified three-statement core:

- fixed assets;
- advanced expense management;
- treasury / cash forecasting;
- budgeting;
- tax engine;
- statutory filing;
- consolidation / intercompany elimination;
- multi-GAAP books;
- complex FX / translation.

## 3. Recommended next packet

Do not jump directly to every statutory feature.

Recommended next large packet:

**FAI-08 — Accounting Evidence + Journal Governance**

Business goal:

> Make every authoritative General Ledger journal not only balanced and replayable, but also reviewable, attributable and traceable to governed accounting evidence.

Suggested bounded scope:

```text
AccountingEvidence
+ EvidenceReference / hash / provenance
+ Journal lifecycle
+ preparer / reviewer / poster actor lineage
+ authorization hooks
+ duplicate-evidence prevention baseline
+ immutable posted-journal policy
+ E2E positive and rejection proofs
```

Why FAI-08 before more reports:

- three core reports already work;
- the larger remaining correctness risk is not arithmetic projection;
- it is whether a legally/audit-relevant Journal has sufficient evidence, authority and immutable lifecycle.

## 4. Explicitly deferred from FAI-08

- full bank reconciliation;
- fixed assets;
- tax engine;
- statutory filing;
- Statement of Changes in Equity;
- Notes / Disclosures;
- consolidation;
- multi-GAAP;
- complex close orchestration.

These remain separate packets.

## 5. Product principle

EVO should expose the finance kernel as capabilities, not assume every enterprise has every finance app installed.

Example:

```text
Core accounting runtime installed
+ AR app installed
+ Cash app installed
+ PRC statement pack installed
→ corresponding accounting rules/APIs/report mappings exist

AR app not installed
→ AR-specific commands/APIs/rules do not pretend to exist
```

This is the same modularity principle already established for sales orders, payments and other enterprise applications.

## 6. Decision

FAI-07 closes the three-core-statement milestone.

Next recommended finance direction is not 'more report calculations'.

It is:

```text
FAI-08
Accounting Evidence
+ Journal Governance
+ Authorization / Review
+ Posted-history integrity
```

After that, reselect between:

- FAI-09 Reconciliation Family (bank / physical / voucher);
- FAI-10 Statutory Reporting Completion (equity + notes + comparative presentation).

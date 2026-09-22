# EVO Accounting & Audit Semantics Principle v0.1

**Status:** AUTHORITATIVE DESIGN PRINCIPLE
**Date:** 2026-09-22

## 0. Core Principle

EVO must not merely digitize the paper artifacts of traditional accounting.

EVO must preserve and implement the accounting and audit semantics that those artifacts historically carried.

> Preserve the problem the artifact solved; do not inherit the artifact form by default.

## 1. Why this matters

Traditional accounting artifacts such as invoices, vouchers, approval signatures, ledgers, reconciliation sheets, printed statements and bound archives were created to provide evidence, accountability, classification, measurement, continuity, traceability and auditability.

In an AI-native system, those purposes should be represented directly as machine-readable facts, rules, lineage, controls, reconciliation results and projections.

## 2. Audit-oriented semantic questions

EVO financial architecture should be able to answer, at minimum:

```text
Occurrence / Existence
Did the economic event or balance really exist?

Completeness
Did all events/balances that should have been recorded enter the accounting system?

Rights / Obligations
Does the asset, liability, right or obligation belong to the correct enterprise?

Valuation / Allocation
Why is the amount this amount?
Which measurement / cost / valuation policy and version produced it?

Presentation / Disclosure
Why was the amount classified into this account and this statement line?

Authorization / Accountability
Who or what rule made the accounting decision, and under what authority?

Evidence
What external/internal evidence supports the fact and the accounting treatment?

Lineage
Can a reported number be traced back to BusinessData, evidence, rules and measurements?
```

## 3. Paper-era artifacts reinterpreted for EVO

| Traditional artifact | EVO semantic carrier |
|---|---|
| Invoice / receipt / bank advice | Evidence / external fact reference |
| Contract | Rights / obligations evidence |
| Goods receipt / issue document | BusinessData + operational evidence |
| Inventory count sheet | Physical Observation Evidence + Reconciliation |
| Bank reconciliation sheet | External Evidence + ReconciliationResult |
| Accounting voucher | Voucher Projection over BusinessData + RuleExecution + Journal + Evidence |
| Voucher number | Period/archive numbering projection |
| Review signature | Actor + Authorization + Audit Event |
| General ledger / subsidiary ledger | Journal/JournalLine projection |
| Trial balance | Trial Balance projection |
| Financial statements | GL + versioned mapping projection |
| Bound paper voucher archive | Archive Manifest + hashes + snapshot + lock |

## 4. Accounting facts vs projections

Authoritative facts and derived projections must remain separate.

Authoritative / governed accounting state:

```text
BusinessData
EvidenceReference / Provenance
AccountingRule / RuleExecution
CostResult / ValuationResult / Measurement lineage
Journal / JournalLine
ReconciliationResult
Actor / Authorization / AuditEvent
```

Derived projections:

```text
Voucher Projection
Voucher Print Number
Subsidiary Ledger View
General Ledger View
Trial Balance
Balance Sheet
Income Statement
Cash Flow Statement
Archive / Print Snapshot
Audit Assertion Coverage View
```

A projection must not become an independent editable source of accounting truth.

## 5. Voucher principle

An accounting voucher is not a new authoritative accounting fact layer in EVO.

It is a human-readable / printable / archivable projection:

```text
BusinessData
+ AccountingRuleExecution
+ Journal / JournalLine
+ Evidence
→ Voucher Projection
```

Voucher numbering is a period/archive governance concern, not Journal identity.

## 6. Measurement and valuation lineage

EVO must explain not only whether a balance exists, but why its amount is correct.

Examples include:

- FIFO / moving average / specific identification;
- depreciation / amortization;
- impairment / expected losses;
- exchange rates;
- provisions;
- fair value where applicable;
- other governed measurement policies.

Target traceability:

```text
Statement amount
→ Account / JournalLine
→ Measurement / Cost / Valuation Result
→ Policy / algorithm version
→ source BusinessData / evidence
```

## 7. Completeness requires independent comparison

Traceability from recorded Journal back to source facts proves only part of auditability.

EVO must also support independent sources and reconciliation to detect missing facts:

```text
Bank statement ↔ Cash ledger / GL
Physical inventory ↔ Inventory ledger
External invoice / platform stream ↔ recorded BusinessData
AR/AP counterpart evidence ↔ accounting balances
Evidence sequence / external source ↔ recorded items
```

Completeness is therefore not equivalent to existence.

## 8. Auditability should be computed from evidence, not asserted

EVO should not rely on simplistic flags such as:

```text
occurrence = true
valuation = true
```

Instead, auditability should be explainable from underlying machine evidence.

Example projection:

```text
Revenue 1,000

Occurrence:
  supported by BusinessData + source evidence

Completeness:
  reconciliation coverage / independent source comparison

Valuation:
  amount expression + policy/version + source values

Presentation:
  account mapping + statement mapping

Authorization:
  actor / rule / review lineage
```

## 9. FAI-08 direction

FAI-08 should focus on Accounting Evidence & Auditability, not on recreating paper voucher tables.

Recommended scope:

```text
EvidenceReference / Provenance
+ BusinessData ↔ Evidence lineage
+ Journal ↔ Evidence lineage
+ Actor / Authorization / AuditEvent baseline
+ Voucher Projection
+ Voucher Numbering / Archive sequencing
+ Archive Manifest / Snapshot / Lock baseline
+ duplicate-evidence prevention
+ posted-history integrity
+ positive and rejection database proofs
```

## 10. Long-term rule

Before implementing any traditional accounting artifact, ask:

1. What accounting/audit problem did this artifact solve?
2. Is that semantic already represented by facts, rules, lineage or reconciliation?
3. Does EVO need the artifact itself, or only a projection/view/print/archive representation?
4. Would adding a new authoritative table duplicate an existing source of truth?

Default decision:

> Keep the semantic function. Prefer projection over duplicated fact storage.

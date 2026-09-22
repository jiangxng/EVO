# EVO Accounting Voucher Projection & Numbering Design — Asloop Semantic Convergence v0.1

**Status:** DESIGN BASELINE / FAI-08 INPUT
**Date:** 2026-09-22
**Legacy semantic source:** Asloop-Backend


> **Design principle:** EVO does not digitize paper-era accounting artifacts by default. It preserves the accounting/audit semantics those artifacts carried and prefers machine-readable facts, lineage, controls, reconciliation and projections over duplicated source-of-truth tables. See `docs/architecture/principles/EVO-ACCOUNTING-AUDIT-SEMANTICS-PRINCIPLE-v0.1.md`.

## 0. Decision

In EVO, an accounting voucher is not a new authoritative accounting fact layer.

It is a governed human-readable / printable / archivable projection of existing authoritative accounting lineage:

```text
BusinessData
+ AccountingRuleExecution
+ Journal / JournalLine
+ Evidence / source references
→ Accounting Voucher Projection
```

The voucher projection must never become a second copy of accounting truth.

## 1. Legacy Asloop semantics confirmed

Asloop contains explicit voucher-number infrastructure:

- `voucher_number_seed` keyed by entity and month;
- `VoucherNumberCenter` job queue;
- `IAccountingVoucherNumberGenerator`;
- `VoucherNumberImpl`;
- `AccountingVoucherNumberRobot`;
- `dw_account_voucher_number` generated-number storage;
- `dw_account_voucher_bin` recycled / revoked-number pool;
- accounting voucher report / print services.

Important legacy behavior:

1. voucher numbering is scoped by enterprise/entity and accounting month;
2. numbering can also vary by voucher type/prefix such as transfer/cash/bank receipt/payment;
3. batch generation orders accounting transactions by effective time;
4. revoked/deleted voucher numbers can be recycled;
5. when assigning a later voucher number, the system first consumes the smallest available revoked number for the same entity/month/prefix;
6. voucher numbering and printing are reporting/archive concerns layered on accounting results.

## 2. EVO interpretation

EVO keeps the semantics but replaces the mutable implementation.

Authoritative accounting remains:

```text
Journal / JournalLine
```

Voucher numbering is separate derived governance:

```text
Journal set for AccountingBook + Period
→ Voucher Projection
→ Voucher Number Assignment
→ Print / Archive Snapshot
```

## 3. Voucher number identity

A voucher number assignment should be scoped by at least:

```text
AccountingBook
+ AccountingPeriod
+ VoucherNumberSeries / VoucherCategory
+ Sequence
```

Example display formats are presentation metadata only:

```text
记字第 1 号
转字第 1 号
现收字第 1 号
银付字第 1 号
```

The numeric sequence and scope are authoritative; localized display formatting is projection metadata.

## 4. Continuity and gap filling

Before archival finalization, numbering policy may require continuous numbers.

Target algorithm:

```text
assignVoucherNumber(scope):
  if reusable gaps exist:
    take MIN(gap)
  else:
    next = maxAssigned + 1
```

This reproduces the useful Asloop behavior without making Journal identity depend on voucher number.

Important distinction:

```text
Journal ID / Journal No
!= Voucher print/archive number
```

Journal identity is stable accounting identity.
Voucher number is a governed archive/presentation sequence.

## 5. Revocation semantics

EVO should not delete posted Journal accounting facts merely to free a voucher number.

Instead:

```text
VoucherNumberAssignment
ACTIVE
→ REVOKED before final archive/lock
→ sequence may return to reusable-gap pool
```

Once a voucher archive batch is finalized/locked, its assigned number must not silently be recycled. Corrections after that point must use governed reversal/adjustment policy rather than renumbering historical archived material.

## 6. Monthly close / print workflow

Recommended workflow:

```text
Accounting Period ready for close
↓
select authoritative Journals in period
↓
build Voucher Projections
↓
assign / repair continuous voucher-number sequence
↓
validate no numbering gaps under selected policy
↓
batch render / print
↓
create archive manifest / snapshot
↓
lock archive batch
```

Printing is therefore downstream from accounting, not part of accounting recognition.

## 7. Voucher projection contents

A projected voucher can display:

- voucher number;
- accounting date / period;
- summary;
- debit / credit accounts and amounts;
- auxiliary dimensions;
- source BusinessData;
- AccountingRule version;
- RuleExecution trace;
- evidence references;
- preparer/reviewer/poster information when governance exists;
- Journal ID / JournalLine lineage.

Every displayed amount/account must come from authoritative Journal/JournalLine data, not duplicated editable voucher fields.

## 8. FAI-08 scope correction

FAI-08 should NOT create authoritative `Voucher` / `VoucherLine` accounting facts duplicating Journal / JournalLine.

FAI-08 should instead implement:

```text
AccountingEvidence
+ Accounting Audit Trail
+ VoucherProjection
+ VoucherNumberSeries
+ VoucherNumberAssignment
+ reusable-gap governance before archive lock
+ Print/Archive batch baseline
```

Journal review/authorization lifecycle remains relevant, but it governs the Journal, not a duplicate Voucher object.

## 9. Core vs application boundary

EVO Core should own generic contracts:

- voucher projection protocol;
- numbering series / assignment invariants;
- continuity check;
- archive-lock state;
- lineage and deterministic regeneration.

Installable finance / jurisdiction packs should own:

- numbering format/prefix rules;
- whether numbering is one unified series or multiple categories;
- print template;
- localization;
- archive layout;
- jurisdiction-specific retention/export requirements.

## 10. Invariants

1. Voucher projection never changes Journal/JournalLine amounts.
2. Voucher numbering never changes accounting recognition.
3. One active number assignment cannot belong to multiple voucher projections in the same series scope.
4. A finalized archive batch cannot silently renumber historical vouchers.
5. Pre-finalization revoked numbers may be reused only under an explicit numbering policy.
6. Batch regeneration from the same Journal set + numbering policy is deterministic.
7. Voucher output remains traceable to Journal → RuleExecution → BusinessData / Evidence.

# EVO Financial Accounting Integrity Audit v0.1

**Status:** GAP CONFIRMED / ARCHITECTURE BOUNDARY DEFINED  
**Date:** 2026-09-22  
**Purpose:** Verify whether current EVO Demo/runtime already satisfies strict double-entry accounting requirements before financial-statement certification.

## 0. 60 秒结论

当前 EVO 已经可靠跑通：

```text
企业业务
→ BusinessData
→ Posting Rules
→ generic LedgerEntry
→ LedgerBalance
→ Work / Cost / Replay
```

但当前实现 **还不能被称为严格复式会计总账**。

已确认：

- EVO 明确以 Asloop-Backend 与 bookkeeping 作为 legacy semantic evidence；
- bookkeeping 原系统存在明确的 `Dr / Cr`、`借方 / 贷方`、借贷方向、对向金额、借贷余额公式等语义；
- EVO 当前 generic Ledger 为 signed quantity / signed amount；
- 当前 `ledger_entry` 无 explicit debit/credit side；
- 当前没有 journal/voucher grouping contract；
- 当前 PostingService / LedgerWriter 没有 `sum(debit) == sum(credit)` 的提交前校验；
- 当前没有 Trial Balance 强制认证。

因此：

> 当前 Demo 的业务账本/经济账本逻辑已经获得大量 DATABASE E2E / Replay 证据，但“有借必有贷、借贷必相等”尚未成为机器强制的不变量。

## 1. Legacy source confirmation

### 1.1 Asloop-Backend

EVO repository already records Asloop as the older and broader ERP/calculation semantic source.

Recovered semantic assets include:

- transaction types;
- calculation relations;
- accounts/ledger semantics;
- debit matching direction;
- quantity/amount/foreign measures;
- balances;
- cost/valuation;
- allocation/matching;
- accounting projections.

Legacy implementation details such as mutable historical balance chains, dynamic SQL accounting and stored procedures are intentionally rejected as implementation architecture.

### 1.2 bookkeeping

Direct source inspection confirms `TransdataAccount` includes:

```text
direction = add / sub / cr / dr / -dr / -cr
```

and explicit semantics for:

```text
借方
贷方
借方合计
贷方合计
借方成本
贷方成本
借方-贷方
贷方-借方
```

The source also distinguishes financial accounts (`isFinance`), account dimensions, balance persistence and cost semantics.

Therefore debit/credit semantics are real legacy evidence, not a newly invented requirement.

## 2. What EVO preserved correctly

EVO correctly preserved or improved:

- immutable canonical business history;
- event → rule → ledger projection;
- explicit dimensions / auxiliary accounting dimensions;
- deterministic posting order;
- balance as derived state;
- cost/valuation separation;
- allocation conservation;
- replay and incremental replay;
- version pinning;
- explicit lineage.

These are appropriate foundations for both operational accounting and later General Ledger accounting.

## 3. Current implementation gap

Current runtime schema:

```text
ledger_entry
  ledger_definition_id
  posting_run_id
  business_data_id
  posting_rule_id
  quantity
  amount
  unit
  currency
  dimensions
  ...
```

There is currently no authoritative:

```text
journal
journal_line
accounting_account / chart_of_accounts binding
DEBIT / CREDIT side
journal accounting currency
debit_total
credit_total
balanced flag / constraint
trial_balance certification
```

Current `PostgresLedgerWriter` writes each effect independently and updates signed balances.

Current `PostingService` commits the effects without a double-entry balancing gate.

Therefore a single financial-named effect such as:

```text
Receivable +1000
```

can be posted by the generic runtime without requiring a corresponding:

```text
Revenue Credit 1000
```

That behavior is valid for an **economic/operational position ledger**, but it is insufficient for an authoritative General Ledger journal.

## 4. Correct architectural boundary

EVO SHOULD retain two related but distinct projections.

### 4.1 Operational / Economic Ledger

Purpose:

- Pending Production;
- Pending Shipment;
- Pending Purchase;
- Receivable economic/open position;
- Payable economic/open position;
- Inventory quantity/value;
- Cash economic position;
- Work-driving balances;
- management dimensions.

Direction:

```text
INCREASE / DECREASE
signed quantity / amount
```

These ledgers do NOT need artificial debit/credit lines.

### 4.2 General Ledger / Financial Accounting Projection

Purpose:

- statutory / formal accounting;
- chart of accounts;
- journals;
- trial balance;
- accounting periods;
- retained earnings / closing;
- financial statements.

Direction:

```text
DEBIT
CREDIT
```

Hard rule:

```text
for each Journal:
Σ Debit == Σ Credit
```

A General Ledger journal cannot be one-sided.

## 5. Business-to-finance mainline

The full target path becomes:

```text
Enterprise Business
→ canonical BusinessData
→ operational/economic Posting Rules
→ Economic Ledgers / Balances
→ valuation / settlement / cost results where needed
→ accounting recognition rules
→ General Ledger Journal
→ Debit/Credit Journal Lines
→ Trial Balance
→ Balance Sheet / Income Statement / Cash Flow Statement
```

This keeps one business truth while allowing multiple governed projections.

## 6. Minimal General Ledger integrity contract

Before financial statements can be certified, EVO must support at minimum:

1. explicit Chart of Accounts / Accounting Account definition;
2. explicit Journal identity;
3. explicit Journal Line;
4. line side = DEBIT | CREDIT;
5. accounting amount + accounting currency;
6. source BusinessData / derived-result lineage;
7. pinned accounting rule/policy version;
8. journal has >= 1 debit and >= 1 credit line;
9. sum(debit) == sum(credit) after declared precision/rounding policy;
10. unbalanced journal rejects atomically;
11. Trial Balance independently recomputes from journal lines;
12. Replay reproduces journals and Trial Balance deterministically.

## 7. Example: sale

Economic projection can remain:

```text
Receivable economic position +1000
```

General Ledger projection should separately express, depending on recognition policy:

```text
Dr Accounts Receivable 1000
Cr Revenue             1000
```

When cash is collected:

```text
Dr Cash                1000
Cr Accounts Receivable 1000
```

The accounting projection timing/policy is versioned and may differ from operational recognition timing.

## 8. Example: purchase / inventory

Goods receipt or supplier invoice accounting depends on policy and business evidence.

Possible formal journal, when recognition criteria are met:

```text
Dr Inventory / Expense
Cr Accounts Payable
```

The P2P economic ledger can still record Pending Purchase and Payable/open obligations earlier if the business needs those states.

This distinction prevents operational obligations from being incorrectly treated as statutory journal recognition.

## 9. Financial statement gate

Until this accounting integrity gate is certified, EVO MUST NOT claim:

- certified General Ledger;
- certified Trial Balance;
- Balance Sheet ready;
- Income Statement ready;
- Cash Flow Statement ready;
- statutory accounting compliance.

EVO MAY continue to certify:

- enterprise business events;
- operational/economic ledger behavior;
- balances;
- Work;
- cost/valuation;
- settlement;
- deterministic Replay.

## 10. Implementation sequence

Recommended bounded sequence:

### FAI-01 — Chart of Accounts + Journal contract
Define the minimal accounting metadata/runtime structures.

### FAI-02 — Atomic double-entry validation
Reject one-sided/unbalanced journals before commit.

### FAI-03 — Demo accounting projection
Map a small set of already-certified events:
- sale/receivable/revenue;
- cash receipt;
- inventory/COGS shipment;
- purchase/AP;
- supplier payment;
- return/refund/red invoice.

### FAI-04 — Trial Balance
Prove debit total == credit total across period/accounting currency.

### FAI-05 — Full Replay equality
Delete derived General Ledger state, replay and prove identical journal/trial-balance digest.

### FAI-06 — Financial Statement readiness gate
Only after sufficient economic events and GL coverage, begin the three financial statements.

## 11. Anti-overdesign boundary

Do NOT build now merely because a full finance suite eventually needs it:

- consolidation;
- multi-GAAP;
- tax engine;
- statutory filing;
- complex close orchestration;
- intercompany elimination;
- budgeting;
- full fixed-asset subledger.

The immediate requirement is narrower:

> General Ledger accounting must have explicit debit/credit and machine-enforced equality.

## 12. Audit decision

**Result: ACCOUNTING_INTEGRITY_GAP_CONFIRMED**

Current generic Ledger remains valid and should not be replaced.

The missing capability is an explicit, replayable, double-entry General Ledger projection layered on the same canonical enterprise facts.

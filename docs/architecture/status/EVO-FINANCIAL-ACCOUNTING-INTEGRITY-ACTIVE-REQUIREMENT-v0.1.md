# EVO Financial Accounting Integrity — Active Requirement Alignment v0.1

**Status:** ACTIVE / OPEN / BLOCKING FINANCIAL STATEMENTS  
**Date:** 2026-09-22  
**Primary requirement:** 有借必有贷，借贷必相等。

## 0. 60 秒结论

EVO 当前已经完成并认证多个企业业务闭环，但这不等于已经完成严格复式会计总账。

当前硬缺口：

```text
每一张 General Ledger Journal
必须：
- 至少有一条 DEBIT
- 至少有一条 CREDIT
- Σ Debit == Σ Credit
- 不平衡时整张 Journal 原子拒绝
```

因此当前状态必须理解为：

```text
Economic / Operational Ledger ✅
General Ledger Double Entry     ❌ OPEN
Trial Balance                   ❌ BLOCKED
Financial Statements            ❌ BLOCKED
```

## 1. 用户需求

明确要求：

> 有借必有贷、借贷必相等。

该需求当前**没有 close**。

此前 Codex/LLM 已完成：

- 缺口审计；
- 架构边界；
- 推荐实现顺序；
- legacy debit/credit 语义确认。

但尚未完成：

- authoritative Chart of Accounts runtime；
- authoritative Journal / JournalLine runtime；
- DEBIT / CREDIT line side；
- journal balance gate；
- atomic reject on imbalance；
- Trial Balance；
- General Ledger Full Replay equality。

## 2. 不能混淆的两层

### 2.1 Operational / Economic Ledger

继续使用：

```text
INCREASE / DECREASE
signed quantity / amount
```

用于：

- Inventory
- Receivable economic position
- Payable economic position
- Cash position
- Pending Production / Shipment / Purchase
- Cost / Work / management balances

这里不强行套借贷。

### 2.2 General Ledger

必须新增明确的财务会计投影：

```text
BusinessData / Economic Result
→ Accounting Recognition Rule
→ Journal
→ JournalLine(DEBIT/CREDIT)
→ Trial Balance
```

硬不变量：

```text
for each Journal:
  debit_line_count >= 1
  credit_line_count >= 1
  Σ Debit == Σ Credit
```

## 3. 下一主线

EEL-C05 完成后，不继续选择新的普通企业业务闭环。

优先主线切换为：

### FAI-01 — Chart of Accounts + Journal Contract

必须提供：

- AccountingBook
- AccountingAccount / Chart of Accounts
- Journal
- JournalLine
- accounting currency
- source BusinessData / derived-result lineage
- pinned accounting rule/policy version

### FAI-02 — Atomic Double-Entry Integrity

必须机器强制：

- DEBIT/CREDIT side；
- debit/credit amount；
- 至少一借一贷；
- 借贷合计相等；
- declared precision / rounding；
- unbalanced journal atomic reject；
- no partial journal commit。

FAI-01 / FAI-02 可以作为一个紧密 bundle 实现，因为 Journal 数据结构如果没有原子平衡校验，就不能作为 authoritative GL 状态进入 main。

## 4. 第一阶段验收场景

建议只选已经被 Stage E 认证过的少量事件，不扩大业务范围。

### Sale / Receivable recognition

示例：

```text
Dr Accounts Receivable 1000
Cr Revenue             1000
```

### Customer Receipt

示例：

```text
Dr Cash                1000
Cr Accounts Receivable 1000
```

### Purchase / Payable

示例：

```text
Dr Inventory / Expense 1000
Cr Accounts Payable    1000
```

### Supplier Payment

示例：

```text
Dr Accounts Payable 1000
Cr Cash             1000
```

具体确认时点必须由 accounting recognition rules 决定，不能把业务事件名称直接等同于法定确认。

## 5. 明确阻塞

在以下能力认证前，EVO 不得声称：

- General Ledger complete；
- Trial Balance complete；
- Balance Sheet ready；
- Income Statement ready；
- Cash Flow Statement ready；
- statutory accounting ready。

## 6. 后续顺序

```text
FAI-01 + FAI-02
Chart of Accounts + Journal + Atomic Balance Gate
↓
FAI-03
Accounting Recognition for certified business events
↓
FAI-04
Trial Balance + economic/subledger reconciliation
↓
FAI-05
General Ledger Full Replay Equality
↓
FAI-06
Financial Statement Readiness Gate
```

## 7. Anti-overdesign

当前不做：

- consolidation；
- multi-GAAP；
- tax engine；
- statutory filing；
- complex period close orchestration；
- intercompany elimination；
- fixed assets；
- budgeting。

先把最根本的不变量做成机器约束：

> **有借必有贷、借贷必相等。**

# EVO Stage E — EEL-C02 Procure-to-Pay Reference Loop Packet v0.1

**Status:** BUSINESS PACKET / READY FOR IMPLEMENTATION  
**Date:** 2026-09-22  
**Stage:** Stage E — Enterprise Economic Loops  
**Packet:** EEL-C02  
**Name:** Procure-to-Pay Reference Loop

## 0. 60 秒业务摘要

EEL-C01 已经证明了“客户欠我们钱 → 收款 → 关闭应收 → 现金增加”。

EEL-C02 要证明相反方向：

```text
采购订单
→ 待采购
→ 应付
→ 到货/入库
→ 待采购关闭
→ 库存增加
→ 供应商付款
→ 现金减少
→ 应付关闭
→ WorkItem 关闭
→ Full Replay 后结果完全一致
```

这条闭环的目的不是建设完整采购平台，而是验证 EVO 是否能处理企业“买东西并最终付钱”的完整经济链条。

## 1. Business Goal

Prove one complete Procure-to-Pay reference loop on the certified EVO Economic Runtime.

企业应能够回答：

- 我向哪个供应商买了什么、买多少？
- 还有多少货没收到？
- 我还欠供应商多少钱？
- 到货后库存增加了多少？
- 哪一笔付款结清了哪一笔应付？
- 付款后现金减少多少？
- 当前还有没有“待收货 / 待付款”工作？
- 删除派生状态后，Full Replay 能否恢复完全相同的正式经济状态？

## 2. Reference Scenario

本工作包采用一个最小全额场景：

- 单一企业；
- 单一供应商；
- 单一采购订单；
- 单一物料；
- 单一仓库；
- 一次性全量收货；
- 一次性全额付款；
- 同币种结算；
- 不含税务复杂性；
- 不含预付款；
- 不含部分收货；
- 不含部分付款；
- 不含退货；
- 不含供应商贷项；
- 不含银行对账。

这些都属于后续独立业务包，不在 EEL-C02 中提前泛化。

## 3. Required Business Facts

### 3.1 Purchase Order Approval

采购订单批准后，必须产生不可变 BusinessData：

```text
purchase_order.approved
```

并形成：

- Pending Purchase 增加；
- Accounts Payable 增加。

业务含义：

> 企业已经承诺采购，并形成明确待收货义务和应付义务。

### 3.2 Goods Receipt

货物实际收到后，必须新增 BusinessData，不修改原采购订单：

```text
goods_receipt.received
```

结果：

- Pending Purchase 减少；
- Inventory 数量增加；
- Inventory 金额增加；
- 原采购订单 BusinessData 保持不变。

### 3.3 Supplier Payment

实际向供应商付款后，必须新增：

```text
cash.paid
```

结果：

- Cash 减少；
- Payable 减少；
- 付款必须能够明确指出结清哪笔应付。

## 4. Acceptance Criteria

EEL-C02 只有全部满足以下条件才允许标记 CERTIFIED：

1. 采购订单批准后形成明确 Pending Purchase；
2. 采购订单批准后形成明确 Payable；
3. 全量收货后 Pending Purchase 归零；
4. 全量收货后 Inventory 数量正确增加；
5. Inventory 金额反映采购成本；
6. 供应商付款后 Cash 正确减少；
7. 供应商付款后 Payable 归零；
8. 付款与目标应付之间存在明确结算关系，不依赖金额相等推断；
9. 全量收货后 RECEIVE WorkItem 关闭；
10. 全额付款后 PAY WorkItem 关闭；
11. 完成闭环后没有该采购单相关 OPEN WorkItem；
12. Full Replay 后 Pending Purchase / Payable / Inventory / Cash 与 replay 前一致；
13. Full Replay 不修改 canonical BusinessData；
14. Replay 不重新执行采购、收货或付款 Command；
15. Reference scenario 的结果可以由 lineage 解释。

## 5. Business-State Reference

预期生命周期：

```text
Purchase Order Approved
  → RECEIVE   OPEN
  → PAY       OPEN

Goods Fully Received
  → RECEIVE   DONE
  → PAY       still OPEN

Supplier Fully Paid
  → PAY       DONE
  → no P2P Work remains OPEN
```

## 6. Ledger Intent

Reference ledgers:

| Ledger | Purchase Order | Goods Receipt | Supplier Payment |
|---|---:|---:|---:|
| Pending Purchase | +quantity | -quantity | — |
| Payable | +amount | — | -amount |
| Inventory | — | +quantity/+amount | — |
| Cash | — | — | -amount |

No historical ledger entry is mutated. Later state is represented by new facts and derived postings.

## 7. Explicit Relationship Requirement

EVO MUST NOT infer fulfillment or settlement merely because quantities/amounts happen to match.

Required explicit relationships:

```text
Goods Receipt
FULFILLS
Purchase Order
```

and

```text
Supplier Payment
SETTLES / ALLOCATES_TO
Payable source
```

The existing BusinessObjectLink / AllocationInstruction / AllocationRelation mechanisms SHOULD be reused where they already satisfy the requirement.

Do not introduce a generic procurement relationship engine unless a current acceptance criterion proves it necessary.

## 8. Replay Requirement

Replay source remains canonical BusinessData plus pinned semantics.

Replay MUST:

- not execute Commands;
- rebuild derived posting/ledger/work state deterministically;
- preserve purchase-order, goods-receipt and payment BusinessData;
- reproduce the same official P2P economic result.

## 9. Anti-Overdesign Gate

Before adding any new abstraction, answer all four:

1. Which EEL-C02 acceptance criterion requires it?
2. What concrete gate fails without it?
3. Can an existing EVO mechanism satisfy the requirement?
4. Is the proposal needed now, or mainly for hypothetical future P2P complexity?

If a new abstraction cannot pass these questions, defer it.

## 10. Explicitly Deferred

Not part of EEL-C02:

- partial receipt;
- partial payment;
- multiple receipts per line;
- three-way matching;
- purchase invoice workflow;
- supplier invoice OCR;
- tax/VAT recovery;
- landed cost;
- freight allocation;
- purchase returns;
- supplier credit notes;
- prepayments/deposits;
- payment approval hierarchy;
- payment batch;
- bank account selection;
- bank reconciliation;
- cross-currency supplier payment;
- early-payment discount;
- payment fees;
- generic AP subledger framework.

These may become future packets when business value requires them.

## 11. Reuse First

Existing repository assets to examine before implementing:

- `enterprise-core-v1` purchase-order semantics;
- existing `pending-purchase`, `payable`, `inventory`, `cash` ledger definitions;
- current Command → BusinessData boundary;
- existing Posting rules and dimensions;
- existing AllocationInstruction / AllocationRelation;
- existing WorkProjection;
- Full Replay;
- lineage / BusinessObjectLink.

EEL-C02 should prove these mechanisms generalize to the procurement direction before inventing new infrastructure.

## 12. Implementation Slice Order

Recommended bounded slices:

### C02.1 — Purchase Order Economic Recognition
Prove:
- purchase_order.approved;
- Pending Purchase increase;
- Payable increase;
- RECEIVE/PAY work opens.

### C02.2 — Goods Receipt & Inventory
Prove:
- goods_receipt.received;
- explicit fulfillment relation;
- Pending Purchase closes;
- Inventory increases;
- RECEIVE work closes.

### C02.3 — Supplier Payment & Explicit Settlement
Prove:
- cash.paid;
- Cash decreases;
- explicit Payable settlement;
- Payable closes;
- PAY work closes.

### C02.4 — Full Replay Equality
Prove:
- P2P official economic state survives full derived-state rebuild;
- BusinessData unchanged;
- lineage/settlement relations preserved.

### C02.5 — Final Certification
Produce final EEL-C02 certification and Human–LLM alignment review.

## 13. Done Definition

EEL-C02 is done only when the enterprise can complete this full business story:

> “我下了采购订单，所以系统知道还有货没到，也知道我欠供应商多少钱；货到后库存增加、待收货关闭；付款后现金减少、应付关闭；所有结果都能追溯到业务事实，并且删除派生状态后可以完整重建。”

That business statement is the acceptance boundary.

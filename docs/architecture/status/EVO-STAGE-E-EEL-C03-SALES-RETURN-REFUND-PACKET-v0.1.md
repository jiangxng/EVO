# EVO Stage E — EEL-C03 Sales Return / Exchange / Refund / Red Invoice Reference Loop Packet v0.1

**Status:** BUSINESS PACKET / READY FOR IMPLEMENTATION  
**Date:** 2026-09-22  
**Stage:** Stage E — Enterprise Economic Loops  
**Packet:** EEL-C03  
**Name:** Sales Return / Exchange / Refund / Red Invoice Reference Loop

## 0. 60 秒业务摘要

EEL-C03 要证明：

> 已经完成的销售、发货和收款发生反向业务时，EVO 不修改历史，而是通过新的退货、换货、退款、红字发票事实表达业务变化，把库存、现金、票据/经济状态正确调整，并且 Full Replay 后结果仍然一致。

参考故事：

```text
Sales Order
→ Shipment
→ Customer Payment
→ Sales Return / Exchange
→ Inventory / Replacement Movement
→ Customer Refund
→ Cash Decrease
→ Red Invoice
→ Work Closure
→ Full Replay Equality
```

## 1. Business Goal

Prove one complete customer-side reverse economic loop on the certified EVO Economic Runtime.

企业必须能够回答：

- 客户退回的是哪一笔原销售/发货？
- 原订单和原发货有没有被改写？
- 退回后库存增加多少？
- 退款对应哪一次原收款或哪一个退货事实？
- 原收款有没有被改写？
- 退款后现金减少多少？
- 当前还有没有未完成退货/退款工作？
- 删除派生状态并 Replay 后结果是否完全一致？

## 2. Reference Scenario

第一版认证采用：

- 单一企业；
- 单一客户；
- 单一销售订单；
- 单一物料；
- 单一仓库；
- 原销售已发货；
- 原销售已收款；
- 一次退货；
- 一次换货事件；
- 一次退款；
- 一次红字发票事件；
- 同币种；
- 不含复杂税务计算/税控接口；
- 不含跨币种退款。

参考认证数据可以简单，但底层实现不得写死“一次退货/一次换货/一次退款/一次红字发票”。

## 3. Required Canonical Facts

### 3.1 Existing forward facts

Reference setup may use:

```text
sales_order.approved
sales_shipment.created
cash.received
```

These existing canonical facts MUST remain unchanged.

### 3.2 Sales Return

A return MUST append:

```text
sales_return.received
```

Expected effect:

- Inventory increases;
- explicit relation points to original sale/shipment;
- original sale/shipment facts remain unchanged.

### 3.3 Sales Exchange

Exchange MUST be represented as a new canonical business fact, not as mutation of the original sale/shipment/return.

Preferred semantic direction:

```text
sales_exchange.created
```

Expected effect:

- explicit relation identifies the returned/original business and replacement intent;
- inventory/replacement movement is expressed through normal posting/business facts;
- original sale/shipment/return facts remain unchanged.

A simple exchange event does NOT imply an RMA platform.

### 3.4 Customer Refund

Refund MUST be a new canonical business fact.

Preferred semantic direction:

```text
cash.refunded
```

or another explicitly customer-refund semantic if current metadata conventions prove better.

Expected effect:

- Cash decreases;
- explicit relation points to the relevant original receipt and/or return;
- original `cash.received` remains unchanged.

Do not reuse supplier-payment semantics merely because both reduce cash unless the semantic contract explicitly supports customer refunds.

### 3.5 Red Invoice

A red invoice MUST be represented as a new canonical business fact.

Preferred semantic direction:

```text
sales_red_invoice.issued
```

Expected effect:

- explicitly references the original invoice/sales economic source;
- does not mutate or delete the original invoice/business fact;
- any financial reversal is expressed through explicit posting rules;
- remains replayable and explainable.

A red-invoice event does NOT imply that EEL-C03 must build a tax-control integration, invoice approval platform, or full statutory tax engine.

## 4. Acceptance Criteria

EEL-C03 can be CERTIFIED only if:

1. Original Sales Order remains unchanged.
2. Original Shipment remains unchanged.
3. Original Customer Receipt remains unchanged.
4. Sales Return appends canonical BusinessData.
5. Sales Return explicitly identifies its source business.
6. Inventory quantity increases correctly after return.
7. Inventory value is handled by an explicit, replayable valuation rule.
8. Sales Exchange appends canonical BusinessData and explicitly identifies original/returned business.
9. Exchange does not mutate original Sales Order / Shipment / Return.
10. Customer Refund appends canonical BusinessData.
11. Customer Refund decreases Cash correctly.
12. Refund explicitly identifies the original receipt/return source.
13. Red Invoice appends canonical BusinessData.
14. Red Invoice explicitly identifies the original invoice/sales economic source.
15. Red Invoice never rewrites the original invoice/business fact.
16. No return/exchange/refund/red-invoice completion is inferred merely because quantities/amounts happen to match.
17. Relevant Work state closes from derived state/rules.
18. Full Replay rebuilds the same official reverse-flow economic state.
19. Full Replay does not re-execute Commands.
20. Canonical forward and reverse BusinessData remain unchanged.
21. Result lineage can explain why inventory/cash/financial reversal changed.

## 5. Core Architecture Rule

EEL-C03 MUST prove reverse business behavior without introducing a generic reversal engine unless existing primitives demonstrably fail.

Preferred expression:

```text
New reverse BusinessData
+ explicit relationships
+ Posting Rules
+ Ledger Balances
+ Valuation
+ WorkProjection
+ Replay
```

NOT:

```text
mutate original sale
mutate original shipment
mutate original receipt
```

## 6. Explicit Relationship Requirement

Required semantics:

```text
Sales Return
→ RETURNS / REFERENCES / FULFILLS-REVERSE
→ Original Sales Shipment / Sales Order
```

and:

```text
Customer Refund
→ ALLOCATES_TO / REFUNDS
→ Original Cash Receipt / Return
```

Reuse current relation mechanisms when sufficient.

Do not add a new generic relationship engine unless a current acceptance criterion requires it.

## 7. Work / Balance Principle

Work completion must be derived from balance/projection state.

Do not implement:

```text
if sales_return.received exists => DONE
if cash.refunded exists => DONE
```

when remaining quantity/amount could still be non-zero.

The implementation should remain compatible with future cumulative partial return/refund facts even though the first certification data may use one full return/refund.

## 8. Replay Requirement

Full Replay MUST:

- preserve original forward BusinessData;
- preserve return/refund BusinessData;
- preserve canonical explicit intent/relationships;
- rebuild derived ledger/work/valuation state;
- reproduce the same official economic result;
- not execute Commands again.

## 9. Explicitly Deferred

Not part of EEL-C03:

- RMA platform;
- repair flow;
- refund approval hierarchy;
- return freight;
- restocking fee;
- tax-control / e-invoice external integration;
- complex tax calculation / statutory reporting;
- credit memo product workflow;
- chargeback;
- multi-order refund distribution;
- refund fees;
- cross-currency refund;
- customer service ticketing;
- reason-code analytics productization.

## 10. Anti-Overdesign Gate

Before adding any new abstraction:

1. Which EEL-C03 acceptance criterion requires it?
2. What concrete business gate fails without it?
3. Can BusinessData + Rules + Ledger + Relation + Projection + Replay already express it?
4. Is it current necessity or future platform speculation?

If it is mainly future platform speculation, defer it.

## 11. Bounded Slice Order

### C03.1 — Sales Return Economic Recognition
- canonical return fact;
- explicit source relation;
- inventory restoration;
- forward facts unchanged.

### C03.2 — Sales Exchange
- canonical exchange fact;
- explicit source/replacement relation;
- replacement movement expressed through existing facts/rules;
- original facts unchanged.

### C03.3 — Customer Refund
- canonical customer refund fact;
- cash decrease;
- explicit source relationship;
- original receipt unchanged.

### C03.4 — Red Invoice
- canonical red-invoice fact;
- explicit original-source relation;
- explicit financial reversal posting where applicable;
- original invoice/business fact unchanged.

### C03.5 — Work / Balance Closure
- reverse-flow tasks close from derived state.

### C03.6 — Full Replay Equality
- official reverse-flow state reconstructed exactly.

### C03.7 — Final Certification
- certification + requirement alignment.

## 12. Done Definition

EEL-C03 is done only when the enterprise can truthfully say:

> “客户退货、换货、退款和红字发票都不会改写原订单、原发货、原收款或原票据；系统用新的可追溯业务事实表达变化，库存、现金和相关经济状态因此正确变化，并且删除派生状态后可以完整重建同样结果。”

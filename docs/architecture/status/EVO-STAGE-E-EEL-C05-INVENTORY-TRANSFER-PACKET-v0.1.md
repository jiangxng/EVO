# EVO Stage E — EEL-C05 Inventory Transfer & Warehouse Rebalancing Packet v0.1

**Status:** BUSINESS PACKET / READY FOR IMPLEMENTATION  
**Date:** 2026-09-22  
**Stage:** Stage E — Enterprise Economic Loops  
**Packet:** EEL-C05

## 0. Business Goal

Prove one bounded intra-enterprise inventory transfer loop where warehouse location changes but enterprise-wide quantity and inventory value are conserved.

## 1. Reference Scenario

Example:

```text
Warehouse A:
100 units / CNY 1,000

Transfer 40 units A → B

Partial receive:
15 + 25

Final:
Warehouse A = 60 units / CNY 600
Warehouse B = 40 units / CNY 400

Enterprise total:
100 units / CNY 1,000
```

The exact values may be generated from existing certified FIFO layers, but the conservation rule is mandatory.

## 2. Canonical Facts

Suggested semantics:

```text
inventory_transfer.created
inventory_transfer.issued
inventory_transfer.received
```

The final naming may adapt to existing application conventions.

## 3. Required Economic Effects

### Transfer Create

```text
inventory_transfer.created
→ pending_transfer increase
→ TRANSFER Work OPEN
```

### Transfer Issue

```text
inventory_transfer.issued
→ source warehouse Inventory quantity decrease
→ source cost basis identified
→ pending receipt / in-transfer state
```

### Transfer Receipt

```text
inventory_transfer.received
→ destination warehouse Inventory quantity/value increase
→ pending transfer decrease
```

At final completion:

```text
pending_transfer = 0
→ TRANSFER Work DONE
```

## 4. Conservation Invariants

For the certified enterprise scope:

```text
Σ Inventory Quantity before transfer
=
Σ Inventory Quantity after transfer
```

and:

```text
Σ Inventory Value before transfer
=
Σ Inventory Value after transfer
```

except for explicitly modeled transfer cost adjustments, which are out of scope for v0.1.

## 5. Forbidden Side Effects

A pure intra-enterprise transfer MUST NOT by itself create:

- Revenue；
- COGS；
- Operating Expense；
- Receivable；
- Payable；
- Cash movement。

## 6. Relationship Requirements

Must explicitly identify:

- source warehouse；
- destination warehouse；
- transfer request；
- issue facts；
- receipt facts；
- which receipt fulfills which transfer/issue。

Do not infer transfer lineage from matching quantity or timestamp.

## 7. Partial Execution

Reference proof should include partial receipt:

```text
Transfer 40
→ issue 40
→ receive 15
→ remaining 25 / Work OPEN
→ receive 25
→ remaining 0 / Work DONE
```

## 8. Cost / Valuation Requirement

The destination value must come from source cost basis, not from an arbitrary command amount.

For FIFO reference:

```text
source layers
→ transfer issue CostResult
→ dimension-aware value transfer
→ destination warehouse inventory value
```

## 9. Replay Requirement

Full Replay must:

- preserve transfer canonical facts；
- preserve explicit relationships；
- rebuild source/destination inventory；
- rebuild transfer cost/value movement；
- rebuild Work；
- preserve conservation invariants；
- reproduce identical economic digest；
- never execute Commands again。

## 10. Explicitly Deferred

- WMS platform；
- TMS；
- bins/locations optimization；
- wave/pick/pack；
- carrier/shipping；
- cross-legal-entity transfer；
- transfer pricing；
- customs/bonded stock；
- advanced lot/serial productization；
- cycle count platform。

## 11. Delivery Strategy

### Bundle A — Transfer Execution
facts + quantity + partial execution + Work + relations

### Bundle B — Valuation + Replay + Certification
cost basis + value conservation + no-P&L invariant + Full Replay + certification

## 12. Done Definition

EEL-C05 is done only when the enterprise can truthfully say:

> “库存从 A 仓移到 B 仓时，数量和价值的来源、去向与剩余任务都能解释；企业总库存数量与价值不会因为内部搬运而变化；删除派生状态后可以重建完全相同的结果。”

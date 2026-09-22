# EVO Stage E — EEL-C04 Manufacturing Execution Reference Loop Packet v0.1

**Status:** BUSINESS PACKET / READY FOR IMPLEMENTATION  
**Date:** 2026-09-22  
**Stage:** Stage E — Enterprise Economic Loops  
**Packet:** EEL-C04  
**Name:** Manufacturing Execution Reference Loop

## 0. 60 秒业务摘要

EEL-C04 要证明：

> EVO 能够把生产需求、原料领用、成品完工、库存价值、生产待办和制造成本表达成同一套不可变业务事实 + 条件式记账 + 账本 + Cost + Work + Replay，而不需要新建制造专用 Core Runtime。

## 1. Business Goal

Prove one bounded Manufacturing Execution reference loop on the certified EVO Economic Runtime.

企业必须能够回答：

- 为什么要生产？
- 还剩多少没有生产？
- 哪些原料被领用了？
- 原料库存为什么减少？
- 哪些成品完成了？
- 成品库存为什么增加？
- 当前生产任务是否完成？
- 成品成本来自哪里？
- Replay 后这些结果是否一致？

## 2. Reference Scenario

第一版认证采用：

- 单一企业；
- 单一成品；
- 一个简单生产需求；
- 一种原料；
- 单一仓库；
- 同一计量单位；
- 原料库存先存在；
- 一次或多次领料；
- 一次或多次生产完工；
- FIFO 或现有已认证成本路径；
- 不含工序、设备、复杂 BOM/MRP。

参考数据应简单，但 Runtime 不得写死“一次领料/一次完工”。

## 3. Required Canonical Facts

建议语义：

```text
production_demand.created
material_issue.issued
production.completed
```

如果现有命名约定有更合适的兼容表达，可以调整，但必须保持业务语义清楚。

## 4. Expected Economic Effects

### Production Demand

```text
production_demand.created
→ pending_production increase
→ PRODUCE Work OPEN
```

### Material Issue

```text
material_issue.issued
→ raw material Inventory decrease
→ explicit REFERENCES / CONSUMES_FOR production demand
```

### Production Completion

```text
production.completed
→ finished goods Inventory increase
→ pending_production decrease
```

当累计完成量达到需求量：

```text
pending_production = 0
→ PRODUCE Work DONE
```

## 5. Manufacturing Cost

成品成本必须可以解释。

第一版最低要求：

```text
Raw Material Cost Basis
→ Material Issue
→ Production Cost Basis
→ Finished Goods Inventory Value
```

不得：

- 在业务代码里直接改 Inventory balance；
- 使用隐藏 SQL 函数作为不可解释成本逻辑；
- 为让成本“对上”修改 canonical BusinessData。

## 6. Relationship Requirements

至少应能表达：

```text
Material Issue
→ consumes for / references
→ Production Demand
```

以及：

```text
Production Completion
→ fulfills
→ Production Demand
```

关系不得仅靠数量相等推断。

## 7. Work / Balance Principle

Production Work 必须由 `pending_production` 余额驱动。

部分完工场景：

```text
Demand 100
→ complete 30
→ remaining 70
→ Work OPEN
→ complete 20
→ remaining 50
→ Work OPEN
→ complete 50
→ remaining 0
→ Work DONE
```

## 8. Replay Requirement

Full Replay MUST:

- preserve canonical production demand / material issue / completion facts；
- preserve explicit relations；
- rebuild Inventory；
- rebuild pending-production；
- rebuild Cost；
- rebuild Work；
- reproduce identical official result；
- never execute Commands again。

## 9. Explicitly Deferred

Not part of EEL-C04 v0.1:

- full BOM platform；
- multi-level BOM explosion；
- MRP；
- APS；
- MES；
- routing / operation scheduling；
- machine/device integration；
- OEE；
- quality platform；
- subcontract manufacturing；
- co-product/by-product allocation；
- rework/scrap platform；
- advanced lot/serial traceability；
- capacity optimization。

## 10. Anti-overdesign Gate

Before adding any new abstraction:

1. Which C04 acceptance criterion requires it?
2. What concrete business gate fails without it?
3. Can existing BusinessData + Rule + Ledger + Relation + Cost + Work + Replay express it?
4. Is it current necessity or future Manufacturing Platform speculation?

## 11. Bounded Slice Order

### C04.1 — Production Demand / Work
### C04.2 — Raw Material Issue
### C04.3 — Production Completion
### C04.4 — Manufacturing Cost
### C04.5 — Partial / Multiple Production
### C04.6 — Full Replay Equality
### C04.7 — Final Certification

## 12. Done Definition

EEL-C04 is done only when the enterprise can truthfully say:

> “生产需求、原料消耗、成品完工、库存、生产待办和成本都来自可追溯业务事实；部分生产不会提前关闭任务；删除派生状态后可以完整重建同样的制造经济结果。”

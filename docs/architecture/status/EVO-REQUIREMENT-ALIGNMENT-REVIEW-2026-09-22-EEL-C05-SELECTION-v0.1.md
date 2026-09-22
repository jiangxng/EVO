# EVO Requirement Alignment Review — 2026-09-22 — Post EEL-C04 / EEL-C05 Selection v0.1

**Status:** ALIGNED / NEXT BUSINESS LOOP SELECTED  
**Date:** 2026-09-22  
**Stage:** Stage E — Enterprise Economic Loops

## 0. 60 秒业务摘要

当前已经认证：

```text
EEL-C01  客户正向：Order → Fulfillment → Receipt → Replay
EEL-C02  供应商正向：Purchase → Receipt → Payment → Replay
EEL-C03  客户反向：Return / Exchange / Refund / Red Invoice → Replay
EEL-C04  制造执行：Demand → Material Issue → WIP → Completion → Replay
```

下一条选择：

> **EEL-C05 — Inventory Transfer & Warehouse Rebalancing Reference Loop**

业务上要回答：

> 同一批库存从 A 仓移到 B 仓时，EVO 能不能证明只是“位置变了”，而不是“经济价值凭空增加/减少”？

## 1. 为什么现在做 Inventory Transfer

### 1.1 新增证据价值高

现有闭环已经证明：

- 外部客户；
- 外部供应商；
- 反向业务；
- 制造投入/产出。

还缺一个非常基础但关键的企业能力：

```text
企业内部资产位置变化
```

它要求：

- 源仓减少；
- 目标仓增加；
- 企业总数量守恒；
- 企业总库存价值守恒；
- 成本基础从源仓迁移到目标仓；
- 不产生 Revenue / Expense / AR / AP / Cash；
- Work/状态只表达调拨执行，不创造经济收益；
- Replay 后完全一致。

### 1.2 APQC 视角

该能力属于库存管理、仓储和内部物流能力族。

它不是销售，也不是采购；因此能进一步验证 EVO 的业务语义不依赖外部交易对手。

### 1.3 当前已有基础

Enterprise Core 已存在：

- Inventory domain；
- inventory-movement transaction type；
- `inventory.moved`；
- warehouse / facility dimensions；
- inventory ledger；
- FIFO/LIFO/MWA/Specific ID 成本基础；
- Cost / Valuation；
- Replay。

因此目标仍然是：

> 组合和补齐现有底座，不新增 WMS Core Runtime。

## 2. EEL-C05 第一版业务故事

```text
Raw / Finished Inventory already exists in Warehouse A
→ Inventory Transfer Requested
→ Transfer Issue from Warehouse A
→ In-transit or explicit transfer state
→ Transfer Receipt into Warehouse B
→ Warehouse A quantity/value decrease
→ Warehouse B quantity/value increase
→ Enterprise-wide quantity/value unchanged
→ Full Replay equality
```

## 3. 必须证明

1. 调拨来源是 canonical BusinessData；
2. 源仓和目标仓必须显式存在，不能靠上下文推断；
3. 源仓库存数量减少；
4. 目标仓库存数量增加；
5. 调拨使用源仓真实成本基础；
6. 企业总库存数量守恒；
7. 企业总库存价值守恒；
8. 调拨不得产生 Revenue / COGS / Expense / AR / AP / Cash；
9. 部分调拨/多次收货用重复事实表达；
10. 未完成调拨可以有 balance-driven Work；
11. 完成后调拨 Work 关闭；
12. Full Replay 保留 canonical facts / relationships；
13. Full Replay 重建库存、成本、Work 后完全一致。

## 4. 当前不要求

第一版不建设：

- 完整 WMS；
- 波次拣货；
- 库位级优化；
- 自动补货；
- 运输管理 TMS；
- 承运商；
- 运输计费；
- 跨法人调拨；
- 内部销售/转移定价；
- 在途所有权复杂规则；
- 海关/保税库存；
- 批次/序列号产品化；
- 复杂盘点平台。

## 5. 关键架构挑战

当前 Cost / Valuation 已经证明库存“出库 → COGS/WIP”。

库存调拨不同：

```text
source warehouse Inventory value
→ destination warehouse Inventory value
```

两边是同一个 ledger code，但维度不同。

因此 C05 会重点验证：

> 当前 Valuation / Posting 能否显式表达“同 Ledger 不同 dimensions 的价值迁移”。

如果现有机制不够，只允许新增最小的 dimension-aware transfer mechanism；不得借机建设通用物流平台。

## 6. 建议 bundle 节奏

为了保持当前加速节奏，不再机械按小片拆 PR。

### C05 Bundle A — Transfer Execution

一次性覆盖：

- transfer request / issue / receipt facts；
- source/destination warehouse；
- quantity movement；
- pending transfer / Work；
- partial/multiple receipt；
- explicit lineage。

### C05 Bundle B — Transfer Valuation + Replay + Certification

一次性覆盖：

- source cost basis；
- destination inventory value；
- quantity/value conservation；
- no P&L side effects；
- Full Replay；
- final certification。

## 7. Anti-overdesign Gate

新增抽象前必须回答：

1. 当前调拨验收是否真的需要？
2. 不做会阻塞哪个业务 gate？
3. 现有 Posting / Cost / Valuation / Relation 是否已经能表达？
4. 是调拨当前必要，还是未来 WMS/TMS 假想需求？

## 8. Alignment conclusion

**REQUIREMENT_DRIFT:** 未发现。  
**SCOPE_DRIFT:** 未发现。  
**OVERDESIGN_RISK:** 可控；明确禁止扩成 WMS/TMS。  
**STATUS_DRIFT:** 已通过 PR #41 修复。  
**NEXT PACKET:** EEL-C05 Inventory Transfer & Warehouse Rebalancing。

选择它的原因不是“库存模块还没做”，而是它第一次对 EVO 提出严格的内部资产迁移守恒要求：

```text
location changes
economic ownership/value does not
```

# EVO Requirement Alignment Review — 2026-09-22 — Post EEL-C03 / EEL-C04 Selection v0.1

**Status:** ALIGNED / NEXT BUSINESS LOOP SELECTED  
**Date:** 2026-09-22  
**Stage:** Stage E — Enterprise Economic Loops

## 0. 60 秒业务摘要

当前已经认证：

```text
EEL-C01
客户正向：
Sales Order → Production → Shipment → Receipt → Settlement → Replay

EEL-C02
供应商正向：
Purchase Order → Goods Receipt → Supplier Payment → Replay

EEL-C03
客户反向：
Return → Exchange → Refund → Red Invoice → Work Closure → Replay
```

三条闭环已经证明：

- 正向客户业务；
- 正向供应商业务；
- 反向客户业务；
- append-only 历史；
- 条件式记账；
- 账本余额；
- Work；
- Replay。

继续做更多销售/采购邻近变体，新增架构证据有限。

下一条最值得验证的是：

> 企业收到制造需求后，EVO 能不能把生产需求、原料消耗、成品完工、库存价值、生产待办和成本统一放在同一条可重放业务链里？

因此选择：

```text
EEL-C04 — Manufacturing Execution Reference Loop
```

## 1. 最终目标有没有变化？

没有。

EVO 仍然是 AI-Native、可生长、模块化、行业无关的企业运行底座。

## 2. Stage E 目标有没有变化？

没有。

Stage E 继续验证：

> 现有 Economic Runtime 是否足以承载真实企业端到端能力，而不是继续为了技术完整性扩建底层。

## 3. 为什么选择 Manufacturing Execution

### 3.1 APQC / 企业能力视角

前面三条主要集中在：

- 客户订单与履约；
- 采购与付款；
- 客户侧反向业务。

制造执行能补上一个不同的企业能力族：

```text
Demand / Production Requirement
→ Material Consumption
→ Production Completion
→ Finished Goods Inventory
→ Cost
→ Work
→ Replay
```

它能检验 EVO 是否真的跨销售、采购、库存、制造，而不是只在交易/结算类场景成立。

### 3.2 当前 EVO 已有基础

现有 Enterprise Template 已包含：

- Production domain；
- production-planning capability；
- production-completion capability；
- `production.completed`；
- `pending-production`；
- Inventory；
- Cost / Valuation。

因此当前更适合“补齐制造闭环”，而不是设计一个新的 Manufacturing Core。

### 3.3 Legacy 证据支持 Reference Pack 方向

Legacy archaeology 已明确：

```text
MRP / WMS / manufacturing models
→ ARCHIVE + ADOPT SEMANTICS
→ Reference Enterprise Packs
→ NOT EVO Core tables
```

这与当前“平台 = 可组合应用集合”的方向一致。

## 4. EEL-C04 第一版业务故事

第一版采用简单 Make-to-Order / manufacturing execution 参考场景：

```text
Sales / Production Demand
→ Pending Production
→ Production Order / Execution Fact
→ Raw Material Issue
→ Raw Material Inventory decrease
→ Production Completion
→ Finished Goods Inventory increase
→ Pending Production close
→ Production Work DONE
→ Finished Product Cost explainable
→ Full Replay equality
```

## 5. 当前必须证明

1. 生产需求是明确业务来源，不靠人工改余额；
2. 生产执行/完工是新的 canonical BusinessData；
3. 原料领用是新的 canonical BusinessData；
4. 原料库存通过正常 Ledger posting 减少；
5. 成品库存通过正常 Ledger posting 增加；
6. 原料消耗和成品产出有显式关系；
7. Pending Production 根据累计完成量关闭；
8. Production Work 从余额关闭；
9. 生产成本能够从明确来源解释；
10. Full Replay 后 BusinessData 不变；
11. Ledger / Balance / Cost / Work 可重建一致。

## 6. 当前不要求

EEL-C04 第一版不建设：

- 完整 MRP；
- APS 高级排程；
- MES 平台；
- 工序/工艺路线平台；
- 设备联网；
- OEE；
- 质量管理平台；
- 委外加工；
- 联副产品复杂分摊；
- 返工/报废复杂流程；
- 批次追溯产品化；
- 多层 BOM 爆炸；
- 产能负荷优化。

这些能力未来可以作为 Manufacturing Package 的独立 Apps / bounded packets。

## 7. Anti-overdesign

### 是否需要 Manufacturing Runtime？

当前没有证据。

优先使用：

```text
Application
+ BusinessData
+ Relation
+ Posting Rules
+ Ledger
+ Cost / Valuation
+ WorkProjection
+ Replay
```

### 是否现在需要完整 BOM/MRP？

不需要。

第一版可以使用明确输入的原料消耗事实，先证明制造经济链。

### 是否需要 MES？

不需要。

EEL-C04 证明的是企业业务/经济语义，不是车间设备控制。

## 8. 建议 bounded slices

### C04.1 — Production Demand / Work
- production demand 来源；
- pending-production；
- PRODUCE Work OPEN。

### C04.2 — Raw Material Issue
- canonical material issue fact；
- raw-material Inventory decrease；
- explicit source/production relation。

### C04.3 — Production Completion
- canonical production completion；
- finished-goods Inventory increase；
- pending-production cumulative closure。

### C04.4 — Manufacturing Cost
- input material cost basis；
- finished goods cost；
- explainable lineage；
- no hidden SQL/business mutation.

### C04.5 — Partial / Multiple Production
- 多次领料 / 多次完工；
- Work stays OPEN until balance zero。

### C04.6 — Full Replay Equality
- canonical facts unchanged；
- inventory / cost / Work rebuilt equally。

### C04.7 — Final Certification

## 9. Alignment conclusion

**REQUIREMENT_DRIFT:** 未发现。  
**SCOPE_DRIFT:** 未发现。  
**OVERDESIGN_RISK:** 可控；明确禁止把 C04 扩成 MRP/MES 平台。  
**COMPREHENSION_GAP:** 当前制造故事可以直接用企业语言解释。  
**STATUS_DRIFT:** EEL-C03 已 CERTIFIED / CLOSED。

最终选择：

> **EEL-C04 — Manufacturing Execution Reference Loop**

选择理由不是“制造模块应该做了”，而是它现在提供最大的跨域验证价值：首次把需求、库存消耗、生产产出、成本、Work 和 Replay 放进同一条制造业务链。

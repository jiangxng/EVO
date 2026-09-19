# Batch 01 — Field / Transaction / Ledger Semantic Observations

Status: IN PROGRESS — evidence-backed, not final canonical mapping

## Source facts
Uploaded SQL contains 451 `account_field` rows. DDL confirms each has 12 properties: ID, FIELD_NAME, HUMP_NAME, UNDER_NAME, CONTAINER_ID, TABLE_ID, FIELD_TYPE, V_TYPE, IS_SHOW, IS_ASSOCIATE, SORT, COMMENT. These properties are migration evidence and cannot be collapsed to name+type.

Field physical types: varchar 292, num 133, date 25, image 1. The 451 rows contain 277 distinct HUMP_NAME values; 92 names occur more than once. Thirty-five repeated HUMP_NAME groups contain differing names/types/behavior semantics, proving that deduplication by technical field name is unsafe. Examples include `transCode` representing 交易号/实例编码/订单号/锁定单号, `storehouseCode` representing 库位编码/库区编码, and `dealerCode` representing 供应商编码/往来编码.

Conclusion: EVO requires separate `FieldDefinition` and `FieldUsage` semantics. A shared technical name is evidence for convergence, never sufficient identity.

## Transaction semantics
The 372 `trans_type` records are not merely CRUD types. Early source examples include 期初, 收款, 备货订单, 付款, 采购申请, 货品销售订单, 物料需求调整, 主计划, 工单任务派工, 本地调拨, 工资计提, 资金转户, 库存盘点, 手动核销, 开账, 物料需求计划, 结账, 项目结项, 零售服务, 设备采购验收, 销售出库, 工单任务验收, 工程领用物资 and logistics/other inventory operations.

Conclusion: legacy TransactionType is a mixed semantic catalog. EVO MUST classify each source row before mapping it to canonical TransactionType, Command, workflow action, accounting operation, planning operation or other definition family. A 1:1 table rename is prohibited.

## Ledger/account semantics
The 134 `calc_rel` rows encode far richer semantics than an account code: measure (`qty`, `amount`, `foreign`), locating dimensions, auxiliary locating dimensions, account grouping, balance/state behavior, debit matching, merge policy, object field, status and revoke semantics.

Observed examples include 库位存货 keyed by material/warehouse/location/entity; 存货 keyed by material/warehouse/entity; 批次存货 adding batch; 项目存货 adding project; 组织存货 adding department; 货币资金 keyed by cash account/accountSub/entity; 待收票/待开票 variants keyed by counterparty/material/facility.

Conclusion: canonical EVO convergence is `LedgerDefinition + Measure + explicit DimensionPolicy + PostingPolicy + matching/settlement semantics`, not `calc_rel` replication. Dimension identity and mapping must remain explicit.

## First canonical decisions
1. Introduce FieldUsage as a first-class template relation; do not duplicate FieldDefinition merely because presentation or transaction context differs.
2. Do not deduplicate fields by HUMP_NAME alone; semantic identity requires business concept + value type + context constraints.
3. Classify all 372 legacy transaction types before canonical generation.
4. Split `calc_rel` semantics across LedgerDefinition, dimensions, posting/matching policy and measure semantics while retaining source lineage.
5. Keep raw expressions as evidence while converging understood expression families into a typed deterministic rule AST.

## Next evidence batch
Reconstruct the graph linking transaction types → field relations → components → expressions → calculation relations → account/dimension semantics. This graph, not legacy table boundaries, drives canonical Enterprise Template generation.
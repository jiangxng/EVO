# Legacy Archaeology Backfill — Analysis Process and Data Assets

Status: LIVING BACKFILL RECORD
Date: 2026-09-17
Scope: discoveries made before high-frequency repository recording was adopted

## Purpose

This file backfills important reasoning, evidence, data assets, and wrong turns from earlier Asloop/bookkeeping archaeology. It intentionally contains intermediate interpretations. Later corrections must append status changes rather than erase history.

## A. Evidence taxonomy used in this backfill

- OBSERVED: directly seen in legacy source/schema/config/comment.
- INTERPRETED: explanation consistent with observed evidence but not yet proven end-to-end.
- HYPOTHESIS: architectural/generalized interpretation needing more evidence.
- CORRECTED: earlier interpretation changed by later evidence/user historical context.
- UNRESOLVED: asset/behavior exists but semantics are not yet fully known.

## B. Asloop calculation metadata — recovered asset families

### OBSERVED asset family: calculation fields

The 2016 calculation initialization snapshot exposes parallel quantity and monetary channels. Recovered field names include:

- qty
- qtyWaterBal
- qtyLocked
- qtyTbMatched
- amount
- amntWaterBal
- amntTbMatched
- amntLocked
- transObjCode
- containerCode
- dealerCode
- checkDirection
- matchDirection
- transMatchedCode
- transMatchedSeq
- transMatchedDetailId
- effectiveTime

Preservation status: INVENTORIED-PARTIAL. Exact IDs, descriptions, types, defaults, expressions and all remaining attributes still need machine extraction.

### OBSERVED asset family: calculation relations / semantic ledgers

Recovered relation codes and interpreted labels:

- `crinvn` — inventory
- `crunph` — pending purchase
- `crniwh` — pending purchase inbound
- `crunpr` — pending production
- `crnows` — pending sales outbound
- `crclnt` — customer dealings / receivable
- `crsppl` — supplier dealings / payable
- `crissu` — invoice to issue
- `cracqu` — invoice to acquire
- `crslin` — sales income
- `crslct` — sales cost
- `crgvrn` — tax
- `crexpn` — expense

Interpretive labels above must remain traceable to source names/comments; do not silently promote translations into canonical names.

### OBSERVED: quantity vs amount component behavior

Recovered component behavior indicates:
- inventory components may carry both qty and amount;
- pending purchase/inbound/production/outbound operational relations emphasize qty;
- customer/supplier receivable/payable, invoices, income, sales cost, tax and expense emphasize amount.

INTERPRETATION H-FLOW-001: inventory/resource state is an important intersection between physical quantity flow and monetary valuation flow.

Status: CANDIDATE, supported by multiple legacy structures but not a final universal ontology.

## C. Asloop expression DSL — preserve expressions as data assets

### OBSERVED expression vocabulary

Examples recovered during archaeology include:

- `current.qty`
- `current.amount`
- `source('qty')`
- `source('amount')`
- `match('qtyTbMatched')`
- `sum('crinvn.amount')`
- `rule.checkDirection`
- `lastStockOut(current.qty)`

Recovered proportional allocation expressions include forms equivalent to:

- `(source('qty') / match('qtyTbMatched')) * match('amntTbMatched')`
- `(match('qtyTbMatched') - source('qty')) * match('amntTbMatched') / match('qtyTbMatched')`
- `(source('qtyTbMatched') - match('qty')) * source('amntTbMatched') / source('qtyTbMatched')`

These strings are themselves legacy metadata/data assets, not merely implementation snippets. The future asset inventory must preserve the exact source expression, source ID/name, owner component/relation, parameters, and normalized AST if one is produced.

INTERPRETATION H-ALLOC-001: quantity consumption can drive proportional value consumption from a matched source layer/open item.

UNRESOLVED U-LASTSTOCKOUT-001: `lastStockOut(current.qty)` was labeled/understood during archaeology as “最近出库法”, but implementation has not yet been recovered. It MUST NOT be equated to LIFO until proven.

## D. Asloop calculation dependency evidence

OBSERVED expressions can reference outputs of other calculation relations, e.g. `sum('crinvn.amount')` and combinations of relation amounts.

HYPOTHESIS H-DEP-001: Asloop encoded a calculation dependency graph implicitly through expression references and runtime ordering.

Candidate EVO consequence: dependencies should become explicit, inspectable metadata/DAG with topological ordering, cycle detection, version identity and impact analysis.

Status: CANDIDATE. Need full expression graph extraction before freezing.

## E. Asloop Matching / Collector evidence that must not be lost

OBSERVED historical collector metadata included multiple source/target collector modes for quantity, amount direction, and quantity+amount. Collector queries used open-state fields and `EFFECTIVE_TIME` ordering.

OBSERVED Component metadata includes concepts/fields equivalent to:
- data collector identity
- calculation relation code
- check direction
- match direction
- lock behavior
- negative-state permission
- calculation fields

HYPOTHESIS H-MATCH-001: the mechanism is broader than financial settlement and represents a generalized matching/allocation engine over open economic/operational state.

Important caution: this hypothesis must not erase domain semantics. Inventory costing, order fulfillment, AR/AP settlement, production allocation and explicit user-selected matching may share infrastructure while retaining different policies.

## F. Asloop intentional redundancy / materialization

OBSERVED: legacy calculation/component structures contain redundant fields such as calculation-relation/account-like codes and persisted balance/matching fields that directly participate in runtime expressions.

Earlier risk: treating redundancy as normalization debt.

CORRECTED interpretation: some redundancy was intentional performance/materialization design. EVO should use semantic normalization while permitting physical denormalization/materialized projections when they are derivable, replayable, versioned and explainable.

Candidate phrase preserved from archaeology:

`Semantic Normalization, Physical Denormalization`.

## G. bookkeeping TransdataAccount — unresolved value as a first-class clue

OBSERVED source comments characterize financial accounting as recording asset movement and needing a source/precondition. Direction semantics include add/dr/-cr as inflow and sub/cr/-dr as outflow.

OBSERVED: entries carry `quantityFactor` and `amountFactor`; amount factor was intentionally represented in a way that can defer evaluation because cost may be unknown when the business occurrence is first recorded.

INTERPRETATION H-DEFERRED-VALUE-001: an economic fact may have known physical quantity while monetary value remains unresolved until valuation/cost interpretation.

Candidate EVO separation:

`Fact / Movement != CostBasis != Valuation != AccountingProjection`.

## H. bookkeeping balance grain and materialization

OBSERVED: Balance persists quantity and amount plus configurable accounting/calculation dimensions. Persistence context determines whether balances are account-level, order-level or another accounting grain.

Candidate abstraction recorded earlier:

`BalanceProjectionDefinition { ledger, measure, dimensions[], aggregationKey[], partitionKey[], materializationPolicy, consistencyPolicy }`

Examples considered during reasoning:
- inventory: material + warehouse + lot
- receivable: customer + currency
- project cost: project + cost center
- production: production order + material
- bank: bank account + currency

These examples are architectural examples, NOT claims that all exact combinations existed in legacy metadata.

## I. bookkeeping cost state, residual closure and lineage

OBSERVED during code archaeology:
- moving-average price can be derived from balance amount / balance quantity;
- cost code handles final depletion by consuming remaining pool value rather than blindly multiplying rounded unit price;
- cost splitting proportionally allocates and then assigns rounding residual so child total closes to source total;
- functions/comments refer to locating source cost references and resolving material dependency paths;
- `cost_mwa` contains fields including object identity, price, transaction identity, path, account, transaction number, calculation-field name/value and time.

INTERPRETATION H-CONSERVATION-001:
- when a valuation pool is fully consumed, quantity and value should close together;
- allocation children should conserve parent/source value under explicit precision/rounding policy.

INTERPRETATION H-COST-LINEAGE-001: `cost_mwa.path` and source cost UUID behavior are evidence of cost/material provenance, distinct from ordinary business parent-child causality.

## J. bookkeeping business causality vs cost lineage

OBSERVED: Transdata parent/child relationships are used for business relationships such as transfer outbound -> inbound and production-related parent/child occurrences.

OBSERVED separately: cost services create/resolve cost references and material dependency paths.

Therefore current working distinction:

- Business Causality Graph
- Allocation/Matching Graph
- Cost/Valuation Lineage Graph
- Accounting Projection Graph
- Calculation Dependency/Impact Graph

Earlier analysis grouped allocation and cost lineage more closely. Preserve that earlier grouping as a superseded simplification; current model keeps them separable pending cardinality/lifecycle proof.

## K. bookkeeping calculation order and temporary state

OBSERVED: cost-producing entries are calculated before dependent entries. Same-batch occurrences may require temporary/intermediate balance behavior so multiple outflows do not all read the same stale pre-batch balance.

INTERPRETATION H-ORDER-001: at least three notions of order must be distinguished:

- Economic Order — when enterprise reality occurred / business ordering.
- Calculation Dependency — what result requires another result first.
- Projection Order — deterministic sequence in which a projection/materialization is built.

These may coincide in simple cases but are not identical concepts.

## L. bookkeeping replay / checkpoint evidence

OBSERVED: recalculation SQL identifies prior balance/cost state before a target time and recalculates forward from that historical state.

HYPOTHESIS H-CHECKPOINT-001: EVO should support replay checkpoints/snapshots as derived acceleration state. Immutable history remains canonical; checkpoint is an optimization/recovery boundary, not the source of truth.

## M. Critical correction: differential recalculation was solving financial trial performance

Earlier interpretation H-DIFF-OLD:
legacy differential propagation mainly demonstrated the complexity/risk of mutating historical derived state.

Status: SUPERSEDED-PARTIALLY.

User historical context + code behavior corrected the interpretation: the chain

`transaction changed -> balance changed -> balance_log changed -> cost changed -> downstream cost changed`

was also deliberately solving local financial trial/recalculation performance. Full recalculation of long history could take hours; a simple unrelated cash inflow should not force inventory/production cost recomputation.

Current architectural interpretation H-IMPACT-001:

`Change Impact Analysis + Incremental Recalculation` is a legitimate optimization capability.

Correctness/reference path:
`Full Deterministic Replay`.

Performance path:
`Dependency/impact-scoped incremental recalculation`.

Candidate invariant:
`Correctness must never depend on incremental recalculation; performance may.`

Verification target:
for equivalent facts/rules/valuation/order boundaries, incremental and full replay should converge to equivalent digest/results.

Important implementation restraint: do not overbuild incremental replay in EVO's earliest core if current hardware makes full replay sufficiently cheap. Preserve the semantic requirement and architecture seam.

## N. Time semantics recovered/derived during archaeology

Candidate time axes:
- `effective_at` — enterprise reality/business-effective time
- `recorded_at` — when the system recorded the fact
- `interpreted_at` — when cost/valuation interpretation ran
- `projected_at` — when projection/materialization was generated

Motivation includes late invoices, retroactive facts, cost recalculation, FX revaluation and period close/reopen.

Status: CANDIDATE architecture derived from legacy problems; exact legacy field mapping still requires inventory.

## O. Foreign exchange assets and hypotheses

OBSERVED in Asloop schema archaeology:
- `sys_foreign_exchange` — currency/exchange-rate configuration; precision evolved in schema history.
- `trans_settlement_exchange` — entity + year/month uniqueness with generated/associated transaction identity.

HYPOTHESIS H-FX-001: ordinary FX resource transaction and period-end settlement/revaluation are distinct semantic processes.

Status: CANDIDATE. Table structure supports distinction, but call chain and generated transaction rules have not yet been reconstructed.

HYPOTHESIS H-CURRENCY-DUAL-ROLE-001: foreign currency may act both as an Economic Resource and as a monetary denomination/unit of measure.

Status: CANDIDATE, not frozen.

## P. Legacy transaction-type/tag data assets — partial backfill

Recovered examples from Asloop migration history must be treated as template-definition assets. Partial list:

- `tsfgbvin` 委外加工完工入库 — 物流、生产
- `tsgainin` 存货盘盈 — 物流
- `tsgdpsod` 采购订单 — 交付计划
- `tslossin` 存货盘亏 — 物流
- `tsosrein` 委外加工退料 — 物流、生产
- `tspcchin` 采购入库 — 物流
- `tspcrtin` 采购退货出库 — 物流
- `tspspsod` 委外加工订单 — 交付计划
- `tsrlinin` 在途调拨入库 — 物流
- `tsrlitin` 在库调拨 — 物流
- `tsrlouin` 在途调拨出库 — 物流
- `tssalsin` 即时销售出库单 — 物流、销售
- `tsslrtin` 销售退货入库 — 物流、销售
- `tsssplit` 货品简单拆分 — 物流
- `tswwjgll` 委外加工领料 — 物流
- `tsmgcspy` 付供应商欠款 — 钱流
- `tsmgcspd` 收客户欠款 — 钱流
- `tspackeg` 货品简单组合 — 物流
- `tsngdslod` 现货销售订单 — 交付计划
- `tsprepare` 备品订单 — 交付计划
- `tsnbjgll` 内部加工领料 — 物流、生产
- `tsysddxsck` 预售订单销售出库 — 物流
- `tspredslod` 预售销售订单 — 销售
- `tsdlreplay` 交付计划单 — 交付计划
- `tsnbpsod` 内部加工订单 — 交付计划
- `tsprompt` 现货订单销售出库 — 物流
- `tsschedule` 部门排程单 — 交付计划
- `tssupply` 客户供料订单 — 交付计划
- `tsintcomp` 内部加工完工入库 — 物流、生产
- `tscusfwar` 客户供料入库 — 物流
- `tscusfback` 客户供料退料出库 — 物流
- `tsinpmr` 内部加工退料 — 物流、生产
- `tsinplcus` 内部加工领客户料 — 物流、生产
- `tsinporcus` 内部加工退客户料 — 物流、生产
- `tsperexr` 期间费用报销 — 费用
- `tsmanexpr` 制造费用报销 — 费用
- `tspexppro` 期间费用计提 — 费用
- `tsmanexpp` 制造费用计提 — 费用
- `tsmanbonp` 制造部门工资与奖金计提 — 工资
- `tsumbonp` 非制造部门工资与奖金计提 — 工资
- `tsmsdofa` 制造部门固定资产折旧计提 — 资产
- `tsumsdofa` 非制造部门固定资产折旧计提 — 资产
- `tsoutpfee` 计提委外加工费 — 生产
- `tsentintax` 计提企业所得税 — 税务
- `tsadcust` 预收客户款 — 钱流
- `tsadvsup` 预付供应商款 — 钱流
- `tsradcst` 退预收客户款 — 钱流
- `tspadvs` 收预付供应商款 — 钱流
- `tsremfre` 付员工报销欠款 — 钱流
- `tsposrf` 付员工备用金 — 钱流
- `tsemretf` 收回员工备用金 — 钱流

Status: PRESERVED-PARTIAL. Do not assume this is the complete transaction-type set; source migration output was larger/truncated during interactive archaeology.

## Q. Broader Asloop application/template assets already observed

Migration history shows definition structures outside accounting, including dashboard/card definitions and changes to List, process-node actions, permissions and transaction types. Combined with earlier repository understanding, the broader extraction target includes at minimum:

Forms, FormViews, Lists, ListViews, WebMenu, Reports, fields, field groups/components, application definitions, transaction types, process/workflow metadata, permissions, dashboard/card metadata, calculation metadata and rules.

This section intentionally records the asset classes even where exact records have not yet been extracted. Absence of an atomic inventory is UNRESOLVED work, not permission to omit them from Enterprise Template migration.

## R. Enterprise Template completeness rule

A semantic skeleton such as domains + dimensions + ledger classes + cost methods + transaction types is insufficient to represent eleven years of accumulated legacy definition assets.

Completion requires a crosswalk/loss ledger for every recoverable atomic definition attribute. Normalization is allowed; silent loss is not.

Recommended future machine-readable columns:

`source_system, source_path, source_table_or_type, source_id, source_code, source_name, attribute, raw_value, asset_class, evidence_hash, status, evo_target_type, evo_target_code, transformation, confidence, supersedes, notes`

## S. Current working economic-runtime genealogy

Non-final candidate:

`Enterprise Reality -> Business/Economic Fact -> Economic Flow/Movement -> Measurement -> Matching/Allocation -> Cost Basis -> Valuation/Interpretation -> Operational/Accounting Projection -> Ledger Entry -> Balance Projection -> Checkpoint`

Cross-cutting:
- business causality
- allocation lineage
- cost lineage
- calculation dependency/impact
- projection lineage
- version/policy identity
- time semantics

Do not promote this diagram into Constitution merely because it is coherent. Continue testing it against raw legacy assets.

## T. Backfill gaps deliberately left open

This backfill still does NOT claim exhaustive preservation. Highest-priority missing raw inventories are:

- complete `计算初始化脚本.sql` tables + records + IDs + descriptions + expressions;
- exact `c_match_rel` and `c_match_field` records;
- exact collector/query-param records;
- full Water Balance / To-Be-Matched state transitions;
- `lastStockOut` implementation;
- FX settlement call chain;
- full bookkeeping Account/Policy records and SQL function inventory;
- full Asloop Forms/FormViews/Lists/ListViews/WebMenu/Reports/fields metadata;
- transaction-type list beyond currently recovered partial migration excerpt.

Each should be captured in small batches and committed immediately.

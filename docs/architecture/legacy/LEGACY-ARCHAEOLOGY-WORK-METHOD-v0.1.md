# Legacy Archaeology Work Method v0.1

**Status:** ACTIVE WORKING PROTOCOL  
**Date:** 2026-09-18  
**Scope:** Asloop-Backend + bookkeeping → EVO Enterprise Template / Economic Runtime  
**Purpose:** 让后续 LLM 可以从仓库恢复“分析过什么、怎么分析、得到了什么、还缺什么、下一步做什么”，避免因聊天上下文截断或模型切换而重复考古。

---

## 0. 为什么需要这份文档

Legacy archaeology 已进入高 token、高证据密度阶段。聊天是 working buffer，不是 durable source of truth。

> **Repository-first archaeology memory.**

允许分析消耗大量 token；优化目标不是少分析，而是：**同一份证据尽量只做一次昂贵的完整理解，之后通过仓库中的 evidence ledger、analysis packet、genealogy 和 crosswalk 复用结果。**

# 1. 文档分工

| 文档 | 作用 | 保存错误路径 |
|---|---|---|
| `LEGACY-CALCULATION-GENEALOGY-v0.1.md` | 计算/成本/匹配语义演化、假设、纠正、EVO 候选抽象 | 是 |
| `LEGACY-ARCHAEOLOGY-BACKFILL-2026-09-17.md` | 高频记录机制建立前的分析与数据资产补录 | 是 |
| `LEGACY-ARCHAEOLOGY-WORK-METHOD-v0.1.md` | 分析方法、已分析文件→结果索引、近期计划、上下文控制、交接协议 | 是 |
| Future `LEGACY-DATA-ASSET-INVENTORY-*` | 原子数据资产清单 | 保存状态 |
| Future `LEGACY-SOURCE-EVO-CROSSWALK-*` | Source → EVO 映射 | 保存变换与置信度 |
| Future `LEGACY-LOSS-LEDGER-*` | 完整性/损失证明 | 是 |
| Future analysis packets | 单个高密度文件/子系统的一次性深挖 | 是 |

不要把这些文档重新合并成一份“干净总结”。它们共同组成 durable reasoning memory。

# 2. Evidence / Interpretation 状态

`OBSERVED` = 直接源证据；`INTERPRETED` = 与证据一致但未端到端证明；`HYPOTHESIS` = 待证实；`CORRECTED` = 旧解释已被纠正；`UNRESOLVED` = 对象存在但语义未恢复；`NORMALIZED` = 已映射为 EVO-native 语义。

资产状态继续使用：`PRESERVED_RAW / INVENTORIED / NORMALIZED / SUPERSEDED_WITH_LINEAGE / INSTANCE_DATA_EXCLUDED / UNRESOLVED`。

未来 LLM 应先查 Analysis Ledger，再决定是否重新打开原文件。

# 3. 已分析项目文件 / 资产与分析结果对照

本节是 **Analysis Ledger**。早期考古部分只能精确到文件族、SQL 对象或代码对象；此类条目标记 BACKFILLED。后续定位精确路径时采用增加法补充，不伪造路径。

## 3.1 Asloop-Backend

| Source / asset | 已分析内容 | 主要结果 | 当前状态 | 是否整文件重析 |
|---|---|---|---|---|
| `roleplay-localize/roleplay-localize-provider/src/main/resources/db/计算初始化脚本.sql` | `c_calc` 初始化快照；Field/Component/Expression/Resource | 恢复 qty/amount 双通道、WaterBal/TbMatched/Locked、source/match DSL、relation/component；证明计算元数据是 Template 资产 | ANALYZED-PARTIAL | **否**；定向抽表/记录/表达式 |
| `roleplay-localize/roleplay-localize-provider/src/main/resources/db/1499252611845.sql` | schema + definition DML | migration SQL 也是 definition asset；含 dashboard/card、list/process/permission/trans_type 演化及大量 transaction type 定义 | ANALYZED-PARTIAL | **否**；抽原子 DML 到 inventory |
| `c_calc_field` records | qty/amount/water balance/to-be-matched/lock/object/container/dealer/match refs/effective time | quantity 与 monetary channels 并行；inventory/resource 位于二者交汇 | BACKFILLED / INVENTORIED-PARTIAL | 补 IDs/types/defaults/comments |
| `c_component` | collector/direction/lock/negative/calc field | Component 决定 collector、方向、负数策略和 channel 等运行行为 | BACKFILLED / INTERPRETED | 补实际 rows |
| `c_data_collector / c_query_param` | 8 类 collector、eligibility、EFFECTIVE_TIME ordering | Matching 是 metadata-driven historical open-state selection；ordered consumption 已有证据，但不能直接称 FIFO | BACKFILLED / NEEDS-RAW-ROWS | 定向恢复 records |
| `c_match_rel / c_match_field` | component + calc relation + trans type + expression | Match 是通用计算/匹配机制候选，不只是 AR/AP settlement | BACKFILLED / UNRESOLVED-ROWS | **高优先级** |
| expression families: `current/source/match/sum` | qty/value allocation | 数量匹配可驱动 value/cost allocation；支持 Allocation/Matching Kernel 候选 | BACKFILLED / PARTIAL | 按 expression family 抽取 |
| `lastStockOut(current.qty)` | cost-selection reference | 只证明“最近出库法”线索；**无实现证据不得称 LIFO** | UNRESOLVED-IMPLEMENTATION | **高优先级**找实现 |
| `sys_foreign_exchange` | rate schema/precision | 汇率定义资产存在；更高层 resource/denomination 解释仍为 candidate | BACKFILLED | 追调用 |
| `trans_settlement_exchange` | entity+period uniqueness + trans code | 支持 period/entity settlement/revaluation 候选；FX gain/loss 精确语义未冻结 | UNRESOLVED-CALL-CHAIN | **高优先级** |
| Forms/FormViews/Lists/ListViews/WebMenu/Reports/fields/process/permissions | broader enterprise definition families | bookkeeping 缺失这些对象不能视为废弃；Template 不能退化成 accounting template | FAMILY-IDENTIFIED | 后续独立 packet |

## 3.2 bookkeeping

早期部分结论已到函数/类级，但精确路径未全部从旧聊天转入 repository。原则：**保留对象名与结论；后续定位路径时补路径，不为了路径而重做业务分析。**

| Source / code object | 主要分析结果 | 状态 | 下一步 |
|---|---|---|---|
| `TransdataAccount` | accounting direction/factors；quantityFactor 与 amountFactor 分离；amount 可依赖后算成本 | BACKFILLED | 补路径 + contract |
| `Transdata` | business causality 与 accounting/cost lineage 不同；transTime 与 workflow effective time 需区分 | BACKFILLED | time/causality crosswalk |
| `Balance` | quantity+amount+dimensions；metadata-defined valuation scope 的 derived/materialized state | BACKFILLED | 抽 schema/keys |
| `BalanceService` | occurrence → temp → procedure → balance → balance_log → cost_mwa；temp 避免同批多出库 stale state | BACKFILLED | 追 procedure I/O |
| `BalancePersistenceContext` | key = Account + Calc Field Names + Values | valuation pool grain 不是全局硬编码库存桶 | STRONG-EVIDENCE | 映射 BalanceKey/ValuationScope |
| `CostMwa / CostMwaService` | derived cost state；source UUID/path/account/dimensions | path 是成本依赖/provenance 线索 | BACKFILLED | 抽 path chain |
| `fn_get_newest_cost_amount` | final outbound consumes remaining amount | quantity/value 同时闭合；吸收 rounding residual | STRONG-EVIDENCE | conservation test |
| `proc_part_cost_split` | proportional split + SUM + difference assignment | rounding + residual assignment 是正式 policy 问题 | STRONG-EVIDENCE | AllocationConservationPolicy |
| `fn_get_cr_cost_uuid` | source cost reference | 支持 CostLineage | BACKFILLED | 补调用链 |
| `fn_get_mat_path_by_account_cost_uuid` | material dependency path | `cost_mwa.path` 是 dependency/provenance，不是普通 debug | BACKFILLED | 补 path format/caller |
| `balance.sql` family | balance/balance_log/balance_nf/balance_log_nf | current + historical log；financial/non-financial 可能共享 machinery，nf 精确语义未冻结 | PARTLY-UNRESOLVED | 定向 DDL/procedure |
| `proc_update_balance_by_diff` | differential propagation | **旧解释已纠正**：历史设计意图包含 financial trial/local recalculation performance，避免无关变化触发多年成本重算 | CORRECTED | 追 callers/comments |
| `recalc.sql` | prior-state recalculation | checkpoint-like 局部重算思想；现代 EVO 可分 full replay 与 dependency-scoped incremental path | BACKFILLED | boundary/equivalence |
| `Policy` | formulas/conditions/dimensions/variables | Rule/Projection Runtime 可服务 operational + accounting projection；成本变量可延迟解析 | BACKFILLED | 全量 inventory |
| `记账规则.sql` | event → multiple ledger/state effects | 一个业务发生可同时投影到库存、待采购、会计科目、待开票、待上架等 | STRONG-EVIDENCE | 原子 rule inventory |

# 4. 不应从零重复推导的研究基线

除非新证据直接冲突，未来 LLM 复用以下基线：Asloop 比 bookkeeping 更广；legacy definition/config 是 Template asset；transaction instance 不进入 template；qty 与 monetary/value flow 要区分；Matching/Allocation 不只 AR/AP；WaterBal/TbMatched 完整 state machine 尚未证明；EFFECTIVE_TIME ordering 不等于所有 matching 都是 FIFO；lastStockOut 未证明为 LIFO；Cost/Valuation 是 derived interpretation/state；多种 lineage/dependency 不应混为 generic parent/source；rounding residual 是正式 policy/invariant 问题；full replay 是 correctness path、incremental recalculation 是 performance path；Balance grain/ValuationScope metadata-defined；Semantic Normalization + Physical Denormalization 是强候选原则；Template completeness 需 inventory + crosswalk + loss ledger + certification 证明。

若推翻任何一项，append correction，不静默覆盖。

# 5. 标准分析方法：Archaeology Packet

以后不要采用“打开很多文件 → 聊天连续推理几十轮 → 最后才总结”。

一个 packet 只解决一个可命名问题，例如：

`AP-WB-001 Water Balance / To-Be-Matched state machine`  
`AP-MATCH-001 c_match_rel + c_match_field semantics`  
`AP-COST-001 bookkeeping residual closure`  
`AP-FX-001 FX settlement/revaluation chain`  
`AP-FORM-001 Asloop Form/FormView model`

Packet 开始先查：`Analysis Ledger → Genealogy → Backfill → Asset Inventory`。只有 evidence gap 才重新读 source。

标准步骤：

```text
Question
→ Known conclusions
→ Evidence gaps
→ Minimal source set
→ Raw extraction
→ Observed facts
→ Interpretations
→ Contradictions / alternatives
→ State transition / dependency / data model reconstruction
→ Historical design intent
→ EVO candidate mapping
→ Unresolved questions
→ Asset inventory update
→ Genealogy/correction update
→ Commit
```

**Minimal source set** 不是为了少花 token，而是为了避免重复把整个 repository 塞入上下文。大 SQL 优先定向抽取目标表/DML/expression，只有上下文不足时扩大范围。

Packet 完成前至少留下：Sources inspected、raw objects/records、observations、interpretations、rejected/superseded interpretations、current conclusion、confidence、unresolved、EVO impact、next evidence target、preservation status、commit SHA。

没有写入 repository 的长篇聊天分析，不视为 durable completed archaeology。

# 6. Token / Context 优化

目标不是限制分析 token，而是限制 **重复 token** 与 **聊天长期驻留 token**。

```text
L0 Project Intent
   EVO-13 + constitution/boundaries

L1 Archaeology Index
   本文件：分析过什么、结论、下一步

L2 Topic Genealogy / Packet
   当前主题证据、推理、纠正

L3 Raw Source
   SQL/code/config，仅按 evidence gap 读取
```

新 LLM 正常先加载 L0+L1，再加载当前 L2；不要默认重新加载全部 L3。

出现以下情况之一立即落盘：新 source family 得到稳定观察；hypothesis 被证实/推翻；出现 architecture implication；已分析约 3–5 个高密度对象；主题可形成 state machine/graph/crosswalk；准备切换主题；对话开始依赖很早的细节。

> **Commit before context becomes the only place where a conclusion exists.**

# 7. 文件级分析记录模板

```yaml
analysis_record:
  id:
  source_system:
  repository:
  ref_or_commit:
  path:
  source_object:
  source_kind:
  inspected_scope:
  evidence_status:
  raw_asset_status:
  observations:
  interpretations:
  historical_intent:
  evo_implications:
  contradictions:
  unresolved:
  do_not_reanalyze_unless:
  next_target:
  related_packet:
  related_genealogy:
  recorded_at:
```

`do_not_reanalyze_unless` 用来直接减少未来重复分析，例如：new migration found / exact expression contradicts interpretation / caller requires broader context。

# 8. 近期分析规划

## Phase A — 关闭 Economic Runtime 最大语义缺口

**AP-WB-001**：恢复 qty/amnt WaterBal 与 TbMatched、source/match/current、正负方向、residual、lock/allowed-negative、EFFECTIVE_TIME ordering。输出 collector variant × state transition matrix。

**AP-MATCH-001**：恢复 `c_match_rel/c_match_field/c_component/c_data_collector/c_query_param/expression/transaction type/calculation relation`，证明什么 metadata 决定什么 runtime behavior。

**AP-COST-001**：验证 BalanceKey/ValuationScope、CostMwa、source cost UUID、material path、rounding、residual recipient、pool exhaustion，形成可执行 invariant/test candidates。

## Phase B — Change Impact / Replay

**AP-RECALC-001**：追 `proc_update_balance_by_diff` callers、recalc.sql、balance_log、cost_mwa dependency、historical comments。目标恢复 `Change → Impact Set → Recalculation Scope → Dependency Order → Equivalence Check against Full Replay`。

## Phase C — FX

**AP-FX-001**：追 `sys_foreign_exchange → trans_settlement_exchange → caller → generated trans code → posting/calculation rule → period behavior`。完成前 FX settlement/revaluation 精确 legacy behavior 保持 UNRESOLVED。

## Phase D — Complete Enterprise Template

与 accounting archaeology 并行，按 family 建 packet：`AP-TXTYPE-* / AP-FIELD-* / AP-FORM-* / AP-LIST-* / AP-MENU-* / AP-REPORT-* / AP-PROC-* / AP-PERM-* / AP-DASH-* / AP-RULE-*`。每批直接进入 machine-readable inventory。

# 9. 下一步动作

```text
1. Start AP-WB-001
2. 定位计算初始化脚本中的 collector/query/expression 精确记录
3. 建 WaterBal/TbMatched transition matrix
4. 立即写 packet/genealogy/inventory
5. Commit
6. 仅在证据指向时进入 AP-MATCH-001
7. 再用 bookkeeping AP-COST-001 做跨系统 genealogy validation
8. 每完成一个 packet 更新本 Analysis Ledger
```

不要在 source evidence 尚未闭合时提前大规模改 Runtime code。

# 10. Handoff Contract

未来接手 LLM 按：`EVO-13 latest additive convergence → 本 WORK-METHOD → LEGACY-CALCULATION-GENEALOGY → topic-specific BACKFILL → current packet → unresolved raw source` 恢复上下文。

接手后的第一件事不是重新理解 Asloop/bookkeeping，而是确认 Analysis Ledger 的最后完成 packet 与 Next Action。

若发现旧文档有错：**append correction; never erase reasoning genealogy.**

若发现已分析文件：**reuse recorded result unless a named evidence gap requires reopening it.**

若必须重析：记录为什么、source/ref 有何变化、新结果相对旧结果改变了什么。

# 11. 方法论完成标准

```text
Different LLM + Repository only
→ identify project intent
→ identify inspected files/objects
→ reuse prior conclusions
→ see uncertainty/corrections
→ locate next evidence gap
→ continue without repeating archaeology
```

> **大量 token 用在发现新知识，而不是重新发现已经发现过的知识。**


# 12. 2026-09-18 packet ledger update — AP-FX-001

Completed packet:

`docs/architecture/legacy/packets/AP-FX-001-FOREIGN-CURRENCY-SETTLEMENT.md`

Status:

`SEMANTIC GATE CLOSED`

Primary recovered conclusions:

- foreign measurement and local carrying value are separate channels;
- settlement closure and period-end revaluation are separate runtime semantics;
- realized FX difference is generated at foreign-position closure;
- period-end FX difference is a valuation result over still-open foreign positions;
- period-end revaluation changes local value/projection, not the foreign amount;
- `EXCHANGE_RATE_END` is directly evidenced as period-end rate;
- rate role/source/version must be explicit in EVO;
- period-close registry/governance is not the economic position.

Do not broadly re-open FX source files unless:

- transaction-level `rates` population is required for certification;
- close-registry enforcement is needed for migration compatibility;
- new source contradicts AP-FX-001.

## Current first unresolved gate

`AP-MANUAL-ALLOC-001 — Manual vs Automatic Allocation`

Minimal-source entry order:

`MATCH_TYPE`
` → MANUALLY_FIELD`
` → manual verification/matching controller/service/UI path`
` → persisted selected source references`
` → correction/reallocation path`
` → mixed manual+automatic behavior`
` → actor/mode/reason provenance`
` → replay classification`

Required closure distinctions:

- Allocation Fact;
- Allocation Instruction / Constraint;
- Allocation Interpretation Result;
- Residual Position Projection.

Only after this gate should the Allocation persistence contract be frozen.


# 13. 2026-09-18 packet ledger update — AP-MANUAL-ALLOC-001

Completed packet:

`docs/architecture/legacy/packets/AP-MANUAL-ALLOC-001.md`

Status:

`SEMANTIC GATE CLOSED`

Primary recovered conclusions:

- manual matching target comes from business transaction input;
- `TRANS_MATCHED_CODE / MANUALLY_FIELD` acts as source-selection instruction/constraint;
- automatic source choice is a deterministic interpretation result under pinned policy/order/open state;
- generated match lineage and WaterBal/TbMatched are rebuildable calculation state;
- revoke restores calculation state without erasing the business-side manual selection instruction;
- mixed manual→automatic semantics are valid conceptually, but current legacy mode-3 initialization has an implementation inconsistency that must not be copied.

Current first unresolved gate:

`AP-COST-METHOD-001 — FIFO / LIFO / Average / Specific Identification genealogy`

Entry order:

`bookkeeping moving-average evidence`
` → Asloop ordered candidate selection`
` → lastStockOut implementation`
` → source ordering variants`
` → explicit lot/source selection`
` → negative inventory interaction`
` → transfer/return basis carry-over`
` → backdated behavior`
` → unified CostMethodPolicy model`


# 14. 2026-09-18 packet ledger update — AP-COST-METHOD-001

Completed packet:

`docs/architecture/legacy/packets/AP-COST-METHOD-001.md`

Status:

`SEMANTIC GATE CLOSED`

Do not reopen cost-method sources merely to look for a legacy LIFO label. Current evidence explicitly distinguishes:

- moving average pool valuation;
- ordered allocation substrate;
- latest-in price reference;
- explicit source-referenced costing.

Strict legacy LIFO remains not evidenced.

Current first unresolved gate:

`AP-RECALC-001 — Change Impact / Local Recalculation vs Full Replay`

Entry order:

`proc_update_balance_by_diff`
` → recalc.sql`
` → balance_log`
` → cost_mwa.path / source UUID`
` → backdated insertion boundary`
` → downstream dependency closure`
` → incremental stop condition`
` → equivalence against full replay`
` → checkpoint contract`


# 15. 2026-09-18 packet ledger update — AP-RECALC-001

Completed packet:

`docs/architecture/legacy/packets/AP-RECALC-001.md`

Status:

`SEMANTIC GATE CLOSED`

The current blocker sequence is complete:

- AP-FX-001 — CLOSED
- AP-MANUAL-ALLOC-001 — CLOSED
- AP-COST-METHOD-001 — CLOSED
- AP-RECALC-001 — CLOSED

The active task is no longer archaeology.

Next:

`Economic Runtime Architecture Freeze Gate`

Read the four closed packets plus the current economic-flow ADR and classify every candidate concept as:

- CORE CANONICAL;
- MODULE CONTRACT;
- DERIVED RESULT;
- MATERIALIZATION;
- REFERENCE / TEMPLATE SEMANTIC;
- REJECTED / NOT NEEDED.

Do not reopen legacy source families unless the freeze review discovers a genuine evidence contradiction.

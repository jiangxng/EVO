# EVO 项目整体目标、当前阶段目标与路线图 v0.1
# EVO Project Goals, Current Stage Goal & Roadmap v0.1

**状态 / Status：AUTHORITATIVE HIGH-LEVEL ORIENTATION**  
**日期 / Date：2026-09-19**  
**维护方式 / Maintenance：ADDITIVE — 新认识新增版本，不覆盖历史版本**

---

## 0. 文档目的

这份文档回答三个长期问题：

1. **EVO 整个项目最终为什么存在？**
2. **当前大阶段到底要完成什么？**
3. **当前阶段结束以后，整体路线往哪里走？**

它不替代具体 ADR、Contract、Migration、Certification、Context Checkpoint。

它的作用是：

> 防止长期开发过程中，被局部 work packet、CI、Schema、模块编号带偏，从而失去对整体目标和阶段验收终点的判断。

---

# 1. EVO 整个项目的最终目标

EVO 的目标不是重写一个传统 ERP。

EVO 的最终定位是：

> **AI-Native、可生长、模块化、行业无关的企业运行底座 / Enterprise Operating System。**

它需要能够长期支撑：

- 销售；
- 采购；
- 库存；
- 生产；
- 成本；
- 应收应付；
- 资金；
- 财务；
- 流程；
- SOP；
- 工作任务；
- 企业管理数据；
- 行业模板；
- 企业个性化；
- AI Agent / LLM 操作。

长期系统边界：

```text
EC
Think / Learn
    ↓ Proposal

Eidos
Interact
    ↓ ActionRequest

EVO
Execute
    ↓
Enterprise Facts / Economic State / Work State
```

核心宪法：

> **EC thinks and learns. EVO executes. Eidos interacts.**

EVO 的职责是：

> 成为企业可信、可验证、可解释、可重放的执行底座。

---

# 2. EVO 与传统 ERP 的核心区别

传统 ERP 常见模型：

```text
单据
 ↓
修改状态
 ↓
修改库存
 ↓
修改余额
 ↓
修改成本
 ↓
修改财务结果
```

时间足够长以后，很难稳定回答：

- 为什么今天库存是这个数字？
- 为什么三年前这批货的成本是这个数字？
- 如果历史规则错误怎么办？
- 如果补录三年前一笔业务怎么办？
- 如果算法变化怎么办？
- 如果系统升级或 LLM 更换怎么办？

EVO 当前选择的是：

```text
Canonical Business Facts
        +
Explicit Business Intent
        +
Versioned Definitions
        +
Versioned Policies
        +
Pinned Reference Data
        ↓
Deterministic Interpretation
        ↓
Position
Allocation
Cost
Valuation
Projection
        ↓
Ledger / Work
        ↓
Balance / Report / UI
```

核心思想：

> **事实尽量永久保存，解释可以重做，结果可以重建。**

因此：

- BusinessData 是 canonical fact；
- AllocationInstruction 可以是 canonical business intent；
- AllocationRelation / CostResult / ValuationResult / LedgerEntry 等属于可重建派生；
- Balance / WorkItem / Checkpoint 等属于 materialization / optimization；
- 历史纠错优先使用新增事实、冲销、更正和重新解释，而不是静默改写历史。

---

# 3. 当前项目所处的大阶段

当前项目尚未进入“完整 ERP 产品功能铺开”阶段。

当前属于：

> **Economic Runtime Kernel — Correctness, Replay & Production-Safe Recalculation**

业务语言：

> 先证明 EVO 的企业经济运行内核真正正确、可解释、可重建、可安全重算，再在上面大规模建设完整业务模块、行业模板、Eidos 产品体验和 EC 智能层。

这一阶段是后续：

- 业务模块；
- 报表；
- 驾驶舱；
- SOP；
- AI Agent；
- 行业模板；

可信运行的底座。

---

# 4. 已完成的关键前置阶段

## 4.1 Semantic Archaeology

当前 Economic Runtime 核心范围：

**阶段性完成**

目标不是复制旧 Java，而是从 Asloop / bookkeeping / 旧数据库 / 配置 / 运行逻辑中恢复真正有价值的企业经济语义。

已经提炼：

- resource flow ≠ monetary flow ≠ valuation；
- quantity / amount / carrying value 分离；
- Fact-before-value；
- Allocation / Matching；
- manual vs automatic allocation；
- FIFO / LIFO / MWA / Specific Identification；
- foreign quantity vs local carrying；
- realized settlement vs period-end revaluation；
- replay / recalculation；
- balance/materialization 不是 canonical truth。

---

## 4.2 Economic Runtime Architecture Freeze

核心语义已经冻结：

```text
Business/Economic Fact
→ Measurement / Explicit Basis / Explicit Instruction
→ Position / Allocation / Derivation
→ Cost / Valuation
→ Projection
→ Materialization
→ Replay / Certification
```

并明确：

- MATCH_REL ≠ Allocation canonical model；
- Component ≠ EVO semantic component；
- WaterBal / TbMatched ≠ canonical truth；
- DB ID ≠ semantic order；
- latest rule/policy/rate ≠ Replay semantics；
- Full Replay = correctness oracle。

---

## 4.3 Full Replay Correctness

状态：

**CERTIFIED**

已通过真实 PostgreSQL E2E 证明：

```text
USD receivable = 1000
initial carrying = CNY 7000

period-end rate = 7.2
→ carrying = CNY 7200
→ revaluation delta = +200

actual settlement = CNY 7300
→ realized FX delta = +100

delete derived state
→ FULL REPLAY
→ rebuild same economic state

beforeDigest == afterDigest
```

Full Replay 的角色：

> **Correctness Oracle / 正确性最高裁判**

---

# 5. 当前大阶段的最终目标

当前阶段的最终目标不是：

- 做一个 FIFO；
- 做一个 Planner；
- 做一个 Checkpoint；
- 做一个 Candidate Dataset。

真正目标是：

> **把已经证明正确的 Full Replay，升级成生产环境可使用的 Safe Incremental Replay。**

也就是说，当企业历史发生变化：

- 补录历史业务；
- 新增冲销/更正；
- 历史规则修复；
- 成本政策变化；
- 汇率数据修正；
- 系统语义升级；

EVO 不应该每次都从企业第一天重算。

目标执行链：

```text
Historical Change
      ↓
Impact Analysis
      ↓
Earliest Affected Boundary
      ↓
Certified + Promoted Checkpoint
      ↓
Restore Prefix State
      ↓
Create Isolated Candidate Generation
      ↓
Recompute Only Affected Suffix
      ↓
Rebuild Derived Runtime Families
      ↓
Candidate Economic Runtime Digest
      ↓
Independent Full Replay Oracle
      ↓
Candidate Digest == Full Replay Digest
      ↓
Candidate VERIFIED
      ↓
Governed Atomic Activation
      ↓
new CURRENT / ACTIVE
old CURRENT → ARCHIVED
```

数学意义上的最终目标：

```text
IncrementalReplay(history, change)
==
FullReplay(newHistory)
```

Full Replay 是 correctness oracle。

Incremental Replay 是 production optimization。

**优化永远不能改变正确性。**

---

# 6. 当前阶段必须通过的验收条件

当前大阶段只有在以下能力全部成立后才可以关闭：

1. Checkpoint 必须来自成功的 Full Replay；
2. Coverage Certification 必须完整；
3. Checkpoint 必须经过显式 Promotion 才能用于 Incremental Replay；
4. Checkpoint 必须能够恢复真正的经济前缀状态，而不只是保存 digest；
5. Impact Analysis 必须确定 earliest affected boundary；
6. Incremental Replay 必须只重算必要 suffix，不能内部偷偷执行 Full Replay；
7. CURRENT 与 CANDIDATE 必须隔离；
8. 已完成旧 Run 的审计语义不能被“删一半结果”破坏；
9. Posting / Allocation / Cost / Valuation / Ledger / Work 等主要派生 family 必须遵循同一 generation；
10. Candidate 必须形成完整 lineage / dependency evidence；
11. Candidate 必须产生稳定 Economic Runtime Digest；
12. 独立 Full Replay 必须针对同一 canonical history 再计算一次；
13. `candidate digest == full replay digest`；
14. mismatch / uncertainty 必须 fallback Full Replay；
15. Candidate 验证失败不能污染 CURRENT；
16. Candidate 验证成功后才能显式/原子激活；
17. previous CURRENT 必须可归档；
18. 整个过程必须可审计、可解释、可复现。

在这些条件全部完成之前：

> **不能宣称 Production-Safe Incremental Replay 已完成。**

---

# 7. 当前阶段路线与状态

当前主线：

```text
Full Replay Correctness
        ✅ CERTIFIED

Coverage Certification
        ✅ CERTIFIED

ReplayCheckpoint
        ✅

Checkpoint Promotion
        ✅ CERTIFIED

Economic Runtime Generation Lifecycle
        ✅ CERTIFIED

Generation Isolation
        🟡 IN PROGRESS

Checkpoint Prefix State
        🟡 IN PROGRESS

Suffix-only Recompute
        🟡 first real execution path in progress

Candidate Full Economic Digest
        ⬜

Independent Full Replay Oracle Comparison
        ⬜

Incremental == Full
        ⬜

Atomic Whole-Runtime Activation
        🟡 lifecycle primitive proven,
           full economic activation not yet certified

Fallback / rollback certification
        ⬜
```

---

# 8. 当前准确开发位置

当前已经不再停留在“Incremental Replay 设计”。

已经进入实际增量计算。

当前已完成：

- promoted safe checkpoint；
- EconomicRuntimeDataset；
- CURRENT / CANDIDATE / ARCHIVED 生命周期；
- MaterializationContext；
- generation-aware AllocationRun；
- generation-aware CostRun；
- generation-aware ValuationRun；
- generation-aware ValuationPosition；
- generation-aware LedgerDataset；
- generation-aware CalculationDependencyEdge；
- ReplayCheckpoint materialization storage；
- deterministic CostPool checkpoint projector；
- FIFO/LIFO/MWA 基础 checkpoint-state tests；
- PostgreSQL sequence-bounded ValuationInput reader。

第一个真实 Cost Prefix State 已经 E2E 证明：

```text
Production:
10 units / total cost 100

Shipment before checkpoint:
2 units

Checkpoint COST_POOL:
remaining quantity = 8
unit cost = 10
source = original production BusinessData
semantic digest = stable
capture = idempotent
```

当前正在验证的第一条真实 suffix execution：

```text
Checkpoint:
8 @ 10

        ↓

checkpoint after:
new shipment 1

        ↓

Incremental Planner
select promoted checkpoint

        ↓

CANDIDATE generation

        ↓

restore 8 @ 10

        ↓

read only suffix input

        ↓

expected candidate cost:

quantity = 1
unitCost = 10
totalCost = 10
```

并验证 Candidate 中的：

- CostRun；
- AllocationRun / AllocationRelation；
- ValuationPosition；
- LedgerDataset；
- CalculationDependencyEdge；

全部属于同一 candidate generation。

该路径完成后仍不能关闭整个 Incremental Replay 阶段。

---

# 9. 当前阶段内部拆分

为了避免一次性大改，当前 Incremental Replay 路线拆分为：

## B4.1 — Checkpoint Promotion

回答：

> 哪个历史点有资格成为生产局部重算的起点？

状态：

**CLOSED / CERTIFIED**

---

## B4.2A — Materialization Generation

回答：

> 如何让旧正式解释与新候选解释同时存在且互不污染？

状态：

**核心生命周期已认证，module generation scoping 持续完善。**

---

## B4.2B — Checkpoint Prefix State

回答：

> 从历史安全点继续计算，需要恢复哪些真实经济状态？

当前首先覆盖 Cost：

- FIFO remaining layers；
- LIFO remaining layers；
- MWA quantity / amount pool；
- Specific-ID remaining source state。

随后需要继续覆盖：

- valuation carrying state；
- position/residual state；
- ledger/materialized prefix；
- workflow/work projection 必要状态。

状态：

**IN PROGRESS**

---

## B4.2C — True Suffix Replay + Full-Replay Equivalence

回答：

> 只重算后半段，最后能否与完整 Full Replay 得到完全相同的企业经济状态？

最终证据：

```text
candidateDigest
==
fullReplayOracleDigest
```

状态：

**NOT YET CERTIFIED**

---

# 10. 当前阶段结束后的整体路线

Production-Safe Incremental Replay 完成后，Economic Runtime 的 correctness foundation 基本可以关门。

之后主要资源转向企业完整业务循环。

整体路线：

```text
Stage A
Semantic Archaeology
        ✅ core scope complete

Stage B
Economic Runtime Architecture
        ✅ core freeze

Stage C
Full Replay Correctness
        ✅ certified

Stage D
Production-Safe Incremental Replay
        ← CURRENT

Stage E
Enterprise Economic Loops
        ↓
Sales → Shipment → AR → Receipt
Purchase → Receipt → AP → Payment
Inventory
Production
Return
Transfer
Correction / Reversal
Multi-currency
Cost methods
...

Stage F
Enterprise Template Productization
        ↓
industry templates
installation
diff
upgrade
binding
migration
canary

Stage G
Eidos Product Experience
        ↓
forms
lists
dashboards
workflow
SOP
reports
business interaction

Stage H
EC Intelligence Layer
        ↓
long-term learning
industry knowledge
enterprise experience
Command Proposal
management reasoning
continuous optimization

Stage I
Production Platform
        ↓
permissions
security
audit
observability
HA
performance
deployment
disaster recovery
scale
```

这些阶段可以部分并行，但依赖方向不能倒置。

---

# 11. EVO 最终希望达到的企业状态

最终目标不是“有很多 ERP 模块”。

而是：

> **企业本身可以被 EVO 描述、执行、解释、重演、升级和持续生长。**

新企业：

```text
选择行业模板
      ↓
安装业务能力
      ↓
配置企业规则
      ↓
形成 Application / Flow / SOP
      ↓
员工 / AI / 外部系统发生业务
      ↓
EVO 保存 canonical facts
      ↓
形成企业经济与工作状态
      ↓
Eidos 提供交互
      ↓
EC 持续学习和提出改进
      ↓
企业持续演进
```

当企业发生：

- 组织变化；
- 业务变化；
- 管理理念变化；
- 财务政策变化；
- 算法变化；
- LLM/AI 变化；
- 软件版本变化；

历史仍然能够被重新解释并证明。

---

# 12. 三层项目定位

以后判断任何开发任务是否跑偏，可以使用这三个层次：

## 最高层

> **AI-Native Enterprise Operating System**

回答：

“为什么做 EVO？”

## 中间层

> **Economic Runtime**

回答：

“企业真实业务如何形成可信、可解释的经济状态？”

## 当前阶段

> **Production-Safe Incremental Replay**

回答：

“历史发生变化以后，如何高效、正确、可审计地重新解释企业？”

当前所有 CostPool、Generation、Checkpoint、Candidate、Digest 工作，都必须服务第三层，并最终服务前两层。

---

# 13. 当前大里程碑的关闭信号

当我们最终获得：

```text
True Incremental Suffix Execution
+
Complete Candidate Generation
+
Candidate Economic Runtime Digest
+
Independent Full Replay Oracle Digest
+
Exact MATCH
+
Governed Atomic Activation
+
Safe Fallback
```

即可宣布：

> **Economic Runtime 的 Replay 正确性基础阶段完成。**

随后应主动降低 Replay 基础设施开发比重，把主要资源转向：

> **企业完整经济业务循环与产品化。**

这将是 EVO 项目的一个正式大阶段切换点。


---

# 14. 2026-09-22 追加：Stage D 关闭并进入 Stage E

## Stage D — Production-Safe Incremental Replay

状态：

**FOUNDATION CLOSED / CERTIFIED FOR REFERENCE FIFO BOUNDARY**

关闭证据：

- governed Candidate / independent Full-Replay Oracle equivalence；
- consecutive generation activation；
- official CURRENT overlay reads；
- activation failure matrix；
- Worker / Activation cutover serialization；
- crash rollback + retry recovery；
- ER-C05B4.4B certification。

这满足本路线图第 13 节定义的 Replay correctness foundation 关闭信号。

## Stage E — Enterprise Economic Loops

状态：

**ACTIVE**

第一个正式 bounded packet：

`EEL-C01 — Order-to-Cash Settlement Reference Loop`

业务目标：

> 把已经存在的 Sales Order、Shipment、Receivable、Customer Receipt、Allocation、FX Settlement、Cash 和 Replay 资产收成第一条可以数据库认证的企业完整业务闭环。

第一项真实语义收敛：

- Runtime compatibility type：`customer_payment.received`；
- Enterprise Template v1 target type：`cash.received`；
- 不改写旧 BusinessData；
- 以 CUSTOMER_CASH_RECEIPT 作为共同语义角色；
- 收款必须分别表达 settled receivable foreign amount 和 actual cash local amount。

详细 packet：

`docs/architecture/status/EVO-STAGE-E-EEL-C01-ORDER-TO-CASH-PACKET-v0.1.md`

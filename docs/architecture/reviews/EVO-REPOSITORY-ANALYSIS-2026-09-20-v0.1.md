# EVO Repository Analysis & Analysis Standard — 2026-09-20 v0.1

**Status: ACTIVE / ADDITIVE (maintained analysis standard + first analysis record)**  
**Date: 2026-09-20**  
**Authority scope: repository-wide reading comprehension, project intent/plan/progress consolidation, and the recurring analysis method. NOT a product-runtime certification.**  
**Depends on: `AGENTS.md`, `LLM.md`, `context.manifest.json`, `docs/architecture/continuity/EVO-LLM-DOCUMENTATION-OPERATING-STANDARD-v0.1.md`**  
**Repository baseline inspected: `8d3ce60` (`docs: harden cross-model context navigation`), branch `evo/apm-certification-enterprise-template-v0.1`**  
**Document class note: this document intentionally combines a *maintained standard* (Part 0) with an *additive analysis record* (Parts 1–8). This is a deliberate, documented exception for recurring analysis so the method travels with the results. New analyses append a dated section to Part 8 and, when the method changes, add a versioned Part 0 revision. Do not silently rewrite prior analysis entries.**

---

## 使用说明

本文件有两个用途：

1. **Part 0 是分析方法规范**：以后定期重复这份分析时，按同一方法、同一模板执行。
2. **Part 1–8 是本次分析记录**：理解 EVO 的项目意图、总体计划、当前进度、架构与风险。

延续方式：每次新分析 **追加** 一个 `### YYYY-MM-DD vX.Y` 小节到 Part 8，不改写历史；当分析方法本身升级时，新增版本化的小节到 Part 0，并保留旧版本。

---

# 第 0 部分：分析方法规范 (Analysis Methodology Standard)

## 0.1 目的

EVO 是 LLM 原生、长期演进、文档驱动的项目。每隔一段时间（例如：一个大 work packet 关闭、一次大阶段切换、或按固定周期），需要一次**仓库级阅读理解**，回答：

- 这个项目**为什么存在**（意图）？
- 现在**整体要走到哪**（计划/路线）？
- **当前准确位置**在哪（进度/活跃包）？
- 架构、模块、文档体系是否**自洽**？
- 是否存在**漂移（drift）、缺口、风险**？

本规范保证：不同时间、不同模型做的分析，**结构一致、证据等级一致、可对比、可延续**。

## 0.2 与项目其它文档的关系

本分析文档 **不替代** 权威文档，只 **汇总与解释**：

| 层级 | 权威来源 | 本分析的角色 |
|---|---|---|
| 指令 | `AGENTS.md`, `LLM.md` | 遵循 |
| 路由 | `context.manifest.json` | 遵循其 current 指针 |
| 规范意图 | `INVARIANTS.md`, `PHILOSOPHY.md`, `CONCEPTS.md`, ADR, Contracts, Freeze | 读取并汇总 |
| 可执行现实 | code, `migrations/`, tests, CI | 读取并对照 |
| 进度 | 当前 checkpoint / status | 读取并汇总 |
| 证据 | certification packets | 读取其 **边界**，不外推 |
| 历史 | `docs/**/legacy/**`, `chat/**` | 默认不读，除非明确考古问题 |

**黄金规则（来自 `LLM.md` 与文档标准）：**
- 区分 **可执行现实** 与 **规范意图**；二者冲突 → 报告 **drift**，不得静默改写。
- `CERTIFIED` 只证明它命名的场景与边界，**不等于** 生产完成。
- 进度文档报告状态；认证包只证明其范围。

## 0.3 分析前的读取策略

严格遵守 `context.manifest.json` 的 read profile，不要全量读 100+ 文档。推荐顺序：

1. `AGENTS.md` → `LLM.md` → `context.manifest.json`（bootstrap + router）。
2. 选择 profile：
   - 仅需进度/交接 → `continuation`；
   - 需全局架构理解 → `crossModuleArchitecture`。
3. 读 `bootstrap` 指定的：continuity protocol、当前 checkpoint、当前 status、当前 certification、documentation standard。
4. 读 canonical 集合：`PHILOSOPHY.md`, `CONCEPTS.md`, `INVARIANTS.md`, `ARCHITECTURE.md`, `PUBLIC-API.md`, `architecture.manifest.json`。
5. 按需读：`docs/architecture/status/EVO-PROJECT-GOALS-STAGE-ROADMAP-v0.1.md`、各 `modules/<m>/README.md` 与存在的 `CONTEXT.md`、`docs/interfaces/**`、`docs/adr/**`、`docs/change/**`。
6. 可执行现实抽样：`package.json`、`migrations/schema/` 文件名、`apps/**`、`platform/**`、`scripts/validate-llm-docs.ts`。
7. **停止条件**：能回答 0.1 的四个问题即可，不追求“读完所有文档”。

> 本次分析对全仓库 `.md` 做了**清单化**（约 135 个），但**只精读**了上面的权威/路由/进度/规范/索引集合，符合“不读全部”的约束。

## 0.4 证据等级词汇（必须使用，来自文档标准）

```text
DESIGN ONLY
IMPLEMENTED
STATIC VERIFIED
UNIT VERIFIED
DATABASE E2E VERIFIED
CERTIFIED — named scenario/boundary
BLOCKED
REJECTED
SUPERSEDED
HISTORICAL ONLY
```

## 0.5 分析步骤（固定七步）

1. **定位**：确认 branch / HEAD / worktree / 最近提交；确认 schema version 与 current milestone。
2. **路由**：从 router 取得当前 checkpoint / status / certification / active packet。
3. **意图**：读 PHILOSOPHY / CONCEPTS / INVARIANTS，提炼“为什么做 EVO”。
4. **计划**：读 roadmap + status，提炼大阶段与下一阶段验收条件。
5. **进度**：读 checkpoint + certification，记录已认证边界与开放缺口。
6. **结构**：读 ARCHITECTURE + `architecture.manifest.json`，列出模块与依赖方向。
7. **对照与判断**：把现实与意图对照，列出 drift / risk / gap，给出证据等级与下一步。

## 0.6 输出模板（本文件即模板）

固定包含以下部分（可按需增减子项，不改变主干）：

```text
Part 0  分析方法规范（本规范）
Part 1  项目定位与意图
Part 2  总体目标与路线图
Part 3  架构概览（运行主线 / 不变量 / 依赖方向）
Part 4  模块地图（所有权）
Part 5  当前进度与活跃工作包
Part 6  文档体系地图（如何导航）
Part 7  风险、缺口与漂移观察
Part 8  延续记录（每次追加）
```

## 0.7 延续规则

- Part 0 方法变更 → **新增版本化小节**，不覆盖旧方法。
- Part 1–7 复盘默认 **不改写**；若发现上次结论有误，用 Part 8 的“更正”小节显式指出旧结论与原因。
- 每次分析必须记录：**基线 commit**、**当前 checkpoint/status/certification 路径**、**当前 active packet**、**证据等级**、**开放缺口**、**下一步与业务原因**。
- 变更后运行 `npm run validate:docs`（若触及路由/索引/versioned 路径条件）。

## 0.8 禁止事项（反模式）

- 不把历史文档、chat、模型记忆当作当前指令。
- 不把 `CERTIFIED`（命名场景）说成“生产完成”。
- 不把设计文本当作已实现。
- 不因偏好而静默重定义 EVO 的规范概念/不变量/公共契约。
- 不从“数量相等/时间戳相同”推断因果或履行。
- 不为简化实现而引入新的核心概念。
- 报告中不得出现“读了全部文档”式的笼统表述；必须说明读了哪些权威来源。

---

# 第 1 部分：项目定位与意图

## 1.1 一句话意图

> **EVO 是 AI 原生的企业操作系统（Enterprise Operating System）：不是重写一个传统 ERP，而是做一个“描述企业、运行企业、持续优化企业”的可计算企业运行底座。**

来自 `PHILOSOPHY.md`：

> EVO models the enterprise. EVO runs the enterprise. EVO helps the enterprise improve itself.

## 1.2 业务初心（为什么存在）

企业现实问题：真实业务发生后，想要可靠地形成库存、应收、应付、待生产、待发货、成本、利润、现金、会计账、管理指标与工作任务，同时：

- **保留完整历史**；
- 允许按**不同时间、规则、政策、解释方式**重新解释与重算；
- 能**证明**结果为什么是这样。

传统 ERP 把单据、当前状态、库存余额、成本、会计结果、流程状态混在一堆可修改的表里，时间一长就答不出“为什么今天库存是这个数”“三年前这批成本怎么来的”“改了规则怎么办”。

EVO 的选择：

```text
Canonical Business Facts
      +
Explicit Business Intent
      +
Versioned Definitions / Policies
      +
Pinned Reference Data
      ↓
Deterministic Interpretation
      ↓
Position / Allocation / Cost / Valuation / Projection
      ↓
Ledger / Work
      ↓
Balance / Report / UI
```

核心思想：**事实尽量永久保存，解释可以重做，结果可以重建。**

## 1.3 最高层系统边界（三层宪法）

来自 `EVO-PROJECT-GOALS-STAGE-ROADMAP-v0.1.md`：

```text
EC      Think / Learn   → Proposal
Eidos   Interact        → ActionRequest
EVO     Execute         → Enterprise Facts / Economic State / Work State
```

> **EC thinks and learns. EVO executes. Eidos interacts.**

EVO 的职责：成为企业**可信、可验证、可解释、可重放**的执行底座。

---

# 第 2 部分：总体目标与路线图

## 2.1 三层定位

```text
最高层：AI-Native Enterprise Operating System   （为什么做 EVO）
中间层：Economic Runtime                        （业务如何形成可信经济状态）
当前层：Production-Safe Incremental Replay      （历史变化后如何高效可审计地重新解释）
```

## 2.2 大阶段路线（Stage A → I）

| Stage | 内容 | 状态（截至本次基线） |
|---|---|---|
| A | Semantic Archaeology（语义考古） | ✅ core scope complete |
| B | Economic Runtime Architecture（架构冻结） | ✅ core freeze |
| C | Full Replay Correctness | ✅ CERTIFIED |
| D | **Production-Safe Incremental Replay** | ← **CURRENT** |
| E | Enterprise Economic Loops（销售/采购/生产/库存/往来/多币种/成本方法…） | 未开始 |
| F | Enterprise Template Productization（行业模板安装/差异/升级） | 未开始 |
| G | Eidos Product Experience（表单/列表/驾驶舱/报表/SOP） | 未开始 |
| H | EC Intelligence Layer（长期学习/提案/管理推理） | 未开始 |
| I | Production Platform（权限/安全/审计/HA/性能/容灾/规模） | 未开始 |

依赖方向不可倒置。当前阶段（D）是后续全部阶段的正确性底座。

## 2.3 当前大阶段的数学目标

```text
IncrementalReplay(history, change)
        ==
FullReplay(newHistory)
```

- Full Replay = **correctness oracle**（正确性最高裁判）。
- Incremental Replay = **production optimization**。
- **优化永远不能改变正确性。**

## 2.4 当前大阶段关闭条件（来自 roadmap §6）

只有在以下 18 条全部成立后，才能宣称 Production-Safe Incremental Replay 完成（择要）：

1. Checkpoint 来自成功的 Full Replay；
2. Coverage Certification 完整；
3. Checkpoint 经显式 Promotion；
4. 能恢复真正的经济前缀状态（不只是 digest）；
5. 能确定 earliest affected boundary；
6. 只重算必要 suffix，不偷偷 Full Replay；
7. CURRENT 与 CANDIDATE 隔离；
8. 不破坏已审计旧 Run；
9–10. 主要派生 family 同一 generation + 完整 lineage；
11–13. 稳定 Economic Runtime Digest + 独立 Full Replay 再算 + digest 相等；
14–15. mismatch fallback、失败不污染 CURRENT；
16–18. 显式/原子激活、旧 CURRENT 可归档、可审计可复现。

---

# 第 3 部分：架构概览

## 3.1 Canonical Runtime Spine

```text
Human / AI / Automation / External System
        ↓
     Command            （唯一 Actual 写入边界）
        ↓
   BusinessData         （不可变业务历史）
        ↓
   PostingInput
        ↓
 Conditional Posting
        ↓
   LedgerEntry → LedgerBalance
        ↓
 Cost / State / Work
        ↓
    Next Command
```

v1.0.0-alpha.2 扩展：

```text
Command → BusinessData → Posting → Ledger(quantity/amount)
        → Cost → Valuation Posting → Ledger(value/COGS)
        → Work → Replay
```

维度是跨切面治理语义，不是独立事实系统；Normal Posting 与 Valuation Posting 共用 LedgerEntry/Balance，但 provenance 不同（`POSTING` vs `VALUATION`）。

## 3.2 基础不变量（`ARCHITECTURE.md` 摘要）

1. 业务历史被保留；
2. 业务变更 = 新增 BusinessData；
3. Command 创建 BusinessData；Posting 创建 Ledger 结果；
4. Posting 顺序确定；
5. 派生 Ledger/Balance/Cost 可重建；
6. **Replay 不重新执行历史 Command**；
7. 成本估值与过账规则评估分离；
8. AI 与其他参与者走同一 Command 边界；
9. 跨模块写尊重所有权；
10. Chat 记忆不是权威架构存储。

完整清单见 `docs/invariants/` 与 `INVARIANTS.md`（含 INV-001..018 核心、INV-019..023 LLM 原生工程宪法、INV-024..032 十一年遗留保全宪法、DIM-01..04 维度、VAL-01..05 估值）。

## 3.3 依赖方向

```text
identity → metadata → application → command → business-data
         → posting → ledger → cost → valuation → ledger(value effects)

workflow   → command/query
replay     → posting/ledger/cost (+allocation/valuation)
ai         → metadata/query/command
integration→ command/outbox
query      → read interfaces only
```

## 3.4 实现基线

Node.js 24 LTS · TypeScript · Fastify · PostgreSQL 18 · SQL-first + Kysely · Vitest · modular monolith · API + Worker 双进程 · v0.x 无强制消息中间件。

---

# 第 4 部分：模块地图（所有权）

`architecture.manifest.json` 声明 26 个模块及其 `owns` / `mayDependOn`。按职责分组：

**基础/元数据层**
- `identity`：actor/auth 原语
- `metadata`：企业、域、交易类型、应用定义/版本、字段、应用实例、企业 overlay、CommandDefinition、PostingRule、LedgerDefinition、ValuationPolicy
- `application`：有效应用运行时
- `dimensions`：DimensionDefinition / ledger 维度策略

**业务写入与历史**
- `command`：受控业务写入（command_execution + 编排）
- `business-data`：持久业务历史

**派生经济层**
- `posting`：有序 PostingInput 执行、runtime state、posting_run/failure
- `ledger`：ledger_dataset/entry/balance
- `cost`：cost_pool/layer/match/result/run + 政策 pin 血缘
- `valuation`：valuation_rule/posting_run/position/run/result、FX 期末与已实现结算、`valuation.requested` 解释与重放血缘
- `allocation`：policy/instruction/run/relation
- `position`：versioned position 语义
- `economic`：measurement / basis evidence / RateObservation / RateDataset / 经济排序键
- `lineage`：计算依赖边语义与端口

**编排/过程层**
- `replay`：replay_run、checkpoint、dependency edge、checkpoint promotion、materialization、前缀状态捕获/恢复
- `workflow`：process_instance / work_item / plan
- `materialization`：EconomicRuntimeDataset、generation identity、CANDIDATE/CURRENT/ARCHIVE 生命周期、激活语义、隔离 ORACLE generation、runtime equivalence certification、governed activation

**企业模型/智能层**
- `capability`、`flow`（FlowDefinition/Instance/Trace、business_object_link）、`metrics`、`sop`
- `enterprise-template`（模板/版本/绑定/版本 pin）、`enterprise-package`（包契约、部署计划）
- `ai`（网关：query + command only）、`integration`（outbox/adapter）、`query`（组合只读）

---

# 第 5 部分：当前进度与活跃工作包

## 5.1 基线事实（对照可执行现实）

- 版本：`1.0.0-alpha.2`（`package.json` / manifest `currentMilestone`）。
- DB schema version：**22**（`migrations/schema/` 共 26 个迁移，最新 `202609200010_runtime_equivalence_certification.sql`）。
- metadata schema version：3。
- 测试/CI 命令：`validate:docs`, `migrate`, `typecheck`, `build`, `test`, `seed:demo`, `validate:demo`。
- 认证管线要求：Node 24.20.x + PostgreSQL 18。

## 5.2 已认证里程碑（证据等级：CERTIFIED — named scenario）

| 里程碑 | 结论 | 关键证据（来自 status/checkpoint） |
|---|---|---|
| ER-C05B3.2B Canonical FX Realized Settlement Full Replay | CERTIFIED | 删除派生状态后 Full Replay 得到相同 economic digest |
| ER-C05B4.1 Checkpoint Promotion | CERTIFIED | 安全 checkpoint 显式 promotion |
| ER-C05B4.2A1 Runtime Dataset Lifecycle | CERTIFIED | CURRENT/CANDIDATE/ARCHIVED 生命周期 |
| ER-C05B4.2B Cost Prefix/Suffix | CERTIFIED | CostPool 前缀状态 8@10 可恢复 |
| ER-C05B4.2C Incremental Full-Replay Equivalence | CERTIFIED | candidate digest == full replay digest |
| ER-C05B4.3A Isolated Oracle | CERTIFIED | 隔离 generation 内完整重放；不推进 CURRENT |
| ER-C05B4.3B Governed Candidate Activation | CERTIFIED（参考 FIFO 场景） | schema 22；不可变等价认证；原子激活 |
| ER-C05B4.4A Current Generation-Overlay Read | CERTIFIED（参考 FIFO 场景） | schema 22；组合父代前缀+当前后缀 == Full Replay |

B4.4A 关键 digest：

```text
Candidate = Oracle = activated CURRENT overlay
= 3d39e82014a071558293e96dbe5e38e02689b9d8dc23955242aab98761eed291
ledgerEntries 13 / ledgerBalances 5 / costResults 2
allocationRelations 3 / valuationPositions 2 / valuationResults 2 / workItems 3
```

## 5.3 活跃工作包

**`ER-C05B4.4B — Read Routing & Activation Failure Matrix`**（`context.manifest.json` → `bootstrap.activePacket`）

需要产出：

1. 把官方 Dashboard/Ledger/Work 读取路由到 CURRENT generation 语义（封住旧旁路）；
2. 认证 **≥2 代连续激活**；
3. semantic mismatch / stale / revoked 治理的 **真实 PostgreSQL 拒绝测试**；
4. 重复激活重试；
5. 并发激活 + Worker 处理；
6. crash / retry 恢复证据。

## 5.4 当前边界（必须显式声明）

- 认证范围 **仅限参考 FIFO 场景**，**不等于**生产成熟。
- B4.4A 已认证，但 **B4.4 未关闭**；旧默认读取（Dashboard、LedgerReader）仍需统一路由。
- 增量重放的生产安全尚未全面关闭。
- 大量产品化内容（UI、行业模板、权限产品化、报表、驾驶舱、Eidos、EC）**尚未开始**。

---

# 第 6 部分：文档体系地图（如何导航）

## 6.1 入口与路由

```text
AGENTS.md                （自动发现的精简入口，<16KB，CI 校验）
LLM.md                   （更深的 LLM 上下文契约，Context Contract v1.2）
context.manifest.json    （机器可读路由：requiredReading / readProfiles / bootstrap 当前指针）
```

## 6.2 权威规范文档（根目录）

`PHILOSOPHY.md` · `CONCEPTS.md` · `INVARIANTS.md` · `ARCHITECTURE.md` · `PUBLIC-API.md` · `architecture.manifest.json`

## 6.3 文档分类（按操作系统标准 §3）

| 类 | 可变性 | 例子 |
|---|---|---|
| Instruction | 就地维护、精简 | `AGENTS.md`, `LLM.md`, `CLAUDE.md`, `.github/copilot-instructions.md` |
| Router | 就地维护、CI 校验 | `context.manifest.json` |
| Normative | 版本化/被取代 | `docs/adr/`, `INVARIANTS.md`, contracts, freezes |
| Reality | 随实现变化 | code, `migrations/`, tests, DB 约束 |
| Progress | 追加或新 checkpoint | `docs/architecture/status/`, `continuity/checkpoints/` |
| Evidence | 不可变/追加 | `docs/architecture/certification/` |
| Historical | 不可变、默认不读 | `docs/architecture/legacy/`, `docs/legacy/`, `chat/` |

## 6.4 关键目录

- `docs/architecture/`：EVO-00..EVO-13 概念架构系列（genealogy，非必读顺序）
- `docs/architecture/continuity/`：跨 chat/跨模型协议、文档操作标准、checkpoints
- `docs/architecture/status/`：当前进度、目标与阶段路线图
- `docs/architecture/certification/`：认证包（含边界）
- `docs/architecture/decisions/`：冻结与决策记录
- `docs/architecture/database/`：数据库设计快照（版本化）
- `docs/architecture/reviews/`：审计/分析类文档（本文件所在）
- `docs/adr/`, `docs/change/`, `docs/interfaces/`, `docs/invariants/`, `docs/operations/`, `docs/performance/`, `docs/public/`, `docs/enterprise-template/`
- `modules/<m>/README.md`（+ 可选 `CONTEXT.md`）
- `apps/api`, `apps/worker`, `platform/{contracts,database,observability,runtime,testing}`, `scripts/`

## 6.5 CI 文档约束（可执行现实）

`scripts/validate-llm-docs.ts`（`npm run validate:docs`）实际校验：

- `context.manifest.json` 的 `requiredReading` / `bootstrap`（除 activePacket）/ `readProfiles` 路径都存在；
- readProfile 文档数不超过 `maxInitialDocuments`；
- `LLM.md` 的 Context Contract Version 与 manifest 一致（当前 **1.2**）；
- `AGENTS.md` ≤ 16KB 且必须包含 `context.manifest.json`；
- `README.md` 必须包含 `AGENTS.md`；
- 当前 continuity protocol 含 `ACTIVE`；
- 当前 checkpoint 含 `ACTIVE HANDOFF CHECKPOINT`；
- 当前 certification 含 `CERTIFIED`。

> 本次新增文档不改变上述任一路由路径，因此不影响 `validate:docs` 通过性。

---

# 第 7 部分：风险、缺口与漂移观察

> 说明：以下是基于本次基线（`8d3ce60`）的**观察**，不是裁决。凡涉及现实与意图冲突，按双轴模型报告为 drift，不静默改写。

## 7.1 已识别风险 / 缺口

| 类型 | 观察 | 影响 | 建议 |
|---|---|---|---|
| 进度边界 | 多个 `CERTIFIED` 只覆盖**参考 FIFO 单场景/单激活链** | 易被误读为生产成熟 | 报告中始终附“命名场景边界” |
| 读取旁路 | 旧默认读取（Dashboard/LedgerReader）尚未统一路由 | 可能绕过 generation 语义读到 Archived/Candidate/Oracle | B4.4B 第 1 项必须关闭 |
| 并发/故障 | 多代连续激活、并发 Worker、crash recovery 尚未 DB 认证 | 生产安全未闭环 | B4.4B 第 2–6 项 |
| 历史文档异构 | legacy/早期文档 header 不一致 | 弱模型可能误当当前 | 保持 `HISTORICAL ONLY` 分类与路由 |
| 一致性探测 | CI 只校验路由结构与关键标记，不校验段落语义真伪 | 语义矛盾需人工/模型复核 | 定期分析（本文件）承担该职责 |
| 版本指针 | `architecture.manifest.json.release.contextContractVersion` 为 `1.1`，而 `LLM.md`/`context.manifest.json` 为 `1.2` | 可能出现版本指针不一致 | 建议在下次维护时对齐并说明；本次仅报告，不静默改写权威文件 |

## 7.2 需要人类/有权模型裁决的事项（escalate）

- 若同一层级的两份规范来源冲突；
- 若 manifest 指向缺失/过期的当前文档；
- 若某改动削弱不变量或跨越模块所有权而无架构决策；
- 若缺少凭据/权限/破坏性授权；
- 若验证无法复现所声称的证据边界。

## 7.3 本次分析中未做的事（透明声明）

- 未运行 `npm install/migrate/test/seed:demo/validate:demo`（本次为阅读理解，非数据库 E2E；不声称任何 DB 证据）。
- 未逐字精读全部约 135 个 `.md`；对非权威/历史集合仅做清单化确认。
- 未修改任何权威文件（既未改 `context.manifest.json`，也未改 `INVARIANTS.md` 等）；仅新增本分析文档并在 `docs/architecture/README.md` 加一行指针。

---

# 第 8 部分：延续记录 (Continuation Log)

> 每次新分析 **追加** 一个带日期的小节。不得改写历史小节。若需更正旧结论，新增“更正”小节并指明被更正的小节与原因。

## 模板（复制此块填写）

```text
### YYYY-MM-DD vX.Y
Baseline: branch / HEAD(short) / worktree clean?
Active packet (from router):
Current checkpoint / status / certification (paths):
Schema version / milestone:
Evidence level reached by this analysis: DESIGN ONLY | IMPLEMENTED | STATIC VERIFIED | ...
Closed boundaries since previous entry:
Open gaps / blockers:
Drift observed (reality vs intent):
Next exact action + business reason:
Required reading for next analysis:
```

---

### 2026-09-20 v0.1

- **Baseline**: branch `evo/apm-certification-enterprise-template-v0.1`; HEAD `8d3ce60`（`docs: harden cross-model context navigation`）；本次为阅读理解，未改权威文件。
- **Active packet (from router)**: `ER-C05B4.4B — Read Routing & Activation Failure Matrix`。
- **Current pointers**: checkpoint `docs/architecture/continuity/checkpoints/EVO-CONTEXT-CHECKPOINT-2026-09-20-v1.0.md`；status `docs/architecture/status/EVO-CURRENT-PROGRESS-BUSINESS-AND-TECH-v0.1.md`；certification `docs/architecture/certification/ER-C05B4.4A-CURRENT-GENERATION-OVERLAY-READ-CERTIFICATION-v0.1.md`。
- **Schema / milestone**: dbSchemaVersion 22；metadataSchemaVersion 3；milestone v1.0.0-alpha.2。
- **Evidence level of this analysis**: 阅读理解 + 静态对照（**STATIC VERIFIED**）。**未**运行数据库 E2E，**不**声称 DATABASE E2E 或 CERTIFIED。
- **Closed boundaries (context)**: 至 B4.4A 为止的参考 FIFO 链已 CERTIFIED：安全 checkpoint → 局部 Candidate → 隔离 Full Replay Oracle → 不可变等价认证 → 原子激活 → 代际叠加读取。
- **Open gaps / blockers**:
  1. 旧默认读取未统一路由（可能绕过 generation 语义）；
  2. 缺 ≥2 代连续激活认证；
  3. 缺 mismatch / stale / revoked 的真实 PostgreSQL 拒绝测试；
  4. 缺重复激活重试、并发 Worker、crash/retry 恢复证据；
  5. 增量重放的生产安全整体未关闭。
- **Drift observed**: `architecture.manifest.json.release.contextContractVersion` = `1.1`，而 `LLM.md` 与 `context.manifest.json` 为 `1.2`（版本指针不一致，建议对齐并显式说明；本次仅报告）。
- **Next exact action + business reason**: 推进 B4.4B —— 先把所有正式读取入口路由到 CURRENT generation 语义，使审计/成本/分配/估值/查询都看到完整历史，并证明并发/失败下不会产生两个 CURRENT 或重复记账。业务原因：新 CURRENT 不仅余额要对，整条历史读取也必须完整且唯一可信。
- **Required reading for next analysis**: `AGENTS.md` → `LLM.md` → `context.manifest.json`（取当日 current 指针）→ 当日 checkpoint/status/certification → `INVARIANTS.md`/`CONCEPTS.md`/`ARCHITECTURE.md` →（如需）当日 active packet 相关模块 README/CONTEXT。

## 当前一句话状态（2026-09-20 v0.1）

> **EVO 已完成经济运行时核心语义考古与架构冻结，并用 Full Replay 建立了正确性裁判；当前处于 Stage D（Production-Safe Incremental Replay），已认证到“局部重算 Candidate = 隔离 Oracle = 激活后 CURRENT 叠加视图”的参考 FIFO 单链，正在封闭旧读取旁路并证明并发/治理失效下的安全性。**
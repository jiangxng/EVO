# EVO Core Boundary and Code Planning v0.1
# EVO 核心边界与代码规划 v0.1

**Status: AUTHORITATIVE PLANNING BASELINE**  
**Date: 2026-09-23**  
**Purpose: 以 bookkeeping 式最小记账内核为基准，重新规划 EVO 代码边界，防止 Core 膨胀，并指导现有代码逐步迁移到可安装 Pack / Plugin。**

## 1. 核心原则

EVO Core 不等于完整 ERP。

EVO Core 的目标是：

> 一个可配置、可追溯、可重算的多维账本与记账规则执行内核。

最小闭环：

```text
BusinessData (thin posting cache)
        ↓
Posting Rule
        ↓
Ledger Entry
        ↓
Balance
```

其中 BusinessData 只保存稳定记账和重算所需的必要历史事实。

## 2. Core 必须拥有的最小原语

第一阶段将 Core 收敛到以下能力：

- BusinessData：弱语义、可重放的 Posting Cache；
- Posting Rule：条件、表达式、目标 Ledger、方向和计算；
- Ledger Definition：账本定义、维度、度量和方向语义；
- Ledger Entry：不可变发生；
- Balance：Ledger Entry 的累计结果；
- Posting Sequence / Ordering：确定性顺序；
- Replay / Re-posting：基于 BusinessData 重新计算；
- Provenance / Trace：BusinessData → Rule → Entry → Balance；
- Import / Export：Ledger / Posting Rule / minimal BusinessData contracts；
- Version / Digest：保证规则和定义可重现。

若某能力不直接服务于上述闭环，默认不进入 Kernel。

## 3. 明确不属于最小 Core 的能力

以下能力默认外移为可安装 Pack / Plugin：

- Object / Master Data Definition；
- Field Definition；
- Transaction Type；
- Application；
- Form / List / View；
- Form Designer；
- Editable Grid；
- Data Source / Filter UI；
- Workflow；
- Work / Todo 产品体验；
- Finance / GL；
- Voucher；
- Trial Balance；
- Balance Sheet；
- Income Statement；
- Cash Flow Statement；
- DW；
- Reporting；
- Dashboard；
- Application–Ledger topology visualization；
- APQC mapping；
- industry template；
- user behavior analysis；
- EC learning。

其中部分能力可以保留非常薄的公共 Contract，但不进入业务实现。

## 4. Pack / Plugin 分类

### 4.1 Definition Pack

绝大多数企业能力都应使用 Definition Pack 实现。

例如：

- Foundation Objects Pack；
- Sales Pack；
- Procurement Pack；
- Inventory Pack；
- Manufacturing Pack；
- Finance Definition Pack；
- Industry Pack。

Definition Pack 主要包含声明式定义，不应新增 Core 业务代码。

### 4.2 Runtime Plugin

只有确实需要新增执行能力时才使用 Runtime Plugin。

例如：

- 新成本算法；
- 特殊估值算法；
- 特殊优化器；
- 外部协议 Adapter。

Runtime Plugin 必须证明其能力跨多个业务场景通用，且现有 Kernel primitive 无法表达。

### 4.3 Experience Pack

由 Eidos 等 Experience Runtime 使用：

- Form；
- List；
- Grid；
- Visualization；
- Dashboard；
- Designer；
- Navigation。

### 4.4 Analytics / Learning

- DW / Reporting：Analytics Pack；
- EC：独立学习系统；
- EVO 只持续产生治理后的 telemetry。

## 5. 代码目录目标形态

推荐逐步收敛为：

```text
/core
  /business-data
  /posting
  /ledger
  /balance
  /replay
  /provenance
  /contracts
  /versioning

/runtime
  /api
  /worker
  /bootstrap

/packs
  /foundation
  /sales
  /procurement
  /inventory
  /manufacturing
  /finance
  /reporting
  /industry-*

/plugins
  /costing-*
  /valuation-*
  /adapters-*

/integration
  /eidos
  /ec

/docs
  /architecture
  /contracts
  /packs
```

这只是目标边界，不要求一次性物理迁移全部目录。

## 6. Core 禁止业务语义规则

Core 代码不得新增与具体业务名称绑定的逻辑，例如：

- sales；
- purchase；
- customer；
- supplier；
- production；
- fixed asset；
- financial statement；
- inventory-specific workflow。

如果某个测试场景需要这些概念，应放在 fixture / pack / certification sample，而不是 Kernel runtime。

允许 Core 使用中性的：

```text
ledger
rule
entry
balance
dimension
source
fact
version
sequence
```

## 7. Application / Field 的新定位

EVO Kernel 本身不需要理解完整 Application / Field 模型。

推荐：

```text
Application Platform Pack
├─ Object Definition
├─ Field Definition
├─ Transaction Type
├─ Application
├─ Master / Detail
├─ Form / List / View
├─ Data Source / Dependency
└─ Editable Grid
```

该 Pack 将需要记账的历史事实投影为 Core BusinessData。

因此：

> Rich Application Data → minimal BusinessData → Posting Kernel

## 8. Finance 的新定位

Finance 不属于最小 Kernel。

Finance Pack 可以建立在同一个 Ledger / Posting Kernel 上提供：

- Chart of Accounts；
- Debit / Credit semantics；
- Journal；
- Period Close；
- Voucher；
- Trial Balance；
- Financial Statements。

已实现的三大报表应视为 Finance / Reporting Pack 能力，而不是 Core 扩展理由。

## 9. 一人公司作为 Core Boundary Test

以后判断一个能力是否应进入 Core，可使用“一人公司测试”：

假设企业只需要：

- 库存；
- 应收；
- 应付；
- 现金；
- 少量进货 / 销售规则。

如果无需安装某能力仍能运行，则该能力不属于最小 Kernel。

例如：

```text
EVO Kernel
+ Simple Trading Pack
=
lightweight inventory / receivable / payable system
```

不要求 Finance、Form Designer、APQC、Reporting、EC 存在。

## 10. Core Boundary Audit 方法

对当前仓库每个模块 / 表 / API 分类为：

```text
KEEP_IN_KERNEL
MOVE_TO_OFFICIAL_PACK
MOVE_TO_BUSINESS_PACK
MOVE_TO_EIDOS
MOVE_TO_EC
DEPRECATE
UNKNOWN_NEEDS_EVIDENCE
```

每项至少记录：

- 当前路径；
- 当前职责；
- 是否直接服务 Posting / Ledger / Balance / Replay；
- 是否绑定具体业务语义；
- 外移目标；
- 兼容影响；
- 数据迁移影响；
- 测试证据；
- 是否需要保留 Public Contract。

## 11. 迁移原则

不能为了“架构变漂亮”破坏已有认证能力。

迁移采用：

```text
inventory current behavior
→ classify ownership
→ extract stable contract
→ add compatibility layer
→ move implementation
→ run existing certification
→ remove obsolete coupling
```

所有迁移必须保留：

- Replay determinism；
- Ledger balance correctness；
- existing certified flows；
- financial traceability；
- migration path；
- rollback path。

## 12. 下一阶段执行顺序

### Phase A — Repository Audit
完整盘点当前 EVO 模块、数据库表、API 和依赖，标记边界归属。

### Phase B — Kernel Contract Freeze
固定最小 BusinessData / Posting Rule / Ledger / Entry / Balance / Replay contracts。

### Phase C — Extract Packs
优先把明显非 Core 的 Finance Reporting、Application metadata、Reporting / Analytics 等能力抽出。

### Phase D — Simple Company Proof
建立一个最小 Trading Pack，证明只使用 Kernel 即可形成库存 / 应收 / 应付 / 现金闭环。

### Phase E — Regression Certification
重新执行现有 Replay、Ledger、Finance 等认证，证明架构收缩没有破坏功能。

## 13. 长期判断规则

任何新能力进入 Core 前必须回答：

1. 是否直接服务 Ledger / Posting / Balance / Replay？
2. 不加入 Core 是否无法实现？
3. 是否至少被多个异构业务共同证明需要？
4. 是否与具体业务名称无关？
5. 是否能保持 Kernel 在一人公司场景下仍然合理？

如果不能同时通过，默认做 Pack / Plugin。

## 14. 最终架构目标

```text
                 ┌────────────────────┐
                 │        EC          │
                 │ learning/experience│
                 └─────────▲──────────┘
                           │ telemetry / recommendations

┌───────────────┐   ┌──────┴───────────────┐
│     Eidos     │   │  Installable Packs   │
│ Experience UI │◄──┤ App / Finance / DW   │
└───────▲───────┘   └─────────▲─────────────┘
        │                     │
        └──────────┬──────────┘
                   │ BusinessData / contracts
          ┌────────▼────────┐
          │    EVO Kernel   │
          │ BusinessData    │
          │ Posting Rules   │
          │ Ledgers         │
          │ Entries         │
          │ Balances        │
          │ Replay          │
          └─────────────────┘
```

最终原则：

> **EVO Kernel 只负责把必要历史事实按规则可靠地变成账本发生和余额，并支持确定性重算；企业业务、财务产品、体验、分析和学习都围绕它安装和生长。**


## 15. 长期性能与规模化设计原则

EVO Kernel 虽然保持最小，但代码设计必须从一开始保留面向长期规模化运行的扩展边界。

核心原则：

> **现在不提前实现所有高规模能力，但今天的 Kernel Contract 不得阻塞未来的高性能、权限隔离、异步重算和分布式扩展。**

因此“最小实现”不等于“短期实现”。

## 16. 性能规划的分层原则

性能问题按职责拆分，不把所有优化逻辑塞进 Posting / Ledger 核心。

推荐分层：

```text
Write Path
BusinessData → Posting → Ledger Entry

Read Path
Ledger Entry → Balance / Projection / Cache

Heavy Compute Path
Replay / Recalculation / Costing / Historical rebuild

Delivery Path
Job status / Notification / Event stream
```

四条路径应尽量低耦合。

### 16.1 Write Path

优先保证：

- 事务边界明确；
- immutable Ledger Entry；
- 顺序键稳定；
- 幂等；
- 可追溯；
- 单次记账路径短；
- 不把报表、DW、复杂分析同步塞进写事务。

### 16.2 Read Path

查询和展示不应长期依赖对 Ledger Entry 全量实时聚合。

允许逐步引入：

- Balance table / snapshot；
- materialized projection；
- partition-aware queries；
- cache；
- read replica；
- specialized read model。

这些属于可替换的读优化，不改变 Ledger Entry 作为权威发生记录的地位。

## 17. 大数据量 Replay / Recalculation

大规模重记账、成本重算、历史重建必须从一开始被视为 Heavy Compute Job，而不是普通同步 API。

推荐长期模型：

```text
Replay Request
→ validate scope
→ create Job
→ freeze / coordinate posting scope if required
→ partition work
→ execute deterministic batches
→ checkpoint
→ validate digest
→ publish result
→ notify caller
```

最小 Core 现在只需要保留：

- deterministic ordering；
- replay scope contract；
- rule/version pinning；
- checkpoint / resume extension point；
- progress / status contract；
- cancellation / failure semantics。

后续可逐步实现：

- batch；
- parallel partition execution；
- worker pool；
- distributed execution；
- incremental replay；
- resume from checkpoint；
- large-scale validation。

### 17.1 Replay 与实时记账协调

历史重算时必须有明确 runtime state。

根据既有约束，某个 replay scope 在重算期间不允许同时被实时 Posting 以不受控方式修改。

未来可支持：

- global pause；
- enterprise-scoped pause；
- ledger-scoped pause；
- time-range / partition isolation；
- shadow rebuild + atomic switch。

第一阶段可以简单，长期接口不能绑定死为全局停机。

## 18. Asynchronous Job / 异步任务边界

Kernel 不应直接拥有完整通知产品，但需要定义通用 Job Contract。

建议：

```text
Job
├─ job_id
├─ job_type
├─ tenant / enterprise
├─ scope
├─ requested_at
├─ started_at
├─ status
├─ progress
├─ checkpoint
├─ result_ref
├─ error_ref
└─ correlation_id
```

Job Runtime 可以作为 Official Runtime Extension，而不是 Ledger Kernel 本体。

适用场景：

- Replay；
- Re-posting；
- Cost recalculation；
- large import；
- large export；
- projection rebuild；
- template install / upgrade；
- integrity validation。

## 19. Notification 不进入 Ledger Kernel

异步任务完成后的通知应通过事件 /接口解耦：

```text
Kernel / Job Runtime
→ JobStatusChanged Event
→ Notification Pack / Eidos / external system
```

EVO Core 只负责提供可靠状态和事件。

邮件、站内信、移动通知、Webhook、Eidos UI toast 等属于外部 Notification capability。

这样未来可以替换通知实现而不影响重算和 Ledger Core。

## 20. 权限与数据可见性

“不同权限看到不同数据”是长期必需能力，但不能把具体企业权限模型硬编码进 Ledger Core。

必须区分：

### 20.1 Core 必须提供的边界

Kernel 的 Public Query / Export API 必须能够接受受治理的 Access Context，例如：

```text
subject
tenant
enterprise
capabilities
scope / dimensions
policy_version
```

所有数据读取接口不得假设“调用者天然能看到全部账本数据”。

### 20.2 外部 Permission / Policy Layer

具体：

- 哪个人可以看哪个部门；
- 哪个角色可以看哪个客户；
- 哪个员工只能看自己；
- 哪个管理者可看全部金额；
- 字段级脱敏；

应由 Permission / Policy Pack 或独立 Policy Runtime 定义。

推荐：

```text
Caller
→ Policy Evaluation
→ Authorized Query Scope
→ Ledger / Balance Query
```

而不是：

```text
Ledger SQL scattered with role-specific conditions
```

### 20.3 Dimension-aware Security

因为 Ledger 本身是多维的，长期权限设计应能基于维度过滤：

```text
enterprise
organization
department
warehouse
project
customer / party
region
other dimensions
```

但 Kernel 只提供可过滤、可授权的稳定维度契约，不内置某一家企业的组织规则。

## 21. 数据规模与物理存储可演进性

逻辑模型不得和单一物理实现绑定。

长期允许在不改变 Public Contract 的情况下演进：

- table partitioning；
- sharding；
- hot / warm / cold tiers；
- archive；
- object storage for historical payload；
- balance snapshots；
- read replicas；
- specialized analytical store。

核心不变量仍然是：

```text
BusinessData identity
Posting Rule version
Ledger Entry identity
Deterministic ordering
Balance semantics
Provenance
```

物理数据位置可以变化。

## 22. 高性能不依赖删除历史

性能优化不能通过破坏历史事实实现。

禁止将以下方式作为默认性能方案：

- 修改历史 Ledger Entry；
- 聚合后删除无法恢复的明细；
- 用当前对象值覆盖历史 BusinessData；
- 为查询方便制造第二套不可追溯权威余额。

允许：

```text
immutable source
+
rebuildable snapshot / cache / projection
```

## 23. 可观测性必须从 Kernel 边界预留

长期高性能系统必须能够定位：

- 哪条 Posting Rule 慢；
- 哪个 Ledger 热点高；
- 哪种维度组合查询慢；
- Replay 每秒处理多少事实；
- backlog 多大；
- checkpoint 到哪里；
- 哪个 tenant 占用资源；
- Balance rebuild 是否一致。

因此 Public Runtime 应逐步提供稳定 metrics / tracing identifiers。

可观测性实现可以后加，但 correlation id、job id、rule version、sequence、tenant id 等基础标识应从早期就稳定。

## 24. 分步实施原则

这些长期能力不一次性实现。

建议顺序：

### Stage P0 — Contract-safe minimal Kernel
- 同步 Posting；
- 基础 Balance；
- 确定性 Replay；
- 简单 tenant isolation；
- 稳定 provenance。

### Stage P1 — Async heavy jobs
- Job Contract；
- Replay 异步化；
- progress / checkpoint；
- JobStatusChanged event。

### Stage P2 — Read scalability
- balance snapshot；
- projection；
- partition；
- query profiling。

### Stage P3 — Policy-aware query
- Access Context；
- dimension scope；
- field / amount masking extension。

### Stage P4 — Large-scale compute
- partition replay；
- worker pool；
- parallelism；
- resume / retry；
- shadow rebuild。

### Stage P5 — Distributed scale
仅在真实数据量证明需要时考虑：
- distributed execution；
- sharding；
- multi-region；
- hot/cold storage。

原则是：

> **先把边界和契约设计对，再按真实压力逐步替换内部实现。**

## 25. Core 代码的性能设计约束

以后 Kernel 代码评审必须检查：

1. 是否把可异步工作塞入同步 Posting 事务；
2. 是否引入必须全表扫描的核心路径；
3. 是否把报表 / Analytics 写入核心事务；
4. 是否将权限逻辑散落在 Ledger 实现；
5. 是否让 Public Contract 绑定具体数据库结构；
6. 是否保留 batch / partition / checkpoint 扩展空间；
7. 是否可以通过换实现提升性能而不改变业务契约；
8. 是否可以按 tenant / enterprise 做资源隔离；
9. 是否保持 Replay deterministic；
10. 性能优化是否仍然保留完整 provenance。

## 26. 长期架构判断

EVO 的目标不是现在就构建一个超大规模分布式系统。

目标是：

> **今天保持 Kernel 极小；同时让未来的异步化、权限化、分区化、并行重算和存储演进都可以在不破坏业务语义和 Public Contract 的情况下逐步加入。**

低耦合的意义不是少写代码，而是未来可以替换实现、扩容和增加治理能力，而不用重写 Ledger / Posting / Balance 的业务本质。


## 27. Responsibility-First Architecture / 责任优先于技术实现

传统人类开发模式中常见“责任就近”现象：当报表查询慢时，最靠近数据库或 Core 的团队往往直接解决；久而久之，Core、Reporting、DW、Cache、Read Model、Partition 等职责混在一起。

EVO 应采用相反原则：

> **先定义语义责任与服务等级，再决定同步、异步、缓存、分区、分库分表等技术实现放在哪一层。**

技术方案不能反向决定模块所有权。

## 28. Core 与 Reporting 的责任边界

### 28.1 EVO Kernel 负责什么

Kernel 对以下内容负责：

- BusinessData 的稳定输入语义；
- Posting Rule 的确定性执行；
- Ledger Entry 的正确性与可追溯性；
- Balance 的权威语义；
- Public Query / Export Contract；
- 能让下游建立 Projection / Read Model 的稳定变更流或导出接口；
- 明确当前数据版本、sequence、checkpoint、freshness metadata。

Kernel 不对“任意复杂报表都必须直接低延迟查询”负责。

### 28.2 Reporting / Analytics Pack 负责什么

Reporting / Analytics 对以下内容负责：

- 面向特定查询场景建立 Read Model；
- 维度展开；
- 聚合；
- Flatten；
- Materialized View；
- DW；
- Cache；
- OLAP / analytical store；
- 报表延迟与刷新策略；
- 报表自身的查询性能；
- 报表 SLA。

因此如果某个报表很慢，第一责任方应先判断是否需要优化自己的 Projection / Read Model，而不是立即要求 Ledger Core 改物理模型。

## 29. “数据是否同步”不是 Core 的统一答案

EVO 不应规定所有下游都必须实时同步或全部异步。

不同 Consumer 可以声明不同 Data Freshness Contract：

\`\`\`text
STRONG_CURRENT
NEAR_REAL_TIME
BOUNDED_STALENESS
BATCH
HISTORICAL_SNAPSHOT
\`\`\`

例如：

- 交易提交后的余额确认：可能要求接近强一致；
- 操作列表：可以 near-real-time；
- 管理 Dashboard：可以允许分钟级延迟；
- 日经营报表：可以 batch；
- 年度分析：可以使用 historical snapshot。

责任应由 Consumer 的业务需求决定，而不是由 Core 开发者统一猜测。

## 30. Freshness Metadata / 数据新鲜度必须显式

任何异步 Projection / DW / Reporting 数据都必须能够说明：

- source sequence；
- source checkpoint；
- projected_at；
- data_as_of；
- lag；
- projection version；
- rebuild status。

UI / API 不应把延迟数据伪装成实时数据。

例如：

\`\`\`text
Report result
data_as_of = 2026-09-23T09:58:00
source_sequence = 9823411
lag = 2m13s
\`\`\`

这样“延迟”成为显式契约，而不是隐藏副作用。

## 31. Physical Scaling Ownership / 物理扩展责任

需要区分“权威写模型扩展”和“消费侧读模型扩展”。

### 31.1 Kernel Storage Scaling

只有当 Kernel 自己的核心 SLO 受到影响时，Core 才负责：

- Ledger Entry partitioning；
- BusinessData partitioning；
- tenant / enterprise isolation；
- write throughput；
- replay throughput；
- core balance query path；
- archive / hot-cold storage。

### 31.2 Reporting Storage Scaling

如果问题只发生在复杂报表、跨维度聚合或大范围扫描，则 Reporting / Analytics 负责：

- reporting database；
- read replica；
- columnar store；
- OLAP engine；
- materialized aggregate；
- DW partitioning；
- report-specific sharding。

不能因为 Reporting 需要某种分库分表，就要求 Core 同步采用同样的物理模型。

## 32. Logical Contract 与 Physical Topology 分离

Public Contract 不应暴露底层：

- 哪张表；
- 哪个分片；
- 哪个库；
- 是否 read replica；
- 是否 DW；
- 是否 cache。

推荐：

\`\`\`text
Consumer
→ Stable Data Contract
→ Projection / Query Service
→ Physical Storage Strategy
\`\`\`

这样可以在不改变上层业务定义的情况下逐步演进物理存储。

## 33. Source of Truth / Projection / Cache 三层必须区分

长期统一术语：

### Source of Truth

权威数据：

\`\`\`text
BusinessData
Ledger Entry
authoritative Balance semantics
\`\`\`

### Projection / Read Model

为某类查询构建的可重建数据。

### Cache

为了性能临时保存的可丢弃副本。

任何模块都必须能回答：

> 这份数据是权威事实、可重建 Projection，还是 Cache？

## 34. Performance Problem Ownership Matrix

遇到性能问题时按问题来源分配责任：

\`\`\`text
Posting latency
→ Kernel owner

Ledger write throughput
→ Kernel owner

Replay throughput
→ Kernel / Job Runtime owner

Authoritative balance lookup
→ Kernel owner

Complex cross-domain report
→ Reporting Pack owner

Dashboard aggregation
→ Analytics / Projection owner

UI rendering
→ Eidos owner

Learning query / feature extraction
→ EC owner
\`\`\`

如果问题横跨多个模块，则通过 Contract / SLO 协作，不通过“谁离数据库近谁解决”。

## 35. SLA / SLO 应属于接口

模块之间不只定义数据格式，还应逐步定义：

- consistency；
- freshness；
- throughput；
- latency；
- availability；
- replayability；
- retention；
- maximum supported query scope。

例如 Reporting Pack 可以声明：

\`\`\`text
source_contract = ledger.change.v1
freshness_slo = 5 minutes
rebuildable = true
\`\`\`

Kernel 只需满足它承诺的 source contract，不承担 Reporting 内部查询实现。

## 36. AI-Native 开发对责任边界的要求

在 AI-native 工程中，不能依赖“资深开发者知道这段代码历史上是谁负责”。

责任必须机器可读、文档化。

每个 Module / Pack 应明确：

\`\`\`text
owner
source_of_truth
inputs
outputs
consistency_contract
freshness_contract
performance_slo
rebuild_strategy
failure_isolation
forbidden_dependencies
\`\`\`

这样未来不同 LLM 可以在不读取全部仓库历史的情况下，判断一个性能问题应该在哪个边界解决。

## 37. 设计决策原则

以后遇到类似：

> 报表慢，应该 Core 分库分表，还是报表建立独立数据库？

不得先讨论技术。

先回答：

1. 谁拥有权威数据？
2. 谁拥有这个查询需求？
3. 查询要求多新？
4. 是否允许重建？
5. 是否影响交易写入？
6. 是否属于多个 Consumer 的共同需求？
7. 优化后是否改变 Public Contract？

然后才选择：

- index；
- partition；
- cache；
- projection；
- read replica；
- DW；
- sharding；
- asynchronous refresh。

最终原则：

> **Ownership follows semantics, not proximity. Performance technology follows ownership and SLO, not developer convenience.**

中文：

> **责任跟随业务语义，而不是跟随代码距离；性能技术方案跟随责任和服务等级，而不是跟随谁最方便修改数据库。**


## 27. Public API First / 对外 API 作为 Core 性能与可靠性边界

EVO Core 的性能责任不应无限扩大。

长期采用以下原则：

> **EVO Core 只对其正式承诺的 Public API 性能与可靠性负责。**

Core 内部可以持续替换数据库、分区、缓存、队列、重算执行器和存储实现，但外部消费者只依赖稳定 Public Contract。

因此性能责任边界从“所有使用 EVO 数据的场景都必须快”收敛为：

```text
EVO Core
→ owns Public API correctness
→ owns Public API latency / throughput
→ owns Public API availability
→ owns Public API durability / consistency guarantees

Consumers
→ own their own projections / DW / caches / visualization performance
```

## 28. Minimum Viable Performance / 最小可用性能原则

EVO 不应一开始为所有未来极端规模做过度设计。

性能建设采用 Minimum Viable Performance 原则：

1. 先定义最小、稳定、必要的 Public API 集；
2. 对这些 API 给出明确性能目标和可靠性目标；
3. 用基准测试 / 压测持续验证；
4. 当真实负载接近边界时，再升级内部实现；
5. 不为了未知未来场景提前引入高复杂度分布式架构。

“最小可用”只限制实现复杂度，不降低 API 质量要求。

也就是说：

> API 范围可以小，但已经承诺的 API 必须高性能、高可靠、行为确定。

## 29. Public API 的性能分级

建议 Public API 按使用性质分级，而不是所有接口采用同一 SLA。

### Tier A — Critical Online API

例如：

- Posting；
- Balance Query；
- Ledger Entry append；
- critical ledger lookup；
- idempotency / status lookup。

要求：

- 低延迟；
- 高可用；
- 明确超时；
- 幂等；
- 可观测；
- 不依赖报表 / DW / EC。

### Tier B — Online Read / Navigation API

例如：

- Ledger movement query；
- provenance / lineage query；
- bounded history query；
- dimension-scoped query。

要求：

- 稳定分页；
- 明确查询边界；
- 不允许无界全表扫描；
- 支持未来读模型优化。

### Tier C — Bulk / Heavy API

例如：

- Bulk Export；
- Replay；
- Recalculation；
- full snapshot；
- large integrity validation。

默认采用异步 Job Contract，不承诺同步低延迟。

```text
request
→ accepted + job_id
→ async execution
→ progress / result
```

这样可以保护 Critical Online API，不被大任务拖垮。

## 30. API Contract 必须声明一致性与新鲜度

每个 Public API 应明确说明：

- strong / eventual / snapshot consistency；
- freshness expectation；
- ordering semantics；
- idempotency semantics；
- pagination / cursor semantics；
- maximum request scope；
- timeout / retry behavior；
- error contract。

不能让消费者猜测：

> “这个余额到底是不是实时？”  
> “这个导出是否包含刚刚写入的数据？”  
> “重试 Posting 会不会重复记账？”

这些都属于 Public Contract。

## 31. Core 内部优化必须对 API 透明

未来为了性能，Core 可以采用：

- partitioning；
- balance snapshot；
- cache；
- read replica；
- queue；
- worker pool；
- sharding；
- hot / cold storage；
- distributed replay。

但只要 Public Contract 不变，消费者不需要知道内部实现。

推荐关系：

```text
Public API Contract
        ↓
Stable Semantic Boundary
        ↓
Replaceable Internal Implementation
```

因此 Reporting Pack 不得依赖：

- Core table name；
- specific SQL；
- specific partition scheme；
- internal cache key；
- worker implementation。

## 32. API Reliability Budget

EVO 后续应为 Public API 建立可量化的可靠性预算。

至少逐步定义：

- availability；
- latency percentile；
- throughput；
- error rate；
- saturation；
- queue backlog；
- replay throughput；
- recovery time。

第一阶段不必立即承诺最终生产级数字，但代码和测试体系必须允许未来配置和验证这些指标。

禁止只使用“快”“高可靠”等无法验证的描述作为最终契约。

## 33. Performance Isolation / 性能隔离

大任务不得拖垮在线 API。

应逐步支持：

```text
Online Posting / Balance Traffic
        ≠
Replay / Export / Rebuild Traffic
```

可采用：

- separate worker pools；
- separate queues；
- concurrency limits；
- tenant quotas；
- priority classes；
- IO / CPU budgets。

最小版本可以共享基础设施，但接口和任务模型必须从一开始允许后续隔离。

## 34. Public API First 对插件体系的意义

所有 Pack / Plugin / Eidos / EC 默认只能通过 Public API / Public Event Contract 访问 EVO Core。

禁止把“性能问题”作为直接访问 Core 私有表的理由。

如果某个消费者认为 Public API 不够：

1. 先判断是否属于消费者自己的 Projection / Cache 问题；
2. 若确实缺少通用数据能力，再增加新的 Public API / Change Feed；
3. 不允许直接绕过边界形成数据库耦合。

这样未来可以保证：

```text
EVO Core storage changes
→ no forced change in Packs

Reporting storage changes
→ no forced change in EVO Core
```

## 35. API-first 性能测试策略

Core 的性能测试重点应围绕 Public API，而不是只测数据库函数。

建议逐步建立：

- Posting API benchmark；
- Balance Query benchmark；
- concurrent posting benchmark；
- idempotency retry benchmark；
- bounded history query benchmark；
- bulk export throughput benchmark；
- replay job throughput benchmark；
- failure / restart recovery test；
- long-running load test。

每个测试都使用公开契约或与公开契约完全相同的 Runtime Path。

这样才能防止出现：

> 底层 SQL 很快，但真实 API 链路很慢。

## 36. 最终性能责任原则

EVO 长期坚持：

> **Core does not promise every query is fast. Core promises its Public APIs are fast, reliable, bounded, observable and evolvable.**

中文：

> **EVO Core 不承诺任何人想怎么查都快；它只承诺正式 Public API 在明确边界内高性能、高可靠、可观测、可演进。**

这条原则将作为未来数据存储、分库分表、缓存、异步化和消费者架构决策的责任边界。

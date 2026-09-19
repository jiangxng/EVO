# EVO 当前阶段数据库表设计与字段字典（中英双语） v0.2 / EVO Current Database Design & Data Dictionary (Bilingual) v0.2

**状态 / Status：CURRENT-STAGE SNAPSHOT / BILINGUAL LEARNING & ENGINEERING REFERENCE**  
**日期 / Date：2026-09-19**  
**分支 / Branch：`evo/apm-certification-enterprise-template-v0.1`**  
**数据库 / Database：PostgreSQL**  
**当前 DB Schema Version / Current DB Schema Version：13**  
**权威字段来源 / Authoritative Sources：`platform/database/src/types.ts` + `migrations/schema/*.sql` + `scripts/migrate.ts`**

---

## 0. 文档定位

这份文档记录的是 **EVO 当前阶段的物理数据库设计快照**，不是最终永久冻结的数据库结构。

EVO 的初心是“大模型原生”。这里的“大模型原生”不意味着必须使用某种新型数据库，而是：

- 业务语义、契约、版本、血缘和重放边界要对 LLM 清晰可读；
- 事实、解释、派生、投影和物化必须显式区分；
- 模块可以替换实现，但公共语义契约保持稳定；
- 数据库结构可以继续演进，演进必须由 migration 和版本化文档记录；
- 任何未来 LLM 都应该能通过仓库中的文档、类型、migration 和测试恢复当前系统理解。

当前物理主库仍采用 PostgreSQL。逻辑上，EVO 已经同时包含不可变事实、版本化定义、Allocation Graph、Valuation Graph、Projection、Calculation Dependency Graph 和可重建 Materialization。

因此可以把当前设计理解为：

```text
语义层：
Canonical Facts
+ Versioned Definitions / Policies
+ Allocation / Valuation / Dependency Graphs
+ Replay Contracts

        ↓ 映射

物理层：
PostgreSQL relational tables
+ JSONB semantic payload
+ derived/materialized tables
+ indexes / digests / checkpoints
```

---

## 1. 当前数据库规模

当前代码侧数据库定义共有：

- **60 张表**
- **635 个字段**
- 其中 **1 张迁移基础设施表（schema_migrations）**
- 其余 **59 张为 EVO 系统、业务、运行时、派生或认证相关表**
- 当前仓库包含 **15 个 schema migration 文件**
- 当前声明的 `dbSchemaVersion = 13`

> 说明：字段数以当前 `Database` / Kysely 类型定义为准；migration 是物理 DDL 的演进历史。后续新增 migration 后，本数字应随文档版本更新。

---

## 2. 先理解六种表语义角色

为了学习当前数据库，不建议只按“主表/子表”理解。EVO 更重要的是知道一张表处于哪一种语义层：

| 角色 | 含义 | 典型例子 |
|---|---|---|
| CORE CANONICAL | 企业已经接受发生的事实，不能靠改历史修正 | `business_data` |
| CANONICAL INSTRUCTION / BINDING | 人/业务明确给出的意图、绑定或治理决定 | `allocation_instruction`, `enterprise_template_binding` |
| VERSIONED DEFINITION / POLICY | 可以版本化发布的定义和政策 | `posting_rule`, `allocation_policy`, `position_definition` |
| EXECUTION / AUDIT | 一次确定性运行过程及其审计状态 | `posting_run`, `cost_run`, `valuation_run`, `replay_run` |
| DERIVED RESULT / PROJECTION | 可以从事实+固定规则重建的派生结果 | `allocation_relation`, `cost_result`, `valuation_result`, `ledger_entry` |
| MATERIALIZATION / INDEX | 为查询、性能、增量重算服务的可重建状态 | `ledger_balance`, `valuation_position`, `replay_checkpoint`, `calculation_dependency_edge` |

最重要的学习点：

> **数据库里有一条记录，不等于它就是“业务真相”。**

EVO 故意把 Business Fact、Explicit Instruction、Derived Result、Materialization 分开存储。

---

## 3. 当前表数量分布

| 分类 | 表数 | 字段数 |
|---|---:|---:|
| 基础设施 | 2 | 7 |
| 企业与模板 | 6 | 46 |
| 元数据 | 8 | 62 |
| 主数据 | 1 | 11 |
| 权限 | 1 | 7 |
| 命令与事实 | 3 | 38 |
| 运行时 | 3 | 34 |
| 流程与工作 | 8 | 72 |
| 分析与管理 | 1 | 12 |
| 记账与账本 | 8 | 93 |
| 分配与头寸 | 5 | 64 |
| 参考数据 | 2 | 24 |
| 成本与估值 | 8 | 95 |
| 重放与血缘 | 4 | 70 |
| **合计** | **60** | **635** |

---

## 4. 核心关系速览

```text
Enterprise
  ├─ EnterpriseTemplate / Binding
  ├─ ApplicationInstance
  │    └─ CommandExecution
  │          └─ BusinessData  ← 最核心 canonical business fact
  │
  ├─ PostingInput
  │    └─ PostingRun
  │          └─ LedgerEntry
  │                └─ LedgerBalance
  │
  ├─ AllocationInstruction  ← 显式业务意图
  │    └─ AllocationRun
  │          └─ AllocationRelation  ← 派生来源消费边
  │
  ├─ CostRun
  │    └─ CostResult
  │          └─ ValuationPostingRun / LedgerEntry
  │
  ├─ valuation.requested (BusinessData)
  │    └─ ValuationRun
  │          └─ ValuationResult
  │
  └─ ReplayRun
       ├─ ReplayCheckpoint
       ├─ CalculationDependencyEdge
       └─ ReplayCoverageCertification
```

---

## 5. 完整表与字段字典 / Complete Table & Field Dictionary

> v0.2 is an **additive bilingual snapshot**. It does not replace or rewrite the Chinese-only v0.1.  
> v0.2 是新增的中英双语快照，不覆盖、不改写中文 v0.1。


# 基础设施 / Infrastructure

## 1. `schema_migrations`

**语义角色 / Semantic Role：INFRA**  
**当前字段数 / Current Field Count：3**

**中文说明：** 数据库迁移历史表。记录每个 migration 文件的版本、校验摘要和实际应用时间，保证已经执行过的迁移不能被静默改写。

**English Description:** Database migration history. Records each migration file version, checksum, and application time so already-applied migration history cannot be silently rewritten.

| # | 字段 / Field | 当前类型 / Current Type | 中文说明 | English Description |
|---:|---|---|---|---|
| 1 | `version` | TEXT | 定义/数据集的版本号。版本发布后通常不应原地修改语义。 | Version number of a definition or dataset. Published semantic versions should not be modified in place. |
| 2 | `checksum` | TEXT | 迁移文件内容的校验摘要，用于检测已应用 migration 是否被改写。 | Checksum of a migration file used to detect mutation of already-applied migration history. |
| 3 | `applied_at` | TIMESTAMPTZ | 该数据库迁移实际执行完成的时间。 | Time when this database migration was applied. |

## 2. `evo_runtime_info`

**语义角色 / Semantic Role：INFRA**  
**当前字段数 / Current Field Count：4**

**中文说明：** EVO 数据库运行时基线信息。用于声明当前架构基线和数据库 schema 版本，是部署与迁移程序判断数据库状态的入口。

**English Description:** EVO database runtime baseline. Declares the active architecture baseline and database schema version used by deployment and migration logic.

| # | 字段 / Field | 当前类型 / Current Type | 中文说明 | English Description |
|---:|---|---|---|---|
| 1 | `singleton` | BOOLEAN | 单例行约束标记。保证运行时基线表只存在一条有效记录。 | Singleton-row guard ensuring that this runtime-baseline table has only one valid row. |
| 2 | `architecture_baseline` | TEXT | 当前数据库所遵循的 EVO 架构基线标识。 | Identifier of the EVO architecture baseline expected by this database. |
| 3 | `db_schema_version` | INTEGER/数值 | 当前数据库 Schema 版本号，用于部署、迁移和兼容性检查。 | Current database schema version used by deployment, migration, and compatibility checks. |
| 4 | `updated_at` | TIMESTAMPTZ | 记录最近一次更新/物化刷新时间。 | Time when the record or materialized state was last updated. |


# 企业与模板 / Enterprise & Templates

## 3. `enterprise`

**语义角色 / Semantic Role：CANONICAL DEFINITION**  
**当前字段数 / Current Field Count：7**

**中文说明：** 企业/租户主表。EVO 的多企业隔离根节点，绝大多数业务事实、运行记录和策略最终都归属于某个 enterprise。

**English Description:** Enterprise/tenant root table. It is the root of multi-enterprise isolation; most business facts, runtime records, policies, and projections ultimately belong to an enterprise.

| # | 字段 / Field | 当前类型 / Current Type | 中文说明 | English Description |
|---:|---|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 | Primary key. Usually a UUID that stably identifies this record. |
| 2 | `code` | TEXT | 稳定、机器可读的业务代码。通常用于配置、API、模板和规则引用，不应随显示名称随意改变。 | Stable machine-readable business code used by configuration, APIs, templates, and rules. |
| 3 | `name` | TEXT | 面向人的显示名称。 | Human-readable display name. |
| 4 | `status` | TEXT 枚举 | 当前生命周期/执行状态。允许值由本表对应的枚举约束决定。 | Current lifecycle or execution status; allowed values are constrained by the table contract. |
| 5 | `default_timezone` | TEXT | 本表的 `default_timezone` 属性；用于表达 default timezone，具体约束由当前 Schema/模块契约定义。 | Current default timezone attribute of this table; its exact constraints are defined by the current schema and module contract. |
| 6 | `created_at` | TIMESTAMPTZ | 记录创建时间。 | Time when the record was created. |
| 7 | `updated_at` | TIMESTAMPTZ | 记录最近一次更新/物化刷新时间。 | Time when the record or materialized state was last updated. |

## 4. `enterprise_template`

**语义角色 / Semantic Role：DEFINITION**  
**当前字段数 / Current Field Count：5**

**中文说明：** 企业模板的稳定身份。模板描述一组可以安装/绑定到企业的定义集合，本表只保存模板本身，不保存具体版本内容。

**English Description:** Stable identity of an Enterprise Template. The table identifies a reusable package of enterprise definitions without storing a specific version body.

| # | 字段 / Field | 当前类型 / Current Type | 中文说明 | English Description |
|---:|---|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 | Primary key. Usually a UUID that stably identifies this record. |
| 2 | `code` | TEXT | 稳定、机器可读的业务代码。通常用于配置、API、模板和规则引用，不应随显示名称随意改变。 | Stable machine-readable business code used by configuration, APIs, templates, and rules. |
| 3 | `name` | TEXT | 面向人的显示名称。 | Human-readable display name. |
| 4 | `description` | TEXT，可空 | 对该对象用途和业务含义的补充说明。 | Additional human-readable explanation of the object's purpose or business meaning. |
| 5 | `created_at` | TIMESTAMPTZ | 记录创建时间。 | Time when the record was created. |

## 5. `enterprise_template_version`

**语义角色 / Semantic Role：VERSIONED DEFINITION**  
**当前字段数 / Current Field Count：8**

**中文说明：** 企业模板的不可变版本。definition 保存某个版本的完整模板定义，semantic_digest 用于证明同一版本内容没有漂移。

**English Description:** Immutable version of an Enterprise Template. The definition column stores the versioned template content and semantic_digest protects it from semantic drift.

| # | 字段 / Field | 当前类型 / Current Type | 中文说明 | English Description |
|---:|---|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 | Primary key. Usually a UUID that stably identifies this record. |
| 2 | `enterprise_template_id` | UUID/标识 | 关联的企业模板 ID，用于建立本表与对应对象之间的稳定关系。 | Stable identifier of the related enterprise template object. |
| 3 | `version` | INTEGER/数值 | 定义/数据集的版本号。版本发布后通常不应原地修改语义。 | Version number of a definition or dataset. Published semantic versions should not be modified in place. |
| 4 | `status` | TEXT 枚举 | 当前生命周期/执行状态。允许值由本表对应的枚举约束决定。 | Current lifecycle or execution status; allowed values are constrained by the table contract. |
| 5 | `definition` | JSONB 对象 | 版本化定义主体，使用 JSONB 保存可扩展的结构化语义。 | Versioned structured definition body stored as JSONB. |
| 6 | `semantic_digest` | TEXT | 对该版本的语义内容计算的稳定摘要，用于检测同一版本发生内容漂移。 | Deterministic digest of semantic content used to detect semantic drift within a supposedly identical version. |
| 7 | `created_at` | TIMESTAMPTZ | 记录创建时间。 | Time when the record was created. |
| 8 | `published_at` | TIMESTAMPTZ，可空 | 该版本被正式发布、生效的时间。 | Time when this version was formally published/activated. |

## 6. `enterprise_template_binding`

**语义角色 / Semantic Role：CANONICAL BINDING**  
**当前字段数 / Current Field Count：6**

**中文说明：** 企业与企业模板版本之间的当前绑定关系。用于明确某个企业正在执行哪一个模板版本。

**English Description:** Current binding between an enterprise and a specific Enterprise Template version. It makes the enterprise's active template version explicit and auditable.

| # | 字段 / Field | 当前类型 / Current Type | 中文说明 | English Description |
|---:|---|---|---|---|
| 1 | `enterprise_id` | UUID/标识 | 所属企业/租户 ID。用于多企业隔离；为空时通常表示全局共享定义。 | Owning enterprise/tenant ID. It is the main boundary for multi-enterprise isolation; null commonly means a globally shared definition. |
| 2 | `enterprise_template_id` | UUID/标识 | 关联的企业模板 ID，用于建立本表与对应对象之间的稳定关系。 | Stable identifier of the related enterprise template object. |
| 3 | `enterprise_template_version_id` | UUID/标识 | 关联的企业模板版本 ID，用于建立本表与对应对象之间的稳定关系。 | Stable identifier of the related enterprise template version object. |
| 4 | `bound_at` | TIMESTAMPTZ | bound at 对应的时间戳；具体业务语义由本表上下文决定。 | Timestamp associated with bound at in this table's lifecycle or business context. |
| 5 | `bound_by` | TEXT | 本表的 `bound_by` 属性；用于表达 bound by，具体约束由当前 Schema/模块契约定义。 | Current bound by attribute of this table; its exact constraints are defined by the current schema and module contract. |
| 6 | `binding_reason` | TEXT，可空 | 本表的 `binding_reason` 属性；用于表达 binding reason，具体约束由当前 Schema/模块契约定义。 | Current binding reason attribute of this table; its exact constraints are defined by the current schema and module contract. |

## 7. `application_instance`

**语义角色 / Semantic Role：CANONICAL BINDING**  
**当前字段数 / Current Field Count：10**

**中文说明：** 某企业安装后的应用实例。把通用 ApplicationDefinition 落到具体 enterprise，并可固定定义版本及实例配置。

**English Description:** Installed application instance for a specific enterprise. It binds a generic ApplicationDefinition to an enterprise and may pin a definition version and instance configuration.

| # | 字段 / Field | 当前类型 / Current Type | 中文说明 | English Description |
|---:|---|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 | Primary key. Usually a UUID that stably identifies this record. |
| 2 | `enterprise_id` | UUID/标识 | 所属企业/租户 ID。用于多企业隔离；为空时通常表示全局共享定义。 | Owning enterprise/tenant ID. It is the main boundary for multi-enterprise isolation; null commonly means a globally shared definition. |
| 3 | `application_definition_id` | UUID/标识 | 该企业应用实例对应的通用 ApplicationDefinition ID。 | Generic ApplicationDefinition installed as this enterprise application instance. |
| 4 | `code` | TEXT | 稳定、机器可读的业务代码。通常用于配置、API、模板和规则引用，不应随显示名称随意改变。 | Stable machine-readable business code used by configuration, APIs, templates, and rules. |
| 5 | `name` | TEXT | 面向人的显示名称。 | Human-readable display name. |
| 6 | `pinned_definition_version` | INTEGER/数值，可空 | 实例当前固定使用的 ApplicationDefinitionVersion；为空时由安装/升级策略决定。 | Explicit ApplicationDefinitionVersion pinned by this instance; null means installation/upgrade policy resolves it. |
| 7 | `status` | TEXT 枚举 | 当前生命周期/执行状态。允许值由本表对应的枚举约束决定。 | Current lifecycle or execution status; allowed values are constrained by the table contract. |
| 8 | `config` | JSONB 对象 | 可扩展配置 JSON。保存尚不值得固化为独立列、但仍需要版本化治理的参数。 | Extensible JSON configuration for parameters that remain governed but do not yet require dedicated relational columns. |
| 9 | `created_at` | TIMESTAMPTZ | 记录创建时间。 | Time when the record was created. |
| 10 | `updated_at` | TIMESTAMPTZ | 记录最近一次更新/物化刷新时间。 | Time when the record or materialized state was last updated. |

## 8. `enterprise_application_overlay`

**语义角色 / Semantic Role：VERSIONED DEFINITION**  
**当前字段数 / Current Field Count：10**

**中文说明：** 企业对标准应用定义的受控覆盖层。用于客户个性化而不直接修改基础模板。

**English Description:** Controlled enterprise-specific overlay on top of a standard application definition. It supports customer customization without mutating the base template.

| # | 字段 / Field | 当前类型 / Current Type | 中文说明 | English Description |
|---:|---|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 | Primary key. Usually a UUID that stably identifies this record. |
| 2 | `enterprise_id` | UUID/标识 | 所属企业/租户 ID。用于多企业隔离；为空时通常表示全局共享定义。 | Owning enterprise/tenant ID. It is the main boundary for multi-enterprise isolation; null commonly means a globally shared definition. |
| 3 | `application_instance_id` | UUID/标识 | 被该企业覆盖层影响的 ApplicationInstance ID。 | ApplicationInstance affected by this enterprise-specific overlay. |
| 4 | `base_definition_version` | INTEGER/数值 | 覆盖层基于哪个基础应用版本创建。 | Base application-definition version on which this overlay was created. |
| 5 | `overlay_version` | INTEGER/数值 | 企业覆盖层自己的版本号。 | Version number of the enterprise-specific overlay itself. |
| 6 | `status` | TEXT 枚举 | 当前生命周期/执行状态。允许值由本表对应的枚举约束决定。 | Current lifecycle or execution status; allowed values are constrained by the table contract. |
| 7 | `patch` | JSONB 对象 | 企业针对基础应用定义的差异覆盖内容。 | Current patch attribute of this table; its exact constraints are defined by the current schema and module contract. |
| 8 | `overlay_hash` | TEXT，可空 | 企业覆盖层内容的摘要/哈希。 | Stable hash for overlay hash used for identity, comparison, or consistency checks. |
| 9 | `published_at` | TIMESTAMPTZ，可空 | 该版本被正式发布、生效的时间。 | Time when this version was formally published/activated. |
| 10 | `created_at` | TIMESTAMPTZ | 记录创建时间。 | Time when the record was created. |


# 元数据 / Metadata

## 9. `domain_definition`

**语义角色 / Semantic Role：DEFINITION**  
**当前字段数 / Current Field Count：5**

**中文说明：** 业务领域定义，例如销售、采购、生产、库存、估值等。它是 TransactionType 的上级分类。

**English Description:** Business domain definition such as Sales, Procurement, Production, Inventory, or Valuation. It is the parent classification of TransactionType.

| # | 字段 / Field | 当前类型 / Current Type | 中文说明 | English Description |
|---:|---|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 | Primary key. Usually a UUID that stably identifies this record. |
| 2 | `code` | TEXT | 稳定、机器可读的业务代码。通常用于配置、API、模板和规则引用，不应随显示名称随意改变。 | Stable machine-readable business code used by configuration, APIs, templates, and rules. |
| 3 | `name` | TEXT | 面向人的显示名称。 | Human-readable display name. |
| 4 | `description` | TEXT，可空 | 对该对象用途和业务含义的补充说明。 | Additional human-readable explanation of the object's purpose or business meaning. |
| 5 | `created_at` | TIMESTAMPTZ | 记录创建时间。 | Time when the record was created. |

## 10. `transaction_type`

**语义角色 / Semantic Role：DEFINITION**  
**当前字段数 / Current Field Count：6**

**中文说明：** 交易类型的高层业务抽象，例如销售订单、采购入库。它描述业务类别，不等同于具体应用。

**English Description:** High-level business transaction abstraction, such as Sales Order or Purchase Receipt. A TransactionType is a business category, not a concrete application.

| # | 字段 / Field | 当前类型 / Current Type | 中文说明 | English Description |
|---:|---|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 | Primary key. Usually a UUID that stably identifies this record. |
| 2 | `domain_id` | UUID/标识 | 关联的业务领域 ID，用于建立本表与对应对象之间的稳定关系。 | Stable identifier of the related domain object. |
| 3 | `code` | TEXT | 稳定、机器可读的业务代码。通常用于配置、API、模板和规则引用，不应随显示名称随意改变。 | Stable machine-readable business code used by configuration, APIs, templates, and rules. |
| 4 | `name` | TEXT | 面向人的显示名称。 | Human-readable display name. |
| 5 | `description` | TEXT，可空 | 对该对象用途和业务含义的补充说明。 | Additional human-readable explanation of the object's purpose or business meaning. |
| 6 | `created_at` | TIMESTAMPTZ | 记录创建时间。 | Time when the record was created. |

## 11. `application_definition`

**语义角色 / Semantic Role：DEFINITION**  
**当前字段数 / Current Field Count：6**

**中文说明：** 应用定义的稳定身份。一个 TransactionType 下可以存在多个具体 Application。

**English Description:** Stable identity of an application definition. Multiple concrete applications or versions can exist under a business transaction type.

| # | 字段 / Field | 当前类型 / Current Type | 中文说明 | English Description |
|---:|---|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 | Primary key. Usually a UUID that stably identifies this record. |
| 2 | `transaction_type_id` | UUID/标识 | 所属 TransactionType ID，表示该应用实现哪一种高层交易类型。 | TransactionType ID implemented by this application definition. |
| 3 | `code` | TEXT | 稳定、机器可读的业务代码。通常用于配置、API、模板和规则引用，不应随显示名称随意改变。 | Stable machine-readable business code used by configuration, APIs, templates, and rules. |
| 4 | `name` | TEXT | 面向人的显示名称。 | Human-readable display name. |
| 5 | `description` | TEXT，可空 | 对该对象用途和业务含义的补充说明。 | Additional human-readable explanation of the object's purpose or business meaning. |
| 6 | `created_at` | TIMESTAMPTZ | 记录创建时间。 | Time when the record was created. |

## 12. `application_definition_version`

**语义角色 / Semantic Role：VERSIONED DEFINITION**  
**当前字段数 / Current Field Count：9**

**中文说明：** 应用定义的版本。字段、命令、记账规则等都绑定到明确的应用版本，以支持升级、回放和兼容。

**English Description:** Versioned application definition. Fields, commands, posting rules, and related metadata bind to an explicit application version for replay and upgrade safety.

| # | 字段 / Field | 当前类型 / Current Type | 中文说明 | English Description |
|---:|---|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 | Primary key. Usually a UUID that stably identifies this record. |
| 2 | `application_definition_id` | UUID/标识 | 所属 ApplicationDefinition ID。 | ApplicationDefinition ID that owns this version. |
| 3 | `version` | INTEGER/数值 | 定义/数据集的版本号。版本发布后通常不应原地修改语义。 | Version number of a definition or dataset. Published semantic versions should not be modified in place. |
| 4 | `status` | TEXT 枚举 | 当前生命周期/执行状态。允许值由本表对应的枚举约束决定。 | Current lifecycle or execution status; allowed values are constrained by the table contract. |
| 5 | `schema_version` | INTEGER/数值 | 固定使用的schema版本号，避免运行时隐式读取“最新版本”。 | Pinned version number of the related schema; it prevents implicit use of a mutable “latest” version. |
| 6 | `base_config` | JSONB 对象 | 应用定义版本的基础配置。 | Current base config attribute of this table; its exact constraints are defined by the current schema and module contract. |
| 7 | `definition_hash` | TEXT，可空 | 应用定义内容的摘要/哈希，用于版本一致性检查。 | Stable hash for definition hash used for identity, comparison, or consistency checks. |
| 8 | `published_at` | TIMESTAMPTZ，可空 | 该版本被正式发布、生效的时间。 | Time when this version was formally published/activated. |
| 9 | `created_at` | TIMESTAMPTZ | 记录创建时间。 | Time when the record was created. |

## 13. `field_group_definition`

**语义角色 / Semantic Role：DEFINITION**  
**当前字段数 / Current Field Count：6**

**中文说明：** 应用版本中的字段组/部件定义，用于把相关业务字段组织为有业务语义的区域。

**English Description:** Semantic field-group/component definition inside an application version. It groups related business fields into meaningful UI and domain sections.

| # | 字段 / Field | 当前类型 / Current Type | 中文说明 | English Description |
|---:|---|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 | Primary key. Usually a UUID that stably identifies this record. |
| 2 | `application_definition_version_id` | UUID/标识 | 所属应用定义版本 ID；字段组随应用版本共同演进。 | ApplicationDefinitionVersion ID that owns this field group. |
| 3 | `code` | TEXT | 稳定、机器可读的业务代码。通常用于配置、API、模板和规则引用，不应随显示名称随意改变。 | Stable machine-readable business code used by configuration, APIs, templates, and rules. |
| 4 | `label` | TEXT | 字段组面向用户展示的名称。 | User-facing name of the field group. |
| 5 | `sort_order` | INTEGER/数值 | 字段组在应用中的排序值。 | Ordering value of the field group inside the application. |
| 6 | `config` | JSONB 对象 | 可扩展配置 JSON。保存尚不值得固化为独立列、但仍需要版本化治理的参数。 | Extensible JSON configuration for parameters that remain governed but do not yet require dedicated relational columns. |

## 14. `field_definition`

**语义角色 / Semantic Role：DEFINITION**  
**当前字段数 / Current Field Count：10**

**中文说明：** 应用版本中的业务字段定义。记录字段代码、标签、数据类型、必填性、引用方式及 UI/数据源等配置。

**English Description:** Business field definition inside an application version. It defines field code, label, data type, required/reference semantics, ordering, and extensible configuration.

| # | 字段 / Field | 当前类型 / Current Type | 中文说明 | English Description |
|---:|---|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 | Primary key. Usually a UUID that stably identifies this record. |
| 2 | `application_definition_version_id` | UUID/标识 | 所属应用定义版本 ID。 | ApplicationDefinitionVersion ID that owns this field. |
| 3 | `field_group_id` | UUID/标识，可空 | 所属字段组 ID；为空表示字段不归入特定组。 | Owning FieldGroupDefinition ID; null means the field is not assigned to a specific group. |
| 4 | `code` | TEXT | 稳定、机器可读的业务代码。通常用于配置、API、模板和规则引用，不应随显示名称随意改变。 | Stable machine-readable business code used by configuration, APIs, templates, and rules. |
| 5 | `label` | TEXT | 面向用户展示的字段名称。 | User-facing label of the business field. |
| 6 | `data_type` | TEXT | 业务字段的数据类型定义，例如文本、数字、日期、引用等。 | Business data type of the field, such as text, number, date, or reference. |
| 7 | `required` | BOOLEAN | 该业务字段是否为必填。 | Whether the business field is required. |
| 8 | `reference_mode` | TEXT 枚举，可空 | 引用型字段的语义：REFERENCE 保留对象引用；SNAPSHOT 固化当时值。 | Reference semantics: REFERENCE keeps object identity; SNAPSHOT freezes the referenced value at that time. |
| 9 | `sort_order` | INTEGER/数值 | 字段在表单/界面/元数据中的排序值。 | Ordering value of the field inside metadata/UI rendering. |
| 10 | `config` | JSONB 对象 | 可扩展配置 JSON。保存尚不值得固化为独立列、但仍需要版本化治理的参数。 | Extensible JSON configuration for parameters that remain governed but do not yet require dedicated relational columns. |

## 15. `dimension_definition`

**语义角色 / Semantic Role：VERSIONED DEFINITION**  
**当前字段数 / Current Field Count：10**

**中文说明：** 统一维度定义，例如仓库、项目、部门、利润中心。供 Ledger、Cost、Valuation 等模块共享。

**English Description:** Shared dimension definition such as warehouse, project, department, or profit center. Dimensions are reused by ledger, cost, valuation, and reporting.

| # | 字段 / Field | 当前类型 / Current Type | 中文说明 | English Description |
|---:|---|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 | Primary key. Usually a UUID that stably identifies this record. |
| 2 | `enterprise_id` | UUID/标识，可空 | 所属企业/租户 ID。用于多企业隔离；为空时通常表示全局共享定义。 | Owning enterprise/tenant ID. It is the main boundary for multi-enterprise isolation; null commonly means a globally shared definition. |
| 3 | `code` | TEXT | 稳定、机器可读的业务代码。通常用于配置、API、模板和规则引用，不应随显示名称随意改变。 | Stable machine-readable business code used by configuration, APIs, templates, and rules. |
| 4 | `name` | TEXT | 面向人的显示名称。 | Human-readable display name. |
| 5 | `data_type` | TEXT | data type 的类型/类别标识。 | Type/category discriminator for data type. |
| 6 | `version` | INTEGER/数值 | 定义/数据集的版本号。版本发布后通常不应原地修改语义。 | Version number of a definition or dataset. Published semantic versions should not be modified in place. |
| 7 | `status` | TEXT 枚举 | 当前生命周期/执行状态。允许值由本表对应的枚举约束决定。 | Current lifecycle or execution status; allowed values are constrained by the table contract. |
| 8 | `config` | JSONB 对象 | 可扩展配置 JSON。保存尚不值得固化为独立列、但仍需要版本化治理的参数。 | Extensible JSON configuration for parameters that remain governed but do not yet require dedicated relational columns. |
| 9 | `created_at` | TIMESTAMPTZ | 记录创建时间。 | Time when the record was created. |
| 10 | `published_at` | TIMESTAMPTZ，可空 | 该版本被正式发布、生效的时间。 | Time when this version was formally published/activated. |

## 16. `capability_definition`

**语义角色 / Semantic Role：VERSIONED DEFINITION**  
**当前字段数 / Current Field Count：10**

**中文说明：** 企业或全局能力定义。描述系统可提供的能力及其版本和配置。

**English Description:** Versioned global or enterprise capability definition describing an available system/business capability and its configuration.

| # | 字段 / Field | 当前类型 / Current Type | 中文说明 | English Description |
|---:|---|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 | Primary key. Usually a UUID that stably identifies this record. |
| 2 | `enterprise_id` | UUID/标识，可空 | 所属企业/租户 ID。用于多企业隔离；为空时通常表示全局共享定义。 | Owning enterprise/tenant ID. It is the main boundary for multi-enterprise isolation; null commonly means a globally shared definition. |
| 3 | `code` | TEXT | 稳定、机器可读的业务代码。通常用于配置、API、模板和规则引用，不应随显示名称随意改变。 | Stable machine-readable business code used by configuration, APIs, templates, and rules. |
| 4 | `name` | TEXT | 面向人的显示名称。 | Human-readable display name. |
| 5 | `description` | TEXT，可空 | 对该对象用途和业务含义的补充说明。 | Additional human-readable explanation of the object's purpose or business meaning. |
| 6 | `version` | INTEGER/数值 | 定义/数据集的版本号。版本发布后通常不应原地修改语义。 | Version number of a definition or dataset. Published semantic versions should not be modified in place. |
| 7 | `status` | TEXT 枚举 | 当前生命周期/执行状态。允许值由本表对应的枚举约束决定。 | Current lifecycle or execution status; allowed values are constrained by the table contract. |
| 8 | `config` | JSONB 对象 | 可扩展配置 JSON。保存尚不值得固化为独立列、但仍需要版本化治理的参数。 | Extensible JSON configuration for parameters that remain governed but do not yet require dedicated relational columns. |
| 9 | `created_at` | TIMESTAMPTZ | 记录创建时间。 | Time when the record was created. |
| 10 | `published_at` | TIMESTAMPTZ，可空 | 该版本被正式发布、生效的时间。 | Time when this version was formally published/activated. |


# 主数据 / Master Data

## 17. `item_definition`

**语义角色 / Semantic Role：CANONICAL DEFINITION**  
**当前字段数 / Current Field Count：11**

**中文说明：** 企业物料/商品/服务定义。描述 item 类型、是否管理库存、默认履约方式和基础计量单位。

**English Description:** Enterprise item/material/product/service master definition, including item type, inventory tracking, fulfillment mode, and base unit.

| # | 字段 / Field | 当前类型 / Current Type | 中文说明 | English Description |
|---:|---|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 | Primary key. Usually a UUID that stably identifies this record. |
| 2 | `enterprise_id` | UUID/标识 | 所属企业/租户 ID。用于多企业隔离；为空时通常表示全局共享定义。 | Owning enterprise/tenant ID. It is the main boundary for multi-enterprise isolation; null commonly means a globally shared definition. |
| 3 | `code` | TEXT | 稳定、机器可读的业务代码。通常用于配置、API、模板和规则引用，不应随显示名称随意改变。 | Stable machine-readable business code used by configuration, APIs, templates, and rules. |
| 4 | `name` | TEXT | 面向人的显示名称。 | Human-readable display name. |
| 5 | `item_type` | TEXT 枚举 | 物料/项目类别，例如原材料、半成品、成品、商品、服务、资产类项目。 | Item classification such as material, semi-finished good, finished good, merchandise, service, or asset item. |
| 6 | `track_inventory` | BOOLEAN | 该 Item 是否参与库存数量/头寸管理。 | Whether the item participates in inventory quantity/position tracking. |
| 7 | `default_fulfillment_mode` | TEXT 枚举，可空 | 默认履约方式：自制、采购、备货或服务。 | Default fulfillment mode: MAKE, BUY, STOCK, or SERVICE. |
| 8 | `base_unit` | TEXT | 该 Item 的基础计量单位。 | Base measurement unit of this item. |
| 9 | `config` | JSONB 对象 | 可扩展配置 JSON。保存尚不值得固化为独立列、但仍需要版本化治理的参数。 | Extensible JSON configuration for parameters that remain governed but do not yet require dedicated relational columns. |
| 10 | `created_at` | TIMESTAMPTZ | 记录创建时间。 | Time when the record was created. |
| 11 | `updated_at` | TIMESTAMPTZ | 记录最近一次更新/物化刷新时间。 | Time when the record or materialized state was last updated. |


# 权限 / Permissions

## 18. `permission_grant`

**语义角色 / Semantic Role：CANONICAL DEFINITION**  
**当前字段数 / Current Field Count：7**

**中文说明：** 企业内 Actor 的权限授予记录，描述谁对什么权限代码/资源范围有执行资格。

**English Description:** Enterprise permission grant describing which actor has a permission code over a resource scope.

| # | 字段 / Field | 当前类型 / Current Type | 中文说明 | English Description |
|---:|---|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 | Primary key. Usually a UUID that stably identifies this record. |
| 2 | `enterprise_id` | UUID/标识 | 所属企业/租户 ID。用于多企业隔离；为空时通常表示全局共享定义。 | Owning enterprise/tenant ID. It is the main boundary for multi-enterprise isolation; null commonly means a globally shared definition. |
| 3 | `actor_type` | TEXT 枚举 | 发起者类型，例如 HUMAN、AI、AUTOMATION、EXTERNAL_SYSTEM。 | Type of initiating actor, such as HUMAN, AI, AUTOMATION, or EXTERNAL_SYSTEM. |
| 4 | `actor_id` | TEXT/标识 | 发起者在其类型命名空间中的标识。 | Identifier of the initiating actor within its actor namespace. |
| 5 | `permission_code` | TEXT | 被授予的权限代码。 | Stable business/code identifier for permission code. |
| 6 | `resource_scope` | JSONB 对象 | 权限适用的资源范围/条件。 | Current resource scope attribute of this table; its exact constraints are defined by the current schema and module contract. |
| 7 | `created_at` | TIMESTAMPTZ | 记录创建时间。 | Time when the record was created. |


# 元数据 / Metadata

## 19. `command_definition`

**语义角色 / Semantic Role：VERSIONED DEFINITION**  
**当前字段数 / Current Field Count：9**

**中文说明：** 应用允许执行的 Command 定义，包括输入结构、前置条件、执行策略以及成功后产生的 BusinessData 类型。

**English Description:** Definition of an allowed application Command, including input schema, preconditions, execution policy, and the BusinessData type produced after successful acceptance.

| # | 字段 / Field | 当前类型 / Current Type | 中文说明 | English Description |
|---:|---|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 | Primary key. Usually a UUID that stably identifies this record. |
| 2 | `application_definition_version_id` | UUID/标识 | 该 Command 属于哪个 ApplicationDefinitionVersion。 | ApplicationDefinitionVersion that owns this Command. |
| 3 | `code` | TEXT | 稳定、机器可读的业务代码。通常用于配置、API、模板和规则引用，不应随显示名称随意改变。 | Stable machine-readable business code used by configuration, APIs, templates, and rules. |
| 4 | `name` | TEXT | 面向人的显示名称。 | Human-readable display name. |
| 5 | `input_schema` | JSONB 对象 | Command 输入的 JSON Schema/结构定义。 | Schema describing the allowed Command input. |
| 6 | `preconditions` | JSONB 数组 | Command 执行前必须满足的条件集合。 | Conditions that must hold before the Command may be accepted/executed. |
| 7 | `execution_policy` | JSONB 对象 | 授权、审批、幂等等执行策略配置。 | Execution governance such as authorization, approval, and idempotency behavior. |
| 8 | `resulting_business_data_type` | TEXT | Command 成功后产生的 canonical BusinessData 类型。 | Canonical BusinessData type produced after successful Command acceptance. |
| 9 | `config` | JSONB 对象 | 可扩展配置 JSON。保存尚不值得固化为独立列、但仍需要版本化治理的参数。 | Extensible JSON configuration for parameters that remain governed but do not yet require dedicated relational columns. |


# 命令与事实 / Commands & Facts

## 20. `command_execution`

**语义角色 / Semantic Role：EXECUTION/AUDIT**  
**当前字段数 / Current Field Count：18**

**中文说明：** 一次 Command 请求的执行记录。保存调用者、幂等键、输入、状态、结果和错误；Command 本身不是重放时的业务事实。

**English Description:** Audit record for one Command request. It records actor, idempotency, input, execution state, result, and error; Replay does not re-execute Commands.

| # | 字段 / Field | 当前类型 / Current Type | 中文说明 | English Description |
|---:|---|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 | Primary key. Usually a UUID that stably identifies this record. |
| 2 | `enterprise_id` | UUID/标识 | 所属企业/租户 ID。用于多企业隔离；为空时通常表示全局共享定义。 | Owning enterprise/tenant ID. It is the main boundary for multi-enterprise isolation; null commonly means a globally shared definition. |
| 3 | `application_instance_id` | UUID/标识 | 本次 Command 针对的 ApplicationInstance ID。 | ApplicationInstance against which this Command was issued. |
| 4 | `command_definition_id` | UUID/标识 | 实际执行的 CommandDefinition ID。 | CommandDefinition actually executed. |
| 5 | `actor_type` | TEXT 枚举 | 发起者类型，例如 HUMAN、AI、AUTOMATION、EXTERNAL_SYSTEM。 | Type of initiating actor, such as HUMAN, AI, AUTOMATION, or EXTERNAL_SYSTEM. |
| 6 | `actor_id` | TEXT/标识 | 发起者在其类型命名空间中的标识。 | Identifier of the initiating actor within its actor namespace. |
| 7 | `request_id` | UUID/标识 | 外部/调用侧请求标识，用于请求追踪。 | Caller/request-side identifier used for request tracing. |
| 8 | `correlation_id` | UUID/标识 | 跨多步业务调用的关联 ID，用于把同一业务链路串起来。 | Correlation identifier that links multiple operations belonging to the same business flow. |
| 9 | `causation_id` | TEXT/标识，可空 | 导致当前动作发生的上游动作/事件标识，用于因果追踪。 | Identifier of the upstream action/event that caused this operation, when known. |
| 10 | `idempotency_scope` | TEXT | 幂等键的作用域，避免不同业务范围的相同键互相冲突。 | Scope within which the idempotency key must be unique. |
| 11 | `idempotency_key` | TEXT | 幂等键。相同作用域内重复提交相同意图时用于避免重复执行。 | Idempotency key used to prevent duplicate execution of the same intent within its scope. |
| 12 | `input` | JSONB 对象 | Command 的原始结构化输入。 | Structured Command input captured for audit and deterministic validation. |
| 13 | `lineage` | JSONB 对象，可空 | 来源、版本、执行路径等血缘信息。 | Structured provenance and execution lineage information. |
| 14 | `status` | TEXT 枚举 | 当前生命周期/执行状态。允许值由本表对应的枚举约束决定。 | Current lifecycle or execution status; allowed values are constrained by the table contract. |
| 15 | `result` | JSONB 对象，可空 | Command 执行结果摘要；没有结果时为空。 | Structured Command execution result; null when no result is available. |
| 16 | `error` | JSONB 对象，可空 | 失败时的结构化错误信息。 | Structured failure information for an execution/run. |
| 17 | `created_at` | TIMESTAMPTZ | 记录创建时间。 | Time when the record was created. |
| 18 | `completed_at` | TIMESTAMPTZ，可空 | 该运行/流程完成的时间；未完成时为空。 | Time when this execution/run completed; null while incomplete. |

## 21. `business_data`

**语义角色 / Semantic Role：CORE CANONICAL**  
**当前字段数 / Current Field Count：11**

**中文说明：** EVO 最核心的不可变业务事实表。保存已经接受发生的业务事件及语义 payload；重放读取 BusinessData，而不是重新执行 Command。

**English Description:** Core immutable business fact table. It stores accepted business occurrences and semantic payload; Replay consumes BusinessData rather than re-running the original Command.

| # | 字段 / Field | 当前类型 / Current Type | 中文说明 | English Description |
|---:|---|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 | Primary key. Usually a UUID that stably identifies this record. |
| 2 | `enterprise_id` | UUID/标识 | 所属企业/租户 ID。用于多企业隔离；为空时通常表示全局共享定义。 | Owning enterprise/tenant ID. It is the main boundary for multi-enterprise isolation; null commonly means a globally shared definition. |
| 3 | `application_instance_id` | UUID/标识 | 产生该事实的应用实例 ID。 | ApplicationInstance that produced this accepted business fact. |
| 4 | `command_execution_id` | UUID/标识 | 接受并产生该事实的 CommandExecution ID；Replay 不会重新执行它。 | CommandExecution that created this fact; Replay never re-executes that Command. |
| 5 | `business_data_type` | TEXT | BusinessData 的语义类型，例如 sales_order.approved、valuation.requested。 | Semantic type of BusinessData, for example sales_order.approved or valuation.requested. |
| 6 | `business_object_key` | TEXT | 业务对象稳定键，例如订单号/业务编号，用于聚合同一对象的不同不可变版本。 | Stable business key, such as an order number, used to group immutable versions of the same business object. |
| 7 | `business_object_version` | BIGINT | 同一 business_object_key 下的业务事实版本序号。 | Monotonic immutable-fact version number within a business_object_key. |
| 8 | `effective_at` | TIMESTAMPTZ | 业务或解释在经济意义上的生效时间，与数据库记录时间不同。 | Business/economic effective time. This is intentionally distinct from database recording time. |
| 9 | `metadata_version` | INTEGER/数值 | 解释/记账该数据时使用的元数据版本。 | Metadata version used to interpret/post this business fact. |
| 10 | `payload` | JSONB 对象 | BusinessData 或事件的业务语义数据载荷，使用 JSONB 保留应用层字段。 | Structured business semantic payload. In BusinessData it contains application-level fields for the accepted immutable fact. |
| 11 | `created_at` | TIMESTAMPTZ | 记录创建时间。 | Time when the record was created. |


# 运行时 / Runtime

## 22. `enterprise_runtime_state`

**语义角色 / Semantic Role：MATERIALIZED CONTROL STATE**  
**当前字段数 / Current Field Count：10**

**中文说明：** 企业当前运行控制状态，包括 posting/replay 模式、下一 posting_sequence 和当前 replay run。

**English Description:** Materialized control state for an enterprise, including posting/replay mode, sequence allocation, last posted ordering key, and active replay run.

| # | 字段 / Field | 当前类型 / Current Type | 中文说明 | English Description |
|---:|---|---|---|---|
| 1 | `enterprise_id` | UUID/标识 | 所属企业/租户 ID。用于多企业隔离；为空时通常表示全局共享定义。 | Owning enterprise/tenant ID. It is the main boundary for multi-enterprise isolation; null commonly means a globally shared definition. |
| 2 | `consistency_domain` | TEXT | 一致性域。当前通常为 enterprise，用于界定 Posting/Replay 的原子一致性范围。 | Consistency scope for Posting/Replay; currently usually the enterprise domain. |
| 3 | `posting_mode` | TEXT 枚举 | 企业当前 Posting 状态：正常、重放中或失败。 | Enterprise posting state: normal, replaying, or failed. |
| 4 | `replay_required` | BOOLEAN | 是否已检测到追溯变化、需要执行 Replay。 | Whether a retroactive/semantic change has made Replay necessary. |
| 5 | `next_posting_sequence` | BIGINT | 下一条 PostingInput 将获得的顺序号。 | Next deterministic posting sequence number to allocate. |
| 6 | `last_posted_effective_at` | TIMESTAMPTZ，可空 | 最近已成功记账事实的业务有效时间。 | Business effective time of the latest successfully posted input. |
| 7 | `last_posted_priority` | INTEGER/数值，可空 | 最近已成功记账事实的 posting priority。 | Posting priority of the latest successfully posted input. |
| 8 | `last_posted_sequence` | BIGINT，可空 | 最近已成功记账的 posting_sequence。 | posting_sequence of the latest successfully posted input. |
| 9 | `active_replay_run_id` | UUID/标识，可空 | 当前正在控制该一致性域的 ReplayRun ID。 | ReplayRun currently controlling this consistency domain. |
| 10 | `updated_at` | TIMESTAMPTZ | 记录最近一次更新/物化刷新时间。 | Time when the record or materialized state was last updated. |

## 23. `outbox_event`

**语义角色 / Semantic Role：INTEGRATION OUTBOX**  
**当前字段数 / Current Field Count：14**

**中文说明：** 事务性 Outbox。把内部已提交变化可靠地发布给外部消费者，避免数据库提交与消息发送之间失配。

**English Description:** Transactional outbox used to publish committed internal changes reliably to external consumers without creating a database/message consistency gap.

| # | 字段 / Field | 当前类型 / Current Type | 中文说明 | English Description |
|---:|---|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 | Primary key. Usually a UUID that stably identifies this record. |
| 2 | `enterprise_id` | UUID/标识 | 所属企业/租户 ID。用于多企业隔离；为空时通常表示全局共享定义。 | Owning enterprise/tenant ID. It is the main boundary for multi-enterprise isolation; null commonly means a globally shared definition. |
| 3 | `event_type` | TEXT | 待发布集成事件类型。 | Type/category discriminator for event type. |
| 4 | `event_version` | INTEGER/数值 | 该集成事件的协议版本。 | Pinned version number of the related event; it prevents implicit use of a mutable “latest” version. |
| 5 | `aggregate_type` | TEXT | 事件对应的聚合/资源类型。 | Type/category discriminator for aggregate type. |
| 6 | `aggregate_id` | TEXT/标识 | 事件对应的聚合/资源 ID。 | Stable identifier of the related aggregate object. |
| 7 | `correlation_id` | UUID/标识 | 跨多步业务调用的关联 ID，用于把同一业务链路串起来。 | Correlation identifier that links multiple operations belonging to the same business flow. |
| 8 | `causation_id` | TEXT/标识，可空 | 导致当前动作发生的上游动作/事件标识，用于因果追踪。 | Identifier of the upstream action/event that caused this operation, when known. |
| 9 | `payload` | JSONB 对象 | BusinessData 或事件的业务语义数据载荷，使用 JSONB 保留应用层字段。 | Structured business semantic payload. In BusinessData it contains application-level fields for the accepted immutable fact. |
| 10 | `status` | TEXT 枚举 | 当前生命周期/执行状态。允许值由本表对应的枚举约束决定。 | Current lifecycle or execution status; allowed values are constrained by the table contract. |
| 11 | `attempts` | INTEGER/数值 | 已经尝试发布的次数。 | Current attempts attribute of this table; its exact constraints are defined by the current schema and module contract. |
| 12 | `available_at` | TIMESTAMPTZ | 允许下一次发布尝试的时间。 | Timestamp associated with available at in this table's lifecycle or business context. |
| 13 | `created_at` | TIMESTAMPTZ | 记录创建时间。 | Time when the record was created. |
| 14 | `published_at` | TIMESTAMPTZ，可空 | 成功发布到外部总线/消费者的时间。 | Time when this version was formally published/activated. |

## 24. `feature_flag`

**语义角色 / Semantic Role：CONTROL DEFINITION**  
**当前字段数 / Current Field Count：10**

**中文说明：** 功能开关。支持灰度发布、迁移期兼容和受控启停。

**English Description:** Governed feature switch used for staged rollout, compatibility, migration, and controlled activation/deactivation.

| # | 字段 / Field | 当前类型 / Current Type | 中文说明 | English Description |
|---:|---|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 | Primary key. Usually a UUID that stably identifies this record. |
| 2 | `code` | TEXT | 稳定、机器可读的业务代码。通常用于配置、API、模板和规则引用，不应随显示名称随意改变。 | Stable machine-readable business code used by configuration, APIs, templates, and rules. |
| 3 | `enterprise_id` | UUID/标识，可空 | 所属企业/租户 ID。用于多企业隔离；为空时通常表示全局共享定义。 | Owning enterprise/tenant ID. It is the main boundary for multi-enterprise isolation; null commonly means a globally shared definition. |
| 4 | `enabled` | BOOLEAN | 功能开关当前是否启用。 | Whether this governed feature switch is currently enabled. |
| 5 | `config` | JSONB 对象 | 可扩展配置 JSON。保存尚不值得固化为独立列、但仍需要版本化治理的参数。 | Extensible JSON configuration for parameters that remain governed but do not yet require dedicated relational columns. |
| 6 | `owner` | TEXT | 该 FeatureFlag 的责任模块/责任人标识。 | Owning module/team/role for this feature flag. |
| 7 | `introduced_in` | TEXT | 该 FeatureFlag 从哪个版本开始引入。 | Version in which this feature flag was introduced. |
| 8 | `expires_at` | TIMESTAMPTZ，可空 | 计划移除/失效时间，用于避免永久遗留临时开关。 | Planned expiry/removal time for a temporary feature flag. |
| 9 | `created_at` | TIMESTAMPTZ | 记录创建时间。 | Time when the record was created. |
| 10 | `updated_at` | TIMESTAMPTZ | 记录最近一次更新/物化刷新时间。 | Time when the record or materialized state was last updated. |


# 流程与工作 / Flows & Work

## 25. `work_item`

**语义角色 / Semantic Role：MATERIALIZATION**  
**当前字段数 / Current Field Count：16**

**中文说明：** 从账本/业务状态派生的工作项物化，例如待生产、待发货、待收款等。可从来源状态重建。

**English Description:** Materialized operational work item derived from ledger/business state, such as pending production, pending shipment, or receivable follow-up.

| # | 字段 / Field | 当前类型 / Current Type | 中文说明 | English Description |
|---:|---|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 | Primary key. Usually a UUID that stably identifies this record. |
| 2 | `enterprise_id` | UUID/标识 | 所属企业/租户 ID。用于多企业隔离；为空时通常表示全局共享定义。 | Owning enterprise/tenant ID. It is the main boundary for multi-enterprise isolation; null commonly means a globally shared definition. |
| 3 | `work_type` | TEXT | 工作项类型，例如待生产、待发货、待收款。 | Operational work-item type, such as pending production, shipment, or collection. |
| 4 | `title` | TEXT | 面向人的工作项/SOP 步骤标题。 | Human-readable work-item or SOP-step title. |
| 5 | `status` | TEXT 枚举 | 当前生命周期/执行状态。允许值由本表对应的枚举约束决定。 | Current lifecycle or execution status; allowed values are constrained by the table contract. |
| 6 | `priority` | INTEGER/数值 | 排序优先级，数值语义由对应模块决定。 | Current priority attribute of this table; its exact constraints are defined by the current schema and module contract. |
| 7 | `source_ledger_code` | TEXT | 生成该 WorkItem 的来源账本代码。 | Code of the source ledger from which this WorkItem is materialized. |
| 8 | `source_dimension_hash` | TEXT | 来源账本余额的维度组合摘要。 | Stable hash of the source ledger balance dimensions. |
| 9 | `source_dimensions` | JSONB 对象 | 来源账本余额的完整维度值。 | Full dimension values of the source ledger balance. |
| 10 | `source_quantity` | NUMERIC 高精度数值 | 生成工作项时来源余额的数量值。 | Source balance quantity captured for the WorkItem. |
| 11 | `source_amount` | NUMERIC 高精度数值 | 生成工作项时来源余额的金额值。 | Source balance amount captured for the WorkItem. |
| 12 | `assigned_actor_type` | TEXT，可空 | 当前受理/负责人的 Actor 类型。 | Type of actor currently assigned to the WorkItem. |
| 13 | `assigned_actor_id` | UUID/标识，可空 | 当前受理/负责人的 Actor 标识。 | Identifier of the actor currently assigned to the WorkItem. |
| 14 | `created_at` | TIMESTAMPTZ | 记录创建时间。 | Time when the record was created. |
| 15 | `updated_at` | TIMESTAMPTZ | 记录最近一次更新/物化刷新时间。 | Time when the record or materialized state was last updated. |
| 16 | `completed_at` | TIMESTAMPTZ，可空 | 该运行/流程完成的时间；未完成时为空。 | Time when this execution/run completed; null while incomplete. |

## 26. `flow_definition`

**语义角色 / Semantic Role：VERSIONED DEFINITION**  
**当前字段数 / Current Field Count：10**

**中文说明：** 业务流定义。描述跨 Command/BusinessData 的业务流程结构。

**English Description:** Versioned business-flow definition describing a cross-command/cross-BusinessData process.

| # | 字段 / Field | 当前类型 / Current Type | 中文说明 | English Description |
|---:|---|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 | Primary key. Usually a UUID that stably identifies this record. |
| 2 | `enterprise_id` | UUID/标识，可空 | 所属企业/租户 ID。用于多企业隔离；为空时通常表示全局共享定义。 | Owning enterprise/tenant ID. It is the main boundary for multi-enterprise isolation; null commonly means a globally shared definition. |
| 3 | `code` | TEXT | 稳定、机器可读的业务代码。通常用于配置、API、模板和规则引用，不应随显示名称随意改变。 | Stable machine-readable business code used by configuration, APIs, templates, and rules. |
| 4 | `name` | TEXT | 面向人的显示名称。 | Human-readable display name. |
| 5 | `description` | TEXT，可空 | 对该对象用途和业务含义的补充说明。 | Additional human-readable explanation of the object's purpose or business meaning. |
| 6 | `version` | INTEGER/数值 | 定义/数据集的版本号。版本发布后通常不应原地修改语义。 | Version number of a definition or dataset. Published semantic versions should not be modified in place. |
| 7 | `status` | TEXT 枚举 | 当前生命周期/执行状态。允许值由本表对应的枚举约束决定。 | Current lifecycle or execution status; allowed values are constrained by the table contract. |
| 8 | `definition` | JSONB 对象 | 版本化定义主体，使用 JSONB 保存可扩展的结构化语义。 | Versioned structured definition body stored as JSONB. |
| 9 | `created_at` | TIMESTAMPTZ | 记录创建时间。 | Time when the record was created. |
| 10 | `published_at` | TIMESTAMPTZ，可空 | 该版本被正式发布、生效的时间。 | Time when this version was formally published/activated. |

## 27. `flow_instance`

**语义角色 / Semantic Role：DERIVED/OPERATIONAL STATE**  
**当前字段数 / Current Field Count：7**

**中文说明：** 某个 FlowDefinition 的运行实例，记录实例键和当前状态。

**English Description:** Operational instance of a FlowDefinition with a stable instance key and lifecycle state.

| # | 字段 / Field | 当前类型 / Current Type | 中文说明 | English Description |
|---:|---|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 | Primary key. Usually a UUID that stably identifies this record. |
| 2 | `enterprise_id` | UUID/标识 | 所属企业/租户 ID。用于多企业隔离；为空时通常表示全局共享定义。 | Owning enterprise/tenant ID. It is the main boundary for multi-enterprise isolation; null commonly means a globally shared definition. |
| 3 | `flow_definition_id` | UUID/标识 | 该流程实例采用的 FlowDefinition ID。 | FlowDefinition used by this flow instance. |
| 4 | `instance_key` | TEXT | 业务侧稳定流程实例键，例如订单号。 | Stable business-side key of the process instance, for example an order number. |
| 5 | `status` | TEXT 枚举 | 当前生命周期/执行状态。允许值由本表对应的枚举约束决定。 | Current lifecycle or execution status; allowed values are constrained by the table contract. |
| 6 | `started_at` | TIMESTAMPTZ | 流程实例启动时间。 | Time when this execution/run started. |
| 7 | `completed_at` | TIMESTAMPTZ，可空 | 该运行/流程完成的时间；未完成时为空。 | Time when this execution/run completed; null while incomplete. |

## 28. `business_object_link`

**语义角色 / Semantic Role：BUSINESS LINEAGE**  
**当前字段数 / Current Field Count：7**

**中文说明：** BusinessData 之间的业务级关系，例如 CAUSES、FULFILLS、REFERENCES。历史兼容枚举中仍包含旧的 ALLOCATES_TO/DERIVES_FROM。

**English Description:** Business-level lineage between BusinessData facts, such as CAUSES, FULFILLS, or REFERENCES. Legacy compatibility values remain readable but should not replace dedicated allocation/calculation graphs.

| # | 字段 / Field | 当前类型 / Current Type | 中文说明 | English Description |
|---:|---|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 | Primary key. Usually a UUID that stably identifies this record. |
| 2 | `enterprise_id` | UUID/标识 | 所属企业/租户 ID。用于多企业隔离；为空时通常表示全局共享定义。 | Owning enterprise/tenant ID. It is the main boundary for multi-enterprise isolation; null commonly means a globally shared definition. |
| 3 | `from_business_data_id` | UUID/标识 | 业务关系起点 BusinessData ID。 | Source BusinessData of this business-level relation. |
| 4 | `to_business_data_id` | UUID/标识 | 业务关系终点 BusinessData ID。 | Target BusinessData of this business-level relation. |
| 5 | `relation_type` | TEXT 枚举 | 业务级关系类型。新运行时不应再用它承载 Allocation/Calculation dependency。 | Business relationship type. Dedicated Allocation/Calculation graphs should be used for those semantics instead of overloading this field. |
| 6 | `metadata` | JSONB 对象 | 补充元数据；不承担主业务语义。 | Supplemental metadata that does not carry the primary business meaning. |
| 7 | `created_at` | TIMESTAMPTZ | 记录创建时间。 | Time when the record was created. |

## 29. `flow_trace`

**语义角色 / Semantic Role：AUDIT/TRACE**  
**当前字段数 / Current Field Count：10**

**中文说明：** 业务流跟踪记录，把 Flow、CommandExecution 和 BusinessData 串起来用于可观测性与追踪。

**English Description:** Trace record linking FlowDefinition, FlowInstance, CommandExecution, and BusinessData for observability and business-process tracing.

| # | 字段 / Field | 当前类型 / Current Type | 中文说明 | English Description |
|---:|---|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 | Primary key. Usually a UUID that stably identifies this record. |
| 2 | `enterprise_id` | UUID/标识 | 所属企业/租户 ID。用于多企业隔离；为空时通常表示全局共享定义。 | Owning enterprise/tenant ID. It is the main boundary for multi-enterprise isolation; null commonly means a globally shared definition. |
| 3 | `flow_definition_id` | UUID/标识 | 所属 FlowDefinition ID。 | FlowDefinition associated with this trace record. |
| 4 | `flow_instance_id` | UUID/标识 | 所属 FlowInstance ID。 | FlowInstance associated with this trace record. |
| 5 | `command_execution_id` | UUID/标识 | 该流程步骤关联的 CommandExecution ID。 | CommandExecution associated with this process step. |
| 6 | `business_data_id` | UUID/标识 | 该流程步骤产生/关联的 BusinessData ID。 | BusinessData produced or referenced by this process step. |
| 7 | `step_code` | TEXT | 流程步骤代码。 | Business-flow step code. |
| 8 | `correlation_id` | UUID/标识 | 跨多步业务调用的关联 ID，用于把同一业务链路串起来。 | Correlation identifier that links multiple operations belonging to the same business flow. |
| 9 | `causation_id` | TEXT/标识，可空 | 导致当前动作发生的上游动作/事件标识，用于因果追踪。 | Identifier of the upstream action/event that caused this operation, when known. |
| 10 | `created_at` | TIMESTAMPTZ | 记录创建时间。 | Time when the record was created. |

## 30. `sop_definition`

**语义角色 / Semantic Role：DEFINITION**  
**当前字段数 / Current Field Count：6**

**中文说明：** 标准作业程序 SOP 的稳定身份。

**English Description:** Stable identity of a Standard Operating Procedure (SOP).

| # | 字段 / Field | 当前类型 / Current Type | 中文说明 | English Description |
|---:|---|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 | Primary key. Usually a UUID that stably identifies this record. |
| 2 | `enterprise_id` | UUID/标识，可空 | 所属企业/租户 ID。用于多企业隔离；为空时通常表示全局共享定义。 | Owning enterprise/tenant ID. It is the main boundary for multi-enterprise isolation; null commonly means a globally shared definition. |
| 3 | `code` | TEXT | 稳定、机器可读的业务代码。通常用于配置、API、模板和规则引用，不应随显示名称随意改变。 | Stable machine-readable business code used by configuration, APIs, templates, and rules. |
| 4 | `name` | TEXT | 面向人的显示名称。 | Human-readable display name. |
| 5 | `description` | TEXT，可空 | 对该对象用途和业务含义的补充说明。 | Additional human-readable explanation of the object's purpose or business meaning. |
| 6 | `created_at` | TIMESTAMPTZ | 记录创建时间。 | Time when the record was created. |

## 31. `sop_version`

**语义角色 / Semantic Role：VERSIONED DEFINITION**  
**当前字段数 / Current Field Count：8**

**中文说明：** SOP 的版本，支持发布、退役和版本化配置。

**English Description:** Versioned SOP content and lifecycle state.

| # | 字段 / Field | 当前类型 / Current Type | 中文说明 | English Description |
|---:|---|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 | Primary key. Usually a UUID that stably identifies this record. |
| 2 | `sop_definition_id` | UUID/标识 | 所属 SOPDefinition ID。 | SOPDefinition that owns this SOP version. |
| 3 | `version` | INTEGER/数值 | 定义/数据集的版本号。版本发布后通常不应原地修改语义。 | Version number of a definition or dataset. Published semantic versions should not be modified in place. |
| 4 | `status` | TEXT 枚举 | 当前生命周期/执行状态。允许值由本表对应的枚举约束决定。 | Current lifecycle or execution status; allowed values are constrained by the table contract. |
| 5 | `summary` | TEXT，可空 | 版本说明/摘要。 | Version summary/description. |
| 6 | `config` | JSONB 对象 | 可扩展配置 JSON。保存尚不值得固化为独立列、但仍需要版本化治理的参数。 | Extensible JSON configuration for parameters that remain governed but do not yet require dedicated relational columns. |
| 7 | `created_at` | TIMESTAMPTZ | 记录创建时间。 | Time when the record was created. |
| 8 | `published_at` | TIMESTAMPTZ，可空 | 该版本被正式发布、生效的时间。 | Time when this version was formally published/activated. |

## 32. `sop_step`

**语义角色 / Semantic Role：VERSIONED DEFINITION**  
**当前字段数 / Current Field Count：8**

**中文说明：** 某个 SOP 版本的具体步骤、操作说明、证据要求和控制条件。

**English Description:** Individual step of a specific SOP version, including instructions, evidence requirements, and controls.

| # | 字段 / Field | 当前类型 / Current Type | 中文说明 | English Description |
|---:|---|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 | Primary key. Usually a UUID that stably identifies this record. |
| 2 | `sop_version_id` | UUID/标识 | 所属 SOPVersion ID。 | SOPVersion that owns this step. |
| 3 | `step_no` | INTEGER/数值 | SOP 中的步骤序号。 | Sequence number of this SOP step. |
| 4 | `code` | TEXT | 稳定、机器可读的业务代码。通常用于配置、API、模板和规则引用，不应随显示名称随意改变。 | Stable machine-readable business code used by configuration, APIs, templates, and rules. |
| 5 | `title` | TEXT | 面向人的工作项/SOP 步骤标题。 | Human-readable work-item or SOP-step title. |
| 6 | `instruction` | TEXT | 该 SOP 步骤的具体操作说明。 | Human-operational instruction for this SOP step. |
| 7 | `evidence_requirement` | JSONB 对象 | 完成该 SOP 步骤需要留存的证据要求。 | Evidence that must be retained to demonstrate completion of this SOP step. |
| 8 | `control` | JSONB 对象 | SOP 步骤的控制条件/限制。 | Governance/control conditions applied to this SOP step. |


# 分析与管理 / Analytics & Management

## 33. `metric_definition`

**语义角色 / Semantic Role：VERSIONED DEFINITION**  
**当前字段数 / Current Field Count：12**

**中文说明：** 指标定义。保存指标计算定义、类型及 lineage，用于企业分析和管理数据层。

**English Description:** Versioned enterprise metric definition, including output type, calculation definition, and lineage.

| # | 字段 / Field | 当前类型 / Current Type | 中文说明 | English Description |
|---:|---|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 | Primary key. Usually a UUID that stably identifies this record. |
| 2 | `enterprise_id` | UUID/标识，可空 | 所属企业/租户 ID。用于多企业隔离；为空时通常表示全局共享定义。 | Owning enterprise/tenant ID. It is the main boundary for multi-enterprise isolation; null commonly means a globally shared definition. |
| 3 | `code` | TEXT | 稳定、机器可读的业务代码。通常用于配置、API、模板和规则引用，不应随显示名称随意改变。 | Stable machine-readable business code used by configuration, APIs, templates, and rules. |
| 4 | `name` | TEXT | 面向人的显示名称。 | Human-readable display name. |
| 5 | `description` | TEXT，可空 | 对该对象用途和业务含义的补充说明。 | Additional human-readable explanation of the object's purpose or business meaning. |
| 6 | `version` | INTEGER/数值 | 定义/数据集的版本号。版本发布后通常不应原地修改语义。 | Version number of a definition or dataset. Published semantic versions should not be modified in place. |
| 7 | `status` | TEXT 枚举 | 当前生命周期/执行状态。允许值由本表对应的枚举约束决定。 | Current lifecycle or execution status; allowed values are constrained by the table contract. |
| 8 | `value_type` | TEXT | 指标输出值的数据类型。 | Output value type of the metric. |
| 9 | `definition` | JSONB 对象 | 版本化定义主体，使用 JSONB 保存可扩展的结构化语义。 | Versioned structured definition body stored as JSONB. |
| 10 | `lineage` | JSONB 对象 | 来源、版本、执行路径等血缘信息。 | Structured provenance and execution lineage information. |
| 11 | `created_at` | TIMESTAMPTZ | 记录创建时间。 | Time when the record was created. |
| 12 | `published_at` | TIMESTAMPTZ，可空 | 该版本被正式发布、生效的时间。 | Time when this version was formally published/activated. |


# 记账与账本 / Posting & Ledgers

## 34. `ledger_definition`

**语义角色 / Semantic Role：DEFINITION**  
**当前字段数 / Current Field Count：8**

**中文说明：** 账本定义。声明一个账本的数量/金额语义、维度结构和其他配置，本身不保存余额。

**English Description:** Ledger definition. It declares quantity/amount semantics, dimension structure, and configuration; it does not itself store balances.

| # | 字段 / Field | 当前类型 / Current Type | 中文说明 | English Description |
|---:|---|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 | Primary key. Usually a UUID that stably identifies this record. |
| 2 | `code` | TEXT | 稳定、机器可读的业务代码。通常用于配置、API、模板和规则引用，不应随显示名称随意改变。 | Stable machine-readable business code used by configuration, APIs, templates, and rules. |
| 3 | `name` | TEXT | 面向人的显示名称。 | Human-readable display name. |
| 4 | `quantity_semantics` | TEXT，可空 | 该账本 quantity 的业务语义说明。 | Business meaning of quantity in this ledger. |
| 5 | `amount_semantics` | TEXT，可空 | 该账本 amount 的业务语义说明。 | Business meaning of amount/value in this ledger. |
| 6 | `dimension_schema` | JSONB 对象 | 声明该定义允许/要求的维度结构。 | Schema describing the dimensions allowed/required by this definition. |
| 7 | `config` | JSONB 对象 | 可扩展配置 JSON。保存尚不值得固化为独立列、但仍需要版本化治理的参数。 | Extensible JSON configuration for parameters that remain governed but do not yet require dedicated relational columns. |
| 8 | `created_at` | TIMESTAMPTZ | 记录创建时间。 | Time when the record was created. |

## 35. `posting_rule`

**语义角色 / Semantic Role：VERSIONED DEFINITION**  
**当前字段数 / Current Field Count：8**

**中文说明：** 确定性记账/投影规则。根据 BusinessData 和条件 AST 产生 LedgerEffect。

**English Description:** Deterministic posting/projection rule. It evaluates a condition against BusinessData and produces ledger effects.

| # | 字段 / Field | 当前类型 / Current Type | 中文说明 | English Description |
|---:|---|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 | Primary key. Usually a UUID that stably identifies this record. |
| 2 | `application_definition_version_id` | UUID/标识 | 该 PostingRule 所属应用定义版本。 | ApplicationDefinitionVersion that owns this PostingRule. |
| 3 | `code` | TEXT | 稳定、机器可读的业务代码。通常用于配置、API、模板和规则引用，不应随显示名称随意改变。 | Stable machine-readable business code used by configuration, APIs, templates, and rules. |
| 4 | `priority` | INTEGER/数值 | 排序优先级，数值语义由对应模块决定。 | Current priority attribute of this table; its exact constraints are defined by the current schema and module contract. |
| 5 | `condition_ast` | JSONB 对象 | 记账规则条件表达式 AST；为 true 才执行 effect。 | Condition expression AST; the effect executes only when this evaluates true. |
| 6 | `effect_ast` | JSONB 对象 | 规则产生 LedgerEffect 的表达式 AST。 | Expression AST that produces one or more ledger effects. |
| 7 | `rule_schema_version` | INTEGER/数值 | PostingRule AST/协议结构版本，不等同于业务版本。 | Protocol/schema version of the PostingRule AST structure. |
| 8 | `created_at` | TIMESTAMPTZ | 记录创建时间。 | Time when the record was created. |

## 36. `posting_input`

**语义角色 / Semantic Role：DERIVED EXECUTION INPUT**  
**当前字段数 / Current Field Count：13**

**中文说明：** BusinessData 进入 Posting Runtime 后的确定性排队输入，固定 effective time、priority、posting_sequence 和 metadata version。

**English Description:** Deterministic queued input derived from BusinessData for Posting Runtime. It fixes effective time, priority, posting sequence, metadata version, and processing status.

| # | 字段 / Field | 当前类型 / Current Type | 中文说明 | English Description |
|---:|---|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 | Primary key. Usually a UUID that stably identifies this record. |
| 2 | `enterprise_id` | UUID/标识 | 所属企业/租户 ID。用于多企业隔离；为空时通常表示全局共享定义。 | Owning enterprise/tenant ID. It is the main boundary for multi-enterprise isolation; null commonly means a globally shared definition. |
| 3 | `consistency_domain` | TEXT | 一致性域。当前通常为 enterprise，用于界定 Posting/Replay 的原子一致性范围。 | Consistency scope for Posting/Replay; currently usually the enterprise domain. |
| 4 | `business_data_id` | UUID/标识 | 关联的业务事实 ID，用于建立本表与对应对象之间的稳定关系。 | Stable identifier of the related business data object. |
| 5 | `application_instance_id` | UUID/标识 | 关联的应用实例 ID，用于建立本表与对应对象之间的稳定关系。 | Stable identifier of the related application instance object. |
| 6 | `effective_at` | TIMESTAMPTZ | 业务或解释在经济意义上的生效时间，与数据库记录时间不同。 | Business/economic effective time. This is intentionally distinct from database recording time. |
| 7 | `posting_priority` | INTEGER/数值 | 同一有效时间下的记账优先级。 | Posting priority used when multiple inputs share the same effective time. |
| 8 | `posting_sequence` | BIGINT | 确定性 Posting 顺序号。重放和成本顺序不能依赖数据库物理插入顺序。 | Deterministic posting order. Replay and costing must not rely on physical database insertion order. |
| 9 | `metadata_version` | INTEGER/数值 | 解释/记账该数据时使用的元数据版本。 | Metadata version used to interpret/post this business fact. |
| 10 | `status` | TEXT 枚举 | 当前生命周期/执行状态。允许值由本表对应的枚举约束决定。 | Current lifecycle or execution status; allowed values are constrained by the table contract. |
| 11 | `retroactive` | BOOLEAN | 是否属于追溯/回溯性输入。追溯输入可能要求触发 Replay。 | Whether this posting input is retroactive/backdated and may therefore require Replay. |
| 12 | `created_at` | TIMESTAMPTZ | 记录创建时间。 | Time when the record was created. |
| 13 | `posted_at` | TIMESTAMPTZ，可空 | 该 PostingInput 完成记账的时间。 | Time when this PostingInput was successfully posted. |

## 37. `ledger_dataset`

**语义角色 / Semantic Role：MATERIALIZATION EPOCH**  
**当前字段数 / Current Field Count：8**

**中文说明：** 一套 Ledger 数据集/物化世代。支持 CURRENT/CANDIDATE/ARCHIVED，使 replay 可以重建候选数据后再原子切换。

**English Description:** A generation/epoch of ledger materialization. CURRENT/CANDIDATE/ARCHIVED datasets allow Replay to rebuild a candidate set before controlled activation.

| # | 字段 / Field | 当前类型 / Current Type | 中文说明 | English Description |
|---:|---|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 | Primary key. Usually a UUID that stably identifies this record. |
| 2 | `enterprise_id` | UUID/标识 | 所属企业/租户 ID。用于多企业隔离；为空时通常表示全局共享定义。 | Owning enterprise/tenant ID. It is the main boundary for multi-enterprise isolation; null commonly means a globally shared definition. |
| 3 | `consistency_domain` | TEXT | 一致性域。当前通常为 enterprise，用于界定 Posting/Replay 的原子一致性范围。 | Consistency scope for Posting/Replay; currently usually the enterprise domain. |
| 4 | `kind` | TEXT 枚举 | 数据集用途：当前生效、Replay 候选或历史归档。 | Purpose of the ledger generation: CURRENT, CANDIDATE, or ARCHIVED. |
| 5 | `status` | TEXT 枚举 | 当前生命周期/执行状态。允许值由本表对应的枚举约束决定。 | Current lifecycle or execution status; allowed values are constrained by the table contract. |
| 6 | `posting_boundary_sequence` | BIGINT，可空 | 该数据集已经构建到的 Posting 顺序边界。 | Highest Posting sequence already represented in this dataset. |
| 7 | `created_at` | TIMESTAMPTZ | 记录创建时间。 | Time when the record was created. |
| 8 | `activated_at` | TIMESTAMPTZ，可空 | 候选 LedgerDataset 被原子切换为 ACTIVE 的时间。 | Time when this candidate dataset was activated as current. |

## 38. `posting_run`

**语义角色 / Semantic Role：EXECUTION/AUDIT**  
**当前字段数 / Current Field Count：10**

**中文说明：** 一次 PostingInput 的记账运行记录，区分正常记账和 replay 模式。

**English Description:** Audit record for processing one PostingInput, in either NORMAL or REPLAY mode.

| # | 字段 / Field | 当前类型 / Current Type | 中文说明 | English Description |
|---:|---|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 | Primary key. Usually a UUID that stably identifies this record. |
| 2 | `enterprise_id` | UUID/标识 | 所属企业/租户 ID。用于多企业隔离；为空时通常表示全局共享定义。 | Owning enterprise/tenant ID. It is the main boundary for multi-enterprise isolation; null commonly means a globally shared definition. |
| 3 | `consistency_domain` | TEXT | 一致性域。当前通常为 enterprise，用于界定 Posting/Replay 的原子一致性范围。 | Consistency scope for Posting/Replay; currently usually the enterprise domain. |
| 4 | `posting_input_id` | UUID/标识 | 本次运行处理的 PostingInput ID。 | PostingInput processed by this run. |
| 5 | `mode` | TEXT 枚举 | 运行模式：NORMAL 或 REPLAY。 | Execution mode: NORMAL or REPLAY. |
| 6 | `metadata_version` | INTEGER/数值 | 解释/记账该数据时使用的元数据版本。 | Metadata version used to interpret/post this business fact. |
| 7 | `status` | TEXT 枚举 | 当前生命周期/执行状态。允许值由本表对应的枚举约束决定。 | Current lifecycle or execution status; allowed values are constrained by the table contract. |
| 8 | `started_at` | TIMESTAMPTZ | 该运行开始执行的时间。 | Time when this execution/run started. |
| 9 | `completed_at` | TIMESTAMPTZ，可空 | 该运行/流程完成的时间；未完成时为空。 | Time when this execution/run completed; null while incomplete. |
| 10 | `error` | JSONB 对象，可空 | 失败时的结构化错误信息。 | Structured failure information for an execution/run. |

## 39. `ledger_entry`

**语义角色 / Semantic Role：DERIVED PROJECTION**  
**当前字段数 / Current Field Count：26**

**中文说明：** 账本分录。它是 BusinessData 经 PostingRule/ValuationRule 得出的派生投影，不是原始业务事实。

**English Description:** Derived ledger projection produced from BusinessData through PostingRule or ValuationRule. It is rebuildable and is not the original business fact.

| # | 字段 / Field | 当前类型 / Current Type | 中文说明 | English Description |
|---:|---|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 | Primary key. Usually a UUID that stably identifies this record. |
| 2 | `enterprise_id` | UUID/标识 | 所属企业/租户 ID。用于多企业隔离；为空时通常表示全局共享定义。 | Owning enterprise/tenant ID. It is the main boundary for multi-enterprise isolation; null commonly means a globally shared definition. |
| 3 | `consistency_domain` | TEXT | 一致性域。当前通常为 enterprise，用于界定 Posting/Replay 的原子一致性范围。 | Consistency scope for Posting/Replay; currently usually the enterprise domain. |
| 4 | `ledger_dataset_id` | UUID/标识 | 关联的账本数据集 ID，用于建立本表与对应对象之间的稳定关系。 | Stable identifier of the related ledger dataset object. |
| 5 | `ledger_definition_id` | UUID/标识 | 关联的账本定义 ID，用于建立本表与对应对象之间的稳定关系。 | Stable identifier of the related ledger definition object. |
| 6 | `posting_run_id` | UUID/标识，可空 | 产生该 LedgerEntry 的 PostingRun；某些估值投影可为空。 | PostingRun that created this entry; valuation-generated entries may use a different source path. |
| 7 | `posting_input_id` | UUID/标识，可空 | 对应的 PostingInput；估值类分录可能通过 valuation posting 产生而为空。 | PostingInput associated with this entry; may be null for valuation-generated entries. |
| 8 | `business_data_id` | UUID/标识 | 该分录最终可追溯到的 BusinessData ID。 | Canonical BusinessData to which this derived ledger entry ultimately traces. |
| 9 | `posting_rule_id` | UUID/标识，可空 | 产生该分录的 PostingRule ID；估值类分录可为空。 | PostingRule that generated this entry; may be null for valuation entries. |
| 10 | `posting_rule_schema_version` | INTEGER/数值 | 产生分录时的 PostingRule 协议/结构版本。 | PostingRule schema/protocol version used to generate the entry. |
| 11 | `effect_index` | INTEGER/数值 | 同一规则可能产生多个 effect，本字段是 effect 的稳定序号。 | Stable index when one rule produces multiple effects. |
| 12 | `quantity` | NUMERIC 高精度数值，可空 | 数量值。使用高精度数值类型，具体业务单位由上下文/unit 决定。 | High-precision quantity value; its business unit is defined by unit/context. |
| 13 | `amount` | NUMERIC 高精度数值，可空 | 金额/价值发生数。不能简单等同于所有场景中的现金流。 | High-precision amount/value occurrence. It must not be assumed to mean cash in every domain. |
| 14 | `unit` | TEXT，可空 | 数量或 Measurement 的计量单位。 | Measurement unit for quantity or another Measurement. |
| 15 | `currency` | TEXT，可空 | 金额表达所使用的货币单位。 | Currency unit used for a monetary amount. |
| 16 | `dimensions` | JSONB 对象 | 结构化维度值，例如仓库、项目、部门等。 | Structured dimension values such as warehouse, project, department, or profit center. |
| 17 | `dimension_hash` | TEXT | 对 dimensions 的稳定摘要，用于高效唯一定位一个维度组合。 | Stable digest of a dimension combination used for efficient identity and lookup. |
| 18 | `effective_at` | TIMESTAMPTZ | 业务或解释在经济意义上的生效时间，与数据库记录时间不同。 | Business/economic effective time. This is intentionally distinct from database recording time. |
| 19 | `posting_priority` | INTEGER/数值 | 同一有效时间下的记账优先级。 | Posting priority used when multiple inputs share the same effective time. |
| 20 | `posting_sequence` | BIGINT | 确定性 Posting 顺序号。重放和成本顺序不能依赖数据库物理插入顺序。 | Deterministic posting order. Replay and costing must not rely on physical database insertion order. |
| 21 | `entry_source_kind` | TEXT 枚举 | 分录来源类型：普通 POSTING 或 VALUATION。 | Source family of the ledger entry: POSTING or VALUATION. |
| 22 | `valuation_posting_run_id` | UUID/标识，可空 | 若分录来自估值差额，关联相应 ValuationPostingRun。 | ValuationPostingRun associated with a valuation-generated entry. |
| 23 | `cost_result_id` | UUID/标识，可空 | 若分录反映成本结果，关联相应 CostResult。 | CostResult reflected by this valuation-generated entry. |
| 24 | `valuation_rule_id` | UUID/标识，可空 | 估值类分录固定使用的 ValuationRule ID。 | ValuationRule ID pinned for this valuation entry. |
| 25 | `valuation_rule_version` | INTEGER/数值，可空 | 估值类分录固定使用的 ValuationRule 版本。 | ValuationRule version pinned for this valuation entry. |
| 26 | `created_at` | TIMESTAMPTZ | 记录创建时间。 | Time when the record was created. |

## 40. `ledger_balance`

**语义角色 / Semantic Role：MATERIALIZATION**  
**当前字段数 / Current Field Count：12**

**中文说明：** 账本当前余额物化。由 LedgerEntry 可确定性重建，主要服务快速查询和工作投影。

**English Description:** Materialized current ledger balance. It is deterministically rebuildable from LedgerEntry and exists primarily for fast query and work projection.

| # | 字段 / Field | 当前类型 / Current Type | 中文说明 | English Description |
|---:|---|---|---|---|
| 1 | `enterprise_id` | UUID/标识 | 所属企业/租户 ID。用于多企业隔离；为空时通常表示全局共享定义。 | Owning enterprise/tenant ID. It is the main boundary for multi-enterprise isolation; null commonly means a globally shared definition. |
| 2 | `consistency_domain` | TEXT | 一致性域。当前通常为 enterprise，用于界定 Posting/Replay 的原子一致性范围。 | Consistency scope for Posting/Replay; currently usually the enterprise domain. |
| 3 | `ledger_dataset_id` | UUID/标识 | 该余额属于哪一代 LedgerDataset。 | Stable identifier of the related ledger dataset object. |
| 4 | `ledger_definition_id` | UUID/标识 | 该余额属于哪个 LedgerDefinition。 | Stable identifier of the related ledger definition object. |
| 5 | `dimension_hash` | TEXT | 对 dimensions 的稳定摘要，用于高效唯一定位一个维度组合。 | Stable digest of a dimension combination used for efficient identity and lookup. |
| 6 | `dimensions` | JSONB 对象 | 结构化维度值，例如仓库、项目、部门等。 | Structured dimension values such as warehouse, project, department, or profit center. |
| 7 | `quantity` | NUMERIC 高精度数值 | 数量值。使用高精度数值类型，具体业务单位由上下文/unit 决定。 | High-precision quantity value; its business unit is defined by unit/context. |
| 8 | `amount` | NUMERIC 高精度数值 | 金额/价值发生数。不能简单等同于所有场景中的现金流。 | High-precision amount/value occurrence. It must not be assumed to mean cash in every domain. |
| 9 | `last_effective_at` | TIMESTAMPTZ | 构成当前余额的最后一条 LedgerEntry 的业务有效时间。 | Timestamp associated with last effective at in this table's lifecycle or business context. |
| 10 | `last_posting_priority` | INTEGER/数值 | 构成当前余额的最后 PostingPriority。 | Current last posting priority attribute of this table; its exact constraints are defined by the current schema and module contract. |
| 11 | `last_posting_sequence` | BIGINT | 构成当前余额的最后 PostingSequence。 | Current last posting sequence attribute of this table; its exact constraints are defined by the current schema and module contract. |
| 12 | `updated_at` | TIMESTAMPTZ | 记录最近一次更新/物化刷新时间。 | Time when the record or materialized state was last updated. |

## 41. `posting_failure`

**语义角色 / Semantic Role：EXECUTION/AUDIT**  
**当前字段数 / Current Field Count：8**

**中文说明：** 记账失败记录。保存错误代码、上下文及是否可重试，支持诊断和恢复。

**English Description:** Posting failure audit record containing stable error code, message, context, and retryability.

| # | 字段 / Field | 当前类型 / Current Type | 中文说明 | English Description |
|---:|---|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 | Primary key. Usually a UUID that stably identifies this record. |
| 2 | `enterprise_id` | UUID/标识 | 所属企业/租户 ID。用于多企业隔离；为空时通常表示全局共享定义。 | Owning enterprise/tenant ID. It is the main boundary for multi-enterprise isolation; null commonly means a globally shared definition. |
| 3 | `posting_input_id` | UUID/标识 | 失败对应的 PostingInput ID。 | Stable identifier of the related posting input object. |
| 4 | `error_code` | TEXT | 稳定的错误代码，便于程序判断与统计。 | Stable machine-readable error code. |
| 5 | `error_message` | TEXT | 面向诊断的错误说明。 | Human-readable diagnostic message. |
| 6 | `error_context` | JSONB 对象 | 失败发生时的结构化上下文。 | Structured context captured when the failure occurred. |
| 7 | `retryable` | BOOLEAN | 该失败是否允许自动/人工重试。 | Whether this failure is eligible for retry. |
| 8 | `created_at` | TIMESTAMPTZ | 记录创建时间。 | Time when the record was created. |


# 分配与头寸 / Allocation & Positions

## 42. `allocation_policy`

**语义角色 / Semantic Role：VERSIONED POLICY**  
**当前字段数 / Current Field Count：15**

**中文说明：** 来源分配策略。定义可选来源范围、排序、是否允许部分分配、负头寸策略、精度与残差规则。

**English Description:** Versioned source-allocation policy. It defines eligible sources, ordering, partial-allocation behavior, negative-position policy, precision, and residual handling.

| # | 字段 / Field | 当前类型 / Current Type | 中文说明 | English Description |
|---:|---|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 | Primary key. Usually a UUID that stably identifies this record. |
| 2 | `enterprise_id` | UUID/标识，可空 | 所属企业/租户 ID。用于多企业隔离；为空时通常表示全局共享定义。 | Owning enterprise/tenant ID. It is the main boundary for multi-enterprise isolation; null commonly means a globally shared definition. |
| 3 | `code` | TEXT | 稳定、机器可读的业务代码。通常用于配置、API、模板和规则引用，不应随显示名称随意改变。 | Stable machine-readable business code used by configuration, APIs, templates, and rules. |
| 4 | `name` | TEXT | 面向人的显示名称。 | Human-readable display name. |
| 5 | `version` | INTEGER/数值 | 定义/数据集的版本号。版本发布后通常不应原地修改语义。 | Version number of a definition or dataset. Published semantic versions should not be modified in place. |
| 6 | `status` | TEXT 枚举 | 当前生命周期/执行状态。允许值由本表对应的枚举约束决定。 | Current lifecycle or execution status; allowed values are constrained by the table contract. |
| 7 | `dimensions` | JSONB 数组 | 结构化维度值，例如仓库、项目、部门等。 | Structured dimension values such as warehouse, project, department, or profit center. |
| 8 | `eligibility` | JSONB 对象 | 哪些来源有资格参与本政策分配的规则。 | Rules defining which candidate sources are eligible under this policy. |
| 9 | `source_ordering` | TEXT 枚举 | 自动选择来源时的顺序策略，例如最老优先、最新优先或显式来源。 | Ordering policy used when automatically choosing eligible allocation sources. |
| 10 | `allow_partial_allocation` | BOOLEAN | 是否允许一个来源只被部分消费/一个目标由多个来源共同满足。 | Whether a source may be partially consumed and/or a consumer may be satisfied by multiple sources. |
| 11 | `negative_position_policy` | TEXT 枚举 | 来源不足时如何处理负头寸/暂估状态的政策。 | Policy describing behavior when eligible sources are insufficient or a negative position would result. |
| 12 | `precision_policy` | JSONB 对象 | 分配计算的精度、舍入和尾差处理政策。 | Precision, rounding, and residual-closure policy for allocation calculations. |
| 13 | `config` | JSONB 对象 | 可扩展配置 JSON。保存尚不值得固化为独立列、但仍需要版本化治理的参数。 | Extensible JSON configuration for parameters that remain governed but do not yet require dedicated relational columns. |
| 14 | `created_at` | TIMESTAMPTZ | 记录创建时间。 | Time when the record was created. |
| 15 | `published_at` | TIMESTAMPTZ，可空 | 该版本被正式发布、生效的时间。 | Time when this version was formally published/activated. |

## 43. `allocation_instruction`

**语义角色 / Semantic Role：CANONICAL INSTRUCTION**  
**当前字段数 / Current Field Count：15**

**中文说明：** 显式分配意图/约束。保存人或自动化系统明确指定“这笔业务要消费哪个来源”的业务证据。

**English Description:** Canonical explicit allocation intent/constraint. It preserves a business decision such as which source a settlement or consumption must use.

| # | 字段 / Field | 当前类型 / Current Type | 中文说明 | English Description |
|---:|---|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 | Primary key. Usually a UUID that stably identifies this record. |
| 2 | `enterprise_id` | UUID/标识 | 所属企业/租户 ID。用于多企业隔离；为空时通常表示全局共享定义。 | Owning enterprise/tenant ID. It is the main boundary for multi-enterprise isolation; null commonly means a globally shared definition. |
| 3 | `consumer_business_data_id` | UUID/标识 | 要消费/核销来源的目标 BusinessData ID。 | Target/consumer BusinessData that must consume or settle one or more sources. |
| 4 | `mode` | TEXT 枚举 | 分配模式：纯显式、纯自动，或先显式再自动补足。 | Allocation mode: explicit only, automatic only, or explicit first then automatic remainder. |
| 5 | `source_selector` | JSONB 对象 | 选择分配来源的显式选择器，例如指定 BusinessData、Position 或维度查询。 | Explicit selector for allocation sources, such as BusinessData, Position, or other governed selection criteria. |
| 6 | `actor_type` | TEXT 枚举 | 发起者类型，例如 HUMAN、AI、AUTOMATION、EXTERNAL_SYSTEM。 | Type of initiating actor, such as HUMAN, AI, AUTOMATION, or EXTERNAL_SYSTEM. |
| 7 | `actor_id` | TEXT/标识 | 发起者在其类型命名空间中的标识。 | Identifier of the initiating actor within its actor namespace. |
| 8 | `effective_at` | TIMESTAMPTZ | 业务或解释在经济意义上的生效时间，与数据库记录时间不同。 | Business/economic effective time. This is intentionally distinct from database recording time. |
| 9 | `recorded_at` | TIMESTAMPTZ | 系统接受/记录该指令的时间。 | Time when the system accepted/recorded this instruction. |
| 10 | `reason` | TEXT，可空 | 创建该指令、绑定或变更的业务原因说明。 | Human/business explanation for creating, binding, superseding, or changing this record. |
| 11 | `allocation_policy_id` | UUID/标识 | 本指令要求使用的 AllocationPolicy ID。 | AllocationPolicy ID explicitly pinned by this instruction. |
| 12 | `allocation_policy_version` | INTEGER/数值 | 本指令固定使用的 AllocationPolicy 版本。 | AllocationPolicy version explicitly pinned by this instruction. |
| 13 | `supersedes_instruction_id` | UUID/标识，可空 | 本指令用于更正/替代的上一条 AllocationInstruction；历史不原地修改。 | Previous AllocationInstruction superseded/corrected by this new additive instruction. |
| 14 | `idempotency_key` | TEXT | 幂等键。相同作用域内重复提交相同意图时用于避免重复执行。 | Idempotency key used to prevent duplicate execution of the same intent within its scope. |
| 15 | `metadata` | JSONB 对象 | 补充元数据；不承担主业务语义。 | Supplemental metadata that does not carry the primary business meaning. |

## 44. `allocation_run`

**语义角色 / Semantic Role：EXECUTION/AUDIT**  
**当前字段数 / Current Field Count：9**

**中文说明：** 一次分配计算运行记录。固定 AllocationPolicy 版本和输入摘要，记录运行状态。

**English Description:** Audit record for one allocation calculation. It pins the AllocationPolicy version, input digest, status, and execution timestamps.

| # | 字段 / Field | 当前类型 / Current Type | 中文说明 | English Description |
|---:|---|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 | Primary key. Usually a UUID that stably identifies this record. |
| 2 | `enterprise_id` | UUID/标识 | 所属企业/租户 ID。用于多企业隔离；为空时通常表示全局共享定义。 | Owning enterprise/tenant ID. It is the main boundary for multi-enterprise isolation; null commonly means a globally shared definition. |
| 3 | `allocation_policy_id` | UUID/标识 | 本次分配运行实际使用的 AllocationPolicy ID。 | AllocationPolicy ID used by this run. |
| 4 | `allocation_policy_version` | INTEGER/数值 | 本次分配运行实际固定的 AllocationPolicy 版本。 | AllocationPolicy version pinned by this run. |
| 5 | `input_digest` | TEXT | 本次计算输入集合的确定性摘要，用于幂等、审计和重放一致性证明。 | Deterministic digest of the inputs to this execution, used for idempotency, audit, and replay consistency. |
| 6 | `status` | TEXT 枚举 | 当前生命周期/执行状态。允许值由本表对应的枚举约束决定。 | Current lifecycle or execution status; allowed values are constrained by the table contract. |
| 7 | `started_at` | TIMESTAMPTZ | 该运行开始执行的时间。 | Time when this execution/run started. |
| 8 | `completed_at` | TIMESTAMPTZ，可空 | 该运行/流程完成的时间；未完成时为空。 | Time when this execution/run completed; null while incomplete. |
| 9 | `error` | JSONB 对象，可空 | 失败时的结构化错误信息。 | Structured failure information for an execution/run. |

## 45. `allocation_relation`

**语义角色 / Semantic Role：DERIVED RESULT**  
**当前字段数 / Current Field Count：13**

**中文说明：** 实际计算出的来源→消费方关系边。它是可重建的派生结果，不等同于人工 AllocationInstruction。

**English Description:** Derived source-to-consumer allocation edge calculated from instructions and/or policy. It is rebuildable and is not the same thing as AllocationInstruction.

| # | 字段 / Field | 当前类型 / Current Type | 中文说明 | English Description |
|---:|---|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 | Primary key. Usually a UUID that stably identifies this record. |
| 2 | `enterprise_id` | UUID/标识 | 所属企业/租户 ID。用于多企业隔离；为空时通常表示全局共享定义。 | Owning enterprise/tenant ID. It is the main boundary for multi-enterprise isolation; null commonly means a globally shared definition. |
| 3 | `allocation_run_id` | UUID/标识 | 生成该分配边的 AllocationRun ID。 | AllocationRun that produced this derived allocation edge. |
| 4 | `source_business_data_id` | UUID/标识，可空 | 被消费的来源 BusinessData；使用 Position 来源时可以为空。 | Source BusinessData being consumed; null when the source is represented by a Position. |
| 5 | `source_position_key` | TEXT，可空 | 被消费的来源 Position 稳定键；使用 BusinessData 来源时可以为空。 | Source Position key being consumed; null when a BusinessData source is used directly. |
| 6 | `consumer_business_data_id` | UUID/标识 | 消费来源的目标 BusinessData ID。 | Target BusinessData consuming/settling the source. |
| 7 | `measurements` | JSONB 数组 | 该分配边实际承载的数量/金额等 Measurement 数组。 | Measurements carried by this allocation relation, such as allocated quantity and/or amount. |
| 8 | `allocation_sequence` | INTEGER/数值 | 同一次 AllocationRun 内分配边的确定性顺序。 | Deterministic sequence of this allocation edge within an AllocationRun. |
| 9 | `instruction_id` | UUID/标识，可空 | 若本分配来自显式业务意图，这里关联 AllocationInstruction；纯自动分配可为空。 | AllocationInstruction that explicitly authorized/constrained this relation; may be null for purely automatic allocation. |
| 10 | `allocation_policy_id` | UUID/标识 | 关联的分配政策 ID，用于建立本表与对应对象之间的稳定关系。 | Stable identifier of the related allocation policy object. |
| 11 | `allocation_policy_version` | INTEGER/数值 | 固定使用的分配政策版本号，避免运行时隐式读取“最新版本”。 | Pinned version number of the related allocation policy; it prevents implicit use of a mutable “latest” version. |
| 12 | `lineage` | JSONB 对象 | 来源、版本、执行路径等血缘信息。 | Structured provenance and execution lineage information. |
| 13 | `created_at` | TIMESTAMPTZ | 记录创建时间。 | Time when the record was created. |

## 46. `position_definition`

**语义角色 / Semantic Role：VERSIONED DEFINITION**  
**当前字段数 / Current Field Count：12**

**中文说明：** Position 的定义。描述从哪些 BusinessData、哪些字段和维度重建某类开放/剩余经济头寸。

**English Description:** Versioned definition of an economic Position. It defines which BusinessData contributes to the position and how dimensions and measurements are reconstructed.

| # | 字段 / Field | 当前类型 / Current Type | 中文说明 | English Description |
|---:|---|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 | Primary key. Usually a UUID that stably identifies this record. |
| 2 | `enterprise_id` | UUID/标识，可空 | 所属企业/租户 ID。用于多企业隔离；为空时通常表示全局共享定义。 | Owning enterprise/tenant ID. It is the main boundary for multi-enterprise isolation; null commonly means a globally shared definition. |
| 3 | `code` | TEXT | 稳定、机器可读的业务代码。通常用于配置、API、模板和规则引用，不应随显示名称随意改变。 | Stable machine-readable business code used by configuration, APIs, templates, and rules. |
| 4 | `name` | TEXT | 面向人的显示名称。 | Human-readable display name. |
| 5 | `version` | INTEGER/数值 | 定义/数据集的版本号。版本发布后通常不应原地修改语义。 | Version number of a definition or dataset. Published semantic versions should not be modified in place. |
| 6 | `status` | TEXT 枚举 | 当前生命周期/执行状态。允许值由本表对应的枚举约束决定。 | Current lifecycle or execution status; allowed values are constrained by the table contract. |
| 7 | `semantic_digest` | TEXT | 对该版本的语义内容计算的稳定摘要，用于检测同一版本发生内容漂移。 | Deterministic digest of semantic content used to detect semantic drift within a supposedly identical version. |
| 8 | `dimensions` | JSONB 数组 | 构成 Position 身份/分组键的维度映射数组。 | Dimension mappings that form Position identity/grouping. |
| 9 | `source_rules` | JSONB 数组 | 声明哪些 BusinessData 如何增加/减少 Position，以及从哪些字段取得 Measurements。 | Rules describing which BusinessData increases/decreases the Position and how measurements are extracted. |
| 10 | `config` | JSONB 对象 | 可扩展配置 JSON。保存尚不值得固化为独立列、但仍需要版本化治理的参数。 | Extensible JSON configuration for parameters that remain governed but do not yet require dedicated relational columns. |
| 11 | `created_at` | TIMESTAMPTZ | 记录创建时间。 | Time when the record was created. |
| 12 | `published_at` | TIMESTAMPTZ，可空 | 该版本被正式发布、生效的时间。 | Time when this version was formally published/activated. |


# 参考数据 / Reference Data

## 47. `rate_dataset`

**语义角色 / Semantic Role：VERSIONED REFERENCE DATA**  
**当前字段数 / Current Field Count：10**

**中文说明：** 一组不可变汇率/转换率数据集的版本身份和摘要。运行时必须 pin 到具体 dataset/version/digest。

**English Description:** Immutable version identity for a set of exchange/conversion rates. Runtime interpretation must pin dataset ID, version, and digest.

| # | 字段 / Field | 当前类型 / Current Type | 中文说明 | English Description |
|---:|---|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 | Primary key. Usually a UUID that stably identifies this record. |
| 2 | `enterprise_id` | UUID/标识，可空 | 所属企业/租户 ID。用于多企业隔离；为空时通常表示全局共享定义。 | Owning enterprise/tenant ID. It is the main boundary for multi-enterprise isolation; null commonly means a globally shared definition. |
| 3 | `code` | TEXT | 稳定、机器可读的业务代码。通常用于配置、API、模板和规则引用，不应随显示名称随意改变。 | Stable machine-readable business code used by configuration, APIs, templates, and rules. |
| 4 | `version` | INTEGER/数值 | 定义/数据集的版本号。版本发布后通常不应原地修改语义。 | Version number of a definition or dataset. Published semantic versions should not be modified in place. |
| 5 | `status` | TEXT 枚举 | 当前生命周期/执行状态。允许值由本表对应的枚举约束决定。 | Current lifecycle or execution status; allowed values are constrained by the table contract. |
| 6 | `provider` | TEXT | 参考数据提供方/来源。 | Provider/source of reference data. |
| 7 | `semantic_digest` | TEXT | 对该版本的语义内容计算的稳定摘要，用于检测同一版本发生内容漂移。 | Deterministic digest of semantic content used to detect semantic drift within a supposedly identical version. |
| 8 | `config` | JSONB 对象 | 可扩展配置 JSON。保存尚不值得固化为独立列、但仍需要版本化治理的参数。 | Extensible JSON configuration for parameters that remain governed but do not yet require dedicated relational columns. |
| 9 | `created_at` | TIMESTAMPTZ | 记录创建时间。 | Time when the record was created. |
| 10 | `published_at` | TIMESTAMPTZ，可空 | 该版本被正式发布、生效的时间。 | Time when this version was formally published/activated. |

## 48. `rate_observation`

**语义角色 / Semantic Role：REFERENCE DATA**  
**当前字段数 / Current Field Count：14**

**中文说明：** RateDataset 中的具体汇率观测值，区分交易确认、结算、期末重估、报告换算等 rate role。

**English Description:** Individual rate observation inside a RateDataset, with an explicit semantic role such as transaction recognition, settlement, period-end valuation, or reporting conversion.

| # | 字段 / Field | 当前类型 / Current Type | 中文说明 | English Description |
|---:|---|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 | Primary key. Usually a UUID that stably identifies this record. |
| 2 | `enterprise_id` | UUID/标识，可空 | 所属企业/租户 ID。用于多企业隔离；为空时通常表示全局共享定义。 | Owning enterprise/tenant ID. It is the main boundary for multi-enterprise isolation; null commonly means a globally shared definition. |
| 3 | `rate_dataset_id` | UUID/标识 | 所属不可变 RateDataset ID。 | RateDataset containing this observation. |
| 4 | `rate_dataset_version` | INTEGER/数值 | 所属 RateDataset 的固定版本。 | Pinned version of the containing RateDataset. |
| 5 | `role` | TEXT 枚举 | 该 RateObservation 的语义角色，例如交易确认、结算或期末重估。 | Semantic role of this rate observation, such as transaction recognition, settlement, period-end valuation, or reporting conversion. |
| 6 | `source_unit` | TEXT | 换算前的单位/币种。 | Source unit/currency of the rate conversion. |
| 7 | `target_unit` | TEXT | 换算后的单位/币种。 | Target unit/currency of the rate conversion. |
| 8 | `convention` | TEXT 枚举 | 汇率报价约定；当前 TARGET_PER_SOURCE 表示每 1 source 对应多少 target。 | Rate quotation convention; TARGET_PER_SOURCE means target units per one source unit. |
| 9 | `rate` | NUMERIC 高精度数值 | 具体换算率/汇率。 | Observed conversion/exchange rate. |
| 10 | `effective_at` | TIMESTAMPTZ | 业务或解释在经济意义上的生效时间，与数据库记录时间不同。 | Business/economic effective time. This is intentionally distinct from database recording time. |
| 11 | `provider` | TEXT | 参考数据提供方/来源。 | Provider/source of reference data. |
| 12 | `precision` | INTEGER/数值 | 该参考率允许/声明的精度位数。 | Declared precision of the reference rate. |
| 13 | `metadata` | JSONB 对象 | 补充元数据；不承担主业务语义。 | Supplemental metadata that does not carry the primary business meaning. |
| 14 | `created_at` | TIMESTAMPTZ | 记录创建时间。 | Time when the record was created. |


# 成本与估值 / Cost & Valuation

## 49. `valuation_rule`

**语义角色 / Semantic Role：VERSIONED DEFINITION**  
**当前字段数 / Current Field Count：12**

**中文说明：** 把 CostResult 投影到账本的估值记账规则，定义业务数据类型、库存/成本账本及维度映射。

**English Description:** Rule that projects CostResult into ledger effects, including source BusinessData type, target inventory/COGS ledgers, and dimension mapping.

| # | 字段 / Field | 当前类型 / Current Type | 中文说明 | English Description |
|---:|---|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 | Primary key. Usually a UUID that stably identifies this record. |
| 2 | `enterprise_id` | UUID/标识，可空 | 所属企业/租户 ID。用于多企业隔离；为空时通常表示全局共享定义。 | Owning enterprise/tenant ID. It is the main boundary for multi-enterprise isolation; null commonly means a globally shared definition. |
| 3 | `code` | TEXT | 稳定、机器可读的业务代码。通常用于配置、API、模板和规则引用，不应随显示名称随意改变。 | Stable machine-readable business code used by configuration, APIs, templates, and rules. |
| 4 | `name` | TEXT | 面向人的显示名称。 | Human-readable display name. |
| 5 | `source_business_data_type` | TEXT | 该估值规则适用的 BusinessData 类型。 | BusinessData type to which this valuation rule applies. |
| 6 | `inventory_ledger_code` | TEXT | 估值调整涉及的库存/资产账本代码。 | Inventory/asset ledger code affected by valuation posting. |
| 7 | `cogs_ledger_code` | TEXT | 估值调整涉及的成本/损益账本代码。 | Cost/expense ledger code affected by valuation posting. |
| 8 | `dimension_mapping` | JSONB 对象 | 定义来源字段如何映射到目标维度。 | Mapping from source fields to target dimensions. |
| 9 | `version` | INTEGER/数值 | 定义/数据集的版本号。版本发布后通常不应原地修改语义。 | Version number of a definition or dataset. Published semantic versions should not be modified in place. |
| 10 | `status` | TEXT 枚举 | 当前生命周期/执行状态。允许值由本表对应的枚举约束决定。 | Current lifecycle or execution status; allowed values are constrained by the table contract. |
| 11 | `created_at` | TIMESTAMPTZ | 记录创建时间。 | Time when the record was created. |
| 12 | `published_at` | TIMESTAMPTZ，可空 | 该版本被正式发布、生效的时间。 | Time when this version was formally published/activated. |

## 50. `valuation_policy`

**语义角色 / Semantic Role：VERSIONED POLICY**  
**当前字段数 / Current Field Count：11**

**中文说明：** 成本计价政策，例如 FIFO、LIFO、移动平均、个别计价及其 pool grain、负库存等配置。

**English Description:** Versioned cost valuation policy such as FIFO, LIFO, moving average, or specific identification, including pool grain and negative-inventory behavior.

| # | 字段 / Field | 当前类型 / Current Type | 中文说明 | English Description |
|---:|---|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 | Primary key. Usually a UUID that stably identifies this record. |
| 2 | `enterprise_id` | UUID/标识，可空 | 所属企业/租户 ID。用于多企业隔离；为空时通常表示全局共享定义。 | Owning enterprise/tenant ID. It is the main boundary for multi-enterprise isolation; null commonly means a globally shared definition. |
| 3 | `code` | TEXT | 稳定、机器可读的业务代码。通常用于配置、API、模板和规则引用，不应随显示名称随意改变。 | Stable machine-readable business code used by configuration, APIs, templates, and rules. |
| 4 | `name` | TEXT | 面向人的显示名称。 | Human-readable display name. |
| 5 | `method` | TEXT 枚举 | 成本计价方法：FIFO、LIFO、MOVING_AVERAGE 或 SPECIFIC_IDENTIFICATION。 | Cost valuation method: FIFO, LIFO, MOVING_AVERAGE, or SPECIFIC_IDENTIFICATION. |
| 6 | `negative_inventory_policy` | TEXT 枚举 | 成本运行遇到负库存时的政策；当前只允许 DISALLOW_NEGATIVE。 | Costing behavior for negative inventory; currently DISALLOW_NEGATIVE. |
| 7 | `pool_dimension_schema` | JSONB 对象 | 成本池按哪些维度划分，例如 warehouse + productId。 | Dimensions defining cost-pool grain, for example warehouse + productId. |
| 8 | `config` | JSONB 对象 | 可扩展配置 JSON。保存尚不值得固化为独立列、但仍需要版本化治理的参数。 | Extensible JSON configuration for parameters that remain governed but do not yet require dedicated relational columns. |
| 9 | `version` | INTEGER/数值 | 定义/数据集的版本号。版本发布后通常不应原地修改语义。 | Version number of a definition or dataset. Published semantic versions should not be modified in place. |
| 10 | `status` | TEXT 枚举 | 当前生命周期/执行状态。允许值由本表对应的枚举约束决定。 | Current lifecycle or execution status; allowed values are constrained by the table contract. |
| 11 | `created_at` | TIMESTAMPTZ | 记录创建时间。 | Time when the record was created. |

## 51. `valuation_posting_run`

**语义角色 / Semantic Role：EXECUTION/AUDIT**  
**当前字段数 / Current Field Count：14**

**中文说明：** 把 CostResult 的目标价值与账本当前已反映价值比较并产生差额分录的一次估值过账运行。

**English Description:** Audit record for applying the difference between a target CostResult and the value already reflected in the ledger.

| # | 字段 / Field | 当前类型 / Current Type | 中文说明 | English Description |
|---:|---|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 | Primary key. Usually a UUID that stably identifies this record. |
| 2 | `enterprise_id` | UUID/标识 | 所属企业/租户 ID。用于多企业隔离；为空时通常表示全局共享定义。 | Owning enterprise/tenant ID. It is the main boundary for multi-enterprise isolation; null commonly means a globally shared definition. |
| 3 | `cost_run_id` | UUID/标识 | 来源 CostRun ID。 | Stable identifier of the related cost run object. |
| 4 | `cost_result_id` | UUID/标识 | 本次估值过账针对的 CostResult ID。 | Stable identifier of the related cost result object. |
| 5 | `business_data_id` | UUID/标识 | 成本对应的业务事实 ID。 | Stable identifier of the related business data object. |
| 6 | `valuation_rule_id` | UUID/标识 | 本次差额过账使用的 ValuationRule ID。 | Stable identifier of the related valuation rule object. |
| 7 | `valuation_rule_version` | INTEGER/数值 | 本次差额过账固定的 ValuationRule 版本。 | Pinned version number of the related valuation rule; it prevents implicit use of a mutable “latest” version. |
| 8 | `previous_total_cost` | NUMERIC 高精度数值 | 估值过账前账本已经反映的总成本。 | Current previous total cost attribute of this table; its exact constraints are defined by the current schema and module contract. |
| 9 | `target_total_cost` | NUMERIC 高精度数值 | 当前 CostResult 要求账本最终反映的目标总成本。 | Current target total cost attribute of this table; its exact constraints are defined by the current schema and module contract. |
| 10 | `delta_total_cost` | NUMERIC 高精度数值 | 本次估值过账需要追加的差额。 | Current delta total cost attribute of this table; its exact constraints are defined by the current schema and module contract. |
| 11 | `status` | TEXT 枚举 | 当前生命周期/执行状态。允许值由本表对应的枚举约束决定。 | Current lifecycle or execution status; allowed values are constrained by the table contract. |
| 12 | `created_at` | TIMESTAMPTZ | 记录创建时间。 | Time when the record was created. |
| 13 | `completed_at` | TIMESTAMPTZ，可空 | 该运行/流程完成的时间；未完成时为空。 | Time when this execution/run completed; null while incomplete. |
| 14 | `error` | JSONB 对象，可空 | 失败时的结构化错误信息。 | Structured failure information for an execution/run. |

## 52. `valuation_position`

**语义角色 / Semantic Role：MATERIALIZATION**  
**当前字段数 / Current Field Count：7**

**中文说明：** 某 BusinessData 当前已反映的成本/估值位置，用于幂等地计算后续 valuation delta。

**English Description:** Materialized current valuation state for a BusinessData/ValuationRule pair, used to calculate idempotent valuation deltas.

| # | 字段 / Field | 当前类型 / Current Type | 中文说明 | English Description |
|---:|---|---|---|---|
| 1 | `enterprise_id` | UUID/标识 | 所属企业/租户 ID。用于多企业隔离；为空时通常表示全局共享定义。 | Owning enterprise/tenant ID. It is the main boundary for multi-enterprise isolation; null commonly means a globally shared definition. |
| 2 | `business_data_id` | UUID/标识 | 当前估值位置对应的 BusinessData ID。 | BusinessData whose reflected valuation state is materialized here. |
| 3 | `valuation_rule_id` | UUID/标识 | 当前物化状态使用的 ValuationRule ID。 | ValuationRule ID governing this materialized valuation position. |
| 4 | `valuation_rule_version` | INTEGER/数值 | 当前物化状态固定的 ValuationRule 版本。 | Pinned ValuationRule version of this materialized valuation position. |
| 5 | `total_cost` | NUMERIC 高精度数值 | 当前已经被估值/过账体系反映的总成本。 | Total cost/value currently reflected by the valuation-posting layer. |
| 6 | `last_cost_result_id` | UUID/标识 | 形成当前 total_cost 的最近 CostResult ID。 | Most recent CostResult that established the current total_cost. |
| 7 | `updated_at` | TIMESTAMPTZ | 记录最近一次更新/物化刷新时间。 | Time when the record or materialized state was last updated. |

## 53. `valuation_run`

**语义角色 / Semantic Role：EXECUTION/AUDIT**  
**当前字段数 / Current Field Count：14**

**中文说明：** 一次通用估值运行记录，例如 FX 期末重估或已实现汇兑。可追溯到 canonical valuation.requested。

**English Description:** Audit record for a general valuation interpretation such as FX period-end revaluation or realized FX settlement. It can link back to canonical valuation.requested BusinessData.

| # | 字段 / Field | 当前类型 / Current Type | 中文说明 | English Description |
|---:|---|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 | Primary key. Usually a UUID that stably identifies this record. |
| 2 | `enterprise_id` | UUID/标识 | 所属企业/租户 ID。用于多企业隔离；为空时通常表示全局共享定义。 | Owning enterprise/tenant ID. It is the main boundary for multi-enterprise isolation; null commonly means a globally shared definition. |
| 3 | `request_business_data_id` | UUID/标识，可空 | 触发本次估值解释的 canonical valuation.requested BusinessData ID；技术性直接调用可为空。 | Canonical valuation.requested BusinessData that authorized/parameterized this ValuationRun. |
| 4 | `valuation_kind` | TEXT | 估值运行类别，例如 FX_PERIOD_END、FX_REALIZED_SETTLEMENT。 | Valuation interpretation family, for example FX_PERIOD_END or FX_REALIZED_SETTLEMENT. |
| 5 | `effective_at` | TIMESTAMPTZ | 业务或解释在经济意义上的生效时间，与数据库记录时间不同。 | Business/economic effective time. This is intentionally distinct from database recording time. |
| 6 | `input_digest` | TEXT | 本次估值解释的确定性输入摘要。 | Deterministic digest of the inputs to this execution, used for idempotency, audit, and replay consistency. |
| 7 | `rate_dataset_id` | UUID/标识，可空 | 本次运行或观测所属的 RateDataset ID。 | Stable identifier of the related rate dataset object. |
| 8 | `rate_dataset_version` | INTEGER/数值，可空 | 固定使用的 RateDataset 版本。 | Pinned version number of the related rate dataset; it prevents implicit use of a mutable “latest” version. |
| 9 | `rate_dataset_digest` | TEXT，可空 | 固定 RateDataset 的内容摘要，防止同一版本被静默改写。 | Deterministic digest for rate dataset digest used for drift detection, idempotency, or replay verification. |
| 10 | `policy` | JSONB 对象 | 本次运行实际使用的政策参数快照。 | Current policy attribute of this table; its exact constraints are defined by the current schema and module contract. |
| 11 | `status` | TEXT 枚举 | 当前生命周期/执行状态。允许值由本表对应的枚举约束决定。 | Current lifecycle or execution status; allowed values are constrained by the table contract. |
| 12 | `started_at` | TIMESTAMPTZ | 该运行开始执行的时间。 | Time when this execution/run started. |
| 13 | `completed_at` | TIMESTAMPTZ，可空 | 该运行/流程完成的时间；未完成时为空。 | Time when this execution/run completed; null while incomplete. |
| 14 | `error` | JSONB 对象，可空 | 失败时的结构化错误信息。 | Structured failure information for an execution/run. |

## 54. `valuation_result`

**语义角色 / Semantic Role：DERIVED RESULT**  
**当前字段数 / Current Field Count：13**

**中文说明：** 通用估值运行的派生结果，保存来源事实、输入/输出 Measurements、估值差额及 lineage。

**English Description:** Derived result of a ValuationRun, including source facts, source/target measurements, value delta, dimensions, and lineage.

| # | 字段 / Field | 当前类型 / Current Type | 中文说明 | English Description |
|---:|---|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 | Primary key. Usually a UUID that stably identifies this record. |
| 2 | `enterprise_id` | UUID/标识 | 所属企业/租户 ID。用于多企业隔离；为空时通常表示全局共享定义。 | Owning enterprise/tenant ID. It is the main boundary for multi-enterprise isolation; null commonly means a globally shared definition. |
| 3 | `valuation_run_id` | UUID/标识 | 生成该结果的 ValuationRun ID。 | ValuationRun that produced this derived result. |
| 4 | `result_kind` | TEXT | 结果类别，通常与 ValuationRun 的语义家族对应。 | Type/category discriminator for result kind. |
| 5 | `position_key` | TEXT | 被估值的经济 Position 稳定键。 | Stable identity of the economic Position being valued. |
| 6 | `source_business_data_ids` | JSONB 数组 | 参与本次估值/推导的 BusinessData ID 集合。 | IDs of canonical BusinessData facts participating in this valuation/derivation. |
| 7 | `dimensions` | JSONB 对象 | 结构化维度值，例如仓库、项目、部门等。 | Structured dimension values such as warehouse, project, department, or profit center. |
| 8 | `source_measurements` | JSONB 数组 | 估值/计算前的输入 Measurements 数组。 | Input Measurements used by a valuation/calculation. |
| 9 | `target_measurements` | JSONB 数组 | 估值/计算后的目标 Measurements 数组。 | Output/target Measurements produced by a valuation/calculation. |
| 10 | `delta_amount` | NUMERIC 高精度数值 | 估值前后产生的价值差额。 | Value difference produced by a valuation result. |
| 11 | `delta_unit` | TEXT | delta_amount 的单位/币种。 | Unit/currency of delta_amount. |
| 12 | `lineage` | JSONB 对象 | 来源、版本、执行路径等血缘信息。 | Structured provenance and execution lineage information. |
| 13 | `created_at` | TIMESTAMPTZ | 记录创建时间。 | Time when the record was created. |

## 55. `cost_run`

**语义角色 / Semantic Role：EXECUTION/AUDIT**  
**当前字段数 / Current Field Count：12**

**中文说明：** 一次成本计算运行。固定成本方法、ValuationPolicy、AllocationPolicy 和成本引擎版本。

**English Description:** Audit record for one cost calculation, pinning cost method, ValuationPolicy, AllocationPolicy, and cost-engine version.

| # | 字段 / Field | 当前类型 / Current Type | 中文说明 | English Description |
|---:|---|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 | Primary key. Usually a UUID that stably identifies this record. |
| 2 | `enterprise_id` | UUID/标识 | 所属企业/租户 ID。用于多企业隔离；为空时通常表示全局共享定义。 | Owning enterprise/tenant ID. It is the main boundary for multi-enterprise isolation; null commonly means a globally shared definition. |
| 3 | `method` | TEXT 枚举 | 成本计价方法或其他表内定义的方法类型。 | Current method attribute of this table; its exact constraints are defined by the current schema and module contract. |
| 4 | `status` | TEXT 枚举 | 当前生命周期/执行状态。允许值由本表对应的枚举约束决定。 | Current lifecycle or execution status; allowed values are constrained by the table contract. |
| 5 | `started_at` | TIMESTAMPTZ | 该运行开始执行的时间。 | Time when this execution/run started. |
| 6 | `completed_at` | TIMESTAMPTZ，可空 | 该运行/流程完成的时间；未完成时为空。 | Time when this execution/run completed; null while incomplete. |
| 7 | `error` | JSONB 对象，可空 | 失败时的结构化错误信息。 | Structured failure information for an execution/run. |
| 8 | `valuation_policy_id` | UUID/标识，可空 | 本次 CostRun 固定使用的 ValuationPolicy ID。 | Stable identifier of the related valuation policy object. |
| 9 | `valuation_policy_version` | INTEGER/数值，可空 | 本次 CostRun 固定使用的 ValuationPolicy 版本。 | Pinned version number of the related valuation policy; it prevents implicit use of a mutable “latest” version. |
| 10 | `allocation_policy_id` | UUID/标识，可空 | 本次 CostRun 固定使用的 AllocationPolicy ID。 | Stable identifier of the related allocation policy object. |
| 11 | `allocation_policy_version` | INTEGER/数值，可空 | 本次 CostRun 固定使用的 AllocationPolicy 版本。 | Pinned version number of the related allocation policy; it prevents implicit use of a mutable “latest” version. |
| 12 | `cost_engine_version` | TEXT | 生成 CostResult 时使用的成本引擎语义/实现版本。 | Semantic/implementation version of the Cost Engine used by this CostRun. |

## 56. `cost_result`

**语义角色 / Semantic Role：DERIVED RESULT**  
**当前字段数 / Current Field Count：12**

**中文说明：** 成本运行对某 BusinessData 计算出的数量、单位成本、总成本以及使用的 ValuationRule。

**English Description:** Derived cost result for a BusinessData item, including quantity, unit cost, total cost, pool key, and pinned valuation rule.

| # | 字段 / Field | 当前类型 / Current Type | 中文说明 | English Description |
|---:|---|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 | Primary key. Usually a UUID that stably identifies this record. |
| 2 | `enterprise_id` | UUID/标识 | 所属企业/租户 ID。用于多企业隔离；为空时通常表示全局共享定义。 | Owning enterprise/tenant ID. It is the main boundary for multi-enterprise isolation; null commonly means a globally shared definition. |
| 3 | `cost_run_id` | UUID/标识 | 生成该成本结果的 CostRun ID。 | CostRun that produced this CostResult. |
| 4 | `business_data_id` | UUID/标识 | 被计算成本的 BusinessData ID。 | BusinessData whose cost was calculated. |
| 5 | `pool_key` | TEXT | 成本池的稳定键，由政策定义的 valuation scope/dimensions 计算得到。 | Stable cost-pool key derived from the policy-defined valuation dimensions. |
| 6 | `method` | TEXT | 成本计价方法或其他表内定义的方法类型。 | Current method attribute of this table; its exact constraints are defined by the current schema and module contract. |
| 7 | `quantity` | NUMERIC 高精度数值 | 数量值。使用高精度数值类型，具体业务单位由上下文/unit 决定。 | High-precision quantity value; its business unit is defined by unit/context. |
| 8 | `unit_cost` | NUMERIC 高精度数值，可空 | 计算得到的单位成本。 | Calculated unit cost. |
| 9 | `total_cost` | NUMERIC 高精度数值，可空 | 计算得到的总成本。 | Calculated total cost. |
| 10 | `valuation_rule_id` | UUID/标识，可空 | 后续把本 CostResult 投影到账本时固定使用的 ValuationRule ID。 | ValuationRule ID pinned for later projection of this CostResult. |
| 11 | `valuation_rule_version` | INTEGER/数值，可空 | CostResult 固定的 ValuationRule 版本。 | ValuationRule version pinned for later projection of this CostResult. |
| 12 | `created_at` | TIMESTAMPTZ | 记录创建时间。 | Time when the record was created. |


# 重放与血缘 / Replay & Lineage

## 57. `calculation_dependency_edge`

**语义角色 / Semantic Role：DERIVED INDEX**  
**当前字段数 / Current Field Count：11**

**中文说明：** 计算依赖图的边。描述某个事实/政策/参考数据变化会影响哪些派生结果或物化，是可重建的 impact/provenance 索引。

**English Description:** Rebuildable calculation dependency graph edge used for impact analysis and provenance. It links facts, policies, datasets, derived results, and materializations.

| # | 字段 / Field | 当前类型 / Current Type | 中文说明 | English Description |
|---:|---|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 | Primary key. Usually a UUID that stably identifies this record. |
| 2 | `enterprise_id` | UUID/标识 | 所属企业/租户 ID。用于多企业隔离；为空时通常表示全局共享定义。 | Owning enterprise/tenant ID. It is the main boundary for multi-enterprise isolation; null commonly means a globally shared definition. |
| 3 | `graph_version` | TEXT | 计算依赖图版本。不同算法/语义版本的边不能无条件混用。 | Version of the calculation dependency graph semantics. |
| 4 | `from_kind` | TEXT | 依赖边起点对象的类型。 | Type of the dependency edge source node. |
| 5 | `from_id` | UUID/标识 | 依赖边起点对象的稳定标识。 | Stable identifier of the dependency edge source node. |
| 6 | `to_kind` | TEXT | 依赖边终点对象的类型。 | Type of the dependency edge target node. |
| 7 | `to_id` | UUID/标识 | 依赖边终点对象的稳定标识。 | Stable identifier of the dependency edge target node. |
| 8 | `edge_kind` | TEXT 枚举 | 依赖关系类别，例如 ALLOCATION、VALUATION、PROJECTION、MATERIALIZATION、CALCULATION。 | Dependency relationship category such as ALLOCATION, VALUATION, PROJECTION, MATERIALIZATION, or CALCULATION. |
| 9 | `effective_from` | TIMESTAMPTZ，可空 | 该依赖关系从何时开始具有经济/计算意义。 | Time from which this dependency has economic/calculation relevance. |
| 10 | `lineage` | JSONB 对象 | 来源、版本、执行路径等血缘信息。 | Structured provenance and execution lineage information. |
| 11 | `created_at` | TIMESTAMPTZ | 记录创建时间。 | Time when the record was created. |

## 58. `replay_checkpoint`

**语义角色 / Semantic Role：MATERIALIZATION**  
**当前字段数 / Current Field Count：21**

**中文说明：** 重放检查点。保存边界序号、输入摘要、版本 pins、物化摘要和有效性条件，用来加速安全的增量重算。

**English Description:** Replay checkpoint containing boundary sequence, ordered input digest, pinned definitions/policies/datasets, materialization digest, and validity metadata.

| # | 字段 / Field | 当前类型 / Current Type | 中文说明 | English Description |
|---:|---|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 | Primary key. Usually a UUID that stably identifies this record. |
| 2 | `enterprise_id` | UUID/标识 | 所属企业/租户 ID。用于多企业隔离；为空时通常表示全局共享定义。 | Owning enterprise/tenant ID. It is the main boundary for multi-enterprise isolation; null commonly means a globally shared definition. |
| 3 | `consistency_domain` | TEXT | 一致性域。当前通常为 enterprise，用于界定 Posting/Replay 的原子一致性范围。 | Consistency scope for Posting/Replay; currently usually the enterprise domain. |
| 4 | `boundary_sequence` | BIGINT | 本次 Replay/Checkpoint 覆盖到的最后 posting_sequence。 | Last posting_sequence included in this Replay/Checkpoint boundary. |
| 5 | `ordered_input_digest` | TEXT | Checkpoint 边界内、按确定性顺序排列的 canonical 输入摘要。 | Deterministic digest of canonical inputs ordered within the Checkpoint boundary. |
| 6 | `last_included_business_data_id` | UUID/标识，可空 | Checkpoint 边界最后包含的 BusinessData ID，便于追踪输入边界。 | BusinessData ID at the last included input boundary. |
| 7 | `template_version` | TEXT | Checkpoint 绑定的 EnterpriseTemplate 版本身份/摘要。 | Enterprise Template version identity/digest pinned by the Checkpoint. |
| 8 | `posting_policy_pins` | JSONB 对象 | Checkpoint 固定的 Posting 规则/政策版本集合。 | Posting policy/rule versions pinned by the Checkpoint. |
| 9 | `allocation_policy_pins` | JSONB 对象 | Checkpoint 固定的 AllocationPolicy 版本集合。 | AllocationPolicy versions pinned by the Checkpoint. |
| 10 | `valuation_policy_pins` | JSONB 对象 | Checkpoint 固定的 Cost/Valuation 政策版本集合。 | Cost/valuation policy versions pinned by the Checkpoint. |
| 11 | `reference_dataset_pins` | JSONB 对象 | Checkpoint 固定的外部/参考数据集版本集合，例如 RateDataset。 | Reference dataset versions/digests pinned by the Checkpoint, for example RateDataset. |
| 12 | `runtime_semantic_version` | TEXT | 生成该 Checkpoint/认证时采用的 Economic Runtime 语义版本。 | Economic Runtime semantic version used to create this Checkpoint/certification. |
| 13 | `dependency_graph_version` | TEXT | 对应的计算依赖图版本。 | Calculation dependency graph version associated with this Checkpoint/certification. |
| 14 | `materialization_digest` | TEXT | 当前派生/物化状态的确定性摘要，用于 Full Replay 与增量重算结果比较。 | Deterministic digest of derived/materialized runtime state used for replay equivalence. |
| 15 | `validity` | JSONB 对象 | Checkpoint 的有效性条件和安全标记。 | Checkpoint validity and safety metadata. |
| 16 | `status` | TEXT 枚举 | 当前生命周期/执行状态。允许值由本表对应的枚举约束决定。 | Current lifecycle or execution status; allowed values are constrained by the table contract. |
| 17 | `parent_checkpoint_id` | UUID/标识，可空 | 上一个/父 Checkpoint，用于表达检查点链。 | Parent/previous ReplayCheckpoint ID in the checkpoint chain. |
| 18 | `source_replay_run_id` | UUID/标识，可空 | 生成并验证该 Checkpoint 的 Full ReplayRun ID。 | Full ReplayRun that generated and validated this Checkpoint. |
| 19 | `invalidated_at` | TIMESTAMPTZ，可空 | Checkpoint 被判定失效的时间。 | Time when this Checkpoint was invalidated. |
| 20 | `invalidation_reason` | TEXT，可空 | Checkpoint 失效原因。 | Reason why this Checkpoint became invalid. |
| 21 | `created_at` | TIMESTAMPTZ | 记录创建时间。 | Time when the record was created. |

## 59. `replay_coverage_certification`

**语义角色 / Semantic Role：CERTIFICATION**  
**当前字段数 / Current Field Count：19**

**中文说明：** 重放覆盖认证记录。机器验证依赖图、物化摘要、派生运行、参考数据 pins、模板绑定是否完整。

**English Description:** Machine-verifiable certification record for replay coverage, including dependency graph, materialization digest, derived-runtime replay, dataset pins, and template binding.

| # | 字段 / Field | 当前类型 / Current Type | 中文说明 | English Description |
|---:|---|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 | Primary key. Usually a UUID that stably identifies this record. |
| 2 | `enterprise_id` | UUID/标识 | 所属企业/租户 ID。用于多企业隔离；为空时通常表示全局共享定义。 | Owning enterprise/tenant ID. It is the main boundary for multi-enterprise isolation; null commonly means a globally shared definition. |
| 3 | `consistency_domain` | TEXT | 一致性域。当前通常为 enterprise，用于界定 Posting/Replay 的原子一致性范围。 | Consistency scope for Posting/Replay; currently usually the enterprise domain. |
| 4 | `runtime_semantic_version` | TEXT | 生成该 Checkpoint/认证时采用的 Economic Runtime 语义版本。 | Economic Runtime semantic version used to create this Checkpoint/certification. |
| 5 | `dependency_graph_version` | TEXT | 对应的计算依赖图版本。 | Calculation dependency graph version associated with this Checkpoint/certification. |
| 6 | `certification_version` | INTEGER/数值 | 同一覆盖范围下的认证版本号。 | Certification version for the same semantic coverage scope. |
| 7 | `status` | TEXT 枚举 | 当前生命周期/执行状态。允许值由本表对应的枚举约束决定。 | Current lifecycle or execution status; allowed values are constrained by the table contract. |
| 8 | `dependency_graph_complete` | BOOLEAN | 依赖图 producer family 是否已经机器证明覆盖完整。 | Whether required dependency producer families are machine-certified as complete. |
| 9 | `materialization_digest_complete` | BOOLEAN | 物化摘要是否覆盖要求的 Economic Runtime 派生家族。 | Whether the materialization digest covers all required Economic Runtime families. |
| 10 | `derived_runtime_replay_complete` | BOOLEAN | Full Replay 是否已经机器证明重建所有要求的派生运行。 | Whether Full Replay is machine-certified to rebuild all required derived-runtime families. |
| 11 | `reference_dataset_pins_complete` | BOOLEAN | 实际使用的参考数据集是否全部被明确 pin。 | Whether every reference dataset actually used by the certified runtime is explicitly pinned. |
| 12 | `template_binding_complete` | BOOLEAN | 企业当前模板绑定是否被 Checkpoint/认证完整固定。 | Whether the active enterprise-template binding is fully pinned/certified. |
| 13 | `evidence` | JSONB 对象 | 机器认证使用的结构化证据。 | Structured machine-verifiable evidence supporting this certification. |
| 14 | `semantic_digest` | TEXT | 对该版本的语义内容计算的稳定摘要，用于检测同一版本发生内容漂移。 | Deterministic digest of semantic content used to detect semantic drift within a supposedly identical version. |
| 15 | `certified_by` | TEXT，可空 | 完成认证的主体标识。 | Actor/process identity that certified this record. |
| 16 | `certified_at` | TIMESTAMPTZ，可空 | 认证正式通过的时间。 | Time when certification became effective. |
| 17 | `revoked_at` | TIMESTAMPTZ，可空 | 认证被撤销的时间。 | Time when the certification was revoked. |
| 18 | `revoke_reason` | TEXT，可空 | 撤销认证的原因。 | Reason for revoking the certification. |
| 19 | `created_at` | TIMESTAMPTZ | 记录创建时间。 | Time when the record was created. |

## 60. `replay_run`

**语义角色 / Semantic Role：EXECUTION/AUDIT**  
**当前字段数 / Current Field Count：19**

**中文说明：** 一次 Full Replay 的全过程记录，包括边界、前后摘要、固定 Cost/Allocation/Valuation pins 及验证结果。

**English Description:** Audit record for a Full Replay, including boundary, before/after digests, pinned cost/allocation/valuation semantics, and validation result.

| # | 字段 / Field | 当前类型 / Current Type | 中文说明 | English Description |
|---:|---|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 | Primary key. Usually a UUID that stably identifies this record. |
| 2 | `enterprise_id` | UUID/标识 | 所属企业/租户 ID。用于多企业隔离；为空时通常表示全局共享定义。 | Owning enterprise/tenant ID. It is the main boundary for multi-enterprise isolation; null commonly means a globally shared definition. |
| 3 | `consistency_domain` | TEXT | 一致性域。当前通常为 enterprise，用于界定 Posting/Replay 的原子一致性范围。 | Consistency scope for Posting/Replay; currently usually the enterprise domain. |
| 4 | `mode` | TEXT 枚举 | Replay 类型；当前架构只允许 FULL 作为 correctness oracle。 | Current mode attribute of this table; its exact constraints are defined by the current schema and module contract. |
| 5 | `status` | TEXT 枚举 | 当前生命周期/执行状态。允许值由本表对应的枚举约束决定。 | Current lifecycle or execution status; allowed values are constrained by the table contract. |
| 6 | `boundary_sequence` | BIGINT，可空 | 本次 Replay/Checkpoint 覆盖到的最后 posting_sequence。 | Last posting_sequence included in this Replay/Checkpoint boundary. |
| 7 | `before_digest` | TEXT，可空 | Replay 前目标派生状态的摘要。 | Digest of target derived state before Replay. |
| 8 | `before_snapshot` | JSONB 数组，可空 | Replay 前用于诊断/比较的状态快照。 | Diagnostic snapshot captured before Replay. |
| 9 | `after_digest` | TEXT，可空 | Replay 重建完成后的派生状态摘要。 | Digest of rebuilt derived state after Replay. |
| 10 | `validation_status` | TEXT 枚举，可空 | Replay 前后摘要的验证结果，例如 MATCH/MISMATCH。 | Replay equivalence status, such as MATCH or MISMATCH. |
| 11 | `started_at` | TIMESTAMPTZ | 该运行开始执行的时间。 | Time when this execution/run started. |
| 12 | `completed_at` | TIMESTAMPTZ，可空 | 该运行/流程完成的时间；未完成时为空。 | Time when this execution/run completed; null while incomplete. |
| 13 | `error` | JSONB 对象，可空 | 失败时的结构化错误信息。 | Structured failure information for an execution/run. |
| 14 | `cost_method` | TEXT 枚举，可空 | 该 Full Replay 重建成本时固定使用的成本方法。 | Cost method pinned for this Full Replay. |
| 15 | `valuation_policy_id` | UUID/标识，可空 | Replay 固定的 ValuationPolicy ID。 | Stable identifier of the related valuation policy object. |
| 16 | `valuation_policy_version` | INTEGER/数值，可空 | Replay 固定的 ValuationPolicy 版本。 | Pinned version number of the related valuation policy; it prevents implicit use of a mutable “latest” version. |
| 17 | `allocation_policy_id` | UUID/标识，可空 | Replay 固定的 AllocationPolicy ID。 | Stable identifier of the related allocation policy object. |
| 18 | `allocation_policy_version` | INTEGER/数值，可空 | Replay 固定的 AllocationPolicy 版本。 | Pinned version number of the related allocation policy; it prevents implicit use of a mutable “latest” version. |
| 19 | `valuation_rule_pins` | JSONB 对象 | Replay 固定的 ValuationRule id/version 集合。 | ValuationRule ID/version set pinned for Replay. |


---

## 6. 双语文档维护规则 / Bilingual Documentation Maintenance Rule

中文是当前项目讨论和业务学习的主要语言；英文用于：

- 与代码、API、数据库对象和国际工程术语对齐；
- 便于未来不同 LLM、海外开发者或外部技术团队恢复准确语义；
- 防止中文业务概念与英文代码概念在长期演进中逐渐漂移。

Chinese is the primary language for current project discussion and business learning. English is maintained alongside it to align with code/API/database terminology, support future LLM or international engineering handoff, and reduce semantic drift between business language and implementation language.

维护原则 / Rules:

1. 表名、字段名保持代码中的英文标识，不翻译为数据库对象名。  
   Keep physical table/field identifiers exactly as implemented in code.

2. 中文说明解释“业务上是什么意思”；英文说明解释同一语义，而不是另起一套定义。  
   Chinese and English descriptions must represent the same semantics, not parallel independent specifications.

3. 未来结构变化使用新增版本，例如 v0.3、v0.4，不覆盖 v0.1/v0.2 历史快照。  
   Future schema changes create additive snapshot versions instead of overwriting v0.1/v0.2 genealogy.

4. canonical / derived / materialization 等角色变化必须有 ADR 或阶段性架构证据。  
   Changes to canonical/derived/materialization roles require architectural evidence, not merely a schema edit.

---

## 7. 版本关系 / Version Relationship

```text
EVO-CURRENT-DATABASE-DESIGN-v0.1.md
  Chinese-first snapshot
        ↓ additive, not replacement
EVO-CURRENT-DATABASE-DESIGN-BILINGUAL-v0.2.md
  Chinese + English table/field explanations
        ↓
future v0.3 / v0.4 ...
```

当前统计仍为 / Current count remains:

- Tables / 表：**60**
- Fields / 字段：**635**
- DB Schema Version：**13**
- Schema migrations：**15**

> 本文档属于 2026-09-19 当前阶段快照。  
> This document is a current-stage snapshot as of 2026-09-19.

# EVO 当前阶段数据库表设计与字段字典 v0.1

**状态：CURRENT-STAGE SNAPSHOT / 学习与工程参考文档**  
**日期：2026-09-19**  
**分支：`evo/apm-certification-enterprise-template-v0.1`**  
**数据库：PostgreSQL**  
**当前 DB Schema Version：13**  
**权威字段来源：`platform/database/src/types.ts` + `migrations/schema/*.sql` + `scripts/migrate.ts`**

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

## 5. 完整表与字段字典


# 基础设施

## 1. `schema_migrations`

**语义角色：INFRA**  
**当前字段数：3**

数据库迁移历史表。记录每个 migration 文件的版本、校验摘要和实际应用时间，保证已经执行过的迁移不能被静默改写。

| # | 字段 | 当前类型（简化） | 中文说明 |
|---:|---|---|---|
| 1 | `version` | TEXT | 定义/数据集的版本号。版本发布后通常不应原地修改语义。 |
| 2 | `checksum` | TEXT | 迁移文件内容的校验摘要，用于检测已应用 migration 是否被改写。 |
| 3 | `applied_at` | TIMESTAMPTZ | 该数据库迁移实际执行完成的时间。 |

## 2. `evo_runtime_info`

**语义角色：INFRA**  
**当前字段数：4**

EVO 数据库运行时基线信息。用于声明当前架构基线和数据库 schema 版本，是部署与迁移程序判断数据库状态的入口。

| # | 字段 | 当前类型（简化） | 中文说明 |
|---:|---|---|---|
| 1 | `singleton` | BOOLEAN | 单例行约束标记。保证运行时基线表只存在一条有效记录。 |
| 2 | `architecture_baseline` | TEXT | 当前数据库所遵循的 EVO 架构基线标识。 |
| 3 | `db_schema_version` | INTEGER/数值 | 当前数据库 Schema 版本号，用于部署、迁移和兼容性检查。 |
| 4 | `updated_at` | TIMESTAMPTZ | 记录最近一次更新/物化刷新时间。 |


# 企业与模板

## 3. `enterprise`

**语义角色：CANONICAL DEFINITION**  
**当前字段数：7**

企业/租户主表。EVO 的多企业隔离根节点，绝大多数业务事实、运行记录和策略最终都归属于某个 enterprise。

| # | 字段 | 当前类型（简化） | 中文说明 |
|---:|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 |
| 2 | `code` | TEXT | 稳定、机器可读的业务代码。通常用于配置、API、模板和规则引用，不应随显示名称随意改变。 |
| 3 | `name` | TEXT | 面向人的显示名称。 |
| 4 | `status` | TEXT 枚举 | 当前生命周期/执行状态。允许值由本表对应的枚举约束决定。 |
| 5 | `default_timezone` | TEXT | 本表的 `default_timezone` 属性；用于表达 default timezone，具体约束由当前 Schema/模块契约定义。 |
| 6 | `created_at` | TIMESTAMPTZ | 记录创建时间。 |
| 7 | `updated_at` | TIMESTAMPTZ | 记录最近一次更新/物化刷新时间。 |

## 4. `enterprise_template`

**语义角色：DEFINITION**  
**当前字段数：5**

企业模板的稳定身份。模板描述一组可以安装/绑定到企业的定义集合，本表只保存模板本身，不保存具体版本内容。

| # | 字段 | 当前类型（简化） | 中文说明 |
|---:|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 |
| 2 | `code` | TEXT | 稳定、机器可读的业务代码。通常用于配置、API、模板和规则引用，不应随显示名称随意改变。 |
| 3 | `name` | TEXT | 面向人的显示名称。 |
| 4 | `description` | TEXT，可空 | 对该对象用途和业务含义的补充说明。 |
| 5 | `created_at` | TIMESTAMPTZ | 记录创建时间。 |

## 5. `enterprise_template_version`

**语义角色：VERSIONED DEFINITION**  
**当前字段数：8**

企业模板的不可变版本。definition 保存某个版本的完整模板定义，semantic_digest 用于证明同一版本内容没有漂移。

| # | 字段 | 当前类型（简化） | 中文说明 |
|---:|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 |
| 2 | `enterprise_template_id` | UUID/标识 | 关联的企业模板 ID，用于建立本表与对应对象之间的稳定关系。 |
| 3 | `version` | INTEGER/数值 | 定义/数据集的版本号。版本发布后通常不应原地修改语义。 |
| 4 | `status` | TEXT 枚举 | 当前生命周期/执行状态。允许值由本表对应的枚举约束决定。 |
| 5 | `definition` | JSONB 对象 | 版本化定义主体，使用 JSONB 保存可扩展的结构化语义。 |
| 6 | `semantic_digest` | TEXT | 对该版本的语义内容计算的稳定摘要，用于检测同一版本发生内容漂移。 |
| 7 | `created_at` | TIMESTAMPTZ | 记录创建时间。 |
| 8 | `published_at` | TIMESTAMPTZ，可空 | 该版本被正式发布、生效的时间。 |

## 6. `enterprise_template_binding`

**语义角色：CANONICAL BINDING**  
**当前字段数：6**

企业与企业模板版本之间的当前绑定关系。用于明确某个企业正在执行哪一个模板版本。

| # | 字段 | 当前类型（简化） | 中文说明 |
|---:|---|---|---|
| 1 | `enterprise_id` | UUID/标识 | 所属企业/租户 ID。用于多企业隔离；为空时通常表示全局共享定义。 |
| 2 | `enterprise_template_id` | UUID/标识 | 关联的企业模板 ID，用于建立本表与对应对象之间的稳定关系。 |
| 3 | `enterprise_template_version_id` | UUID/标识 | 关联的企业模板版本 ID，用于建立本表与对应对象之间的稳定关系。 |
| 4 | `bound_at` | TIMESTAMPTZ | bound at 对应的时间戳；具体业务语义由本表上下文决定。 |
| 5 | `bound_by` | TEXT | 本表的 `bound_by` 属性；用于表达 bound by，具体约束由当前 Schema/模块契约定义。 |
| 6 | `binding_reason` | TEXT，可空 | 本表的 `binding_reason` 属性；用于表达 binding reason，具体约束由当前 Schema/模块契约定义。 |

## 7. `application_instance`

**语义角色：CANONICAL BINDING**  
**当前字段数：10**

某企业安装后的应用实例。把通用 ApplicationDefinition 落到具体 enterprise，并可固定定义版本及实例配置。

| # | 字段 | 当前类型（简化） | 中文说明 |
|---:|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 |
| 2 | `enterprise_id` | UUID/标识 | 所属企业/租户 ID。用于多企业隔离；为空时通常表示全局共享定义。 |
| 3 | `application_definition_id` | UUID/标识 | 该企业应用实例对应的通用 ApplicationDefinition ID。 |
| 4 | `code` | TEXT | 稳定、机器可读的业务代码。通常用于配置、API、模板和规则引用，不应随显示名称随意改变。 |
| 5 | `name` | TEXT | 面向人的显示名称。 |
| 6 | `pinned_definition_version` | INTEGER/数值，可空 | 实例当前固定使用的 ApplicationDefinitionVersion；为空时由安装/升级策略决定。 |
| 7 | `status` | TEXT 枚举 | 当前生命周期/执行状态。允许值由本表对应的枚举约束决定。 |
| 8 | `config` | JSONB 对象 | 可扩展配置 JSON。保存尚不值得固化为独立列、但仍需要版本化治理的参数。 |
| 9 | `created_at` | TIMESTAMPTZ | 记录创建时间。 |
| 10 | `updated_at` | TIMESTAMPTZ | 记录最近一次更新/物化刷新时间。 |

## 8. `enterprise_application_overlay`

**语义角色：VERSIONED DEFINITION**  
**当前字段数：10**

企业对标准应用定义的受控覆盖层。用于客户个性化而不直接修改基础模板。

| # | 字段 | 当前类型（简化） | 中文说明 |
|---:|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 |
| 2 | `enterprise_id` | UUID/标识 | 所属企业/租户 ID。用于多企业隔离；为空时通常表示全局共享定义。 |
| 3 | `application_instance_id` | UUID/标识 | 被该企业覆盖层影响的 ApplicationInstance ID。 |
| 4 | `base_definition_version` | INTEGER/数值 | 覆盖层基于哪个基础应用版本创建。 |
| 5 | `overlay_version` | INTEGER/数值 | 企业覆盖层自己的版本号。 |
| 6 | `status` | TEXT 枚举 | 当前生命周期/执行状态。允许值由本表对应的枚举约束决定。 |
| 7 | `patch` | JSONB 对象 | 企业针对基础应用定义的差异覆盖内容。 |
| 8 | `overlay_hash` | TEXT，可空 | 企业覆盖层内容的摘要/哈希。 |
| 9 | `published_at` | TIMESTAMPTZ，可空 | 该版本被正式发布、生效的时间。 |
| 10 | `created_at` | TIMESTAMPTZ | 记录创建时间。 |


# 元数据

## 9. `domain_definition`

**语义角色：DEFINITION**  
**当前字段数：5**

业务领域定义，例如销售、采购、生产、库存、估值等。它是 TransactionType 的上级分类。

| # | 字段 | 当前类型（简化） | 中文说明 |
|---:|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 |
| 2 | `code` | TEXT | 稳定、机器可读的业务代码。通常用于配置、API、模板和规则引用，不应随显示名称随意改变。 |
| 3 | `name` | TEXT | 面向人的显示名称。 |
| 4 | `description` | TEXT，可空 | 对该对象用途和业务含义的补充说明。 |
| 5 | `created_at` | TIMESTAMPTZ | 记录创建时间。 |

## 10. `transaction_type`

**语义角色：DEFINITION**  
**当前字段数：6**

交易类型的高层业务抽象，例如销售订单、采购入库。它描述业务类别，不等同于具体应用。

| # | 字段 | 当前类型（简化） | 中文说明 |
|---:|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 |
| 2 | `domain_id` | UUID/标识 | 关联的业务领域 ID，用于建立本表与对应对象之间的稳定关系。 |
| 3 | `code` | TEXT | 稳定、机器可读的业务代码。通常用于配置、API、模板和规则引用，不应随显示名称随意改变。 |
| 4 | `name` | TEXT | 面向人的显示名称。 |
| 5 | `description` | TEXT，可空 | 对该对象用途和业务含义的补充说明。 |
| 6 | `created_at` | TIMESTAMPTZ | 记录创建时间。 |

## 11. `application_definition`

**语义角色：DEFINITION**  
**当前字段数：6**

应用定义的稳定身份。一个 TransactionType 下可以存在多个具体 Application。

| # | 字段 | 当前类型（简化） | 中文说明 |
|---:|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 |
| 2 | `transaction_type_id` | UUID/标识 | 所属 TransactionType ID，表示该应用实现哪一种高层交易类型。 |
| 3 | `code` | TEXT | 稳定、机器可读的业务代码。通常用于配置、API、模板和规则引用，不应随显示名称随意改变。 |
| 4 | `name` | TEXT | 面向人的显示名称。 |
| 5 | `description` | TEXT，可空 | 对该对象用途和业务含义的补充说明。 |
| 6 | `created_at` | TIMESTAMPTZ | 记录创建时间。 |

## 12. `application_definition_version`

**语义角色：VERSIONED DEFINITION**  
**当前字段数：9**

应用定义的版本。字段、命令、记账规则等都绑定到明确的应用版本，以支持升级、回放和兼容。

| # | 字段 | 当前类型（简化） | 中文说明 |
|---:|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 |
| 2 | `application_definition_id` | UUID/标识 | 所属 ApplicationDefinition ID。 |
| 3 | `version` | INTEGER/数值 | 定义/数据集的版本号。版本发布后通常不应原地修改语义。 |
| 4 | `status` | TEXT 枚举 | 当前生命周期/执行状态。允许值由本表对应的枚举约束决定。 |
| 5 | `schema_version` | INTEGER/数值 | 固定使用的schema版本号，避免运行时隐式读取“最新版本”。 |
| 6 | `base_config` | JSONB 对象 | 应用定义版本的基础配置。 |
| 7 | `definition_hash` | TEXT，可空 | 应用定义内容的摘要/哈希，用于版本一致性检查。 |
| 8 | `published_at` | TIMESTAMPTZ，可空 | 该版本被正式发布、生效的时间。 |
| 9 | `created_at` | TIMESTAMPTZ | 记录创建时间。 |

## 13. `field_group_definition`

**语义角色：DEFINITION**  
**当前字段数：6**

应用版本中的字段组/部件定义，用于把相关业务字段组织为有业务语义的区域。

| # | 字段 | 当前类型（简化） | 中文说明 |
|---:|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 |
| 2 | `application_definition_version_id` | UUID/标识 | 所属应用定义版本 ID；字段组随应用版本共同演进。 |
| 3 | `code` | TEXT | 稳定、机器可读的业务代码。通常用于配置、API、模板和规则引用，不应随显示名称随意改变。 |
| 4 | `label` | TEXT | 字段组面向用户展示的名称。 |
| 5 | `sort_order` | INTEGER/数值 | 字段组在应用中的排序值。 |
| 6 | `config` | JSONB 对象 | 可扩展配置 JSON。保存尚不值得固化为独立列、但仍需要版本化治理的参数。 |

## 14. `field_definition`

**语义角色：DEFINITION**  
**当前字段数：10**

应用版本中的业务字段定义。记录字段代码、标签、数据类型、必填性、引用方式及 UI/数据源等配置。

| # | 字段 | 当前类型（简化） | 中文说明 |
|---:|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 |
| 2 | `application_definition_version_id` | UUID/标识 | 所属应用定义版本 ID。 |
| 3 | `field_group_id` | UUID/标识，可空 | 所属字段组 ID；为空表示字段不归入特定组。 |
| 4 | `code` | TEXT | 稳定、机器可读的业务代码。通常用于配置、API、模板和规则引用，不应随显示名称随意改变。 |
| 5 | `label` | TEXT | 面向用户展示的字段名称。 |
| 6 | `data_type` | TEXT | 业务字段的数据类型定义，例如文本、数字、日期、引用等。 |
| 7 | `required` | BOOLEAN | 该业务字段是否为必填。 |
| 8 | `reference_mode` | TEXT 枚举，可空 | 引用型字段的语义：REFERENCE 保留对象引用；SNAPSHOT 固化当时值。 |
| 9 | `sort_order` | INTEGER/数值 | 字段在表单/界面/元数据中的排序值。 |
| 10 | `config` | JSONB 对象 | 可扩展配置 JSON。保存尚不值得固化为独立列、但仍需要版本化治理的参数。 |

## 15. `dimension_definition`

**语义角色：VERSIONED DEFINITION**  
**当前字段数：10**

统一维度定义，例如仓库、项目、部门、利润中心。供 Ledger、Cost、Valuation 等模块共享。

| # | 字段 | 当前类型（简化） | 中文说明 |
|---:|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 |
| 2 | `enterprise_id` | UUID/标识，可空 | 所属企业/租户 ID。用于多企业隔离；为空时通常表示全局共享定义。 |
| 3 | `code` | TEXT | 稳定、机器可读的业务代码。通常用于配置、API、模板和规则引用，不应随显示名称随意改变。 |
| 4 | `name` | TEXT | 面向人的显示名称。 |
| 5 | `data_type` | TEXT | data type 的类型/类别标识。 |
| 6 | `version` | INTEGER/数值 | 定义/数据集的版本号。版本发布后通常不应原地修改语义。 |
| 7 | `status` | TEXT 枚举 | 当前生命周期/执行状态。允许值由本表对应的枚举约束决定。 |
| 8 | `config` | JSONB 对象 | 可扩展配置 JSON。保存尚不值得固化为独立列、但仍需要版本化治理的参数。 |
| 9 | `created_at` | TIMESTAMPTZ | 记录创建时间。 |
| 10 | `published_at` | TIMESTAMPTZ，可空 | 该版本被正式发布、生效的时间。 |

## 16. `capability_definition`

**语义角色：VERSIONED DEFINITION**  
**当前字段数：10**

企业或全局能力定义。描述系统可提供的能力及其版本和配置。

| # | 字段 | 当前类型（简化） | 中文说明 |
|---:|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 |
| 2 | `enterprise_id` | UUID/标识，可空 | 所属企业/租户 ID。用于多企业隔离；为空时通常表示全局共享定义。 |
| 3 | `code` | TEXT | 稳定、机器可读的业务代码。通常用于配置、API、模板和规则引用，不应随显示名称随意改变。 |
| 4 | `name` | TEXT | 面向人的显示名称。 |
| 5 | `description` | TEXT，可空 | 对该对象用途和业务含义的补充说明。 |
| 6 | `version` | INTEGER/数值 | 定义/数据集的版本号。版本发布后通常不应原地修改语义。 |
| 7 | `status` | TEXT 枚举 | 当前生命周期/执行状态。允许值由本表对应的枚举约束决定。 |
| 8 | `config` | JSONB 对象 | 可扩展配置 JSON。保存尚不值得固化为独立列、但仍需要版本化治理的参数。 |
| 9 | `created_at` | TIMESTAMPTZ | 记录创建时间。 |
| 10 | `published_at` | TIMESTAMPTZ，可空 | 该版本被正式发布、生效的时间。 |


# 主数据

## 17. `item_definition`

**语义角色：CANONICAL DEFINITION**  
**当前字段数：11**

企业物料/商品/服务定义。描述 item 类型、是否管理库存、默认履约方式和基础计量单位。

| # | 字段 | 当前类型（简化） | 中文说明 |
|---:|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 |
| 2 | `enterprise_id` | UUID/标识 | 所属企业/租户 ID。用于多企业隔离；为空时通常表示全局共享定义。 |
| 3 | `code` | TEXT | 稳定、机器可读的业务代码。通常用于配置、API、模板和规则引用，不应随显示名称随意改变。 |
| 4 | `name` | TEXT | 面向人的显示名称。 |
| 5 | `item_type` | TEXT 枚举 | 物料/项目类别，例如原材料、半成品、成品、商品、服务、资产类项目。 |
| 6 | `track_inventory` | BOOLEAN | 该 Item 是否参与库存数量/头寸管理。 |
| 7 | `default_fulfillment_mode` | TEXT 枚举，可空 | 默认履约方式：自制、采购、备货或服务。 |
| 8 | `base_unit` | TEXT | 该 Item 的基础计量单位。 |
| 9 | `config` | JSONB 对象 | 可扩展配置 JSON。保存尚不值得固化为独立列、但仍需要版本化治理的参数。 |
| 10 | `created_at` | TIMESTAMPTZ | 记录创建时间。 |
| 11 | `updated_at` | TIMESTAMPTZ | 记录最近一次更新/物化刷新时间。 |


# 权限

## 18. `permission_grant`

**语义角色：CANONICAL DEFINITION**  
**当前字段数：7**

企业内 Actor 的权限授予记录，描述谁对什么权限代码/资源范围有执行资格。

| # | 字段 | 当前类型（简化） | 中文说明 |
|---:|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 |
| 2 | `enterprise_id` | UUID/标识 | 所属企业/租户 ID。用于多企业隔离；为空时通常表示全局共享定义。 |
| 3 | `actor_type` | TEXT 枚举 | 发起者类型，例如 HUMAN、AI、AUTOMATION、EXTERNAL_SYSTEM。 |
| 4 | `actor_id` | TEXT/标识 | 发起者在其类型命名空间中的标识。 |
| 5 | `permission_code` | TEXT | 被授予的权限代码。 |
| 6 | `resource_scope` | JSONB 对象 | 权限适用的资源范围/条件。 |
| 7 | `created_at` | TIMESTAMPTZ | 记录创建时间。 |


# 命令与事实

## 19. `command_definition`

**语义角色：VERSIONED DEFINITION**  
**当前字段数：9**

应用允许执行的 Command 定义，包括输入结构、前置条件、执行策略以及成功后产生的 BusinessData 类型。

| # | 字段 | 当前类型（简化） | 中文说明 |
|---:|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 |
| 2 | `application_definition_version_id` | UUID/标识 | 该 Command 属于哪个 ApplicationDefinitionVersion。 |
| 3 | `code` | TEXT | 稳定、机器可读的业务代码。通常用于配置、API、模板和规则引用，不应随显示名称随意改变。 |
| 4 | `name` | TEXT | 面向人的显示名称。 |
| 5 | `input_schema` | JSONB 对象 | Command 输入的 JSON Schema/结构定义。 |
| 6 | `preconditions` | JSONB 数组 | Command 执行前必须满足的条件集合。 |
| 7 | `execution_policy` | JSONB 对象 | 授权、审批、幂等等执行策略配置。 |
| 8 | `resulting_business_data_type` | TEXT | Command 成功后产生的 canonical BusinessData 类型。 |
| 9 | `config` | JSONB 对象 | 可扩展配置 JSON。保存尚不值得固化为独立列、但仍需要版本化治理的参数。 |

## 20. `command_execution`

**语义角色：EXECUTION/AUDIT**  
**当前字段数：18**

一次 Command 请求的执行记录。保存调用者、幂等键、输入、状态、结果和错误；Command 本身不是重放时的业务事实。

| # | 字段 | 当前类型（简化） | 中文说明 |
|---:|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 |
| 2 | `enterprise_id` | UUID/标识 | 所属企业/租户 ID。用于多企业隔离；为空时通常表示全局共享定义。 |
| 3 | `application_instance_id` | UUID/标识 | 本次 Command 针对的 ApplicationInstance ID。 |
| 4 | `command_definition_id` | UUID/标识 | 实际执行的 CommandDefinition ID。 |
| 5 | `actor_type` | TEXT 枚举 | 发起者类型，例如 HUMAN、AI、AUTOMATION、EXTERNAL_SYSTEM。 |
| 6 | `actor_id` | TEXT/标识 | 发起者在其类型命名空间中的标识。 |
| 7 | `request_id` | UUID/标识 | 外部/调用侧请求标识，用于请求追踪。 |
| 8 | `correlation_id` | UUID/标识 | 跨多步业务调用的关联 ID，用于把同一业务链路串起来。 |
| 9 | `causation_id` | TEXT/标识，可空 | 导致当前动作发生的上游动作/事件标识，用于因果追踪。 |
| 10 | `idempotency_scope` | TEXT | 幂等键的作用域，避免不同业务范围的相同键互相冲突。 |
| 11 | `idempotency_key` | TEXT | 幂等键。相同作用域内重复提交相同意图时用于避免重复执行。 |
| 12 | `input` | JSONB 对象 | Command 的原始结构化输入。 |
| 13 | `lineage` | JSONB 对象，可空 | 来源、版本、执行路径等血缘信息。 |
| 14 | `status` | TEXT 枚举 | 当前生命周期/执行状态。允许值由本表对应的枚举约束决定。 |
| 15 | `result` | JSONB 对象，可空 | Command 执行结果摘要；没有结果时为空。 |
| 16 | `error` | JSONB 对象，可空 | 失败时的结构化错误信息。 |
| 17 | `created_at` | TIMESTAMPTZ | 记录创建时间。 |
| 18 | `completed_at` | TIMESTAMPTZ，可空 | 该运行/流程完成的时间；未完成时为空。 |

## 21. `business_data`

**语义角色：CORE CANONICAL**  
**当前字段数：11**

EVO 最核心的不可变业务事实表。保存已经接受发生的业务事件及语义 payload；重放读取 BusinessData，而不是重新执行 Command。

| # | 字段 | 当前类型（简化） | 中文说明 |
|---:|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 |
| 2 | `enterprise_id` | UUID/标识 | 所属企业/租户 ID。用于多企业隔离；为空时通常表示全局共享定义。 |
| 3 | `application_instance_id` | UUID/标识 | 产生该事实的应用实例 ID。 |
| 4 | `command_execution_id` | UUID/标识 | 接受并产生该事实的 CommandExecution ID；Replay 不会重新执行它。 |
| 5 | `business_data_type` | TEXT | BusinessData 的语义类型，例如 sales_order.approved、valuation.requested。 |
| 6 | `business_object_key` | TEXT | 业务对象稳定键，例如订单号/业务编号，用于聚合同一对象的不同不可变版本。 |
| 7 | `business_object_version` | BIGINT | 同一 business_object_key 下的业务事实版本序号。 |
| 8 | `effective_at` | TIMESTAMPTZ | 业务或解释在经济意义上的生效时间，与数据库记录时间不同。 |
| 9 | `metadata_version` | INTEGER/数值 | 解释/记账该数据时使用的元数据版本。 |
| 10 | `payload` | JSONB 对象 | BusinessData 或事件的业务语义数据载荷，使用 JSONB 保留应用层字段。 |
| 11 | `created_at` | TIMESTAMPTZ | 记录创建时间。 |


# 运行时

## 22. `enterprise_runtime_state`

**语义角色：MATERIALIZED CONTROL STATE**  
**当前字段数：10**

企业当前运行控制状态，包括 posting/replay 模式、下一 posting_sequence 和当前 replay run。

| # | 字段 | 当前类型（简化） | 中文说明 |
|---:|---|---|---|
| 1 | `enterprise_id` | UUID/标识 | 所属企业/租户 ID。用于多企业隔离；为空时通常表示全局共享定义。 |
| 2 | `consistency_domain` | TEXT | 一致性域。当前通常为 enterprise，用于界定 Posting/Replay 的原子一致性范围。 |
| 3 | `posting_mode` | TEXT 枚举 | 企业当前 Posting 状态：正常、重放中或失败。 |
| 4 | `replay_required` | BOOLEAN | 是否已检测到追溯变化、需要执行 Replay。 |
| 5 | `next_posting_sequence` | BIGINT | 下一条 PostingInput 将获得的顺序号。 |
| 6 | `last_posted_effective_at` | TIMESTAMPTZ，可空 | 最近已成功记账事实的业务有效时间。 |
| 7 | `last_posted_priority` | INTEGER/数值，可空 | 最近已成功记账事实的 posting priority。 |
| 8 | `last_posted_sequence` | BIGINT，可空 | 最近已成功记账的 posting_sequence。 |
| 9 | `active_replay_run_id` | UUID/标识，可空 | 当前正在控制该一致性域的 ReplayRun ID。 |
| 10 | `updated_at` | TIMESTAMPTZ | 记录最近一次更新/物化刷新时间。 |

## 23. `outbox_event`

**语义角色：INTEGRATION OUTBOX**  
**当前字段数：14**

事务性 Outbox。把内部已提交变化可靠地发布给外部消费者，避免数据库提交与消息发送之间失配。

| # | 字段 | 当前类型（简化） | 中文说明 |
|---:|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 |
| 2 | `enterprise_id` | UUID/标识 | 所属企业/租户 ID。用于多企业隔离；为空时通常表示全局共享定义。 |
| 3 | `event_type` | TEXT | 待发布集成事件类型。 |
| 4 | `event_version` | INTEGER/数值 | 该集成事件的协议版本。 |
| 5 | `aggregate_type` | TEXT | 事件对应的聚合/资源类型。 |
| 6 | `aggregate_id` | TEXT/标识 | 事件对应的聚合/资源 ID。 |
| 7 | `correlation_id` | UUID/标识 | 跨多步业务调用的关联 ID，用于把同一业务链路串起来。 |
| 8 | `causation_id` | TEXT/标识，可空 | 导致当前动作发生的上游动作/事件标识，用于因果追踪。 |
| 9 | `payload` | JSONB 对象 | BusinessData 或事件的业务语义数据载荷，使用 JSONB 保留应用层字段。 |
| 10 | `status` | TEXT 枚举 | 当前生命周期/执行状态。允许值由本表对应的枚举约束决定。 |
| 11 | `attempts` | INTEGER/数值 | 已经尝试发布的次数。 |
| 12 | `available_at` | TIMESTAMPTZ | 允许下一次发布尝试的时间。 |
| 13 | `created_at` | TIMESTAMPTZ | 记录创建时间。 |
| 14 | `published_at` | TIMESTAMPTZ，可空 | 成功发布到外部总线/消费者的时间。 |

## 24. `feature_flag`

**语义角色：CONTROL DEFINITION**  
**当前字段数：10**

功能开关。支持灰度发布、迁移期兼容和受控启停。

| # | 字段 | 当前类型（简化） | 中文说明 |
|---:|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 |
| 2 | `code` | TEXT | 稳定、机器可读的业务代码。通常用于配置、API、模板和规则引用，不应随显示名称随意改变。 |
| 3 | `enterprise_id` | UUID/标识，可空 | 所属企业/租户 ID。用于多企业隔离；为空时通常表示全局共享定义。 |
| 4 | `enabled` | BOOLEAN | 功能开关当前是否启用。 |
| 5 | `config` | JSONB 对象 | 可扩展配置 JSON。保存尚不值得固化为独立列、但仍需要版本化治理的参数。 |
| 6 | `owner` | TEXT | 该 FeatureFlag 的责任模块/责任人标识。 |
| 7 | `introduced_in` | TEXT | 该 FeatureFlag 从哪个版本开始引入。 |
| 8 | `expires_at` | TIMESTAMPTZ，可空 | 计划移除/失效时间，用于避免永久遗留临时开关。 |
| 9 | `created_at` | TIMESTAMPTZ | 记录创建时间。 |
| 10 | `updated_at` | TIMESTAMPTZ | 记录最近一次更新/物化刷新时间。 |


# 流程与工作

## 25. `work_item`

**语义角色：MATERIALIZATION**  
**当前字段数：16**

从账本/业务状态派生的工作项物化，例如待生产、待发货、待收款等。可从来源状态重建。

| # | 字段 | 当前类型（简化） | 中文说明 |
|---:|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 |
| 2 | `enterprise_id` | UUID/标识 | 所属企业/租户 ID。用于多企业隔离；为空时通常表示全局共享定义。 |
| 3 | `work_type` | TEXT | 工作项类型，例如待生产、待发货、待收款。 |
| 4 | `title` | TEXT | 面向人的工作项/SOP 步骤标题。 |
| 5 | `status` | TEXT 枚举 | 当前生命周期/执行状态。允许值由本表对应的枚举约束决定。 |
| 6 | `priority` | INTEGER/数值 | 排序优先级，数值语义由对应模块决定。 |
| 7 | `source_ledger_code` | TEXT | 生成该 WorkItem 的来源账本代码。 |
| 8 | `source_dimension_hash` | TEXT | 来源账本余额的维度组合摘要。 |
| 9 | `source_dimensions` | JSONB 对象 | 来源账本余额的完整维度值。 |
| 10 | `source_quantity` | NUMERIC 高精度数值 | 生成工作项时来源余额的数量值。 |
| 11 | `source_amount` | NUMERIC 高精度数值 | 生成工作项时来源余额的金额值。 |
| 12 | `assigned_actor_type` | TEXT，可空 | 当前受理/负责人的 Actor 类型。 |
| 13 | `assigned_actor_id` | UUID/标识，可空 | 当前受理/负责人的 Actor 标识。 |
| 14 | `created_at` | TIMESTAMPTZ | 记录创建时间。 |
| 15 | `updated_at` | TIMESTAMPTZ | 记录最近一次更新/物化刷新时间。 |
| 16 | `completed_at` | TIMESTAMPTZ，可空 | 该运行/流程完成的时间；未完成时为空。 |

## 26. `flow_definition`

**语义角色：VERSIONED DEFINITION**  
**当前字段数：10**

业务流定义。描述跨 Command/BusinessData 的业务流程结构。

| # | 字段 | 当前类型（简化） | 中文说明 |
|---:|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 |
| 2 | `enterprise_id` | UUID/标识，可空 | 所属企业/租户 ID。用于多企业隔离；为空时通常表示全局共享定义。 |
| 3 | `code` | TEXT | 稳定、机器可读的业务代码。通常用于配置、API、模板和规则引用，不应随显示名称随意改变。 |
| 4 | `name` | TEXT | 面向人的显示名称。 |
| 5 | `description` | TEXT，可空 | 对该对象用途和业务含义的补充说明。 |
| 6 | `version` | INTEGER/数值 | 定义/数据集的版本号。版本发布后通常不应原地修改语义。 |
| 7 | `status` | TEXT 枚举 | 当前生命周期/执行状态。允许值由本表对应的枚举约束决定。 |
| 8 | `definition` | JSONB 对象 | 版本化定义主体，使用 JSONB 保存可扩展的结构化语义。 |
| 9 | `created_at` | TIMESTAMPTZ | 记录创建时间。 |
| 10 | `published_at` | TIMESTAMPTZ，可空 | 该版本被正式发布、生效的时间。 |

## 27. `flow_instance`

**语义角色：DERIVED/OPERATIONAL STATE**  
**当前字段数：7**

某个 FlowDefinition 的运行实例，记录实例键和当前状态。

| # | 字段 | 当前类型（简化） | 中文说明 |
|---:|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 |
| 2 | `enterprise_id` | UUID/标识 | 所属企业/租户 ID。用于多企业隔离；为空时通常表示全局共享定义。 |
| 3 | `flow_definition_id` | UUID/标识 | 该流程实例采用的 FlowDefinition ID。 |
| 4 | `instance_key` | TEXT | 业务侧稳定流程实例键，例如订单号。 |
| 5 | `status` | TEXT 枚举 | 当前生命周期/执行状态。允许值由本表对应的枚举约束决定。 |
| 6 | `started_at` | TIMESTAMPTZ | 流程实例启动时间。 |
| 7 | `completed_at` | TIMESTAMPTZ，可空 | 该运行/流程完成的时间；未完成时为空。 |

## 28. `business_object_link`

**语义角色：BUSINESS LINEAGE**  
**当前字段数：7**

BusinessData 之间的业务级关系，例如 CAUSES、FULFILLS、REFERENCES。历史兼容枚举中仍包含旧的 ALLOCATES_TO/DERIVES_FROM。

| # | 字段 | 当前类型（简化） | 中文说明 |
|---:|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 |
| 2 | `enterprise_id` | UUID/标识 | 所属企业/租户 ID。用于多企业隔离；为空时通常表示全局共享定义。 |
| 3 | `from_business_data_id` | UUID/标识 | 业务关系起点 BusinessData ID。 |
| 4 | `to_business_data_id` | UUID/标识 | 业务关系终点 BusinessData ID。 |
| 5 | `relation_type` | TEXT 枚举 | 业务级关系类型。新运行时不应再用它承载 Allocation/Calculation dependency。 |
| 6 | `metadata` | JSONB 对象 | 补充元数据；不承担主业务语义。 |
| 7 | `created_at` | TIMESTAMPTZ | 记录创建时间。 |

## 29. `flow_trace`

**语义角色：AUDIT/TRACE**  
**当前字段数：10**

业务流跟踪记录，把 Flow、CommandExecution 和 BusinessData 串起来用于可观测性与追踪。

| # | 字段 | 当前类型（简化） | 中文说明 |
|---:|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 |
| 2 | `enterprise_id` | UUID/标识 | 所属企业/租户 ID。用于多企业隔离；为空时通常表示全局共享定义。 |
| 3 | `flow_definition_id` | UUID/标识 | 所属 FlowDefinition ID。 |
| 4 | `flow_instance_id` | UUID/标识 | 所属 FlowInstance ID。 |
| 5 | `command_execution_id` | UUID/标识 | 该流程步骤关联的 CommandExecution ID。 |
| 6 | `business_data_id` | UUID/标识 | 该流程步骤产生/关联的 BusinessData ID。 |
| 7 | `step_code` | TEXT | 流程步骤代码。 |
| 8 | `correlation_id` | UUID/标识 | 跨多步业务调用的关联 ID，用于把同一业务链路串起来。 |
| 9 | `causation_id` | TEXT/标识，可空 | 导致当前动作发生的上游动作/事件标识，用于因果追踪。 |
| 10 | `created_at` | TIMESTAMPTZ | 记录创建时间。 |

## 30. `sop_definition`

**语义角色：DEFINITION**  
**当前字段数：6**

标准作业程序 SOP 的稳定身份。

| # | 字段 | 当前类型（简化） | 中文说明 |
|---:|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 |
| 2 | `enterprise_id` | UUID/标识，可空 | 所属企业/租户 ID。用于多企业隔离；为空时通常表示全局共享定义。 |
| 3 | `code` | TEXT | 稳定、机器可读的业务代码。通常用于配置、API、模板和规则引用，不应随显示名称随意改变。 |
| 4 | `name` | TEXT | 面向人的显示名称。 |
| 5 | `description` | TEXT，可空 | 对该对象用途和业务含义的补充说明。 |
| 6 | `created_at` | TIMESTAMPTZ | 记录创建时间。 |

## 31. `sop_version`

**语义角色：VERSIONED DEFINITION**  
**当前字段数：8**

SOP 的版本，支持发布、退役和版本化配置。

| # | 字段 | 当前类型（简化） | 中文说明 |
|---:|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 |
| 2 | `sop_definition_id` | UUID/标识 | 所属 SOPDefinition ID。 |
| 3 | `version` | INTEGER/数值 | 定义/数据集的版本号。版本发布后通常不应原地修改语义。 |
| 4 | `status` | TEXT 枚举 | 当前生命周期/执行状态。允许值由本表对应的枚举约束决定。 |
| 5 | `summary` | TEXT，可空 | 版本说明/摘要。 |
| 6 | `config` | JSONB 对象 | 可扩展配置 JSON。保存尚不值得固化为独立列、但仍需要版本化治理的参数。 |
| 7 | `created_at` | TIMESTAMPTZ | 记录创建时间。 |
| 8 | `published_at` | TIMESTAMPTZ，可空 | 该版本被正式发布、生效的时间。 |

## 32. `sop_step`

**语义角色：VERSIONED DEFINITION**  
**当前字段数：8**

某个 SOP 版本的具体步骤、操作说明、证据要求和控制条件。

| # | 字段 | 当前类型（简化） | 中文说明 |
|---:|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 |
| 2 | `sop_version_id` | UUID/标识 | 所属 SOPVersion ID。 |
| 3 | `step_no` | INTEGER/数值 | SOP 中的步骤序号。 |
| 4 | `code` | TEXT | 稳定、机器可读的业务代码。通常用于配置、API、模板和规则引用，不应随显示名称随意改变。 |
| 5 | `title` | TEXT | 面向人的工作项/SOP 步骤标题。 |
| 6 | `instruction` | TEXT | 该 SOP 步骤的具体操作说明。 |
| 7 | `evidence_requirement` | JSONB 对象 | 完成该 SOP 步骤需要留存的证据要求。 |
| 8 | `control` | JSONB 对象 | SOP 步骤的控制条件/限制。 |


# 分析与管理

## 33. `metric_definition`

**语义角色：VERSIONED DEFINITION**  
**当前字段数：12**

指标定义。保存指标计算定义、类型及 lineage，用于企业分析和管理数据层。

| # | 字段 | 当前类型（简化） | 中文说明 |
|---:|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 |
| 2 | `enterprise_id` | UUID/标识，可空 | 所属企业/租户 ID。用于多企业隔离；为空时通常表示全局共享定义。 |
| 3 | `code` | TEXT | 稳定、机器可读的业务代码。通常用于配置、API、模板和规则引用，不应随显示名称随意改变。 |
| 4 | `name` | TEXT | 面向人的显示名称。 |
| 5 | `description` | TEXT，可空 | 对该对象用途和业务含义的补充说明。 |
| 6 | `version` | INTEGER/数值 | 定义/数据集的版本号。版本发布后通常不应原地修改语义。 |
| 7 | `status` | TEXT 枚举 | 当前生命周期/执行状态。允许值由本表对应的枚举约束决定。 |
| 8 | `value_type` | TEXT | 指标输出值的数据类型。 |
| 9 | `definition` | JSONB 对象 | 版本化定义主体，使用 JSONB 保存可扩展的结构化语义。 |
| 10 | `lineage` | JSONB 对象 | 来源、版本、执行路径等血缘信息。 |
| 11 | `created_at` | TIMESTAMPTZ | 记录创建时间。 |
| 12 | `published_at` | TIMESTAMPTZ，可空 | 该版本被正式发布、生效的时间。 |


# 记账与账本

## 34. `ledger_definition`

**语义角色：DEFINITION**  
**当前字段数：8**

账本定义。声明一个账本的数量/金额语义、维度结构和其他配置，本身不保存余额。

| # | 字段 | 当前类型（简化） | 中文说明 |
|---:|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 |
| 2 | `code` | TEXT | 稳定、机器可读的业务代码。通常用于配置、API、模板和规则引用，不应随显示名称随意改变。 |
| 3 | `name` | TEXT | 面向人的显示名称。 |
| 4 | `quantity_semantics` | TEXT，可空 | 该账本 quantity 的业务语义说明。 |
| 5 | `amount_semantics` | TEXT，可空 | 该账本 amount 的业务语义说明。 |
| 6 | `dimension_schema` | JSONB 对象 | 声明该定义允许/要求的维度结构。 |
| 7 | `config` | JSONB 对象 | 可扩展配置 JSON。保存尚不值得固化为独立列、但仍需要版本化治理的参数。 |
| 8 | `created_at` | TIMESTAMPTZ | 记录创建时间。 |

## 35. `posting_rule`

**语义角色：VERSIONED DEFINITION**  
**当前字段数：8**

确定性记账/投影规则。根据 BusinessData 和条件 AST 产生 LedgerEffect。

| # | 字段 | 当前类型（简化） | 中文说明 |
|---:|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 |
| 2 | `application_definition_version_id` | UUID/标识 | 该 PostingRule 所属应用定义版本。 |
| 3 | `code` | TEXT | 稳定、机器可读的业务代码。通常用于配置、API、模板和规则引用，不应随显示名称随意改变。 |
| 4 | `priority` | INTEGER/数值 | 排序优先级，数值语义由对应模块决定。 |
| 5 | `condition_ast` | JSONB 对象 | 记账规则条件表达式 AST；为 true 才执行 effect。 |
| 6 | `effect_ast` | JSONB 对象 | 规则产生 LedgerEffect 的表达式 AST。 |
| 7 | `rule_schema_version` | INTEGER/数值 | PostingRule AST/协议结构版本，不等同于业务版本。 |
| 8 | `created_at` | TIMESTAMPTZ | 记录创建时间。 |

## 36. `posting_input`

**语义角色：DERIVED EXECUTION INPUT**  
**当前字段数：13**

BusinessData 进入 Posting Runtime 后的确定性排队输入，固定 effective time、priority、posting_sequence 和 metadata version。

| # | 字段 | 当前类型（简化） | 中文说明 |
|---:|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 |
| 2 | `enterprise_id` | UUID/标识 | 所属企业/租户 ID。用于多企业隔离；为空时通常表示全局共享定义。 |
| 3 | `consistency_domain` | TEXT | 一致性域。当前通常为 enterprise，用于界定 Posting/Replay 的原子一致性范围。 |
| 4 | `business_data_id` | UUID/标识 | 关联的业务事实 ID，用于建立本表与对应对象之间的稳定关系。 |
| 5 | `application_instance_id` | UUID/标识 | 关联的应用实例 ID，用于建立本表与对应对象之间的稳定关系。 |
| 6 | `effective_at` | TIMESTAMPTZ | 业务或解释在经济意义上的生效时间，与数据库记录时间不同。 |
| 7 | `posting_priority` | INTEGER/数值 | 同一有效时间下的记账优先级。 |
| 8 | `posting_sequence` | BIGINT | 确定性 Posting 顺序号。重放和成本顺序不能依赖数据库物理插入顺序。 |
| 9 | `metadata_version` | INTEGER/数值 | 解释/记账该数据时使用的元数据版本。 |
| 10 | `status` | TEXT 枚举 | 当前生命周期/执行状态。允许值由本表对应的枚举约束决定。 |
| 11 | `retroactive` | BOOLEAN | 是否属于追溯/回溯性输入。追溯输入可能要求触发 Replay。 |
| 12 | `created_at` | TIMESTAMPTZ | 记录创建时间。 |
| 13 | `posted_at` | TIMESTAMPTZ，可空 | 该 PostingInput 完成记账的时间。 |

## 37. `ledger_dataset`

**语义角色：MATERIALIZATION EPOCH**  
**当前字段数：8**

一套 Ledger 数据集/物化世代。支持 CURRENT/CANDIDATE/ARCHIVED，使 replay 可以重建候选数据后再原子切换。

| # | 字段 | 当前类型（简化） | 中文说明 |
|---:|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 |
| 2 | `enterprise_id` | UUID/标识 | 所属企业/租户 ID。用于多企业隔离；为空时通常表示全局共享定义。 |
| 3 | `consistency_domain` | TEXT | 一致性域。当前通常为 enterprise，用于界定 Posting/Replay 的原子一致性范围。 |
| 4 | `kind` | TEXT 枚举 | 数据集用途：当前生效、Replay 候选或历史归档。 |
| 5 | `status` | TEXT 枚举 | 当前生命周期/执行状态。允许值由本表对应的枚举约束决定。 |
| 6 | `posting_boundary_sequence` | BIGINT，可空 | 该数据集已经构建到的 Posting 顺序边界。 |
| 7 | `created_at` | TIMESTAMPTZ | 记录创建时间。 |
| 8 | `activated_at` | TIMESTAMPTZ，可空 | 候选 LedgerDataset 被原子切换为 ACTIVE 的时间。 |

## 38. `posting_run`

**语义角色：EXECUTION/AUDIT**  
**当前字段数：10**

一次 PostingInput 的记账运行记录，区分正常记账和 replay 模式。

| # | 字段 | 当前类型（简化） | 中文说明 |
|---:|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 |
| 2 | `enterprise_id` | UUID/标识 | 所属企业/租户 ID。用于多企业隔离；为空时通常表示全局共享定义。 |
| 3 | `consistency_domain` | TEXT | 一致性域。当前通常为 enterprise，用于界定 Posting/Replay 的原子一致性范围。 |
| 4 | `posting_input_id` | UUID/标识 | 本次运行处理的 PostingInput ID。 |
| 5 | `mode` | TEXT 枚举 | 运行模式：NORMAL 或 REPLAY。 |
| 6 | `metadata_version` | INTEGER/数值 | 解释/记账该数据时使用的元数据版本。 |
| 7 | `status` | TEXT 枚举 | 当前生命周期/执行状态。允许值由本表对应的枚举约束决定。 |
| 8 | `started_at` | TIMESTAMPTZ | 该运行开始执行的时间。 |
| 9 | `completed_at` | TIMESTAMPTZ，可空 | 该运行/流程完成的时间；未完成时为空。 |
| 10 | `error` | JSONB 对象，可空 | 失败时的结构化错误信息。 |

## 39. `ledger_entry`

**语义角色：DERIVED PROJECTION**  
**当前字段数：26**

账本分录。它是 BusinessData 经 PostingRule/ValuationRule 得出的派生投影，不是原始业务事实。

| # | 字段 | 当前类型（简化） | 中文说明 |
|---:|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 |
| 2 | `enterprise_id` | UUID/标识 | 所属企业/租户 ID。用于多企业隔离；为空时通常表示全局共享定义。 |
| 3 | `consistency_domain` | TEXT | 一致性域。当前通常为 enterprise，用于界定 Posting/Replay 的原子一致性范围。 |
| 4 | `ledger_dataset_id` | UUID/标识 | 关联的账本数据集 ID，用于建立本表与对应对象之间的稳定关系。 |
| 5 | `ledger_definition_id` | UUID/标识 | 关联的账本定义 ID，用于建立本表与对应对象之间的稳定关系。 |
| 6 | `posting_run_id` | UUID/标识，可空 | 产生该 LedgerEntry 的 PostingRun；某些估值投影可为空。 |
| 7 | `posting_input_id` | UUID/标识，可空 | 对应的 PostingInput；估值类分录可能通过 valuation posting 产生而为空。 |
| 8 | `business_data_id` | UUID/标识 | 该分录最终可追溯到的 BusinessData ID。 |
| 9 | `posting_rule_id` | UUID/标识，可空 | 产生该分录的 PostingRule ID；估值类分录可为空。 |
| 10 | `posting_rule_schema_version` | INTEGER/数值 | 产生分录时的 PostingRule 协议/结构版本。 |
| 11 | `effect_index` | INTEGER/数值 | 同一规则可能产生多个 effect，本字段是 effect 的稳定序号。 |
| 12 | `quantity` | NUMERIC 高精度数值，可空 | 数量值。使用高精度数值类型，具体业务单位由上下文/unit 决定。 |
| 13 | `amount` | NUMERIC 高精度数值，可空 | 金额/价值发生数。不能简单等同于所有场景中的现金流。 |
| 14 | `unit` | TEXT，可空 | 数量或 Measurement 的计量单位。 |
| 15 | `currency` | TEXT，可空 | 金额表达所使用的货币单位。 |
| 16 | `dimensions` | JSONB 对象 | 结构化维度值，例如仓库、项目、部门等。 |
| 17 | `dimension_hash` | TEXT | 对 dimensions 的稳定摘要，用于高效唯一定位一个维度组合。 |
| 18 | `effective_at` | TIMESTAMPTZ | 业务或解释在经济意义上的生效时间，与数据库记录时间不同。 |
| 19 | `posting_priority` | INTEGER/数值 | 同一有效时间下的记账优先级。 |
| 20 | `posting_sequence` | BIGINT | 确定性 Posting 顺序号。重放和成本顺序不能依赖数据库物理插入顺序。 |
| 21 | `entry_source_kind` | TEXT 枚举 | 分录来源类型：普通 POSTING 或 VALUATION。 |
| 22 | `valuation_posting_run_id` | UUID/标识，可空 | 若分录来自估值差额，关联相应 ValuationPostingRun。 |
| 23 | `cost_result_id` | UUID/标识，可空 | 若分录反映成本结果，关联相应 CostResult。 |
| 24 | `valuation_rule_id` | UUID/标识，可空 | 估值类分录固定使用的 ValuationRule ID。 |
| 25 | `valuation_rule_version` | INTEGER/数值，可空 | 估值类分录固定使用的 ValuationRule 版本。 |
| 26 | `created_at` | TIMESTAMPTZ | 记录创建时间。 |

## 40. `ledger_balance`

**语义角色：MATERIALIZATION**  
**当前字段数：12**

账本当前余额物化。由 LedgerEntry 可确定性重建，主要服务快速查询和工作投影。

| # | 字段 | 当前类型（简化） | 中文说明 |
|---:|---|---|---|
| 1 | `enterprise_id` | UUID/标识 | 所属企业/租户 ID。用于多企业隔离；为空时通常表示全局共享定义。 |
| 2 | `consistency_domain` | TEXT | 一致性域。当前通常为 enterprise，用于界定 Posting/Replay 的原子一致性范围。 |
| 3 | `ledger_dataset_id` | UUID/标识 | 该余额属于哪一代 LedgerDataset。 |
| 4 | `ledger_definition_id` | UUID/标识 | 该余额属于哪个 LedgerDefinition。 |
| 5 | `dimension_hash` | TEXT | 对 dimensions 的稳定摘要，用于高效唯一定位一个维度组合。 |
| 6 | `dimensions` | JSONB 对象 | 结构化维度值，例如仓库、项目、部门等。 |
| 7 | `quantity` | NUMERIC 高精度数值 | 数量值。使用高精度数值类型，具体业务单位由上下文/unit 决定。 |
| 8 | `amount` | NUMERIC 高精度数值 | 金额/价值发生数。不能简单等同于所有场景中的现金流。 |
| 9 | `last_effective_at` | TIMESTAMPTZ | 构成当前余额的最后一条 LedgerEntry 的业务有效时间。 |
| 10 | `last_posting_priority` | INTEGER/数值 | 构成当前余额的最后 PostingPriority。 |
| 11 | `last_posting_sequence` | BIGINT | 构成当前余额的最后 PostingSequence。 |
| 12 | `updated_at` | TIMESTAMPTZ | 记录最近一次更新/物化刷新时间。 |

## 41. `posting_failure`

**语义角色：EXECUTION/AUDIT**  
**当前字段数：8**

记账失败记录。保存错误代码、上下文及是否可重试，支持诊断和恢复。

| # | 字段 | 当前类型（简化） | 中文说明 |
|---:|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 |
| 2 | `enterprise_id` | UUID/标识 | 所属企业/租户 ID。用于多企业隔离；为空时通常表示全局共享定义。 |
| 3 | `posting_input_id` | UUID/标识 | 失败对应的 PostingInput ID。 |
| 4 | `error_code` | TEXT | 稳定的错误代码，便于程序判断与统计。 |
| 5 | `error_message` | TEXT | 面向诊断的错误说明。 |
| 6 | `error_context` | JSONB 对象 | 失败发生时的结构化上下文。 |
| 7 | `retryable` | BOOLEAN | 该失败是否允许自动/人工重试。 |
| 8 | `created_at` | TIMESTAMPTZ | 记录创建时间。 |


# 分配与头寸

## 42. `allocation_policy`

**语义角色：VERSIONED POLICY**  
**当前字段数：15**

来源分配策略。定义可选来源范围、排序、是否允许部分分配、负头寸策略、精度与残差规则。

| # | 字段 | 当前类型（简化） | 中文说明 |
|---:|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 |
| 2 | `enterprise_id` | UUID/标识，可空 | 所属企业/租户 ID。用于多企业隔离；为空时通常表示全局共享定义。 |
| 3 | `code` | TEXT | 稳定、机器可读的业务代码。通常用于配置、API、模板和规则引用，不应随显示名称随意改变。 |
| 4 | `name` | TEXT | 面向人的显示名称。 |
| 5 | `version` | INTEGER/数值 | 定义/数据集的版本号。版本发布后通常不应原地修改语义。 |
| 6 | `status` | TEXT 枚举 | 当前生命周期/执行状态。允许值由本表对应的枚举约束决定。 |
| 7 | `dimensions` | JSONB 数组 | 结构化维度值，例如仓库、项目、部门等。 |
| 8 | `eligibility` | JSONB 对象 | 哪些来源有资格参与本政策分配的规则。 |
| 9 | `source_ordering` | TEXT 枚举 | 自动选择来源时的顺序策略，例如最老优先、最新优先或显式来源。 |
| 10 | `allow_partial_allocation` | BOOLEAN | 是否允许一个来源只被部分消费/一个目标由多个来源共同满足。 |
| 11 | `negative_position_policy` | TEXT 枚举 | 来源不足时如何处理负头寸/暂估状态的政策。 |
| 12 | `precision_policy` | JSONB 对象 | 分配计算的精度、舍入和尾差处理政策。 |
| 13 | `config` | JSONB 对象 | 可扩展配置 JSON。保存尚不值得固化为独立列、但仍需要版本化治理的参数。 |
| 14 | `created_at` | TIMESTAMPTZ | 记录创建时间。 |
| 15 | `published_at` | TIMESTAMPTZ，可空 | 该版本被正式发布、生效的时间。 |

## 43. `allocation_instruction`

**语义角色：CANONICAL INSTRUCTION**  
**当前字段数：15**

显式分配意图/约束。保存人或自动化系统明确指定“这笔业务要消费哪个来源”的业务证据。

| # | 字段 | 当前类型（简化） | 中文说明 |
|---:|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 |
| 2 | `enterprise_id` | UUID/标识 | 所属企业/租户 ID。用于多企业隔离；为空时通常表示全局共享定义。 |
| 3 | `consumer_business_data_id` | UUID/标识 | 要消费/核销来源的目标 BusinessData ID。 |
| 4 | `mode` | TEXT 枚举 | 分配模式：纯显式、纯自动，或先显式再自动补足。 |
| 5 | `source_selector` | JSONB 对象 | 选择分配来源的显式选择器，例如指定 BusinessData、Position 或维度查询。 |
| 6 | `actor_type` | TEXT 枚举 | 发起者类型，例如 HUMAN、AI、AUTOMATION、EXTERNAL_SYSTEM。 |
| 7 | `actor_id` | TEXT/标识 | 发起者在其类型命名空间中的标识。 |
| 8 | `effective_at` | TIMESTAMPTZ | 业务或解释在经济意义上的生效时间，与数据库记录时间不同。 |
| 9 | `recorded_at` | TIMESTAMPTZ | 系统接受/记录该指令的时间。 |
| 10 | `reason` | TEXT，可空 | 创建该指令、绑定或变更的业务原因说明。 |
| 11 | `allocation_policy_id` | UUID/标识 | 本指令要求使用的 AllocationPolicy ID。 |
| 12 | `allocation_policy_version` | INTEGER/数值 | 本指令固定使用的 AllocationPolicy 版本。 |
| 13 | `supersedes_instruction_id` | UUID/标识，可空 | 本指令用于更正/替代的上一条 AllocationInstruction；历史不原地修改。 |
| 14 | `idempotency_key` | TEXT | 幂等键。相同作用域内重复提交相同意图时用于避免重复执行。 |
| 15 | `metadata` | JSONB 对象 | 补充元数据；不承担主业务语义。 |

## 44. `allocation_run`

**语义角色：EXECUTION/AUDIT**  
**当前字段数：9**

一次分配计算运行记录。固定 AllocationPolicy 版本和输入摘要，记录运行状态。

| # | 字段 | 当前类型（简化） | 中文说明 |
|---:|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 |
| 2 | `enterprise_id` | UUID/标识 | 所属企业/租户 ID。用于多企业隔离；为空时通常表示全局共享定义。 |
| 3 | `allocation_policy_id` | UUID/标识 | 本次分配运行实际使用的 AllocationPolicy ID。 |
| 4 | `allocation_policy_version` | INTEGER/数值 | 本次分配运行实际固定的 AllocationPolicy 版本。 |
| 5 | `input_digest` | TEXT | 本次计算输入集合的确定性摘要，用于幂等、审计和重放一致性证明。 |
| 6 | `status` | TEXT 枚举 | 当前生命周期/执行状态。允许值由本表对应的枚举约束决定。 |
| 7 | `started_at` | TIMESTAMPTZ | 该运行开始执行的时间。 |
| 8 | `completed_at` | TIMESTAMPTZ，可空 | 该运行/流程完成的时间；未完成时为空。 |
| 9 | `error` | JSONB 对象，可空 | 失败时的结构化错误信息。 |

## 45. `allocation_relation`

**语义角色：DERIVED RESULT**  
**当前字段数：13**

实际计算出的来源→消费方关系边。它是可重建的派生结果，不等同于人工 AllocationInstruction。

| # | 字段 | 当前类型（简化） | 中文说明 |
|---:|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 |
| 2 | `enterprise_id` | UUID/标识 | 所属企业/租户 ID。用于多企业隔离；为空时通常表示全局共享定义。 |
| 3 | `allocation_run_id` | UUID/标识 | 生成该分配边的 AllocationRun ID。 |
| 4 | `source_business_data_id` | UUID/标识，可空 | 被消费的来源 BusinessData；使用 Position 来源时可以为空。 |
| 5 | `source_position_key` | TEXT，可空 | 被消费的来源 Position 稳定键；使用 BusinessData 来源时可以为空。 |
| 6 | `consumer_business_data_id` | UUID/标识 | 消费来源的目标 BusinessData ID。 |
| 7 | `measurements` | JSONB 数组 | 该分配边实际承载的数量/金额等 Measurement 数组。 |
| 8 | `allocation_sequence` | INTEGER/数值 | 同一次 AllocationRun 内分配边的确定性顺序。 |
| 9 | `instruction_id` | UUID/标识，可空 | 若本分配来自显式业务意图，这里关联 AllocationInstruction；纯自动分配可为空。 |
| 10 | `allocation_policy_id` | UUID/标识 | 关联的分配政策 ID，用于建立本表与对应对象之间的稳定关系。 |
| 11 | `allocation_policy_version` | INTEGER/数值 | 固定使用的分配政策版本号，避免运行时隐式读取“最新版本”。 |
| 12 | `lineage` | JSONB 对象 | 来源、版本、执行路径等血缘信息。 |
| 13 | `created_at` | TIMESTAMPTZ | 记录创建时间。 |

## 46. `position_definition`

**语义角色：VERSIONED DEFINITION**  
**当前字段数：12**

Position 的定义。描述从哪些 BusinessData、哪些字段和维度重建某类开放/剩余经济头寸。

| # | 字段 | 当前类型（简化） | 中文说明 |
|---:|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 |
| 2 | `enterprise_id` | UUID/标识，可空 | 所属企业/租户 ID。用于多企业隔离；为空时通常表示全局共享定义。 |
| 3 | `code` | TEXT | 稳定、机器可读的业务代码。通常用于配置、API、模板和规则引用，不应随显示名称随意改变。 |
| 4 | `name` | TEXT | 面向人的显示名称。 |
| 5 | `version` | INTEGER/数值 | 定义/数据集的版本号。版本发布后通常不应原地修改语义。 |
| 6 | `status` | TEXT 枚举 | 当前生命周期/执行状态。允许值由本表对应的枚举约束决定。 |
| 7 | `semantic_digest` | TEXT | 对该版本的语义内容计算的稳定摘要，用于检测同一版本发生内容漂移。 |
| 8 | `dimensions` | JSONB 数组 | 构成 Position 身份/分组键的维度映射数组。 |
| 9 | `source_rules` | JSONB 数组 | 声明哪些 BusinessData 如何增加/减少 Position，以及从哪些字段取得 Measurements。 |
| 10 | `config` | JSONB 对象 | 可扩展配置 JSON。保存尚不值得固化为独立列、但仍需要版本化治理的参数。 |
| 11 | `created_at` | TIMESTAMPTZ | 记录创建时间。 |
| 12 | `published_at` | TIMESTAMPTZ，可空 | 该版本被正式发布、生效的时间。 |


# 参考数据

## 47. `rate_dataset`

**语义角色：VERSIONED REFERENCE DATA**  
**当前字段数：10**

一组不可变汇率/转换率数据集的版本身份和摘要。运行时必须 pin 到具体 dataset/version/digest。

| # | 字段 | 当前类型（简化） | 中文说明 |
|---:|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 |
| 2 | `enterprise_id` | UUID/标识，可空 | 所属企业/租户 ID。用于多企业隔离；为空时通常表示全局共享定义。 |
| 3 | `code` | TEXT | 稳定、机器可读的业务代码。通常用于配置、API、模板和规则引用，不应随显示名称随意改变。 |
| 4 | `version` | INTEGER/数值 | 定义/数据集的版本号。版本发布后通常不应原地修改语义。 |
| 5 | `status` | TEXT 枚举 | 当前生命周期/执行状态。允许值由本表对应的枚举约束决定。 |
| 6 | `provider` | TEXT | 参考数据提供方/来源。 |
| 7 | `semantic_digest` | TEXT | 对该版本的语义内容计算的稳定摘要，用于检测同一版本发生内容漂移。 |
| 8 | `config` | JSONB 对象 | 可扩展配置 JSON。保存尚不值得固化为独立列、但仍需要版本化治理的参数。 |
| 9 | `created_at` | TIMESTAMPTZ | 记录创建时间。 |
| 10 | `published_at` | TIMESTAMPTZ，可空 | 该版本被正式发布、生效的时间。 |

## 48. `rate_observation`

**语义角色：REFERENCE DATA**  
**当前字段数：14**

RateDataset 中的具体汇率观测值，区分交易确认、结算、期末重估、报告换算等 rate role。

| # | 字段 | 当前类型（简化） | 中文说明 |
|---:|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 |
| 2 | `enterprise_id` | UUID/标识，可空 | 所属企业/租户 ID。用于多企业隔离；为空时通常表示全局共享定义。 |
| 3 | `rate_dataset_id` | UUID/标识 | 所属不可变 RateDataset ID。 |
| 4 | `rate_dataset_version` | INTEGER/数值 | 所属 RateDataset 的固定版本。 |
| 5 | `role` | TEXT 枚举 | 该 RateObservation 的语义角色，例如交易确认、结算或期末重估。 |
| 6 | `source_unit` | TEXT | 换算前的单位/币种。 |
| 7 | `target_unit` | TEXT | 换算后的单位/币种。 |
| 8 | `convention` | TEXT 枚举 | 汇率报价约定；当前 TARGET_PER_SOURCE 表示每 1 source 对应多少 target。 |
| 9 | `rate` | NUMERIC 高精度数值 | 具体换算率/汇率。 |
| 10 | `effective_at` | TIMESTAMPTZ | 业务或解释在经济意义上的生效时间，与数据库记录时间不同。 |
| 11 | `provider` | TEXT | 参考数据提供方/来源。 |
| 12 | `precision` | INTEGER/数值 | 该参考率允许/声明的精度位数。 |
| 13 | `metadata` | JSONB 对象 | 补充元数据；不承担主业务语义。 |
| 14 | `created_at` | TIMESTAMPTZ | 记录创建时间。 |


# 成本与估值

## 49. `valuation_rule`

**语义角色：VERSIONED DEFINITION**  
**当前字段数：12**

把 CostResult 投影到账本的估值记账规则，定义业务数据类型、库存/成本账本及维度映射。

| # | 字段 | 当前类型（简化） | 中文说明 |
|---:|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 |
| 2 | `enterprise_id` | UUID/标识，可空 | 所属企业/租户 ID。用于多企业隔离；为空时通常表示全局共享定义。 |
| 3 | `code` | TEXT | 稳定、机器可读的业务代码。通常用于配置、API、模板和规则引用，不应随显示名称随意改变。 |
| 4 | `name` | TEXT | 面向人的显示名称。 |
| 5 | `source_business_data_type` | TEXT | 该估值规则适用的 BusinessData 类型。 |
| 6 | `inventory_ledger_code` | TEXT | 估值调整涉及的库存/资产账本代码。 |
| 7 | `cogs_ledger_code` | TEXT | 估值调整涉及的成本/损益账本代码。 |
| 8 | `dimension_mapping` | JSONB 对象 | 定义来源字段如何映射到目标维度。 |
| 9 | `version` | INTEGER/数值 | 定义/数据集的版本号。版本发布后通常不应原地修改语义。 |
| 10 | `status` | TEXT 枚举 | 当前生命周期/执行状态。允许值由本表对应的枚举约束决定。 |
| 11 | `created_at` | TIMESTAMPTZ | 记录创建时间。 |
| 12 | `published_at` | TIMESTAMPTZ，可空 | 该版本被正式发布、生效的时间。 |

## 50. `valuation_policy`

**语义角色：VERSIONED POLICY**  
**当前字段数：11**

成本计价政策，例如 FIFO、LIFO、移动平均、个别计价及其 pool grain、负库存等配置。

| # | 字段 | 当前类型（简化） | 中文说明 |
|---:|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 |
| 2 | `enterprise_id` | UUID/标识，可空 | 所属企业/租户 ID。用于多企业隔离；为空时通常表示全局共享定义。 |
| 3 | `code` | TEXT | 稳定、机器可读的业务代码。通常用于配置、API、模板和规则引用，不应随显示名称随意改变。 |
| 4 | `name` | TEXT | 面向人的显示名称。 |
| 5 | `method` | TEXT 枚举 | 成本计价方法：FIFO、LIFO、MOVING_AVERAGE 或 SPECIFIC_IDENTIFICATION。 |
| 6 | `negative_inventory_policy` | TEXT 枚举 | 成本运行遇到负库存时的政策；当前只允许 DISALLOW_NEGATIVE。 |
| 7 | `pool_dimension_schema` | JSONB 对象 | 成本池按哪些维度划分，例如 warehouse + productId。 |
| 8 | `config` | JSONB 对象 | 可扩展配置 JSON。保存尚不值得固化为独立列、但仍需要版本化治理的参数。 |
| 9 | `version` | INTEGER/数值 | 定义/数据集的版本号。版本发布后通常不应原地修改语义。 |
| 10 | `status` | TEXT 枚举 | 当前生命周期/执行状态。允许值由本表对应的枚举约束决定。 |
| 11 | `created_at` | TIMESTAMPTZ | 记录创建时间。 |

## 51. `valuation_posting_run`

**语义角色：EXECUTION/AUDIT**  
**当前字段数：14**

把 CostResult 的目标价值与账本当前已反映价值比较并产生差额分录的一次估值过账运行。

| # | 字段 | 当前类型（简化） | 中文说明 |
|---:|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 |
| 2 | `enterprise_id` | UUID/标识 | 所属企业/租户 ID。用于多企业隔离；为空时通常表示全局共享定义。 |
| 3 | `cost_run_id` | UUID/标识 | 来源 CostRun ID。 |
| 4 | `cost_result_id` | UUID/标识 | 本次估值过账针对的 CostResult ID。 |
| 5 | `business_data_id` | UUID/标识 | 成本对应的业务事实 ID。 |
| 6 | `valuation_rule_id` | UUID/标识 | 本次差额过账使用的 ValuationRule ID。 |
| 7 | `valuation_rule_version` | INTEGER/数值 | 本次差额过账固定的 ValuationRule 版本。 |
| 8 | `previous_total_cost` | NUMERIC 高精度数值 | 估值过账前账本已经反映的总成本。 |
| 9 | `target_total_cost` | NUMERIC 高精度数值 | 当前 CostResult 要求账本最终反映的目标总成本。 |
| 10 | `delta_total_cost` | NUMERIC 高精度数值 | 本次估值过账需要追加的差额。 |
| 11 | `status` | TEXT 枚举 | 当前生命周期/执行状态。允许值由本表对应的枚举约束决定。 |
| 12 | `created_at` | TIMESTAMPTZ | 记录创建时间。 |
| 13 | `completed_at` | TIMESTAMPTZ，可空 | 该运行/流程完成的时间；未完成时为空。 |
| 14 | `error` | JSONB 对象，可空 | 失败时的结构化错误信息。 |

## 52. `valuation_position`

**语义角色：MATERIALIZATION**  
**当前字段数：7**

某 BusinessData 当前已反映的成本/估值位置，用于幂等地计算后续 valuation delta。

| # | 字段 | 当前类型（简化） | 中文说明 |
|---:|---|---|---|
| 1 | `enterprise_id` | UUID/标识 | 所属企业/租户 ID。用于多企业隔离；为空时通常表示全局共享定义。 |
| 2 | `business_data_id` | UUID/标识 | 当前估值位置对应的 BusinessData ID。 |
| 3 | `valuation_rule_id` | UUID/标识 | 当前物化状态使用的 ValuationRule ID。 |
| 4 | `valuation_rule_version` | INTEGER/数值 | 当前物化状态固定的 ValuationRule 版本。 |
| 5 | `total_cost` | NUMERIC 高精度数值 | 当前已经被估值/过账体系反映的总成本。 |
| 6 | `last_cost_result_id` | UUID/标识 | 形成当前 total_cost 的最近 CostResult ID。 |
| 7 | `updated_at` | TIMESTAMPTZ | 记录最近一次更新/物化刷新时间。 |

## 53. `valuation_run`

**语义角色：EXECUTION/AUDIT**  
**当前字段数：14**

一次通用估值运行记录，例如 FX 期末重估或已实现汇兑。可追溯到 canonical valuation.requested。

| # | 字段 | 当前类型（简化） | 中文说明 |
|---:|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 |
| 2 | `enterprise_id` | UUID/标识 | 所属企业/租户 ID。用于多企业隔离；为空时通常表示全局共享定义。 |
| 3 | `request_business_data_id` | UUID/标识，可空 | 触发本次估值解释的 canonical valuation.requested BusinessData ID；技术性直接调用可为空。 |
| 4 | `valuation_kind` | TEXT | 估值运行类别，例如 FX_PERIOD_END、FX_REALIZED_SETTLEMENT。 |
| 5 | `effective_at` | TIMESTAMPTZ | 业务或解释在经济意义上的生效时间，与数据库记录时间不同。 |
| 6 | `input_digest` | TEXT | 本次估值解释的确定性输入摘要。 |
| 7 | `rate_dataset_id` | UUID/标识，可空 | 本次运行或观测所属的 RateDataset ID。 |
| 8 | `rate_dataset_version` | INTEGER/数值，可空 | 固定使用的 RateDataset 版本。 |
| 9 | `rate_dataset_digest` | TEXT，可空 | 固定 RateDataset 的内容摘要，防止同一版本被静默改写。 |
| 10 | `policy` | JSONB 对象 | 本次运行实际使用的政策参数快照。 |
| 11 | `status` | TEXT 枚举 | 当前生命周期/执行状态。允许值由本表对应的枚举约束决定。 |
| 12 | `started_at` | TIMESTAMPTZ | 该运行开始执行的时间。 |
| 13 | `completed_at` | TIMESTAMPTZ，可空 | 该运行/流程完成的时间；未完成时为空。 |
| 14 | `error` | JSONB 对象，可空 | 失败时的结构化错误信息。 |

## 54. `valuation_result`

**语义角色：DERIVED RESULT**  
**当前字段数：13**

通用估值运行的派生结果，保存来源事实、输入/输出 Measurements、估值差额及 lineage。

| # | 字段 | 当前类型（简化） | 中文说明 |
|---:|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 |
| 2 | `enterprise_id` | UUID/标识 | 所属企业/租户 ID。用于多企业隔离；为空时通常表示全局共享定义。 |
| 3 | `valuation_run_id` | UUID/标识 | 生成该结果的 ValuationRun ID。 |
| 4 | `result_kind` | TEXT | 结果类别，通常与 ValuationRun 的语义家族对应。 |
| 5 | `position_key` | TEXT | 被估值的经济 Position 稳定键。 |
| 6 | `source_business_data_ids` | JSONB 数组 | 参与本次估值/推导的 BusinessData ID 集合。 |
| 7 | `dimensions` | JSONB 对象 | 结构化维度值，例如仓库、项目、部门等。 |
| 8 | `source_measurements` | JSONB 数组 | 估值/计算前的输入 Measurements 数组。 |
| 9 | `target_measurements` | JSONB 数组 | 估值/计算后的目标 Measurements 数组。 |
| 10 | `delta_amount` | NUMERIC 高精度数值 | 估值前后产生的价值差额。 |
| 11 | `delta_unit` | TEXT | delta_amount 的单位/币种。 |
| 12 | `lineage` | JSONB 对象 | 来源、版本、执行路径等血缘信息。 |
| 13 | `created_at` | TIMESTAMPTZ | 记录创建时间。 |

## 55. `cost_run`

**语义角色：EXECUTION/AUDIT**  
**当前字段数：12**

一次成本计算运行。固定成本方法、ValuationPolicy、AllocationPolicy 和成本引擎版本。

| # | 字段 | 当前类型（简化） | 中文说明 |
|---:|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 |
| 2 | `enterprise_id` | UUID/标识 | 所属企业/租户 ID。用于多企业隔离；为空时通常表示全局共享定义。 |
| 3 | `method` | TEXT 枚举 | 成本计价方法或其他表内定义的方法类型。 |
| 4 | `status` | TEXT 枚举 | 当前生命周期/执行状态。允许值由本表对应的枚举约束决定。 |
| 5 | `started_at` | TIMESTAMPTZ | 该运行开始执行的时间。 |
| 6 | `completed_at` | TIMESTAMPTZ，可空 | 该运行/流程完成的时间；未完成时为空。 |
| 7 | `error` | JSONB 对象，可空 | 失败时的结构化错误信息。 |
| 8 | `valuation_policy_id` | UUID/标识，可空 | 本次 CostRun 固定使用的 ValuationPolicy ID。 |
| 9 | `valuation_policy_version` | INTEGER/数值，可空 | 本次 CostRun 固定使用的 ValuationPolicy 版本。 |
| 10 | `allocation_policy_id` | UUID/标识，可空 | 本次 CostRun 固定使用的 AllocationPolicy ID。 |
| 11 | `allocation_policy_version` | INTEGER/数值，可空 | 本次 CostRun 固定使用的 AllocationPolicy 版本。 |
| 12 | `cost_engine_version` | TEXT | 生成 CostResult 时使用的成本引擎语义/实现版本。 |

## 56. `cost_result`

**语义角色：DERIVED RESULT**  
**当前字段数：12**

成本运行对某 BusinessData 计算出的数量、单位成本、总成本以及使用的 ValuationRule。

| # | 字段 | 当前类型（简化） | 中文说明 |
|---:|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 |
| 2 | `enterprise_id` | UUID/标识 | 所属企业/租户 ID。用于多企业隔离；为空时通常表示全局共享定义。 |
| 3 | `cost_run_id` | UUID/标识 | 生成该成本结果的 CostRun ID。 |
| 4 | `business_data_id` | UUID/标识 | 被计算成本的 BusinessData ID。 |
| 5 | `pool_key` | TEXT | 成本池的稳定键，由政策定义的 valuation scope/dimensions 计算得到。 |
| 6 | `method` | TEXT | 成本计价方法或其他表内定义的方法类型。 |
| 7 | `quantity` | NUMERIC 高精度数值 | 数量值。使用高精度数值类型，具体业务单位由上下文/unit 决定。 |
| 8 | `unit_cost` | NUMERIC 高精度数值，可空 | 计算得到的单位成本。 |
| 9 | `total_cost` | NUMERIC 高精度数值，可空 | 计算得到的总成本。 |
| 10 | `valuation_rule_id` | UUID/标识，可空 | 后续把本 CostResult 投影到账本时固定使用的 ValuationRule ID。 |
| 11 | `valuation_rule_version` | INTEGER/数值，可空 | CostResult 固定的 ValuationRule 版本。 |
| 12 | `created_at` | TIMESTAMPTZ | 记录创建时间。 |


# 重放与血缘

## 57. `calculation_dependency_edge`

**语义角色：DERIVED INDEX**  
**当前字段数：11**

计算依赖图的边。描述某个事实/政策/参考数据变化会影响哪些派生结果或物化，是可重建的 impact/provenance 索引。

| # | 字段 | 当前类型（简化） | 中文说明 |
|---:|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 |
| 2 | `enterprise_id` | UUID/标识 | 所属企业/租户 ID。用于多企业隔离；为空时通常表示全局共享定义。 |
| 3 | `graph_version` | TEXT | 计算依赖图版本。不同算法/语义版本的边不能无条件混用。 |
| 4 | `from_kind` | TEXT | 依赖边起点对象的类型。 |
| 5 | `from_id` | UUID/标识 | 依赖边起点对象的稳定标识。 |
| 6 | `to_kind` | TEXT | 依赖边终点对象的类型。 |
| 7 | `to_id` | UUID/标识 | 依赖边终点对象的稳定标识。 |
| 8 | `edge_kind` | TEXT 枚举 | 依赖关系类别，例如 ALLOCATION、VALUATION、PROJECTION、MATERIALIZATION、CALCULATION。 |
| 9 | `effective_from` | TIMESTAMPTZ，可空 | 该依赖关系从何时开始具有经济/计算意义。 |
| 10 | `lineage` | JSONB 对象 | 来源、版本、执行路径等血缘信息。 |
| 11 | `created_at` | TIMESTAMPTZ | 记录创建时间。 |

## 58. `replay_checkpoint`

**语义角色：MATERIALIZATION**  
**当前字段数：21**

重放检查点。保存边界序号、输入摘要、版本 pins、物化摘要和有效性条件，用来加速安全的增量重算。

| # | 字段 | 当前类型（简化） | 中文说明 |
|---:|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 |
| 2 | `enterprise_id` | UUID/标识 | 所属企业/租户 ID。用于多企业隔离；为空时通常表示全局共享定义。 |
| 3 | `consistency_domain` | TEXT | 一致性域。当前通常为 enterprise，用于界定 Posting/Replay 的原子一致性范围。 |
| 4 | `boundary_sequence` | BIGINT | 本次 Replay/Checkpoint 覆盖到的最后 posting_sequence。 |
| 5 | `ordered_input_digest` | TEXT | Checkpoint 边界内、按确定性顺序排列的 canonical 输入摘要。 |
| 6 | `last_included_business_data_id` | UUID/标识，可空 | Checkpoint 边界最后包含的 BusinessData ID，便于追踪输入边界。 |
| 7 | `template_version` | TEXT | Checkpoint 绑定的 EnterpriseTemplate 版本身份/摘要。 |
| 8 | `posting_policy_pins` | JSONB 对象 | Checkpoint 固定的 Posting 规则/政策版本集合。 |
| 9 | `allocation_policy_pins` | JSONB 对象 | Checkpoint 固定的 AllocationPolicy 版本集合。 |
| 10 | `valuation_policy_pins` | JSONB 对象 | Checkpoint 固定的 Cost/Valuation 政策版本集合。 |
| 11 | `reference_dataset_pins` | JSONB 对象 | Checkpoint 固定的外部/参考数据集版本集合，例如 RateDataset。 |
| 12 | `runtime_semantic_version` | TEXT | 生成该 Checkpoint/认证时采用的 Economic Runtime 语义版本。 |
| 13 | `dependency_graph_version` | TEXT | 对应的计算依赖图版本。 |
| 14 | `materialization_digest` | TEXT | 当前派生/物化状态的确定性摘要，用于 Full Replay 与增量重算结果比较。 |
| 15 | `validity` | JSONB 对象 | Checkpoint 的有效性条件和安全标记。 |
| 16 | `status` | TEXT 枚举 | 当前生命周期/执行状态。允许值由本表对应的枚举约束决定。 |
| 17 | `parent_checkpoint_id` | UUID/标识，可空 | 上一个/父 Checkpoint，用于表达检查点链。 |
| 18 | `source_replay_run_id` | UUID/标识，可空 | 生成并验证该 Checkpoint 的 Full ReplayRun ID。 |
| 19 | `invalidated_at` | TIMESTAMPTZ，可空 | Checkpoint 被判定失效的时间。 |
| 20 | `invalidation_reason` | TEXT，可空 | Checkpoint 失效原因。 |
| 21 | `created_at` | TIMESTAMPTZ | 记录创建时间。 |

## 59. `replay_coverage_certification`

**语义角色：CERTIFICATION**  
**当前字段数：19**

重放覆盖认证记录。机器验证依赖图、物化摘要、派生运行、参考数据 pins、模板绑定是否完整。

| # | 字段 | 当前类型（简化） | 中文说明 |
|---:|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 |
| 2 | `enterprise_id` | UUID/标识 | 所属企业/租户 ID。用于多企业隔离；为空时通常表示全局共享定义。 |
| 3 | `consistency_domain` | TEXT | 一致性域。当前通常为 enterprise，用于界定 Posting/Replay 的原子一致性范围。 |
| 4 | `runtime_semantic_version` | TEXT | 生成该 Checkpoint/认证时采用的 Economic Runtime 语义版本。 |
| 5 | `dependency_graph_version` | TEXT | 对应的计算依赖图版本。 |
| 6 | `certification_version` | INTEGER/数值 | 同一覆盖范围下的认证版本号。 |
| 7 | `status` | TEXT 枚举 | 当前生命周期/执行状态。允许值由本表对应的枚举约束决定。 |
| 8 | `dependency_graph_complete` | BOOLEAN | 依赖图 producer family 是否已经机器证明覆盖完整。 |
| 9 | `materialization_digest_complete` | BOOLEAN | 物化摘要是否覆盖要求的 Economic Runtime 派生家族。 |
| 10 | `derived_runtime_replay_complete` | BOOLEAN | Full Replay 是否已经机器证明重建所有要求的派生运行。 |
| 11 | `reference_dataset_pins_complete` | BOOLEAN | 实际使用的参考数据集是否全部被明确 pin。 |
| 12 | `template_binding_complete` | BOOLEAN | 企业当前模板绑定是否被 Checkpoint/认证完整固定。 |
| 13 | `evidence` | JSONB 对象 | 机器认证使用的结构化证据。 |
| 14 | `semantic_digest` | TEXT | 对该版本的语义内容计算的稳定摘要，用于检测同一版本发生内容漂移。 |
| 15 | `certified_by` | TEXT，可空 | 完成认证的主体标识。 |
| 16 | `certified_at` | TIMESTAMPTZ，可空 | 认证正式通过的时间。 |
| 17 | `revoked_at` | TIMESTAMPTZ，可空 | 认证被撤销的时间。 |
| 18 | `revoke_reason` | TEXT，可空 | 撤销认证的原因。 |
| 19 | `created_at` | TIMESTAMPTZ | 记录创建时间。 |

## 60. `replay_run`

**语义角色：EXECUTION/AUDIT**  
**当前字段数：19**

一次 Full Replay 的全过程记录，包括边界、前后摘要、固定 Cost/Allocation/Valuation pins 及验证结果。

| # | 字段 | 当前类型（简化） | 中文说明 |
|---:|---|---|---|
| 1 | `id` | UUID/标识 | 记录主键。通常为 UUID，用于稳定标识这一条记录。 |
| 2 | `enterprise_id` | UUID/标识 | 所属企业/租户 ID。用于多企业隔离；为空时通常表示全局共享定义。 |
| 3 | `consistency_domain` | TEXT | 一致性域。当前通常为 enterprise，用于界定 Posting/Replay 的原子一致性范围。 |
| 4 | `mode` | TEXT 枚举 | Replay 类型；当前架构只允许 FULL 作为 correctness oracle。 |
| 5 | `status` | TEXT 枚举 | 当前生命周期/执行状态。允许值由本表对应的枚举约束决定。 |
| 6 | `boundary_sequence` | BIGINT，可空 | 本次 Replay/Checkpoint 覆盖到的最后 posting_sequence。 |
| 7 | `before_digest` | TEXT，可空 | Replay 前目标派生状态的摘要。 |
| 8 | `before_snapshot` | JSONB 数组，可空 | Replay 前用于诊断/比较的状态快照。 |
| 9 | `after_digest` | TEXT，可空 | Replay 重建完成后的派生状态摘要。 |
| 10 | `validation_status` | TEXT 枚举，可空 | Replay 前后摘要的验证结果，例如 MATCH/MISMATCH。 |
| 11 | `started_at` | TIMESTAMPTZ | 该运行开始执行的时间。 |
| 12 | `completed_at` | TIMESTAMPTZ，可空 | 该运行/流程完成的时间；未完成时为空。 |
| 13 | `error` | JSONB 对象，可空 | 失败时的结构化错误信息。 |
| 14 | `cost_method` | TEXT 枚举，可空 | 该 Full Replay 重建成本时固定使用的成本方法。 |
| 15 | `valuation_policy_id` | UUID/标识，可空 | Replay 固定的 ValuationPolicy ID。 |
| 16 | `valuation_policy_version` | INTEGER/数值，可空 | Replay 固定的 ValuationPolicy 版本。 |
| 17 | `allocation_policy_id` | UUID/标识，可空 | Replay 固定的 AllocationPolicy ID。 |
| 18 | `allocation_policy_version` | INTEGER/数值，可空 | Replay 固定的 AllocationPolicy 版本。 |
| 19 | `valuation_rule_pins` | JSONB 对象 | Replay 固定的 ValuationRule id/version 集合。 |


---

## 6. 为什么当前仍是关系数据库

当前 EVO 的物理主库是 PostgreSQL，但不能把 EVO 理解成“传统关系型 ERP”。

关系数据库目前主要承担：

- ACID 事务；
- 多企业隔离；
- 主键/外键/唯一性约束；
- 确定性序号；
- 版本化定义；
- 高精度数量和金额；
- JSONB 业务语义载荷；
- Replay/Checkpoint/Digest 的可靠持久化。

而逻辑模型已经包含多种图：

- Business Causality Graph；
- Allocation Graph；
- Cost / Valuation Derivation Graph；
- Projection Lineage Graph；
- Calculation Dependency Graph。

当前阶段这些 graph 仍使用 PostgreSQL 关系表表达。未来如果图查询、分析或搜索规模证明需要专用引擎，可以增加 Graph / Analytics / Search 等物理存储，但不应该改变 EVO 的 canonical semantic contract。

---

## 7. 为什么有大量 JSONB

JSONB 在 EVO 中不是“懒得设计字段”。

它主要用于两类数据：

1. **应用/模板层的可扩展业务语义**  
   例如 `business_data.payload`、规则 AST、定义 config。

2. **版本化结构数据或 Measurements/Dimensions 集合**  
   例如 `position_definition.source_rules`、`valuation_result.source_measurements`。

相反，需要稳定索引、唯一性、版本 pin、跨模块关联和 replay 边界的字段，仍然优先使用显式关系字段。

当前原则：

> **Semantic Normalization, Physical Denormalization.**

语义必须清晰分层；物理实现可以为了性能和可演进性使用 JSONB、余额表、快照、checkpoint 和派生索引。

---

## 8. 学习时最值得先看的 12 张表

建议按下面顺序理解 EVO：

1. `enterprise` — 多企业根节点；
2. `application_definition_version` — 应用定义如何版本化；
3. `command_definition` — 什么动作可以发生；
4. `command_execution` — 一次请求如何执行；
5. `business_data` — 什么才是不可变业务事实；
6. `posting_rule` — 事实如何解释成账本影响；
7. `ledger_entry` — 派生账本分录；
8. `allocation_instruction` — 人/业务如何明确指定来源；
9. `allocation_relation` — 系统实际算出的来源消费关系；
10. `valuation_result` — 价值解释的派生结果；
11. `replay_run` — 如何从事实重建结果；
12. `replay_checkpoint` — 如何在保证正确性的前提下加速重放。

如果理解了这 12 张，再看其他表会容易很多。

---

## 9. 当前阶段需要特别记住的边界

### 9.1 BusinessData 不等于传统“业务单据当前行”

`business_data` 保存的是不可变事实。

修改、撤销、冲销、重估等行为不应把旧事实原地改成新状态，而应通过新增事实/指令/解释表达。

### 9.2 LedgerEntry 不是原始业务真相

`ledger_entry` 是 PostingRule / ValuationRule 对 canonical facts 的确定性投影。

它应该可以通过 Full Replay 重建。

### 9.3 Balance 不是事实

`ledger_balance` 是 Materialization。

余额丢失不应该导致业务历史丢失；理论上可以从 LedgerEntry 重建。

### 9.4 AllocationInstruction 和 AllocationRelation 不是同一个东西

`allocation_instruction`：

> “业务明确要求从哪个来源消费。”

`allocation_relation`：

> “运行时根据指令/政策实际算出了怎样的来源消费边。”

前者可能是 canonical business evidence；后者默认是 derived result。

### 9.5 Cost / Valuation 需要固定版本

Cost、FX、估值等运行不能在 Replay 时去找“当前最新规则”。

因此大量表同时保存：

- policy id；
- policy version；
- rule id；
- rule version；
- dataset id；
- dataset version；
- digest。

这些字段看起来重复，但它们是确定性 Replay 的必要证据。

---

## 10. 维护规则

这是一份 **Current Stage Snapshot**。

未来数据库变更时：

- 不覆盖本阶段含义；
- migration 只追加，不改已经执行的历史 migration；
- 表/字段增加或语义变化时提升本文档版本；
- 统计数字重新由 `Database` 类型和 migration 交叉生成；
- 删除/废弃字段必须说明迁移路径；
- canonical / derived / materialization 角色改变必须通过 ADR，而不能只改表结构；
- LLM 修改数据库前应先读取本文件、Architecture Freeze ADR 和对应模块契约。

---

## 11. 当前统计基线

```text
Database                  PostgreSQL
Schema version            13
Tables                    60
Fields                    635
Migration SQL files       15
Migration infra tables    1
EVO tables                59
```

本统计属于 2026-09-19 当前分支快照。后续任何数字变化都应视为正常演进，但必须通过 migration + contract + documentation 留下可追踪历史。

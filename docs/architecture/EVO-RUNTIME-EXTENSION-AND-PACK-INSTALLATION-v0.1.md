# EVO Runtime Extension and Pack Installation v0.1
# EVO 运行时扩展与安装边界 v0.1

**Status: TARGET ARCHITECTURE**  
**Date: 2026-09-23**

## 1. Fundamental Correction

EVO Core 的“核心”不仅是代码层边界，更必须是运行时边界。

最终目标不是单进程 import 各种插件，而是：

```text
EVO Core Service
        ↕ Public API / Events / Package Protocol
Independent Packs / Services / Eidos / EC
```

强约束：

> **扩展不得通过 import EVO Core 私有代码实现能力；EVO Core 也不得通过 import 扩展实现来获得可选能力。**

代码可以暂时同一 GitHub repository，但运行时所有权必须按独立服务设计。

## 2. Three Extension Types

### 2.1 Definition Package / 定义安装包

绝大多数企业业务扩展应当是“数据/定义包”，不是加载代码插件。

例如 Ledger Definitions、Posting Rules、Transaction Types、Objects / Fields、Applications、Forms / Views、Business Ledger templates、Finance templates、Reporting definitions。

安装路径：

```text
Package Artifact
→ Package Install API
→ Validate
→ Resolve Dependencies
→ Persist Versioned Definitions
→ Activate
```

安装完成后，Core 只运行声明式定义。Package 不进入 Core 进程，也不执行任意代码。

### 2.2 External Runtime Extension / 外部运行时扩展

只有 Core 原语无法表达的通用执行能力才允许成为 Runtime Extension，例如 Costing、advanced valuation、optimization、special industry calculation、external protocol adapter。

它必须是独立进程 / 服务，通过版本化协议协作：

```text
EVO Core
→ request/event contract
→ External Runtime Extension
→ result/command/posting contract
→ EVO Core
```

必须具备 capability manifest、protocol version、timeout、idempotency、retry、health、authentication、tenant context、failure isolation。

Core 不加载其 binary/library。

### 2.3 Projection / Experience / Learning Consumer

Reporting、DW、Search、Eidos、EC 默认作为外围消费者：

```text
EVO Core
├─ Snapshot / Bulk Export
├─ Change Feed
├─ Query API
└─ Events
        ↓
Independent Consumer
        ↓
Own storage / cache / model
```

消费者不得直接连接 Core 私有数据库。

## 3. Runtime Installation Model

“安装插件”在 EVO 中应优先表示为注册和部署能力，而不是 npm dependency。

```text
Discover Package
→ Verify Signature / Digest
→ Validate Compatibility
→ Resolve Dependency
→ Install Definitions
→ Register External Capabilities if any
→ Activate
→ Health Check
→ Certification
```

卸载不得删除无法重建的权威 BusinessData / Ledger history。

## 4. No In-process Plugin Contract

最终架构禁止把以下作为正式扩展方式：

- import Core private implementation；
- npm package linking to EVO runtime internals；
- shared database tables as integration contract；
- plugin code executed inside EVO Core process；
- plugin-defined SQL directly mutating Core tables。

即使官方 Pack 与 EVO 同仓，也必须遵守同样规则。

## 5. Public Contract Is Protocol, Not Implementation Library

允许提供 SDK，但 SDK 只能是协议客户端。

权威源优先使用 OpenAPI、JSON Schema、AsyncAPI / Event Schema，未来需要时可增加 protobuf。

```text
Protocol Schema
→ generated TypeScript / Java / Python SDK
```

因此：

> SDK dependency is acceptable; runtime implementation dependency is not.

SDK 不得暴露 Core repository class、database type 或 infrastructure interface。

## 6. Core Service Boundary

最小 EVO Core Service 只承诺：

- BusinessData API；
- Posting Rule API；
- Ledger Definition API；
- Posting API；
- Ledger Entry Query API；
- Balance API；
- Replay API；
- Provenance API；
- Snapshot / Export API；
- Change Feed / Event Contract；
- Package Definition Install API。

## 7. Database Boundary

Core owns Core storage。

第一阶段允许不同能力物理使用同一个 PostgreSQL server，但 schema ownership 必须独立，跨 owner SQL 不得作为正式协议。

Definition Package 通过 Core Package API 将 Ledger / Posting definitions 安装到 Core-owned storage，而不是自己直接写表。

## 8. Finance Example

三大报表不应被 Core import。

目标：

```text
EVO Core
→ Snapshot + Change Feed / Public Accounting Contract
→ Finance Accounting Service/Pack
→ Finance Reporting Service/Pack
→ own projection store
```

如果 Finance Accounting 只是规则/科目模板，可以作为 Definition Package；如果需要独立 Journal/Close runtime，则作为独立服务运行。

Finance Reporting 必须能够独立扩容、缓存、分库和延迟刷新。

## 9. Application Platform Example

Object / Field / Transaction Type / Application definitions 可以打成独立 Definition Package。

Eidos/Application Platform 通过 Public API 安装定义、读取 effective definitions、提交 BusinessData / Command，不 import EVO implementation。

## 10. EC Boundary

EC 永远是独立服务。

```text
EVO/Eidos
→ durable telemetry
→ EC

EC
→ recommendation/experience package
→ public contract
→ EVO/Eidos
```

EC 离线不影响 EVO/Eidos 运行。

## 11. Transitional Compatibility Layer

当前仓库中的 `createEvoRuntime()` 与新建的 `createEvoKernelRuntime()` 是迁移期结构，不是最终插件模型。

它们用于保留现有认证并逐步识别依赖。

最终 `createEvoKernelRuntime()` 只作为 EVO Core Service 内部 composition root；`createEvoRuntime()` 应退化为开发/兼容发行编排器，不能成为正式插件耦合机制。

## 12. Migration Direction

```text
1. Freeze Kernel Public Protocol
2. Extract independent Kernel service composition
3. Add Package Install API / Manifest
4. Add Snapshot + Change Feed
5. Convert one non-Core capability to external consumer
6. Prove no direct DB/import dependency
7. Repeat for Finance / Reporting / Application / EC
8. Retire compatibility in-process composition when no longer needed
```

第一批建议用 Finance Reporting 做外部化证明，因为其数据可以从稳定财务/账本数据构建且性能责任清晰。

## 13. Hard Architecture Invariant

最终必须满足：

```text
Optional capability removed
→ EVO Core still starts
→ EVO Core still posts
→ EVO Core still queries balances
→ EVO Core still replays
```

以及：

```text
EVO Core implementation replaced
→ extensions continue working
provided Public Protocol remains compatible
```

这才是真正的低耦合。


## 14. Architecture Decision — LLM-Native Extension Model

**Decision: APPROVED TARGET ARCHITECTURE**

EVO 不采用“所有扩展都通过代码 import”的插件模型，也不采用“所有模块都拆成微服务”的模型。

最终采用：

> **Modular Core Service + Protocol-Isolated Extensions + Declarative Packages**

即：

```text
                 ┌─────────────────────────┐
                 │      EVO Core Service   │
                 │                         │
                 │ BusinessData            │
                 │ Posting Rules           │
                 │ Ledger                  │
                 │ Balance                 │
                 │ Replay                  │
                 └────────────┬────────────┘
                              │
          Public API / Events / Package Protocol
                              │
          ┌───────────────────┼───────────────────┐
          │                   │                   │
 Definition Packages   External Runtime      Consumers
 App/Field/Rules       Cost/Valuation        Reporting/Eidos/EC
```

### 14.1 Where code import IS allowed

在 EVO Core Service 内部，Kernel 自身实现可以使用代码级模块化与静态 import。

例如：

```text
posting application service
→ BusinessData port
→ LedgerWriter port
```

允许 import：

- stable internal interfaces / ports；
- domain value objects；
- Kernel-owned contracts；
- generated protocol types used internally。

但必须保持依赖方向和 architecture tests。

Core 内部不需要为了“纯粹解耦”强行经过网络。

原因：

- Posting / Ledger / Balance 存在强事务和低延迟要求；
- 分布式事务会增加错误面；
- Replay deterministic execution 更适合明确的本地执行边界；
- 不应为尚不存在的规模问题增加网络 hop。

### 14.2 Where implementation import IS forbidden

只要能力是“可选安装 / 可卸载”的，就不能依赖 EVO Core 的实现代码。

禁止：

```text
Finance Reporting
→ import PostgresLedgerReader

Cost extension
→ import PostingService

Eidos
→ import EVO database repository
```

允许：

```text
Finance Reporting
→ generated EVO API client

Cost Extension
→ versioned runtime protocol

Eidos
→ Public API / Event Contract
```

### 14.3 Microservice is a deployment choice, not the primary abstraction

EVO 不把“微服务”本身作为架构目标。

首要目标是：

```text
semantic ownership
+ protocol boundary
+ independent lifecycle
+ failure isolation where needed
```

只有满足以下一项或多项时，才值得独立成 Runtime Service：

- 需要独立扩容；
- 需要异步长时间执行；
- 需要独立故障隔离；
- 需要独立技术栈；
- 第三方提供；
- 需要独立发布；
- 生命周期与 Core 显著不同；
- 计算资源特征与 Core 显著不同。

否则优先选择 Definition Package，而不是新增服务。

### 14.4 LLM-Native reason

LLM-native 的关键不是“更多微服务”，而是：

- contract machine-readable；
- ownership machine-readable；
- dependency direction machine-checkable；
- package manifest machine-readable；
- compatibility machine-verifiable；
- tests/certifications executable；
- module context small enough for independent reasoning。

因此对 LLM 最友好的系统是：

> **边界非常硬，但运行拓扑不过度复杂。**

### 14.5 Official packs and third-party packs obey the same rule

官方 Pack 不能因为“和 EVO 是同一个团队”就获得私有访问权。

长期原则：

```text
Official Pack
Third-party Pack
Eidos
EC
External Integration
```

在 Core 边界外的访问规则相同。

这可以防止“官方代码先偷用内部实现，第三方永远无法真正扩展”的架构腐化。

### 14.6 Repository topology does not define runtime topology

可以长期保持 monorepo：

```text
/EVO
  /core-service
  /packs
  /services
  /contracts
  /sdk
```

但 CI 必须证明：

- external pack 不 import Core implementation；
- external service 不使用 Core private DB schema；
- contracts/sdk 可独立构建；
- 可选能力缺失时 Core 可独立启动。

是否物理拆 GitHub repository，由发布、权限、规模和组织需求决定，不作为低耦合前提。

### 14.7 Decision summary

最终拍板：

```text
Inside EVO Core:
    code import through strict internal interfaces is GOOD.

Across EVO Core boundary:
    implementation import is FORBIDDEN.

Most business extensibility:
    declarative installation package.

Executable optional capabilities:
    protocol-isolated runtime extension.

Reporting / Eidos / EC:
    independent consumers/services.

Microservices:
    used only when lifecycle/performance/isolation justifies them.
```

这条决策优先于此前任何“所有插件都必须微服务化”或“所有插件都通过代码 import”的理解。


## 15. Business Rationale — Growth by Installation

本架构的直接业务来源不是“技术上喜欢插件化”，而是企业自身会成长。

EVO 必须支持同一个企业从极简形态逐步生长，而不需要更换底座。

典型路径：

```text
One-person Company
        ↓ install capabilities
Small Team
        ↓ install capabilities
Small Company
        ↓ install capabilities
Industry-specific Company
        ↓ install capabilities
Larger Enterprise
```

核心原则：

> **企业的成长主要表现为安装更多能力、更多应用、更多定义和更多服务，而不是替换 EVO Core。**

### 15.1 One-person Company

最小企业可能只需要：

```text
EVO Core
+
Simple Trading / Inventory Definition Package
```

能力可能只有：

- Inventory ledger；
- Cash ledger；
- Receivable；
- Payable；
- Purchase / Sales posting rules；
- 极少量业务应用。

它不应被迫安装：

- Finance Reporting；
- Manufacturing；
- Workflow；
- APQC；
- EC；
- Advanced Analytics。

### 15.2 Small Team

当企业开始多人协作，可以继续安装：

- User / Role / Policy capability；
- Approval / Workflow；
- Work / Todo；
- Shared Sales / Procurement applications；
- basic operational dashboards。

原有 BusinessData / Ledger history 不迁移、不重建为另一套产品。

### 15.3 Small Company

企业继续成长时，可以再安装：

- Finance Accounting；
- Payroll / Expense；
- Inventory management；
- Costing；
- CRM；
- Reporting；
- multi-department dimensions；
- stronger permission policies。

EVO Core 本身不因为企业规模变化而变成另一个 SKU。

### 15.4 Industry Growth

不同行业通过安装不同 Industry Package / Application Package 扩展：

```text
Retail
Manufacturing
Trading
Service
Logistics
Construction
Professional Services
...
```

行业包主要组合：

- ledger definitions；
- posting rules；
- objects / fields；
- transaction types；
- applications；
- forms / views；
- workflows；
- reports；
- optional runtime extensions。

因此“行业 ERP”是 EVO Core + 行业能力组合，而不是另一套底层系统。

## 16. UI-driven Installation

最终用户应能够在界面上完成“安装应用 / 安装能力”。

推荐用户体验：

```text
App / Capability Catalog
→ select capability
→ view dependencies and permissions
→ preview changes
→ install
→ configure
→ activate
```

用户看到的可以是“应用”，而底层安装器实际处理：

- Definition Package；
- dependent packages；
- optional external service registration；
- schema/projection initialization；
- compatibility check；
- version pinning；
- activation。

用户无需理解微服务、数据库、Posting Rule 或 Ledger Definition。

### 16.1 Installable Unit

对用户而言安装单位可以称为：

- App；
- Module；
- Capability；
- Industry Package。

对系统而言统一抽象为：

```text
Installable Package
```

Manifest 至少需要描述：

- package id；
- version；
- display name；
- capabilities provided；
- dependencies；
- required EVO protocol version；
- tenant/local compatibility；
- configuration schema；
- data ownership；
- permissions requested；
- install/upgrade/uninstall behavior；
- runtime endpoint requirements if any；
- digest/signature。

## 17. Local Deployment and Cloud Tenant Must Share the Same Model

EVO 必须同时支持：

### Local / On-premises

```text
Customer machine / private server
├─ EVO Core
├─ installed packages
├─ optional local services
└─ customer-owned storage
```

适合：

- 一人公司；
- 私有部署；
- 内网；
- 数据主权要求；
- 行业现场系统。

### Cloud / Multi-tenant

```text
EVO Cloud
├─ shared / isolated Core runtime
├─ Tenant A package set
├─ Tenant B package set
├─ Tenant C package set
└─ governed tenant isolation
```

每个 Tenant 都拥有自己的：

- installed package inventory；
- package versions；
- configuration；
- data scope；
- permissions；
- feature activation；
- runtime extension registration。

关键原则：

> **Deployment topology can differ; package semantics must remain the same.**

同一个 Package 应尽量既能安装在本地企业，也能安装在云租户。

## 18. Tenant as an Installation Boundary

Cloud 场景中，Tenant / Enterprise 不只是数据隔离单位，也是 capability installation boundary。

推荐：

```text
Tenant
├─ Core protocol version
├─ Installed Packages
├─ Activated Capabilities
├─ Definition Versions
├─ Runtime Extensions
├─ Policy Set
└─ Data
```

因此不同租户可以运行完全不同的能力集合，而共享同一 EVO Core 产品。

例如：

```text
Tenant A = Trading
Tenant B = Trading + Finance
Tenant C = Manufacturing + Finance + Reporting
Tenant D = Service + CRM + Workflow
```

无需为每个客户维护不同代码分支。

## 19. Product Consequence

EVO 的产品不是一个固定 ERP 功能集合。

更准确地说：

> **EVO 是一个可生长的企业运行底座；应用、行业能力和管理能力通过安装不断生长。**

因此 Core 的长期稳定性比单个业务模块数量更重要。

产品成熟后的理想体验类似：

```text
Install EVO
→ choose company starting template
→ use
→ company grows
→ install more apps/capabilities
→ keep using the same system and history
```

这也是为什么 Runtime Extension Boundary、Package Manifest、Versioning、Upgrade、Uninstall、Tenant Isolation 都是 EVO 的一级能力，而不是后期附加功能。


## 20. Installability as a First-Class Certification Target

代码结构是否正确，不能只用“模块可编译 / 数据可跑通”判断。

EVO 的核心愿景要求建立第二类认证：

```text
Data Correctness Certification
+
Installability / Growth Certification
```

也就是说，未来每个能力不仅要证明业务结果正确，还必须证明：

- 未安装时 Core 可以独立运行；
- 安装后能力出现；
- 安装过程不直接修改 Core 私有实现；
- 依赖自动解析；
- 安装失败可回滚；
- 升级可迁移；
- 卸载不会破坏权威历史；
- 不同 Tenant 可拥有不同安装集合；
- Local 与 Cloud 使用同一 Package contract。

## 21. Minimum Package Runtime Capabilities Required

为了真正支持 Growth-by-Installation，下一阶段至少需要补齐以下平台能力：

### 21.1 Package Manifest Contract

每个安装包必须有机器可读 Manifest，至少声明：

- packageId；
- packageVersion；
- displayName；
- packageType；
- providedCapabilities；
- dependencies；
- requiredCoreProtocolVersion；
- configurationSchema；
- requestedPermissions；
- ownedDefinitions；
- ownedProjections；
- runtimeExtension requirements；
- install/upgrade/uninstall hooks or declarative steps；
- semanticDigest / signature。

### 21.2 Package Registry

需要可查询：

```text
available packages
installed packages
installed version
activation state
dependency graph
compatibility state
```

Registry 是 UI“应用中心”的后端基础。

### 21.3 Tenant Installation State

每个 Tenant / Enterprise 必须独立记录：

- installed package；
- active version；
- configuration；
- installation status；
- dependency pins；
- activated capabilities；
- installedAt / upgradedAt；
- failure state；
- rollback reference。

### 21.4 Package Install API

最小流程：

```text
plan
→ validate
→ install
→ activate
→ verify
```

建议 Public API 至少包含：

```text
GET  /packages
GET  /tenants/{id}/packages
POST /tenants/{id}/packages/{packageId}:plan
POST /tenants/{id}/packages/{packageId}:install
POST /tenants/{id}/packages/{packageId}:upgrade
POST /tenants/{id}/packages/{packageId}:deactivate
POST /tenants/{id}/packages/{packageId}:uninstall
```

具体 REST 命名可在 Protocol Freeze 阶段调整。

### 21.5 Capability Registry

Package 安装结果不应只表现为“多了几张表”，而要能机器可读地回答：

```text
Does tenant X have capability Y?
Which package/version provides it?
What protocol/version is available?
```

这将成为 Eidos UI、LLM、依赖解析和运行时路由的共同依据。

## 22. Installation Certification Ladder

安装测试不能一次跳到最复杂场景，建议建立分级认证。

### IC-00 — Bare Core Certification

证明：

```text
Core starts with no business pack installed
→ health PASS
→ BusinessData API available
→ Ledger/Posting/Balance/Replay core available
→ no Sales/Finance/Workflow capability exposed
```

这是最重要的边界证明。

### IC-01 — First Definition Package Install

安装一个极小的 Simple Trading Definition Package：

```text
Bare Core
→ install Trading Lite
→ inventory / cash / receivable / payable ledgers appear
→ posting rules activate
→ sample BusinessData posts correctly
```

证明“安装应用”不是部署另一套系统。

### IC-02 — Dependency Install

例如：

```text
Finance Reporting
requires Finance Accounting
```

测试：

- 自动发现依赖；
- plan 清楚显示依赖；
- 用户确认后按顺序安装；
- 不允许缺失依赖强行激活。

### IC-03 — Tenant Isolation

同一 Cloud Runtime：

```text
Tenant A: Trading only
Tenant B: Trading + Finance
Tenant C: Manufacturing
```

验证 API/能力可见性和数据完全隔离。

### IC-04 — Upgrade

```text
Package v1
→ existing data
→ upgrade v2
→ migration
→ compatibility validation
→ history preserved
```

### IC-05 — Deactivate / Uninstall

验证：

- 停用后能力不再对外暴露；
- 依赖检查；
- 权威 BusinessData / Ledger history 不被删除；
- rebuildable projections 可以删除；
- 再安装可重新构建。

### IC-06 — Runtime Extension

安装一个真正需要代码执行的外部扩展。

验证：

- service registration；
- health；
- protocol compatibility；
- timeout / retry；
- extension down 时 Core 不崩溃；
- 卸载后 Core 正常运行。

### IC-07 — Local / Cloud Parity

同一个 Package artifact：

```text
Local deployment install
=
Cloud tenant install
```

语义结果、版本和 capability manifest 一致。

## 23. When We Can Start These Tests

不需要等整个 Core 重构完成。

### Can start immediately

现在即可建立：

- IC-00 Bare Core architecture/runtime test；
- Package Manifest schema；
- Tenant package-state schema；
- Package planning dry-run；
- “未安装能力不可见”测试。

### After minimal installer exists

马上进入：

- IC-01 First Package Install；
- IC-02 Dependency Install；
- IC-03 Tenant Isolation。

### After version/migration contract exists

进入：

- IC-04 Upgrade；
- IC-05 Uninstall / reinstall。

### After external runtime protocol exists

进入：

- IC-06 Runtime Extension；
- IC-07 Local/Cloud parity。

因此“安装测试”应该从现在开始，而不是等未来。

## 24. Recommended First Installation Proof

第一份安装包不要用 Finance，也不要用完整 Application Platform。

建议使用：

```text
evo.trading-lite
```

只包含：

- Inventory Qty Ledger；
- Inventory Value Ledger；
- Cash Ledger；
- Receivable Ledger；
- Payable Ledger；
- purchase receipt posting rules；
- sales shipment posting rules；
- receipt/payment rules；
- 最小示例 BusinessData contract mappings。

这样可以证明：

```text
Bare EVO Core
→ install one package
→ becomes useful
```

这正对应“一人公司”场景。

第二个安装证明再使用 Finance Accounting。

第三个使用 Finance Reporting。

这样可以逐层证明企业成长：

```text
Core
→ Trading Lite
→ Finance Accounting
→ Finance Reporting
```

而不是一次安装完整 ERP。

## 25. Code Structure Acceptance Criteria

本轮代码重构只有满足以下条件，才算真正支持产品愿景：

1. Bare Core 可独立启动；
2. 可选能力不存在时 Core 不 import / 不初始化它们；
3. Package Manifest 可机器读取；
4. Tenant Package State 是一等数据；
5. 安装通过 Public Package Protocol；
6. 安装后 Capability Registry 可发现新能力；
7. Eidos/UI 可根据 Registry 动态显示已安装应用；
8. Package 可以升级、停用、卸载；
9. Core 私有数据库不是插件协议；
10. 同一个 Package 可以用于 Local 与 Cloud Tenant；
11. 安装测试进入 CI；
12. 安装/升级/卸载失败路径也有认证证据。

如果这些条件没有满足，仅仅把代码移到 packs/ 目录，不算完成插件化。


## 26. Architecture Correction — Multi-tenancy Is NOT an EVO Core Concern

此前将 Tenant 描述为 EVO 的安装边界过重，需要正式纠正。

新的权威原则：

> **Enterprise / Company 是 EVO 的业务作用域；Tenant 是 Cloud Hosting Platform 的托管与隔离作用域。**

二者可能一一对应，也可能不是。

EVO Core 不应知道“Tenant 使用什么数据库拓扑”。

### 26.1 Core-owned concept

Core 只需要稳定的业务作用域，例如：

```text
enterprise_id
company_id
consistency_domain
```

具体命名在后续 Contract Freeze 时统一。

其作用是：

- BusinessData ownership；
- Ledger ownership；
- Posting scope；
- Balance scope；
- Replay scope；
- Definition activation scope。

这是业务语义，不等于 SaaS multi-tenancy。

### 26.2 Platform-owned concept

Hosting / Platform 层负责：

- tenant identity；
- tenant routing；
- subscription / billing；
- deployment topology；
- database placement；
- region placement；
- resource quota；
- storage isolation；
- backup / restore policy；
- tenant-level encryption strategy；
- cloud operational lifecycle。

Core 不依赖这些实现。

## 27. Multi-tenant Storage Strategy Must Remain Pluggable

Cloud 平台可以根据规模、成本、安全和合规选择不同模式。

允许的候选包括：

### Database per Tenant

```text
Tenant A → DB A
Tenant B → DB B
Tenant C → DB C
```

优点：

- 强隔离；
- restore / backup 边界清楚；
- 大客户独立扩容容易；
- 私有化与云模型更接近。

代价：

- 数据库数量可能很大；
- migrations / connection / operations 成本更高。

### Schema per Tenant

```text
Shared PostgreSQL
├─ tenant_a schema
├─ tenant_b schema
└─ tenant_c schema
```

优缺点介于独立数据库和共享表之间。

### Shared Tables + Tenant Key / RLS

```text
Shared database
Shared tables
tenant_key on rows
```

优点：

- 资源利用率高；
- 运维对象少。

风险：

- 隔离错误影响面大；
- noisy-neighbor 风险；
- backup / restore 单租户复杂；
- 数据治理要求高。

### Hybrid

长期平台很可能允许：

```text
small tenants → shared infrastructure
large / regulated tenants → dedicated database
local deployment → dedicated local database
```

EVO Core 不应因为任何一种模式而改变 Public Contract。

## 28. Tenant Router / Hosting Adapter

Cloud 入口负责：

```text
Request
→ authenticate hosting tenant
→ resolve deployment / database / Core endpoint
→ invoke EVO Core Public API
```

可以表示为：

```text
Cloud Gateway
        ↓
Tenant Router
        ├─ Tenant A → Core/DB A
        ├─ Tenant B → Core/DB B
        └─ Tenant C → Shared Core/DB Partition C
```

Core 收到的仍然是正常的 Enterprise-scoped request，而不是自行承担云路由逻辑。

这使 Local Deployment 可以直接：

```text
Client
→ Local EVO Core
→ Local DB
```

不需要实现 SaaS Tenant Router。

## 29. Package Installation Boundary Correction

“安装应用/能力”的产品语义应归属于：

```text
Enterprise / EVO Installation Scope
```

而不是强绑定 Cloud Tenant。

例如：

```text
Enterprise A
├─ Trading
├─ Finance
└─ Reporting
```

在本地部署时，这个 Enterprise 属于本地 EVO 实例。

在云部署时，Hosting Platform 再决定该 Enterprise 被哪个 Tenant / database / runtime 承载。

因此 Package Manager 只处理：

- enterprise/application scope；
- package versions；
- definitions；
- capabilities；
- configuration。

它不决定数据库物理拓扑。

## 30. Cross-tenant Platform Analytics Is Outside Core

平台运营者未来可能需要：

- tenant usage analysis；
- aggregate operational metrics；
- product usage analysis；
- capacity planning；
- benchmark / industry analytics under governance。

这些都不应该让 EVO Core 提供“跨租户查询”。

推荐职责：

```text
Tenant Core(s)
→ governed CDC / Change Feed / Telemetry
→ Platform Data Pipeline
→ Warehouse / Lakehouse / Analytics Store
→ Platform Analytics
```

而不是：

```text
analytics request
→ synchronously query every tenant production database
```

具体可采用：

- CDC；
- event stream；
- scheduled export；
- warehouse ETL；
- lakehouse；
- federated query for limited operational cases。

最终技术选型由 Platform Architecture 根据规模和成本决定。

Core 只需要提供稳定的单 Enterprise 数据出口和事件契约。

## 31. Platform Analytics Data Governance

跨租户分析必须由 Platform 层独立治理，包括：

- allowed data categories；
- tenant consent / contract；
- aggregation；
- anonymization / pseudonymization where required；
- retention；
- regional constraints；
- access audit；
- separation between operational support and analytics。

这些规则不能污染 Ledger / Posting / Balance 的 Kernel 语义。

## 32. Revised Local / Cloud Principle

新的原则不是：

> Tenant 是 EVO Core 的一级对象。

而是：

> **同一个 EVO Core 协议可以被本地部署和云托管平台以不同拓扑运行。**

```text
Local:
User → EVO Core → DB

Cloud:
User → Cloud Platform / Tenant Router → EVO Core deployment → DB strategy
```

Package semantics 保持一致，Hosting topology 可以完全不同。

## 33. Hard Boundary

EVO Kernel / Core Service 禁止因为 Cloud Multi-tenancy 增加：

- tenant routing；
- billing；
- subscription；
- cross-tenant query；
- database-per-tenant management；
- cloud region placement；
- cross-tenant analytics pipeline。

这些属于 Platform / Hosting。

Core 只保证：

```text
one scoped enterprise request
→ correct BusinessData
→ correct Posting
→ correct Ledger
→ correct Balance
→ correct Replay
```

这使 EVO Core 同时适用于单机、一人公司、私有化部署和云平台，而不被某一种 SaaS 架构绑死。

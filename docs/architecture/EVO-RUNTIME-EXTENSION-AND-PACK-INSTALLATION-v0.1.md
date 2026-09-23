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

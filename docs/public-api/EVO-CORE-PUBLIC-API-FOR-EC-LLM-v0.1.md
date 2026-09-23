# EVO Core Public API for EC Project LLM v0.1

**Status: DRAFT CONTRACT BASELINE**  
**Purpose:** 向 EC 项目的负责 LLM 提供稳定、机器可读的 EVO Core 能力说明，使其能够基于 EC 中积累的知识选择 EVO/Eidos 组件，并把选择结果、实例说明和测试用例写入 3EC 文章。

## 1. Correct Role Model

这里有三个不同角色：

```text
1. EC Project LLM
   = 负责理解、选择、组合、推理和写作的执行者

2. EC Project
   = 负责存储和积累这个 LLM 的长期知识、行业知识、经验、方法和组件使用知识

3. 3EC
   = 当前开发阶段用于 EVO / Eidos / EC 三个项目 LLM 协调、对齐和集成验证的临时工作区 / 聊天容器
```

因此：

> **3EC 不是长期产品，也不是知识库，更不是运行时系统。**

它当前的价值是开发阶段的跨项目协调与集成验证，例如：

- 让 EVO / Eidos / EC 项目负责 LLM 对齐接口与边界；
- 汇总跨项目集成问题；
- 承载联合测试场景；
- 记录尚未归属到单一项目的集成决策。

真正长期保存企业背景、项目知识、行业学习和 LLM 经验的是 **EC Project**。

当 EVO / Eidos 的契约、Catalog、集成测试和项目文档足够成熟后，3EC 应当可以缩减、归档甚至取消。

## 2. Relationship

推荐关系：

```text
                 EVO
        Public API / Capability Catalog
                  │
                  │
Eidos ─ Component Catalog ─┐
EC Project
(long-term knowledge)
        │
        ▼
EC Project LLM
        │
        ├─ reads EVO contracts/catalog
        ├─ reads Eidos contracts/catalog
        └─ coordinates with EVO/Eidos project LLMs
                 │
                 ▼
        3EC temporary workspace
```

EC Project LLM 是真正的“选择者”。

3EC 是选择和推理后的可读、可复用产物。

## 3. What EVO Should Publish

为了让 EC Project LLM 将主要精力放在“选择”而不是“开发”，EVO 应优先发布：

- Capability Catalog；
- Public API descriptions；
- Package Catalog；
- dependency information；
- configuration schema；
- input/output schema；
- examples；
- constraints；
- compatibility；
- status: AVAILABLE / DRAFT / PLANNED；
- performance/reliability class；
- install/upgrade semantics。

EC Project LLM 不应需要阅读 EVO 私有源码才能知道某项能力是否可用。

## 4. Phase-0 Discovery

### GET /health/live

用于说明 EVO 服务是否运行。

### GET /health/ready

用于说明 EVO Core 是否已就绪。

### GET /api/v1/core/capabilities

这是 EC Project LLM 最早可以消费的机器可读入口。

用途：

- 了解 EVO 当前具备哪些 Core 能力；
- 区分 AVAILABLE / DRAFT / PLANNED；
- 不假设 Sales / Finance / Manufacturing 永远存在；
- 为 3EC 文章选择正确的组件和能力。

## 5. Future Capability Families

EVO 后续应逐步公布以下接口族：

- BusinessData；
- Ledger Definition；
- Posting Rule；
- Posting；
- Ledger Entry；
- Balance；
- Replay；
- Provenance；
- Package Installation；
- Snapshot / Change Feed。

每个接口族都应同时提供：

```text
machine-readable schema
+
human/LLM-readable semantic explanation
+
examples
+
constraints
+
compatibility/version
```

## 6. How EC Project LLM Uses These Contracts

正常流程：

```text
企业/行业问题
        ↓
EC Project LLM
        ↓
retrieve relevant EC knowledge
        ↓
read EVO Capability Catalog
read Eidos Component Catalog
        ↓
choose existing capabilities/components
        ↓
write/update enterprise knowledge and, when cross-project coordination is needed, use the 3EC temporary workspace
```

3EC 文章可以写成：

```text
需求
→ 推荐 EVO Package
→ 推荐 Eidos Component
→ 配置方法
→ 测试场景
→ 预期结果
→ 未覆盖能力
```

## 7. Testing Responsibility

测试要区分“测试用例定义”和“测试执行”。

### EC Project LLM / 3EC article

负责描述：

- Given；
- When；
- Expected；
- required capability；
- required package；
- expected ledger/balance result；
- acceptance criteria。

例如：

```text
Given:
Trading Lite 已安装

When:
采购入库 10 件

Expected:
Inventory Qty +10
Payable +1000
Replay 后结果一致
```

这些测试用例可以成为 3EC 文章的一部分。

### EVO / Eidos Test Harness

负责真正执行：

- HTTP；
- OpenAPI contract test；
- package installation；
- ledger verification；
- UI automation；
- replay verification。

因此 EC Project LLM 不需要把主要精力花在编写测试框架。

## 8. Capability Gap

如果 EC Project LLM 发现现有 EVO/Eidos 组件无法组合出目标实例：

```text
EC Project LLM
→ 在 3EC 中记录 Capability Gap
→ 输出明确需求与验收条件
→ 交给 EVO 或 Eidos 项目负责 LLM
→ 平台项目开发通用组件
→ 发布到 Catalog
→ EC Project LLM 重新选择
```

这样避免 EC Project LLM 为每个实例重新开发平台能力。

## 9. Core Principle

> **EC Project LLM should spend most of its effort on knowledge retrieval, component selection, composition and explanation — not on platform implementation.**

对应中文：

> **EC 项目负责 LLM 的主要精力应该用于“查知识、选组件、组合、解释和形成 3EC”，而不是替 EVO/Eidos 开发底层代码。**

EVO 和 Eidos 是否对 LLM 友好，一个重要判断标准就是：

> EC Project LLM 能否只看 Catalog / Contract，就完成高质量选择，而无需深入阅读底层实现。


## 10. 3EC Sunset Principle

3EC should exist only while it provides unique development-stage coordination value.

It can be retired when:

- EVO Public API / Capability Catalog is authoritative and machine-readable;
- Eidos Component Catalog is authoritative and machine-readable;
- EC contains durable enterprise / industry / learned knowledge;
- cross-project interface tests run automatically;
- capability-gap requests have a standard machine-readable format;
- project LLMs can recover the necessary cross-project state from repositories and contracts without relying on a separate coordination workspace.

At that point, keeping 3EC as a permanent third product would create duplicate context and unclear ownership.

The desired long-term shape is:

```text
EVO   = durable backend/runtime product
Eidos = durable experience/UI product
EC    = durable knowledge/learning project

3EC   = temporary development integration workspace
        → shrink
        → archive/retire when no longer uniquely useful
```


## Enterprise Agent boundary update — 2026-09-23

The former EC / Experience Compiler product identity is being replaced by the **Enterprise Agent** model.

For EVO, the only durable rule is local:

- Enterprise Agent may consume EVO capabilities through EVO Public Contracts;
- Enterprise Agent is not part of EVO Core;
- EVO Core must remain fully operational without any Agent or LLM;
- Agent reasoning does not become authoritative business truth by itself;
- Agent execution must pass the same authorization, command and consistency boundaries as any other client;
- EVO must not depend on the Agent's private memory, knowledge store, model provider or implementation.

The canonical definition of Agent Package semantics belongs to `EVO-App-Platform/docs/architecture/AGENT-PACKAGE-MODEL-v0.1.md`.

The historical EC-to-Enterprise-Agent transition is recorded in `Experience-Compiler/docs/adr/0004-ec-to-enterprise-agent.md`.

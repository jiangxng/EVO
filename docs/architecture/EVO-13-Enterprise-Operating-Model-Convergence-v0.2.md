# EVO-13 — Enterprise Operating Model Convergence v0.2

**Status:** Architecture Convergence Candidate  
**Date:** 2026-09-10  
**Purpose:** 收敛 EVO 的产品范畴、核心对象、分层架构、管理框架、工具层、SOP、Management Intelligence、Simulation 与商业定位。  
**Supersedes / Refines:** EVO-13 Management Intelligence, SOP & Simulation Architecture v0.1  
**Builds on:** EVO-08 ~ EVO-12

---

## 0. Executive Summary

EVO 的最终产品范畴不应定义为“AI ERP”，也不应简单定义为“低代码平台”。

更准确的定义是：

> **EVO 是一个可生长的 Enterprise Operating System：以统一企业模型和确定性运行时为底座，承载企业全流程、生成岗位化软件工具、连接管理与执行，并允许企业持续演化。**

对外市场语言应保持更简单：

> **EVO — The Operating System for Your Enterprise.**  
> **描述企业，运行企业，持续优化企业。**

EVO 的核心差异不是“模块更多”，而是：

1. 企业模型不是按传统 ERP 模块固定；
2. 企业活动通过统一 Command / BusinessData / Ledger / Work 底座运行；
3. 不同岗位可以拥有完全不同的工具体验，但共享同一企业语义和运行时；
4. 管理视角可以跨部门、跨 App、跨流程、跨账本理解企业；
5. SOP、指标、管理框架和 AI 都在统一企业上下文中工作；
6. Scenario 可以在不污染真实数据的情况下进行经营推演；
7. 企业改变时，通过版本、迁移、Replay、灰度升级安全演化，而不是依赖人或 LLM 的记忆。

本次收敛作出三个关键决定：

### 决定 A — Enterprise Capability 正式进入企业模型，但保持轻量

Capability 表达“企业能够完成什么”，而不是“企业当前具体怎么做”。

例如：

```text
Sell
Procure
Produce
Deliver
Collect
Service Customer
Hire
Close Books
```

Capability 是稳定的业务能力地图，用于组织流程、应用、指标、SOP、权限和模板，但不成为运行时交易对象。

### 决定 B — Enterprise Flow 正式进入架构，但不把所有“流”做成独立持久化对象

Enterprise Flow 是跨对象、跨流程、跨应用的业务链路定义与追踪能力。

核心只需要：

```text
FlowDefinition
FlowInstance / FlowTrace
```

Material Flow、Cash Flow、Information Flow、Value Flow、Work Flow、Decision Flow 等默认应作为同一企业事实的**语义视图或投影**，除非某类流确实需要独立生命周期。

避免为每一种“流”创建一套基础表和引擎。

### 决定 C — Management Framework 是可安装模板，不进入 Core Code

PDCA、TOC、Lean、OODA、OKR、Balanced Scorecard 等管理思想应被表达为：

```text
Metrics
Views
Rules
Detectors
Review Cadence
Alerts
Work Templates
Scenario Templates
```

Core 只提供通用原语：

```text
Goal
Metric
Flow
State
Constraint
Process
Work
Decision
Scenario
Feedback
```

EVO 不应存在：

```ts
if (framework === "TOC") { ... }
```

---

# 1. 为什么必须从“模块型 ERP”转向“企业运行模型”

传统 ERP 的产品结构通常表现为：

```text
Sales
Procurement
Inventory
Manufacturing
Finance
HR
CRM
```

这种划分适合软件供应商组织产品，却不是企业真实运行方式。

企业真正运行的是：

```text
客户需求
→ 报价
→ 订单
→ 采购 / 生产
→ 库存
→ 交付
→ 开票
→ 收款
→ 售后
```

即横向流。

APQC 的 Process Classification Framework 也强调以跨职能的业务过程语言描述企业，而不仅仅使用纵向职能划分；其 2026 年 PCF 8.0 继续将流程、定义和关键指标组织成企业范围的统一分类体系。

因此 EVO 应坚持：

> **Domain 是组织语义，不是系统边界。**

> **Application 是工具边界，不是企业边界。**

> **Process 是执行结构，不是企业的最高层模型。**

企业整体层需要比 Application / Process 更高的抽象：

```text
Enterprise Model
→ Capability
→ Flow
→ Process
→ Application / Tool
→ Command
```

---

# 2. 最终产品范畴

## 2.1 内部架构名称

推荐：

> **Enterprise Operating System**

原因：

EVO 不只是“管理软件”。

它同时拥有：

```text
Enterprise Model
Operational Runtime
Business Transactions
Workflow
Ledger / State
Cost
Tools
AI Context
Management Intelligence
Simulation
Evolution Governance
```

Palantir 在 2026 年也明确把 Foundry + Ontology + AIP 等组合描述为 Enterprise Operating System；其 Ontology 核心把 Data、Logic、Action、Security 放进同一企业模型，并强调“Action”使分析系统变成运行系统。

EVO 与之不同的是：

> EVO 从企业交易与运行时开始，而不是主要从异构数据集成后构造运营 Ontology 开始。

## 2.2 不建议的最终名称

### “AI ERP”

过窄。

会让市场默认理解为：

```text
ERP + Copilot
```

### “Business OS”

可用于营销，但语义较模糊，市场中已有多个不同定义。

### “Enterprise Runtime”

技术上准确，但不适合市场定位。

### “Enterprise Management System”

能体现管理，但弱化一线工具与交易运行能力。

### “Composable Enterprise Platform”

是属性，不应是主类别。

---

# 3. EVO 的一句话定义

## 架构定义

> **EVO 是一个可生长的企业运行与管理底座：用统一企业模型描述能力、流程和业务语义，用确定性运行时处理业务事实，用岗位化工具承载执行，用指标、管理框架和 AI 支持跨流程管理，并通过版本、Replay 与灰度升级持续演化。**

## 市场定义

> **EVO — The Operating System for Your Enterprise.**

## 中文产品主张

> **描述企业，运行企业，持续优化企业。**

---

# 4. 最终分层架构

```text
┌──────────────────────────────────────────────┐
│              Strategy / Management           │
│ Goal · Metric · Framework · Insight          │
│ Scenario · Decision                          │
├──────────────────────────────────────────────┤
│                Enterprise Model              │
│ Enterprise · Capability · Domain · Flow      │
│ Transaction Type · SOP · Process             │
├──────────────────────────────────────────────┤
│              Experience / Tool Layer         │
│ Workspace · App · Mobile · Scanner · Portal  │
│ Dashboard · AI Assistant · API               │
├──────────────────────────────────────────────┤
│                 Execution Layer              │
│ Command · ProcessInstance · WorkItem · Plan  │
├──────────────────────────────────────────────┤
│                  Fact Layer                  │
│ BusinessData · PostingInput                  │
├──────────────────────────────────────────────┤
│               State / Accounting             │
│ Posting · Ledger · Balance · Cost            │
├──────────────────────────────────────────────┤
│              Derived Intelligence            │
│ Metrics · Flow Trace · Process Intelligence  │
│ Management Intelligence                      │
├──────────────────────────────────────────────┤
│            Rebuild / Simulation              │
│ Replay · Scenario                            │
├──────────────────────────────────────────────┤
│          Governance / Evolution              │
│ Version · Migration · Feature Flag · Audit   │
│ Permission · Compatibility · Release         │
└──────────────────────────────────────────────┘
```

---

# 5. 最终核心链路

EVO 已有链路保持不变：

```text
Command
→ BusinessData
→ Posting
→ Ledger
→ Cost
→ Work
→ Replay
```

但企业整体模型增加外层：

```text
Enterprise Model
→ Capability
→ Flow
→ Process
→ Application / Tool
→ Command
→ BusinessData
→ Posting
→ Ledger / Cost / Work
→ Metrics
→ Management Intelligence
→ Scenario / Decision
→ Command
```

这不是替换核心链路。

而是把：

```text
“企业如何定义”
```

和：

```text
“企业如何运行”
```

连接起来。

---

# 6. Enterprise Capability 决策

## 6.1 正式进入模型

Capability 是：

> 企业为了实现目标所具备的一种稳定业务能力。

例如：

```text
Sell
Price
Procure
Plan Production
Produce
Manage Inventory
Fulfill
Collect Cash
Pay Supplier
Recruit
Maintain Asset
Support Customer
Close Finance
```

APQC 明确区分 Process 与 Capability：Process 是把输入转化为输出的一系列相关活动；Capability 是组织实现目标的能力，涉及成熟度和有效性，两者不能简单等同。

因此 EVO 需要 Capability。

## 6.2 Capability 不是什么

Capability 不是：

- Workflow
- Department
- App
- Transaction Type
- Database Module

## 6.3 Capability 的作用

```text
Capability
├── Processes
├── Applications
├── Commands
├── SOPs
├── Metrics
├── Roles
└── Management Framework bindings
```

## 6.4 Runtime 边界

Capability 不产生交易。

不创建：

```text
CapabilityExecution
```

除非未来出现明确需要。

当前它属于**企业结构元数据**。

---

# 7. Capability 与已有对象关系

建议：

```text
Enterprise
│
├── Domain
│
├── Capability
│
└── Flow
```

而不是强制：

```text
Enterprise
→ Domain
→ Capability
```

因为 Domain 与 Capability 是不同分类维度。

例如：

```text
Domain: Supply Chain
Capability: Fulfill Customer Order

Domain: Finance
Capability: Collect Cash
```

一个 Flow 可以跨多个 Domain 和 Capability。

Transaction Type 仍然定义：

> 什么类型的业务发生。

Application 定义：

> 用什么业务应用处理这些业务发生。

Process 定义：

> 活动如何被组织执行。

---

# 8. Enterprise Flow 决策

## 8.1 正式进入架构

Flow 是：

> 一项企业价值、对象、状态或责任如何跨多个业务活动连续演化的可追踪链路。

典型：

```text
Lead-to-Cash
Order-to-Cash
Procure-to-Pay
Plan-to-Produce
Issue-to-Resolution
Hire-to-Retire
Record-to-Report
```

## 8.2 为什么 Flow 很重要

老板不会问：

> 销售模块运行得怎样？

更可能问：

> 从客户下单到收到钱，到底需要多久？

这个问题天然跨：

```text
Sales
Inventory
Production
Logistics
Finance
```

因此 Flow 是 Management Intelligence 的重要分析边界。

---

# 9. 不把“所有流”建成核心实体

这是本次收敛最重要的限制之一。

以下概念非常有用：

```text
Transaction Flow
Material Flow
Information Flow
Cash Flow
Value Flow
Work Flow
Decision Flow
```

但它们多数不需要分别成为基础实体。

推荐结构：

```text
FlowDefinition
FlowTrace
```

再通过投影生成：

```text
MaterialFlowView
CashFlowView
InformationFlowView
WorkFlowView
ValueFlowView
DecisionFlowView
```

例如一张订单：

```text
Order
 │
 ├── Material Projection
 ├── Cash Projection
 ├── Cost Projection
 ├── Work Projection
 └── Information Projection
```

这些是同一企业事实历史的不同解释。

原则：

> **先使用 Lineage + Semantic Projection；只有出现独立生命周期和独立不变量时，才升级为一等运行对象。**

---

# 10. Flow Trace 如何实现

核心应该解决：

> “为什么这条业务结果与那条业务发生有关？”

因此所有关键记录继续保留 lineage：

```text
enterprise_id
business_object_key
command_execution_id
business_data_id
posting_input_id
ledger_entry_id
process_instance_id
work_item_id
correlation_id
causation_id
```

增加：

```text
flow_definition_id
flow_instance_id
```

但不强制每条 BusinessData 都绑定一个 Flow。

FlowInstance 可以由：

1. Command 创建；
2. Process 启动；
3. 关联业务对象自动归集；
4. Query/analysis 动态识别。

最终允许：

```text
Customer Order #SO-101
↓
Production
↓
Shipment
↓
Invoice
↓
Collection
```

成为一条可解释链路。

---

# 11. Application / Tool 的最终定位

Application 不再被视为企业功能本身。

它是：

> **企业能力与流程的一种可执行用户界面。**

同一个 Process 可以拥有：

```text
Desktop Workspace
Mobile App
Scanner UI
Kiosk
Customer Portal
Supplier Portal
AI Tool
API
Automation
```

例如：

```text
Capability:
Fulfill Order

Process:
Warehouse Picking

Tools:
├── PC Picking Console
├── PDA Scanner
├── Mobile Camera
├── Voice Picking
├── Robot API
└── AI Supervisor
```

全部调用相同 Command。

这是 EVO 同时成为“管理系统”和“工具平台”的关键。

---

# 12. Tool Layer 原则

工具层允许高度变化。

Core 不应该要求所有 App 长得一样。

只要求：

```text
Tool
↓
Command Contract
↓
BusinessData
```

因此 EVO 可以支持：

```text
Form
Table
Board
Timeline
Scanner
Map
Chat
Dashboard
Workflow Inbox
AI Agent
Specialized UI
```

Frappe/ERPNext 证明了元数据驱动可以快速生成数据库型业务应用；Microsoft Power Apps 进一步把自然语言、数据模型、流程、应用、portal、agent 组合成低代码/AI 应用平台。

EVO 应借鉴其“工具可快速生成”，但必须避免：

> 每个生成 App 自己建立一套孤立数据语义。

EVO 的差异应是：

> **生成的是界面和工作方式，不是新的事实体系。**

---

# 13. 企业不是“只有流”

本次研究也必须避免走向另一个极端。

结论不是：

> 企业由模块组成 → 错  
> 企业由流组成 → 对

更准确的是：

```text
Enterprise
=
Capabilities
+
Objects
+
Relationships
+
Flows
+
Processes
+
Rules
+
Resources
+
People
+
State
+
Actions
```

Flow 是理解企业横向运作的重要视角。

但企业也有：

```text
长期资产
组织
合同
能力
政策
静态关系
```

所以最终架构应避免把一切都强迫成 Flow。

---

# 14. Management Framework 决策

正式对象：

```text
ManagementFrameworkDefinition
ManagementFrameworkVersion
```

但 Framework 是模板层，不是运行时核心引擎。

框架可声明：

```yaml
framework:
  code: TOC
  version: 1

requires:
  metrics:
    - throughput
    - queue_time
    - capacity_utilization

detectors:
  - bottleneck

views:
  - constraint_map

review:
  cadence: weekly

actions:
  - exploit_constraint
  - subordinate_other_processes
```

安装以后生成或绑定：

```text
Metrics
Views
Rules
Detectors
Alerts
Review Cadence
Work Templates
Scenario Templates
```

---

# 15. 管理理论的映射方式

## PDCA

```text
Goal
→ Plan
→ Work / Command
→ Metric
→ Deviation
→ Review
→ Corrective Command
```

## TOC

```text
Flow
→ Queue
→ Capacity
→ Throughput
→ Constraint Detector
→ Improvement Work
```

## Lean

```text
Process Trace
→ Value Added / Non-Value Added Classification
→ Wait / Rework / Handoff
→ Improvement Action
```

## OODA

```text
Observe = Facts / Metrics
Orient  = Context / Diagnosis
Decide  = Decision
Act     = Command
```

## OKR

```text
Goal
→ Key Results
→ MetricDefinition
→ Owner
→ Review
```

## Balanced Scorecard

```text
Management Framework Template
→ Metric Groups
→ Strategy Map
→ Review Cadence
```

这些都不改变 Core 数据模型。

---

# 16. Metrics & Semantic Layer 必须成为核心基础设施

推荐正式增加：

```text
modules/metrics/
```

核心对象：

```text
MetricDefinition
MetricVersion
MetricValue
MetricTarget
MetricDimension
MetricRelationship
MetricLineage
```

Microsoft 2026 正在把 object-centric process mining 的对象、事件、关系、属性和指标直接发布到 Fabric Semantic Model，使 process intelligence 与财务、运营和客户数据合并分析。

SAP Business Data Cloud 强调使用业务流程、政策、逻辑和 semantics 给企业数据增加上下文，为 agent 提供 universal business context。

EVO 必须从一开始做得更统一：

```text
Semantic Layer
≠ BI-only Layer

Semantic Layer
=
Human
+ Dashboard
+ Management Algorithm
+ AI
+ Scenario
共同使用的企业语言
```

---

# 17. SOP / Knowledge 的最终定位

SOP 不应该只是附件。

也不应该完全等同 Workflow。

定义：

```text
SOP = Enterprise Knowledge of How Work Should Be Performed
```

而：

```text
Process = How Work Is Coordinated
Command = What Business Action May Be Executed
WorkItem = What Must Be Done Now
```

关系：

```text
SOP
↓ maps to
Process / Command / Control / Metric / Evidence
```

---

# 18. SOPDefinition

推荐核心结构：

```text
SOPDefinition
SOPVersion
SOPStep
SOPException
SOPEvidenceRequirement
SOPControl
SOPTrainingReference
```

Step 可关联：

```text
Role
Command
Input
Output
Expected Duration
Quality Standard
Evidence
Exception Route
```

---

# 19. 从企业文档生成 EVO 模型

长期重要入口：

```text
Word
PDF
Excel
PPT
Flowchart
Chat
Existing ERP
Historical Operation
```

LLM：

```text
Extract
↓
Propose Enterprise Objects
↓
Propose Capabilities
↓
Propose Processes
↓
Propose Commands
↓
Propose SOP
↓
Propose Metrics
```

但必须经过：

```text
AI Draft
→ Human Confirmation
→ Version
→ Contract Validation
→ Simulation / Test
→ Gray Release
→ Publish
```

原则：

> **LLM 可以提出企业模型，不能擅自定义企业真相。**

---

# 20. Designed Process 与 Observed Process

这是 EVO 未来非常重要的能力。

```text
Designed:
A → B → C → D

Observed:
A → B → X → C → B → D
```

系统可以发现：

```text
Skipped Step
Rework
Waiting
Unauthorized Route
Unexpected Handoff
SLA Breach
```

Microsoft Power Automate 2026 已将 object-centric process mining 作为正式能力，并连接 Process Intelligence 与 Fabric Semantic Model。SAP Signavio 同样强调从真实执行数据获得实际流程可见性。

EVO 的优势在于：

> Process Trace 可以来自 EVO 自己的运行时，而不是必须从多个系统重新抽取日志。

---

# 21. Management Intelligence

推荐：

```text
modules/management-intelligence/
```

只读取已治理的：

```text
Metrics
Flow Trace
Process Trace
Ledger
Cost
Work
Scenario
```

输出：

```text
Observation
Anomaly
Diagnosis
Constraint
Forecast
Recommendation
```

不能直接写 BusinessData。

---

# 22. Fact / Analysis / Decision 边界

必须永久区分六层：

```text
FACT
MODEL
ANALYSIS
RECOMMENDATION
DECISION
EXECUTION
```

### FACT

真实发生。

### MODEL

定义和算法。

### ANALYSIS

从事实推导。

### RECOMMENDATION

AI 或规则提出。

### DECISION

授权主体选择。

### EXECUTION

Command。

任何 UI / API 都必须携带 type。

---

# 23. Decision 是否成为一等对象

本次结论：

> **保留设计，但不进入 v1.0 核心。**

原因：

DecisionRecord 很有长期价值：

```text
Context
Options
Scenario
Selection
Rationale
Decision Maker
Result
```

最终可以形成：

```text
Decision → Action → Result
```

这是企业学习最有价值的数据之一。

但当前加入会增加 v1.0 概念负担。

因此：

```text
v1.0: Audit via Command / Approval / Plan
1.x: Introduce DecisionRecord
```

---

# 24. Scenario / Simulation

Simulation 与 Replay 必须严格不同。

## Replay

```text
Actual Historical Facts
+
Pinned Versions
=
Rebuilt Actual Derived State
```

## Simulation

```text
Actual Baseline
+
Hypothetical Assumptions
=
Hypothetical State
```

公式：

```text
Replay = Reconstruction
Simulation = Exploration
```

Scenario 不得污染 Actual Ledger。

---

# 25. Simulation 路线

## v1.0

只定义隔离边界和接口。

## 1.x

确定性 What-if：

```text
Price
Volume
Lead Time
Capacity
Payment Terms
Inventory Policy
```

## 2.x

再加入：

```text
Forecast
Monte Carlo
Optimization
Constraint Solver
Agent-based Simulation
```

Anaplan 当前正强化“deterministic calculations + business context + forward-looking scenarios”；SAP Business Data Cloud 也已将 forecasting、simulation 和 Monte Carlo 风险分析纳入 AI-ready operational intelligence。

EVO 不应现在追求“大数字孪生”。

---

# 26. Digital Twin 的收敛定义

EVO 不需要建立单独的：

```text
DigitalTwinEngine
```

至少 1.x 不需要。

EVO 的 Digital Twin 应是一个组合能力：

```text
Enterprise Model
+
Actual State
+
Flow / Process Trace
+
Rules
+
Metrics
+
Scenario
```

Palantir Ontology 已将 objects、links、actions、functions 和 security 视为组织动态数字表示；Celonis 的 process intelligence 方向也推动从流程观察走向上下文化运营模型。

EVO 的长期区别：

> EVO 的企业模型不仅观察企业，还直接运行企业。

---

# 27. 用户分层体验

## Owner / CEO

看：

```text
Growth
Profit
Cash
Customer
Capacity
Execution
Risk
Constraints
Future
```

不按模块导航。

## Board / Shareholder

看：

```text
Growth
Capital Efficiency
Cash
Risk
Strategy
Forecast
Variance
```

## COO / CFO / Functional Executives

看：

```text
Flow
Drivers
Constraints
Exceptions
Scenario
```

## Middle Management

看：

```text
Queue
SLA
Exceptions
People / Resource
Priority
Actions
```

## Front-line Worker

看：

```text
What do I do now?
What information do I need?
What is the fastest correct action?
```

例如仓库：

```text
Order
Bin
Qty
Scan
Confirm
```

不显示：

```text
PDCA
TOC
Ledger
Semantic Model
```

## AI Agent

看：

```text
Allowed Commands
Required Context
Permissions
Metrics
Policies
SOP
```

## External Partner

看：

```text
Scoped Portal / API / Command
```

绝不能直接获得企业内部全部模型。

---

# 28. 一线“工具性”是 EVO 的核心产品要求

一线员工不会因为：

> EVO 有优秀架构

而喜欢它。

真正决定采用的是：

```text
少输入
少点击
少等待
少切系统
上下文自动带入
异常明确
动作快速
移动友好
扫码友好
AI 可辅助
```

因此 EVO 的 Tool Layer 必须成为正式产品能力，而不是开发者 Demo UI。

关键产品指标应该包括：

```text
Time to Complete Task
Clicks / Task
Manual Fields / Task
Error Rate
Rework Rate
Context Switching
Training Time
```

---

# 29. 市场对比收敛

## SAP / Oracle

强：

```text
完整业务套件
全球财务
行业深度
治理
```

2026 已全面加入 agentic AI、semantic business context 和 planning。

EVO 不竞争：

> 功能数量。

竞争：

> **改变企业软件的构建方式和演化速度。**

## Microsoft

强：

```text
Fabric
Power BI
Power Apps
Power Automate
Copilot
```

EVO 不能靠“低代码”。

差异：

> **EVO 所有工具共享同一个企业业务运行时，而不是通过多个平台产品组合后再治理。**

## ServiceNow

强：

```text
Workflow
Case
Agent
Workflow Data Fabric
```

2026 明确强调 live governed data + agent action。

EVO 的差异：

> 从 Workflow 延伸到 Transaction / Ledger / Cost / Enterprise State。

## Palantir

理念上最接近。

强：

```text
Data
Ontology
Logic
Action
AI
Decision
```

EVO 差异：

> 从业务交易运行时、财务/业务账本与可重放历史作为底座原生构建。

## Celonis

强：

```text
Process Mining
Process Intelligence
Observed Process
```

EVO 差异：

> 不仅发现流程，而是流程本身可以在 EVO 运行。

## Anaplan

强：

```text
Planning
Scenario
Decision
```

EVO 差异：

> Actual → Scenario → Decision → Command 在同一企业系统完成。

## Odoo / ERPNext

强：

```text
Modular ERP
Low Cost
Extensible Apps
Open Ecosystem
```

EVO 不能卖：

> 更便宜 ERP。

应该卖：

> **企业不需要不断适应 ERP；ERP 可以持续适应企业。**

---

# 30. 市场定位最终收敛

## 不是

```text
AI ERP
AI Accounting
Low-code ERP
BI Platform
Workflow Platform
Digital Twin Platform
```

## 是

```text
Enterprise Operating System
```

产品能力可以解释为：

```text
System of Record
+
System of Work
+
System of Intelligence
+
System of Action
```

未来再加入：

```text
System of Decision
```

---

# 31. 首个 ICP

架构通用，但市场绝不能“所有企业”。

建议首个 ICP：

> **20–500 人、业务增长快、流程变化频繁、已经被 Excel + SaaS + 老 ERP + 自研工具割裂的中型企业。**

优先特点：

```text
订单型业务
采购 / 库存 / 交付较复杂
大量跨部门协作
流程仍在变化
老板强参与经营
现有系统难适配
```

比大型集团更容易切入，也比微型企业更有流程痛点和付费能力。

首个 wedge 不应是：

> 全面替换 ERP。

推荐：

> **从一个高价值端到端 Flow 切入。**

例如：

```text
Order-to-Cash
```

或：

```text
Order-to-Fulfillment
```

先跨销售、库存、生产/采购、交付、应收形成完整闭环。

---

# 32. EVO 实际卖什么

第一阶段客户购买的不是“技术底座”。

客户购买：

> **把一个关键业务流真正跑顺，并且让管理层看清。**

产品交付：

```text
Enterprise Flow
+
Role Workspaces
+
SOP
+
Metrics
+
Management View
+
AI Assistance
```

底层才是：

```text
EVO Runtime
```

---

# 33. 商业模式收敛

推荐四层，但对客户报价保持简单。

## 1. EVO Platform

按企业 / 运行规模订阅。

避免纯 Per-seat。

## 2. AI Usage

作为额度或预算池，不裸露 token 作为核心商业单位。

## 3. Templates / Tools Marketplace

未来销售：

```text
Industry Template
Flow Template
App / Tool
SOP
Metric Pack
Management Framework
Integration
AI Agent
```

## 4. Enterprise Services / Partner Ecosystem

早期不可避免需要：

```text
Modeling
Migration
Integration
Rollout
```

但目标不是建立重咨询公司。

最终应把实施经验产品化成：

```text
Templates
Importers
AI Discovery
Validation Tools
```

---

# 34. 商业飞轮

```text
更多企业运行
↓
更多高质量匿名化模式知识
↓
更好的 Templates / Frameworks / SOP models
↓
更快实施
↓
更多企业
```

注意：

企业原始业务数据不应自动成为平台共享资产。

可积累的是：

```text
Generic Schema Patterns
Template Patterns
Management Frameworks
Migration Intelligence
Benchmark Definitions
```

需要明确隐私和授权。

---

# 35. v0.9 当前哪些保持不变

保持：

```text
Command
BusinessData
PostingInput
Posting
Ledger
Cost
Work
Replay
Enterprise
Metadata
Application
Transaction Type
Outbox
Versioning
Gray Upgrade
```

这些仍是正确基础。

---

# 36. v0.9 后必须调整的方向

不是立即大改数据库。

先在 architecture 层增加：

```text
Capability
Flow
Metric
SOP
```

优先顺序：

```text
Metric
Capability
Flow
SOP
```

其中：

Capability / Flow 初期可以很轻。

不要立即增加大量复杂 Runtime。

---

# 37. v1.0 建议范围

必须加入：

```text
CapabilityDefinition
FlowDefinition
Flow Trace foundation
MetricDefinition
Metric Query
SOPDefinition / Version / Step
Process Execution Trace
Tool / Workspace contract
Management Insight contract
Actual / Scenario namespace separation
```

至少提供一个真正完整的 Flow 示例：

```text
Order-to-Cash
```

以及不同角色工具：

```text
Sales
Warehouse
Finance
Manager
Owner
AI
```

---

# 38. EVO 1.x

增加：

```text
AI SOP Import
AI Enterprise Modeling
Process Mining Basic
Designed vs Observed
KPI Tree
Constraint Detection
PDCA / TOC Templates
Management Briefing
Deterministic Scenario
DecisionRecord
Tool Generator
```

---

# 39. EVO 2.x

增加：

```text
Enterprise Digital Twin
Advanced Management Framework Marketplace
Cross-enterprise Benchmarking
Forecast
Monte Carlo
Optimization
Decision Learning
Advanced Autonomous Agents
Industry Operating Models
```

---

# 40. 核心对象 / 派生对象 / 延后对象

## 正式核心 / 元数据

```text
Enterprise
Domain
Capability
FlowDefinition
TransactionType
ApplicationDefinition
CommandDefinition
ProcessDefinition
SOPDefinition
MetricDefinition
ManagementFrameworkDefinition
```

## 正式运行对象

```text
CommandExecution
BusinessData
PostingInput
LedgerEntry
LedgerBalance
CostResult
ProcessInstance
WorkItem
ReplayRun
```

## 轻量运行 / Trace

```text
FlowInstance / FlowTrace
ProcessTrace
MetricValue
```

## 派生视图

```text
Material Flow
Cash Flow
Information Flow
Value Flow
Constraint Map
KPI Tree
Process Map
PDCA Board
CEO Cockpit
```

## 延后

```text
DecisionRecord
Advanced Digital Twin
Monte Carlo
Optimization
Agent-based Simulation
```

---

# 41. Architecture Invariants

### EO-01
任何业务工具写入真实业务必须通过 Command。

### EO-02
Application / Tool 不得建立独立企业事实体系。

### EO-03
BusinessData 是真实业务历史的一部分；Management Intelligence 只可派生，不得重写事实。

### EO-04
Capability 是业务能力分类，不承担交易执行。

### EO-05
Flow 可以跨 Domain、Application、Process、Ledger。

### EO-06
不得为了“流”概念给每一种流建立独立核心引擎。

### EO-07
正式指标必须来自已发布 MetricDefinition。

### EO-08
Management Framework 不得在 Core 中写死理论专用逻辑。

### EO-09
SOP 发布版本不可原地修改。

### EO-10
Designed Process 与 Observed Process 必须区分。

### EO-11
AI-generated enterprise definitions 在 Publish 前只是 Draft。

### EO-12
Fact / Analysis / Recommendation / Scenario 在 API 和 UI 中必须区分。

### EO-13
Scenario 结果不能直接进入 Actual Ledger。

### EO-14
Simulation → Actual 必须经过 Decision/Approval（若需要）→ Command。

### EO-15
Replay 与 Simulation 永远是不同语义。

### EO-16
企业变更必须经过版本、兼容、迁移、测试和发布治理。

### EO-17
任何关键结果必须可追溯 lineage。

### EO-18
管理视图必须允许追溯到底层指标和事实来源。

---

# 42. 禁止事项

EVO 不应该：

```text
1. 把所有业务概念都变成一等数据库对象；
2. 把所有管理理论写进 Core；
3. 让 LLM 自由扫描数据库后生成“官方指标”；
4. 让每个 App 建自己的数据孤岛；
5. 把 Dashboard 当 Management Intelligence；
6. 把 Workflow 当 SOP；
7. 把 Process 当 Enterprise Flow；
8. 把 Simulation 当 Forecast Truth；
9. 为追求“Digital Twin”过早构建巨型图模型；
10. 追求第一版覆盖所有 ERP 功能；
11. 用 AI 模糊确定性账本与推测结果的边界；
12. 因为架构可扩展，就在市场上对所有行业同时销售。
```

---

# 43. 与 EVO-08~13 的继承关系

## EVO-08

核心业务历史、Command / BusinessData / Posting / Ledger / Cost / Replay 哲学继续有效。

## EVO-09

物理数据模型仍有效。

Capability / Flow / Metric / SOP 后续以增量 Schema 加入。

## EVO-10

Modular Monolith 继续有效。

新增模块不改变部署策略。

## EVO-11

Command 是统一写边界继续有效。

所有 Tool / AI / Scenario 转实际执行都必须进入 Command。

## EVO-12

LLM-native repository、interface-first、version/migration/gray rollout 原则继续有效。

## EVO-13 v0.1

Management Intelligence / SOP / Simulation 方向继续有效。

本 v0.2 的主要收敛：

```text
新增 Capability
新增 Enterprise Flow
明确 Tool Layer
限制 Flow 过度建模
Management Framework 模板化
延迟 Decision / advanced simulation
重新收敛市场 wedge
```

因此：

> 本文件不推翻前十二份架构，而是建立“企业整体层”。

---

# 44. 最终一页架构

```text
                         ENTERPRISE
                             │
              ┌──────────────┼──────────────┐
              │              │              │
           Strategy        Goals         Policies
              │              │              │
              └──────────────┼──────────────┘
                             ↓
                    ENTERPRISE MODEL
       Enterprise · Domain · Capability · Flow
          Objects · SOP · Process · Metrics
                             │
                             ↓
                       TOOL LAYER
      Workspace · App · Scanner · Mobile · AI · API
                             │
                             ↓
                          COMMAND
                             │
                             ↓
                       BUSINESS DATA
                             │
                             ↓
                          POSTING
                             │
                             ↓
                    LEDGER / BALANCE
                             │
                             ↓
                      COST / STATE
                             │
                             ↓
                      PROCESS / WORK
                             │
             ┌───────────────┴───────────────┐
             ↓                               ↓
         FLOW TRACE                        METRICS
             │                               │
             └───────────────┬───────────────┘
                             ↓
                 MANAGEMENT INTELLIGENCE
                             │
                  Frameworks / Diagnosis
                             │
                             ↓
                         SCENARIO
                             │
                             ↓
                          DECISION
                             │
                             ↓
                           PLAN
                             │
                             ↓
                         COMMAND
                             ↺
```

---

# 45. 最终哲学

EVO 最终不是：

> 一套包含很多模块的软件。

而是：

> **企业的一套可计算运行模型。**

它允许企业的软件工具不断生长，但所有工具仍属于同一个企业。

它允许管理理论不断增加，但不改变企业事实。

它允许 AI 越来越聪明，但不能取代确定性运行时。

它允许流程不断变化，但历史始终可以解释和重建。

它允许管理者跨流程理解企业，同时让一线员工只看到最适合自己工作的简单工具。

因此最终可以用三句话定义：

> **EVO models the enterprise.**  
> **EVO runs the enterprise.**  
> **EVO helps the enterprise improve itself.**

中文：

> **描述企业。运行企业。持续优化企业。**

---

# 46. 研究依据摘要

本次收敛参考的主要官方/一手方向：

- SAP Business Data Cloud：将企业数据与业务流程、政策、逻辑、semantics 结合，为 agentic AI 提供受治理业务上下文，并提供 planning / forecasting / simulation 能力。
- Palantir Ontology / Foundry：以 objects、links、logic、actions、security 构建企业 operational layer / Enterprise Operating System，强调“数据 + 逻辑 + 行动”闭环。
- Microsoft Power Automate / Fabric：2026 正式推进 object-centric process mining 与 Fabric Semantic Model 的整合，把对象、事件、关系和 process KPI 与其他企业数据统一分析。
- Microsoft Power Apps：使用自然语言生成业务蓝图、数据模型、流程、App、portal、agent，并强调企业级治理。
- ServiceNow Workflow Data Fabric：连接企业数据、上下文、治理与 AI workflows，使 agent 可在可信实时数据上行动。
- Anaplan：强调 business context + deterministic calculations + scenario planning + agentic decision infrastructure。
- APQC PCF 8.0：继续以跨行业 process taxonomy、process definitions 和 key measures 提供企业流程共同语言，并明确区分 Process 与 Capability。
- OMG BPMN：继续作为业务过程设计与实现之间的标准化桥梁。
- Frappe / ERPNext：证明 metadata-first 可以高效率构建数据库驱动业务应用和可扩展 App 生态。

正式实施前，EVO 应继续把这些行业实践当参考，不应复制任何单一厂商架构。

---

# 47. Architecture Convergence Decision

从本文件开始，建议将 EVO 的核心概念收敛为：

```text
Enterprise
Capability
Flow
Process
Application / Tool
Command
BusinessData
Posting
Ledger / Cost
Work
Metric
Management Intelligence
Replay
Scenario
```

其中：

```text
Capability = 企业能做什么
Flow       = 价值/业务如何跨边界流动
Process    = 活动怎样组织
Tool       = 人如何使用
Command    = 系统允许做什么
BusinessData = 实际发生了什么
Ledger     = 当前状态如何被推导
Metric     = 状态如何被度量
Management Intelligence = 如何理解问题
Scenario   = 如果改变会怎样
Replay     = 按真实历史重新构建
```

这是本轮收敛后的正式推荐基线。

---

**End of EVO-13 v0.2**

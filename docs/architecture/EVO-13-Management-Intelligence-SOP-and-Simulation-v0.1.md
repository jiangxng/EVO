# EVO-13 — Management Intelligence, SOP & Simulation Architecture v0.1

**Status:** Draft for Architecture Review  
**Date:** 2026-09-10  
**Scope:** EVO Management Intelligence / SOP / Metrics / Simulation / Decision Support  
**Baseline:** EVO v0.9 / EVO-08 Architecture Convergence / EVO-09~12 implementation baseline

---

## 1. Executive Summary

EVO 不应把传统管理理论作为“知识文章”嵌入系统，而应把它们转化为一组**可计算、可观测、可解释、可执行、可验证的管理工具**。

PDCA、TOC、Lean、BPM、OODA、OKR/KPI、平衡计分卡、商业模式画布、管理会计等理论，本质上是在不同语言和视角下描述同一个问题：

> 企业如何感知现实、理解状态、发现差距、识别约束、做出决策、组织行动、观察结果并持续学习。

在 LLM 出现之前，这些理论通常依赖经理人、顾问和分析师，把散落在 ERP、Excel、SOP、会议、经验中的信息手工整合。  
在 LLM + 结构化企业运行数据出现之后，EVO 可以把这些管理思想统一为一个数据驱动闭环：

```text
Enterprise Reality
        ↓
Facts / Events / BusinessData
        ↓
State / Ledger / Cost / Work
        ↓
Metrics / Constraints / Process
        ↓
Analysis / Diagnosis
        ↓
Scenario / Simulation
        ↓
Decision
        ↓
Command / Plan / Work
        ↓
Execution
        ↓
New BusinessData
        ↓
Feedback / Learning
        ↺
```

因此，本文件提出四个新的产品级能力层：

1. **Management Intelligence**
2. **Metrics & Semantic Layer**
3. **SOP / Knowledge Runtime**
4. **Scenario & Simulation Engine**

它们不替代 EVO 已经确定的核心链路：

```text
Command → BusinessData → Posting → Ledger → Cost → Work → Replay
```

而是在核心链路之上形成：

```text
Truth → Understanding → Decision → Action → Feedback
```

最重要的产品原则是：

> **事实由系统记录，模型由规则定义，分析由算法产生，建议由 AI 提出，决策由授权主体做出，执行只能通过 Command。**

这条边界应成为 EVO 的核心不变量。

---

## 2. 为什么 Management Intelligence 应成为 EVO 的核心产品能力

今天的大多数 ERP 解决的是：

```text
记录业务 + 控制流程 + 生成报表
```

BI 解决的是：

```text
从数据中看发生了什么
```

Process Mining 解决的是：

```text
业务实际上如何运行
```

Planning / EPM 解决的是：

```text
未来可能发生什么
```

AI Agent 解决的是：

```text
帮助分析或执行某些任务
```

EVO 的机会在于把它们连接起来：

```text
Record + Process + State + Analysis + Simulation + Decision + Execution
```

这也是当前市场正在明显汇聚的方向。SAP Business Data Cloud 将企业数据与业务流程、政策和逻辑统一为 AI 可使用的业务上下文，并强调从数据到 agentic execution；Palantir Ontology 明确把企业数据、逻辑、动作和安全策略连接成可供人和 AI 使用的企业语义层；Celonis 正在把 Process Intelligence Graph / Context Model 描述为企业运行的动态数字孪生，并进一步连接预测、建议和 what-if；Anaplan 继续强化 scenario planning、预测和 agentic decision infrastructure；ServiceNow 与 Microsoft 正在把 process mining、workflow、agent execution 连起来。

这些趋势共同说明：

> 下一代企业软件的竞争中心正在从“记录系统”转向“企业上下文 + 决策 + 行动”。

EVO 应该直接把这个方向纳入核心架构，而不是未来作为 BI 插件补充。

---

## 3. EVO 的统一管理闭环

传统管理理论可以统一映射成下面的结构：

```text
目标 Goal
   ↓
感知 Observe
   ↓
事实 Facts
   ↓
状态 State
   ↓
指标 Metrics
   ↓
偏差 Gap
   ↓
约束 Constraint
   ↓
原因 Diagnosis
   ↓
方案 Options
   ↓
推演 Simulation
   ↓
决策 Decision
   ↓
计划 Plan
   ↓
执行 Command / Work
   ↓
结果 Result
   ↓
反馈 Feedback
   ↓
学习 / 改进
   ↺
```

这不是另一个“管理理论”。它应成为 EVO 的 **Management Runtime Loop**。

---

## 4. 管理理论如何映射为 EVO 工具

### 4.1 PDCA

传统：Plan → Do → Check → Act。

EVO：

```text
Target / Plan
     ↓
Command / Work
     ↓
BusinessData / Ledger
     ↓
Metric Comparison
     ↓
Deviation
     ↓
Corrective Action
     ↓
Next Command
```

EVO 可以把 PDCA 做成真实运行的闭环，而不是四个框。典型 UI 应展示：目标、当前值、差距、原因、已采取行动、行动效果、下一轮建议。

### 4.2 TOC / 瓶颈理论

EVO 可利用 Work Queue、Process Duration、Waiting Time、Capacity、WIP、Throughput、Exception Rate 自动推导当前约束、潜在约束、约束变化趋势、约束损失金额和约束解除方案。

例如：

```text
订单 → 审核 → 采购 → 到货 → 生产 → 质检 → 发货
                 ↑
             当前瓶颈
```

管理者不只看到“采购周期 11.8 天”，而应看到：

> 当前订单交付周期的 47% 延迟来自 A 类物料等待；如果平均 Lead Time 从 9.3 天降低到 7 天，预计 OTIF 从 82% 提升到 91%。

### 4.3 Lean

EVO 可从 Process Execution 数据识别 Waiting、Rework、Duplicate Input、Approval Delay、Handoffs、Queue、Over-processing、Excess Inventory，并计算 Value Added Time、Non-Value Added Time、Process Efficiency。

### 4.4 BPM / BPR

EVO 应同时保存：

```text
Designed Process + Observed Process
```

并比较 Expected Flow vs Actual Flow，识别 Deviation、Rework Loop、Skipped Step、Unauthorized Path、Unexpected Wait。

### 4.5 OODA

```text
Observe  → BusinessData / Ledger / External Data
Orient   → Metrics / Context / Constraints / SOP
Decide   → Human or AI-supported Decision
Act      → Command
```

建议正式引入一个管理 KPI：**Decision Latency**，即异常发生到被发现、理解、形成决策并执行所需的总时间。

### 4.6 OKR / KPI

KPI 不应只是 Dashboard Widget，而应成为正式对象 `MetricDefinition`，至少包含：定义、公式、数据来源、时间范围、责任人、目标值、版本、维度和数据新鲜度。

示例：

```yaml
code: inventory_turnover
name: Inventory Turnover
numerator: cost_of_goods_sold
denominator: average_inventory
period: rolling_12_month
owner: supply_chain
target: 6.0
direction: higher_is_better
source:
  - ledger.inventory
  - cost.cogs
```

这样才能避免同一企业不同部门各自定义“毛利率”。

### 4.7 Balanced Scorecard

平衡计分卡适合作为 `ManagementFrameworkDefinition` 模板安装，安装后生成 Metric Groups、Target Relationships、Dashboard、Review Cycle，而不是把四个维度永久写死在核心代码中。

### 4.8 Business Model Canvas

商业模式画布未来可把 Customer Segment、Value Proposition、Channel、Revenue Stream、Cost Structure、Key Activity、Key Resource、Partner、Relationship 映射到实际 BusinessData，使商业模式从一次 Workshop 变成一个持续被真实经营数据校验的模型。

---

## 5. Management Intelligence Layer

建议新增：

```text
modules/
  management-intelligence/
```

职责：

```text
Enterprise State Interpretation
KPI Diagnosis
Constraint Detection
Process Diagnosis
Management Frameworks
Root Cause Graph
Management Briefing
```

它不拥有原始业务事实，只消费 BusinessData、Ledger、Cost、Work、Process、Metric、Scenario。

核心接口建议：

```text
ManagementQuery
ManagementInsight
ManagementAlert
ManagementDiagnosis
ManagementRecommendation
```

---

## 6. Metrics & Semantic Layer

建议新增：

```text
modules/
  metrics/
```

这是 EVO 未来最重要的基础模块之一。Power BI 将 Semantic Model 定义为对分析领域的逻辑描述，包括指标和业务友好术语；Tableau Semantics 更进一步，把 metrics、business meaning 和 AI context 放进同一受治理层。

EVO 应更进一步：

> EVO 的 Semantic Layer 不只是给 BI 使用，而要同时给 **人、Dashboard、管理算法、Simulation 和 AI Agent 使用**。

核心对象：

```text
MetricDefinition
MetricValue
MetricTarget
MetricDimension
MetricRelationship
MetricLineage
MetricSnapshot
```

例如：

```text
Revenue
├── Quantity
└── Average Selling Price

Gross Profit
├── Revenue
└── COGS

Cash Conversion Cycle
├── DIO
├── DSO
└── DPO
```

这使 EVO 可以自动生成 KPI Tree，并让 LLM 回答“为什么本月利润下降？”但 AI 不能自己发明利润公式，必须调用已经发布的 MetricDefinition。

---

## 7. 管理可视化工具

EVO 不应固定一种 Dashboard。同一份企业状态应支持多种投影视图：Enterprise Cockpit、KPI Tree、Process Map、Constraint Map、Value Stream、Work Queue Map、Cash Flow Map、Inventory Flow、Order Flow、Customer Profitability、Exception Radar、PDCA Board、Strategy Map、Scenario Compare、Business Model Map。

这些视图应共享同一 Metric / Process / Enterprise Model，而不是各自维护计算逻辑。

---

## 8. CEO / Board / Shareholder View

CEO 首页不应按 ERP 模块组织，而应按经营问题组织：Growth、Profitability、Cash、Customer、Operations、Capacity、Risk、People、Execution。

示例：

```text
Enterprise Pulse

Revenue             ↑ 8.4%
Gross Margin        ↓ 1.8pp
Cash                 126d runway
Inventory            84 days
OTIF                  91%
Receivable Risk      ↑
Production Bottleneck Line 3
Top Management Alerts 5
```

然后 AI 生成四段：What's changed / Why it changed / What may happen / What requires decision。

Board View 则更强调 Growth、Profitability、Cash、Capital Efficiency、Risk、Strategic Goals、Forecast、Major Deviations，并支持 Monthly / Quarterly Board Pack，所有数字必须来自受治理的 MetricDefinition。

---

## 9. 中层与一线工具

中层真正需要的是：异常 + 责任 + 资源 + 优先级 + 下一步，而不是老板 Dashboard 的缩小版。建议提供 Operations Control Board，并允许从 Insight 直接进入 Open Data、Open Process、Open Root Cause、Simulate、Create Plan、Execute Command。

一线员工不需要看到 TOC、PDCA、Balanced Scorecard 这些术语。管理理论应在后台帮助系统决定“下一件事情是什么”。例如仓库员工只看到：

```text
Pick Order #123
Aisle 7
Bin 42
Qty 6
Scan
```

后台可能利用 TOC 重新排序任务、利用 SLA 判断优先级、利用库存状态决定路线、利用 PDCA 收集异常反馈。

> 管理理论服务管理者，管理结果服务员工。

---

## 10. SOP 必须从“文档”升级为企业运行知识

企业 SOP 通常散落在 Word、PDF、PowerPoint、Excel、聊天记录和员工经验里。EVO 应把 SOP 分成：

```text
Human SOP + Executable SOP
```

建议新增：

```text
modules/
  knowledge/
```

核心对象：

```text
SOPDefinition
SOPVersion
SOPStep
SOPEvidence
SOPException
SOPTrainingMaterial
```

SOPDefinition 至少包含：purpose、scope、owner、version、trigger、preconditions、inputs、outputs、steps、roles、command、expected_duration、quality_check、evidence_required、exception_paths、completion_criteria、metrics、risks、controls、attachments、training_materials。

重要边界：

```text
SOP       = 应该怎样工作
Process   = 系统如何协调工作
Command   = 系统允许执行什么业务动作
WorkItem  = 现在谁需要做什么
```

因此：

```text
SOP → ProcessDefinition → WorkItem → Command
```

但不是每一个 SOP Step 都必须自动化。比如“检查包装是否破损”可以是 Human Instruction + Photo Evidence + Pass/Fail Command。

---

## 11. SOP → EVO 的 AI Import Pipeline

客户提供：Word、PDF、Excel、PPT、Flowchart、Chat、Existing ERP Export、Historical Logs。

AI：

```text
Extract
↓
Identify Business Objects
↓
Identify Roles
↓
Identify Steps
↓
Identify Rules
↓
Identify Inputs / Outputs
↓
Identify Exceptions
↓
Identify Metrics
↓
Identify Commands
↓
Generate Draft SOP Model
```

但不能直接 Publish。必须：

```text
AI Draft → Human Review → Simulation → Validation → Version → Publish
```

推荐状态：DRAFT、AI_EXTRACTED、UNDER_REVIEW、VALIDATED、PUBLISHED、DEPRECATED。

有了结构化 SOP + Process Execution，EVO 可以实时比较：

```text
SOP says: A → B → C → D
Reality:  A → B → X → C → B → D
```

进而发现 Rework、Unauthorized Step、Skipped Quality Check、Waiting、Manual Bypass、Repeated Approval。

SOP 不再是“墙上的制度”，而是企业标准运行与实际运行之间的实时差异模型。

---

## 12. Scenario & Simulation Engine

建议新增：

```text
modules/
  simulation/
```

核心原则：不修改真实企业状态，而是创建 Scenario Dataset。

```text
Actual Dataset
      ↓ logical reference / clone
Scenario
      ↓
Changed Assumptions
      ↓
Rules / Constraints
      ↓
Simulation
      ↓
Scenario Result
```

核心对象建议：

```text
ScenarioDefinition
ScenarioRun
ScenarioAssumption
ScenarioResult
ScenarioComparison
```

Scenario 必须记录 base_dataset / base_sequence / created_by / assumptions / rule_versions / policy_versions / confidence。

### v1.x 最适合的模拟

先做确定性 What-if：

- Inventory：需求 +20%、Lead Time +5 days、安全库存变化 → Stockout / Inventory / Cash / Fulfillment。
- Pricing：Price -5%、Volume +12% → Revenue / Gross Margin / Contribution Margin / Cash。
- Capacity：Machine Capacity / Shift / Labor → Throughput / Backlog / OTIF / Cost。
- Payment Terms：DSO 45 → 60 days → Cash Flow / Working Capital / Financing Requirement。

### 后期模拟

Monte Carlo、Optimization、Constraint Solver、Forecast Model、Demand Uncertainty、Supplier Risk、Agent-based Simulation 应放在 EVO 2.x 以后。

模拟系统最危险的问题不是“算不出来”，而是让用户误以为模拟就是未来。因此所有结果必须同时呈现 Assumption、Model、Confidence、Sensitivity、Result。

---

## 13. Replay 与 Simulation 必须严格区分

Replay：

```text
真实历史 + 指定规则版本 = 重新计算真实派生结果
```

Simulation：

```text
真实基线 + 假设 = 虚拟结果
```

因此 Replay ≠ Simulation。

任何 Scenario Result 都不能直接写入 BusinessData、Ledger、Cost。要进入现实必须经过：

```text
Decision → Command
```

---

## 14. 企业数字孪生

EVO 长期可以形成 Enterprise Digital Twin，但不是 3D 模型，而是：

```text
Enterprise Objects
+ Business State
+ Process State
+ Rules
+ Resources
+ Constraints
+ Metrics
+ Relationships
+ Actions
```

这与 Palantir Ontology 和 Celonis Context Model 当前方向接近。EVO 的潜在差异是：它不只是从外部系统“观察企业”，还可以成为业务本身的运行底座，因此 Observed Enterprise 与 Executed Enterprise 可以共享同一语义模型。

---

## 15. 六层可信边界

EVO 必须永久区分：

```text
1 Fact
2 Model
3 Analysis
4 Recommendation
5 Decision
6 Execution
```

Fact：BusinessData、LedgerEntry、WorkExecution。  
Model：SOP、Metric、Posting Rule、Cost Policy、ProcessDefinition。  
Analysis：Margin ↓、Bottleneck detected、Cycle time ↑。  
Recommendation：AI 建议。  
Decision：授权主体批准或选择。  
Execution：Command。

UI 和 API 必须明确类型，绝不能把 AI Prediction 展示得像 Actual Revenue。

建议 `ManagementInsight` 至少包含：type、facts、metrics、time_range、model_version、algorithm、confidence、evidence、recommended_commands、created_by、created_at，并永久支持：**Why am I seeing this?**

---

## 16. AI 的角色与边界

AI 可以 Explain、Summarize、Compare、Diagnose、Generate Hypothesis、Generate Scenario、Suggest Action、Draft Plan。

AI 不能 Rewrite Facts、Invent Metrics、Modify Ledger、Bypass Permission、Silently Execute High-risk Commands、Present Scenario as Actual。

老板问“今天公司有什么值得我关注？”时，不应该让 LLM 扫描全库自由发挥，而应走：

```text
Management Query
↓
Metric Engine
↓
Exception Engine
↓
Process Intelligence
↓
Constraint Detection
↓
Scenario Data
↓
LLM Explanation
```

AI 是解释与推理层，事实和正式计算来自确定性系统。

---

## 17. 管理 Framework 不应写死

建议新增：

```text
ManagementFrameworkDefinition
```

例如 PDCA、TOC、Lean、Balanced Scorecard、OKR、OODA。安装框架后生成 Metrics、Views、Rules、Review Cadence、Alerts、Analysis Templates，而不是在 Core Code 中写 `if (framework === "PDCA")`。

---

## 18. 推荐模块边界

```text
modules/
  metadata
  command
  business-data
  posting
  ledger
  cost
  workflow
  replay
  metrics
  knowledge
  management-intelligence
  simulation
  ai
  query
```

主要依赖关系：

```text
BusinessData
   ↓
Posting
   ↓
Ledger
   ↓
Cost
   ↓
Work
   ↓
Metrics
   ↓
Management Intelligence
   ↓
Simulation
   ↓
Decision
   ↓
Command
```

Knowledge / SOP 横跨 Metadata、Process、Work、Command、AI Context。

---

## 19. 管理工具不是 BI

传统 BI：

```text
Data → Chart → Human interprets
```

EVO：

```text
Facts → Metrics → Context → Diagnosis → Scenario → Decision → Command → Result
```

因此 Management Intelligence 的产品关键词应是 **Insight-to-Action Loop**，而不是 Dashboard Builder。

---

## 20. 与主要产品方向的比较

### SAP
SAP 的强项是 ERP Data + Business Data Cloud + Joule + Agents。EVO 不应比功能数量，而应强调从第一天就把 Enterprise Model、BusinessData、Command、Ledger、Work、Replay、AI 放进同一可演化架构。

### Oracle
Oracle 强于 ERP + EPM + Planning + Finance + AI Agents。EVO 的潜在机会是把 Planning 与实际业务执行底座做成同一系统，而不是两个产品家族之间连接。

### Microsoft
Microsoft 的 Fabric + Power BI + Power Automate + Power Apps + Copilot 生态极强。EVO 的差异不能是“也能做 App / Workflow”，而必须是企业统一模型不是可选项，而是系统核心。

### Tableau
Tableau 正在强化 Semantic Layer、Agentic Analytics 和 Action，但核心仍从 analytics 出发。EVO 是 Operational System → Semantic State → Analytics → Action。

### Anaplan
Anaplan 强于 Planning / Scenario / Decision。EVO 的长期机会是 Actual + Operational State + Scenario + Execution 同一底座。

### Palantir
这是与 EVO 长期理念最接近的产品之一。Palantir 是 Data + Ontology + Logic + Action + AI；EVO 是 Metadata + BusinessData + Posting + Ledger + Work + Command + AI。EVO 更偏 Enterprise Transaction Runtime，而不仅是 Enterprise Data / Ontology Platform。

### Celonis
Celonis 是 Process Data + Process Mining + Context Model + Process Intelligence。EVO 则是 Process Execution + Business State + Management Intelligence。最值得借鉴的原则是：**Designed Process 与 Observed Process 必须同时存在。**

---

## 21. v1.0 / 1.x / 2.x 路线

### v1.0 前

应加入最小基础：MetricDefinition、Metric Query、Basic KPI Dashboard、SOPDefinition / SOP Version / SOP Step / SOP Attachment、Process Execution Trace、Management Insight Contract、Actual / Scenario Type Separation，以及 Enterprise Overview / Cash / Orders / Inventory / Work Queue / Exceptions 等少量官方管理视图。

### EVO 1.x

Metric Tree、KPI Goal、SOP AI Import、Designed vs Actual Process、Basic Process Mining、PDCA Board、Constraint Detection、AI Management Briefing、Scenario Engine v1（Deterministic What-if）。

### EVO 2.x

Enterprise Digital Twin、Cross-process Graph、Root Cause Graph、Advanced Process Mining、Monte Carlo、Optimization、Forecasting、Strategy Simulation、Business Model Simulation、AI Decision Agents、Benchmark Intelligence。

---

## 22. 一个重要的新对象：Decision

长期建议考虑引入 `DecisionRecord`，但不应立即进入 v1.0 Core。

```yaml
decision_id:
issue:
context:
options:
scenario_results:
selected_option:
decision_maker:
rationale:
approved_at:
result_after_execution:
```

这样 EVO 可以建立：

```text
Decision → Action → Result
```

长期形成企业自己的决策学习数据集。

---

## 23. SOP + Decision + Result = Enterprise Learning

企业最宝贵的知识往往不是 SOP 本身，而是：

```text
当时发生了什么
为什么这样判断
采取了什么行动
结果怎么样
```

因此 EVO 最终可以形成 Enterprise Learning Graph：

```text
Fact + Process + SOP + Decision + Action + Result
```

LLM 可以从企业自己的经营历史学习：“在类似情况下，这家公司过去怎么处理，以及效果怎样”。

---

## 24. 商业推演

老板可以问：

> 如果中国销售下降 20%，同时供应商交期增加两周，会怎样？

系统应沿业务模型传播影响：

```text
Demand Scenario
↓
Sales
↓
Inventory
↓
Procurement
↓
Capacity
↓
Cash
↓
Profit
```

然后返回类似：Revenue -12.4%、Inventory Days +18、Cash Need +$2.1m、OTIF -7pp、Margin -1.2pp，并给出多个决策选项及其 Scenario Comparison。

这将是 EVO 长期最具战略价值的能力之一。

---

## 25. 不能犯的错误

- 把管理理论做成模板 Dashboard 就结束。必须是 Theory → Data → Diagnosis → Action → Feedback。
- 让 LLM 自由解释数据库。必须通过 Semantic Layer / Metrics / Governed Queries。
- 让 AI 自动定义正式 KPI。AI 可以 Draft，但必须经过治理发布。
- 把 SOP 等同于 Workflow。SOP 是知识，Workflow 是执行。
- 把 Simulation 和 Forecast 当事实。所有模拟结果必须明确标记 `SIMULATED`。
- 一开始就做“超级数字孪生”。先解决 Orders、Inventory、Cash、Capacity、Cost、Work。

---

## 26. 新增关键不变量

建议未来正式加入：

```text
MI-01 Management Insight 不得修改 BusinessData。
MI-02 任何正式 KPI 必须来自已发布 MetricDefinition。
MI-03 AI 不得把未发布 KPI 结果展示为正式企业指标。
MI-04 Scenario 数据必须与 Actual 数据隔离。
MI-05 Scenario Result 不得直接成为真实 LedgerEntry。
MI-06 Simulation → Execution 必须经过 Command。
MI-07 SOP Version 发布后不可原地改写。
MI-08 Observed Process 不得被 Designed Process 覆盖。
MI-09 Management Recommendation 必须可追溯到 Facts / Metrics / Model。
MI-10 Prediction / Recommendation / Simulation 必须在 UI 和 API 中明确标记类型。
```

---

## 27. 产品定位进一步更新

此前的品牌定位仍然成立：

> **EVO — The Operating System for Your Enterprise.**

但产品内核可以更准确地描述为：

```text
System of Record
+
System of Work
+
System of Intelligence
+
System of Decision
+
System of Action
```

市场语言仍应保持简单：老板看清企业并知道下一步；中层看清业务流、异常、瓶颈和责任；员工更快完成工作；AI 在可信企业上下文中理解、建议和执行。

---

## 28. 长期商业价值

如果 EVO 只实现 ERP，价值是业务软件；如果实现 ERP + AI，价值是智能业务软件；如果实现 Enterprise Model + Business History + SOP + Process Execution + Metrics + Management Intelligence + Decision + Simulation + Action，那么 EVO 实际拥有的是：

> **企业自己的可计算管理系统。**

真正长期的护城河也将不只是代码，而是：Enterprise Semantic Model + Operational History + Management Frameworks + SOP Templates + Decision Patterns + Industry Benchmarks + Simulation Models。

---

## 29. 最终架构图

```text
                         ENTERPRISE
                             │
              ┌──────────────┼──────────────┐
              │              │              │
           Strategy        Goals           SOP
              │              │              │
              └──────────────┼──────────────┘
                             ↓
                       Enterprise Model
                             │
                             ↓
Human / AI / Automation → Command
                             ↓
                       BusinessData
                             ↓
                          Posting
                             ↓
                          Ledger
                             ↓
                           Cost
                             ↓
                           Work
                             ↓
                ┌────────────┴─────────────┐
                ↓                          ↓
             Metrics                 Process Trace
                │                          │
                └────────────┬─────────────┘
                             ↓
                 Management Intelligence
                             │
            ┌────────────────┼────────────────┐
            ↓                ↓                ↓
         Insight          Diagnosis        Constraint
            │                │                │
            └────────────────┼────────────────┘
                             ↓
                         Scenario
                             ↓
                         Decision
                             ↓
                           Plan
                             ↓
                         Command
                             ↓
                         Reality
                             ↺
```

---

## 30. Architecture Decision

本文件建议 EVO 正式接受以下方向：

> **EVO 不仅是企业交易与业务运行底座，同时应逐步成为企业管理与决策底座。**

但管理智能不能成为新的独立数据孤岛，必须建立在 BusinessData、Posting、Ledger、Cost、Work、Process 的事实基础上。

因此：

> **Management Intelligence is derived, explainable, actionable and replayable.**

SOP：

> **从文档升级成结构化、版本化、可执行、可比较的企业知识。**

Simulation：

> **从真实业务状态建立隔离的假设世界，并通过 Scenario → Decision → Command 回到现实。**

最终，EVO 的管理哲学可以浓缩成一句话：

> **让企业的事实可以被计算，让管理思想可以被执行，让决策可以被验证，让组织可以持续学习。**

---

## 31. 推荐下一步

建议在 EVO v1.0 实施计划中增加四个正式设计任务：

```text
EVO-14 Metrics & Semantic Layer
EVO-15 SOP & Enterprise Knowledge Model
EVO-16 Management Intelligence
EVO-17 Scenario & Simulation
```

优先级：

```text
Metrics → SOP → Management Intelligence → Simulation
```

没有统一 Metric，就没有可信 Management Intelligence；没有结构化 SOP，就无法正确理解 Designed Process；没有事实和模型基础，Simulation 只会变成一个漂亮的预测玩具。

---

## Research Notes / Sources

以下资料用于本研究的市场与技术方向核对；产品结论与架构建议为 EVO 项目自身设计判断。

1. SAP — Business Data Cloud  
   https://www.sap.com/products/data-cloud.html
2. SAP — Joule Feature Scope Description, 2026  
   https://help.sap.com/doc/0a1c2b2b16f843dca835b44a5db033be/CLOUD/en-US/Joule_FSD.pdf
3. Palantir — The Ontology System  
   https://www.palantir.com/docs/foundry/architecture-center/ontology-system
4. Palantir — Ontology Core Concepts  
   https://www.palantir.com/docs/foundry/ontology/core-concepts
5. Palantir — Foundry Platform Summary for LLMs, 2026  
   https://www.palantir.com/docs/foundry/getting-started/foundry-platform-summary-llm
6. Celonis — What is Process Intelligence  
   https://www.celonis.com/blog/what-is-process-intelligence-and-how-will-it-help-you-optimize-your-business-processes
7. Celonis — Digital Twins / Process Digital Twin  
   https://www.celonis.com/insights/topics/what-is-digital-twin  
   https://www.celonis.com/blog/what-is-a-process-digital-twin
8. Microsoft — Power Automate 2026 Wave 1 / Process Intelligence  
   https://learn.microsoft.com/en-us/power-platform/release-plan/2026wave1/power-automate/
9. Microsoft — Power BI Semantic Models  
   https://learn.microsoft.com/en-us/fabric/data-warehouse/semantic-models
10. Tableau — Tableau Semantics  
    https://www.tableau.com/products/tableau-semantics
11. Tableau — Tableau Next / Agentic Analytics  
    https://www.tableau.com/products/tableau-next
12. Anaplan — AI-driven Scenario Planning and Analysis, 2026  
    https://www.anaplan.com/resources/webinars/trends-in-ai-driven-scenario-planning-2026/
13. Anaplan — 2026 AI-driven innovations  
    https://www.anaplan.com/news/anaplan-announces-latest-ai-driven-innovations-applications-to-advance-enterprise-decision-making/
14. Workday — Org Design and Scenario Modeling, 2026  
    https://doc.workday.com/adaptive-planning/en-us/what-s-new/releases/2026r1-release-notes/2026r1-planning-for-hcm-and-financials/org-design-and-scenario-modeling.html
15. ServiceNow — Process Mining  
    https://www.servicenow.com/products/process-mining.html
16. ServiceNow — Agentic Workflows, 2026  
    https://www.servicenow.com/docs/r/intelligent-experiences/sn-aia-use-cases-list.html

---

**End of EVO-13**

# EVO 横向 / 纵向扩展验证原则 v0.1
# EVO Horizontal / Vertical Expansion Validation Principle v0.1

**Status: AUTHORITATIVE ARCHITECTURE VALIDATION PRINCIPLE**  
**Date: 2026-09-22**  
**Scope: Enterprise Template / Application Model / Transaction Type / Field Model / Conditional Posting / Ledger extensibility**

## 1. 目的

EVO 的目标不是证明少数预选业务可以运行，而是证明核心抽象可以持续承载真实企业不断增加的业务能力。

企业模板因此不只是导入 / 导出功能，而是 EVO 横向扩展能力的主要验收载体：

> 用大量、异构、真实的企业应用持续验证 Transaction Type、Application、Field / Field Group、Conditional Posting、Ledger 等核心抽象是否足够通用。

Asloop 已积累的大量真实企业应用与配置资产，应作为 EVO 第一批企业应用语料库和验证样本。目标是提炼业务语义，不是机械迁移旧表、旧 Controller 或旧 SQL。长期覆盖目标应接近 APQC 所描述的企业全流程范围，并进一步扩展到多行业企业模板。

## 2. 两个正交的扩展方向

### 2.1 横向扩展 / Horizontal Expansion

横向扩展回答：EVO 能否不断增加新的交易类型、应用、字段、字段组、账本和业务流程，而不要求为每个新业务重写 Core？

基本链路：

    Transaction Type
    → Application
    → Field Group
    → Fields
    → Command / BusinessData
    → Conditional Posting Rules
    → One or More Ledgers
    → Balance / Work / Projection

横向扩展至少覆盖 Transaction Type、Application、Field / Field Group、Ledger、Posting Rule、Workflow / Work / Projection、APQC Process / Capability 和行业模板的持续增加。

### 2.2 纵向扩展 / Vertical Expansion

纵向扩展回答：同一份 canonical BusinessData 能否在不修改历史事实的前提下，通过增加或版本化规则，被继续解释到更多业务、成本、管理和财务层次？

典型链路：

    Canonical BusinessData
        ├─ Conditional Posting → Operational Ledger → Balance / Work
        ├─ Conditional Posting → Inventory / Cost / Valuation
        ├─ Accounting Recognition → Journal / GL → Trial Balance → Financial Statements
        └─ Future governed projections → Management / Regulatory / Industry views

纵向扩展的核心不是增加硬编码处理器，而是增加条件、规则、目标账本 / 投影、维度和版本化解释；必要时通过 Replay / Re-posting 重新解释历史 BusinessData。历史 BusinessData 本身不得为了新的纵向解释而被改写。

## 3. Enterprise Template 的验证角色

Enterprise Template 应被视为 Enterprise Definition Dataset，而不只是 UI 配置或安装文件。

一个可安装企业模板应能够包含或引用至少以下定义资产：Transaction Types、Applications、Field Groups、Fields、Commands / Business Events、Workflow / Work definitions、Ledgers、Dimensions、Conditional Posting Rules、Calculation / Valuation / Cost Policies、Accounting mappings / policies、Views / Lists / Forms、Dependencies、APQC capability mappings、Version / Semantic Digest。

模板安装后的企业必须能够真实运行这些定义，而不是只恢复菜单或静态元数据。

## 4. Application Expansion Without Core Modification

EVO 长期追求：新增企业业务能力，原则上通过安装或定义新的 Application / Transaction Type / Field / Rule / Ledger 完成，而不是修改 EVO Core。

销售订单、采购入库、生产领料、生产入库、库存盘点、费用报销、固定资产折旧、固定资产处置、MRP 需求、质量检验等能力，原则上都不应要求出现与业务名称绑定的 Core Runtime。

如果现有原语无法表达新业务，可以扩展 Core，但必须先证明：

1. 缺失的是跨多个应用共同需要的通用语义；
2. 现有 Application / Metadata / Rule / Ledger 原语无法简单表达；
3. 新 Core abstraction 不绑定某个具体行业或业务名称；
4. 新能力有至少一个真实应用验收场景；
5. 增加后由自动化测试证明既有模板 / 应用没有回归。

## 5. Ledger 横向扩展原则

Ledger 是可扩展企业状态容器，而不是预先写死的一组 ERP 科目。

可以持续增加 Pending Production、Pending Purchase、Pending Shipment、Receivable、Payable、Inventory、Cash、WIP、Quality Hold、Fixed Asset、Depreciation、Project Cost 以及未来行业特定 Ledger。

新增 Ledger 不应要求修改 Ledger Core。Ledger 的语义、维度、measurement 和允许的 Posting Rule 应由定义和契约决定。

## 6. Conditional Posting 的横向与纵向作用

Conditional Posting 是 Application 与 Ledger 之间的关键解耦层。

横向上，同一种 Runtime 必须能够承载更多不同业务规则，而无需把“销售订单”“固定资产折旧”等业务名称写入 Posting Core。

纵向上，同一 BusinessData 可以在不同治理规则下继续形成 operational posting、costing / valuation、accounting recognition、GL 和 financial statement 等解释。后续增加新的合法规则版本时，可以基于原 BusinessData 重新记账 / Replay，而不是修改历史事实。

## 7. Asloop 的角色

Asloop 在 EVO 中的主要角色定义为：**Enterprise Application Corpus / 企业应用语料库**。

重点提炼：已有交易类型、应用、字段与字段组、表单 / 列表 / 模板配置、条件与表达式、制造 / 销售 / 采购 / 库存 / 项目 / 财务业务语义、业务连接关系、会计 / 凭证 / 现金流语义，以及固定资产折旧等长期运行过的企业应用经验。

迁移原则：Preserve business semantics → Reject accidental legacy coupling → Re-express through EVO primitives → Verify by executable evidence。

不得把旧数据库结构本身视为 EVO 的目标模型。

## 8. 第一批横向压力测试必须异构

第一批应用不能只选择结构类似的订单类业务。建议至少覆盖：销售订单、采购入库、生产领料、生产入库、客户收款、固定资产折旧、库存盘点、费用报销、MRP 需求、质量检验。

这些样本分别压力测试多行交易、库存与应付、WIP、成本、Allocation、周期计算、差异业务、审批、计划型业务和条件 / 状态驱动业务。

如果这些异构应用可以由同一组 Core primitives 表达，才构成有意义的横向扩展证据。

## 9. 企业模板分级认证目标

- Level 0 — Primitive Proof：少量应用证明安装和运行机制成立。
- Level 1 — Heterogeneous Application Proof：至少 10 类性质明显不同的应用使用同一 Runtime。
- Level 2 — Major Enterprise Loops：覆盖销售、采购、库存、生产、资金、费用、资产等主要闭环。
- Level 3 — Asloop Application Corpus：系统性提炼和承载 Asloop 已积累的主要企业应用语义。
- Level 4 — APQC-like Enterprise Coverage：以 APQC Process / Capability 映射显示企业应用覆盖与缺口。
- Level 5 — Multi-industry Templates：通过多个行业模板证明 EVO 不依赖某个单一行业模型。

## 10. 每个横向扩展应用的最低证据

每新增一个用于架构认证的 Application，至少验证：

1. Transaction Type 可由定义安装；
2. Application 可由模板安装；
3. Field Group / Fields 可由模板安装；
4. 字段保持业务语义，而不是退化为无语义 JSON；
5. BusinessData 可产生并保持不可静默改写；
6. Conditional Posting Rule 可配置；
7. 一个业务事件可按条件写入一个或多个 Ledger；
8. 新 Ledger 可在不修改 Ledger Core 下增加；
9. Ledger Entry / Balance 可解释并可追溯；
10. Replay / Re-posting 后结果确定；
11. 应用卸载 / 升级边界明确；
12. 新应用原则上没有修改 EVO Core。

如果必须修改 Core，必须记录原因并判断该能力是否真正通用。

## 11. 长期可观察指标

EVO 应逐步能够从机器可读数据回答：当前有多少 Transaction Types、Applications、Field / Field Groups、Ledger、Conditional Posting Rules；一个 Application 使用哪些 Ledger；一个 Ledger 接收哪些 Applications 的 Posting；一个 BusinessData 经历哪些纵向投影；当前覆盖哪些 APQC Process / Capabilities；哪些应用来自 Asloop 语义迁移；哪些新增应用需要修改 Core；哪些 Core 修改由多个应用共同证明有必要。

## 12. 架构成功判据

横向成功：更多 Transaction Types + Applications + Fields + Ledgers + 企业流程，而 Core 保持稳定。

纵向成功：同一 BusinessData + 更多条件式规则 + 更多 Ledger / Cost / Accounting / Report projection，而历史事实保持稳定。

> **横向扩展用于证明 EVO 的业务抽象广度；纵向扩展用于证明 EVO 的记账 / 投影深度；Enterprise Template 用于把两种能力组合成可安装、可复制、可验证的完整企业定义。**

## 13. Asloop 元数据 / 字段设计语义基线

横向扩展验证在分析 Asloop application corpus 时，必须同时参考：

`docs/architecture/EVO-ASLOOP-METADATA-FIELD-DESIGN-UNDERSTANDING-v0.1.md`

该文档记录了当前已经确认的历史设计意图，包括：

- 六大基础对象及后续对象扩展；
- SharePoint 2017 风格的字段组合思想；
- Object → Field → Transaction Type → Application；
- Field authored once, projected many times；
- Object current value 与 Transaction historical snapshot 的不同时间语义；
- Reference Identity + Historical Snapshot；
- Application Field Binding；
- DW / Reporting Pack 的可安装派生定位。

后续用户继续补充 Asloop 设计思想时，优先按新增法补充该语义基线，并用代码 / 配置 / 数据证据交叉验证。


## 14. Ledger Template / 账本与记账模板原则

EVO 的 Ledger 和 Posting Rule 虽然必须保持可扩展，但并不意味着每个企业都需要从零设计全部账本和记账规则。

应区分两类模板化程度不同的账本体系。

### 14.1 Financial Ledger Template / 财务账本模板

在适用会计法则、会计准则和法定报表要求的约束下，不同行业企业的核心财务记账规则通常具有较高共性，可调整空间相对有限。

因此 EVO 应提供一套或多套受治理的 Financial Ledger / Accounting Posting Template，作为企业财务初始化的标准起点。

模板可以包含：

- 标准会计科目 / Ledger 定义；
- 借贷方向和余额方向；
- 常见 Accounting Recognition Rules；
- 常见业务到 GL 的映射；
- Trial Balance / Financial Statement Mapping；
- 会计期间和结账相关约束；
- Currency / Dimension Policy；
- Voucher / Journal 相关政策；
- 适用准则 / Jurisdiction / Version 元数据。

企业原则上在标准模板基础上进行受控调整，而不是重新发明完整财务体系。

需要允许的调整包括但不限于：

- 企业科目扩展；
- 辅助核算维度；
- 明细科目；
- 业务事件到会计科目的映射；
- 会计政策允许范围内的 Recognition / Valuation Policy；
- 报表映射和管理口径。

任何企业定制必须保留模板来源、差异和版本 lineage。

### 14.2 Business Ledger Template / 业务账本模板

业务 Ledger 相比财务 Ledger 更受企业流程、行业和管理方式影响，因此变体空间更大。

EVO 应提供若干常见 Business Ledger Template，覆盖典型企业流程，例如：

- 待生产；
- 待采购；
- 待入库；
- 待出库；
- 待发货；
- 应收；
- 应付；
- 库存；
- 在制品；
- 质量冻结；
- 项目成本；
- 待办 / 已办；
- 其他行业常见状态账本。

这些模板不是强制标准，而是可复制、可修改的起点。

企业可以：

```text
EVO Standard Business Ledger Template
        ↓ copy / install
Enterprise Baseline
        ↓ modify / extend
Enterprise-specific Ledger Definition
```

### 14.3 Template → Enterprise Override

账本模板应采用显式继承 / 派生思想，而不是把模板内容直接复制后失去来源。

推荐至少记录：

```text
template_id
template_version
enterprise_definition_id
base_semantic_digest
enterprise_overrides
effective_version
```

目标是系统能够回答：

- 当前企业账本来自哪个 EVO 标准模板；
- 企业修改了哪些内容；
- 哪些规则仍继承标准模板；
- 标准模板升级后哪些变化可以安全合并；
- 哪些企业定制会与新模板冲突。

### 14.4 Financial Template 与 Business Template 的不同治理强度

推荐治理关系：

```text
Financial Ledger Template
→ higher governance
→ smaller customization surface
→ stronger compliance / certification

Business Ledger Template
→ broader variation
→ larger customization surface
→ industry / enterprise optimization
```

但两者最终仍必须运行在同一套 Ledger / Posting Runtime 上，而不能形成两套独立内核。

### 14.5 与 Enterprise Template 的关系

Enterprise Template 可以组合：

```text
Enterprise Template
├─ Financial Ledger Template
├─ Business Ledger Template(s)
├─ Transaction Types
├─ Applications
├─ Fields / Field Groups
├─ Posting Rules
├─ Workflow / Work
├─ Reporting / Analytics Packs
└─ Industry Overrides
```

因此新企业安装模板时，不需要从空白系统开始，而可以先获得一套可运行的标准企业定义，再快速修改为自己的业务和管理方式。

### 14.6 长期目标

EVO 应逐步形成：

> 标准模板提供高质量默认企业模型，企业通过少量差异配置完成本地化，而不是每个客户重复实施一套完整 ERP。

财务部分优先追求“标准化 + 受控差异”；业务部分优先追求“可复用模板 + 快速派生”。


## 15. Enterprise Package 与 SharePoint Classic Solution / Site Template 的历史参照

EVO 的 Enterprise Template / Enterprise Installation Package 可以参考经典 SharePoint 的 Site Template / Solution Package 思想，但只继承其“声明式打包 + 可安装组件”的架构思想，不复制其具体 XML / WSP 技术实现。

Microsoft 的经典 SharePoint 站点模板可以把站点整体框架保存为可部署的 Web Solution Package（WSP）。其模板可包含列表 / 文档库、视图、表单、工作流、内容类型、自定义操作、导航、站点页面等；SharePoint 的 List Schema 还把字段、视图、内容类型、表单等作为同一列表定义的一部分。Visual Studio 的 SharePoint Solution 进一步以 Package + Features 组织可部署、可激活的功能单元。

这与 EVO 的目标存在重要相似性：

```text
SharePoint Classic
Solution Package / Site Template
├─ Lists
├─ Fields / Site Columns
├─ Content Types
├─ Forms
├─ Views
├─ Workflows
├─ Navigation
├─ Pages
├─ Features
└─ optional content

EVO
Enterprise Package / Enterprise Template
├─ Transaction Types
├─ Applications
├─ Objects / Semantic Fields
├─ Application Field Bindings
├─ Master / Detail Structures
├─ Forms / Lists / Editable Grids
├─ Views / Visualizations
├─ Data Sources / Filters / Dependencies
├─ Workflows / Work
├─ Business Ledgers
├─ Financial Ledger Template
├─ Posting / Accounting Rules
├─ Relations / Lineage
├─ Reporting / Analytics Packs
├─ Navigation / Experience Composition
├─ APQC / Capability Metadata
└─ optional Seed / Demo Data
```

### 15.1 Package Manifest

EVO Enterprise Package 应有一个机器可读 Manifest，用于声明：

- package identity；
- package version；
- semantic digest；
- dependencies；
- required EVO runtime / contract versions；
- included definition assets；
- installation order；
- optional features / packs；
- compatibility constraints；
- upgrade / migration metadata；
- uninstall policy；
- seed / demo data 是否包含。

Manifest 的作用类似 SharePoint Solution Manifest + Feature manifests，但应采用 EVO 自己的版本化、LLM-friendly、machine-readable contract。

### 15.2 Feature / Pack 作为可组合安装单元

SharePoint Solution 可以包含多个 Feature，并分别激活。EVO 可以借鉴这一点，把一个 Enterprise Package 继续拆成可组合的 Pack / Capability Unit，例如：

```text
Manufacturing Enterprise Package
├─ Core Sales Pack
├─ Procurement Pack
├─ Inventory Pack
├─ Manufacturing Pack
├─ Finance Pack
├─ Fixed Asset Pack
├─ Sales Analytics Pack
└─ Management Dashboard Pack
```

这些 Pack 可以有依赖关系和安装顺序，但不应要求把整个企业模板做成不可拆分的单体。

### 15.3 Definition 与 Instance Data 分离

经典 SharePoint Site Template 可以选择是否包含站点内容。EVO 也应明确区分：

```text
Enterprise Definition Package
≠
Enterprise Runtime / Transaction Data
```

默认企业模板应主要携带 Definition：

- Schema；
- Applications；
- Fields；
- Rules；
- Ledgers；
- Views；
- Workflows；
- Reports；
- Experience composition。

真实企业的 BusinessData、Ledger Entries、Journal、Balance 等运行事实不应随模板复制。

允许单独提供：

```text
Seed Data / Demo Data Pack
```

用于演示、测试和新企业初始化，但必须与正式定义和真实交易数据清晰隔离。

### 15.4 Install / Activate / Upgrade / Uninstall 生命周期

EVO Enterprise Package 不应只有“导入 JSON”。

应形成完整生命周期：

```text
Package
→ Validate
→ Resolve Dependencies
→ Install Definitions
→ Activate Capabilities
→ Verify
→ Run
→ Upgrade / Migrate
→ Deactivate
→ Uninstall
```

其中安装 / 升级必须：

- 可重复验证；
- 有版本和 semantic digest；
- 有依赖解析；
- 有冲突检测；
- 有迁移计划；
- 能识别企业 override；
- 不静默破坏已有 BusinessData；
- 支持回滚 / 恢复策略；
- 输出安装证据。

### 15.5 Site/List Schema 思想对 EVO Field / Application Model 的启发

SharePoint List Schema 将 Field、View、Form、Content Type 等围绕一个 List 定义组织。

这与 Asloop 已确认的设计历史一致：

```text
Field
→ Data
→ Form
→ List
→ View
→ API
```

EVO 应继续保持“一处业务语义定义，多种 Experience Projection”的能力，但使用显式 Binding / Dependency Graph，而不是复制 SharePoint 的 CAML/XML 和页面耦合。

### 15.6 EVO 超越 SharePoint Package 的关键部分

EVO Enterprise Package 不能停留在“网站 / 界面模板”。

它必须进一步包含企业运行语义：

```text
Application
→ BusinessData
→ Conditional Posting
→ Ledger
→ Work / Balance
→ Accounting / GL
→ Reporting / Analytics
```

因此 EVO Enterprise Package 更接近：

> **可安装的 Enterprise Operating Definition**

而不是单纯 Site Template。

### 15.7 设计原则

EVO 应借鉴经典 SharePoint Package 的以下思想：

- declarative definitions；
- reusable package；
- package manifest；
- modular features；
- install / activate；
- reusable list / field / view / form definitions；
- optional seed content；
- dependency-aware provisioning。

但不继承：

- WSP/CAB 本身；
- CAML/XML 作为主要表达语言；
- SharePoint 特有服务器目录 / Feature 部署机制；
- UI 与数据 schema 的历史技术耦合。

EVO 的目标是把这一思想提升为适合 AI-native ERP 的、版本化、可解释、可组合、可升级的企业安装包。


## 16. Usage Telemetry 与 EC 持续学习边界

Asloop 过去已经收集过用户使用数据，用于分析用户使用习惯。EVO 应保留“采集可治理的使用行为数据”这一能力，但必须明确职责边界：

> **EVO 负责采集、规范化、治理并对外提供使用行为数据；EC 负责分析、长期学习、习惯建模、经验沉淀与知识演进。**

EVO 本身不应把持续学习能力做进 Core，也不应因为引入 AI 而把运行时行为分析逻辑散落到各个 Application。

### 16.1 EVO 的职责

EVO 负责产生和保存可解释的 Usage Telemetry / Interaction Events，例如：

- Application 打开 / 关闭；
- Form / List / Editable Grid 使用；
- View / Visualization 使用；
- Search / Filter / Sort / Group 行为；
- Field 修改、取消、提交；
- Work / 待办进入、完成、跳转；
- 上下游 Relation Navigation；
- Ledger / Journal / Voucher 查看；
- 用户在不同 Application 之间的导航路径；
- 功能使用频率；
- 操作耗时与失败 / 放弃；
- 可选的匿名化 UI interaction signals。

这些事件必须通过稳定、版本化的 Event Contract 表达，而不是由 EC 直接读取 EVO 内部表。

推荐链路：

```text
EVO Runtime
→ Usage Event Contract
→ Governed Telemetry Store / Stream
→ Public Export / Connector Contract
→ EC
```

### 16.2 EC 的职责

EC 负责消费 EVO 输出的 Usage Events，并进行：

- 使用习惯分析；
- 用户 / 角色工作模式分析；
- 高频路径发现；
- 低效步骤识别；
- Experience 改进建议；
- 企业行为模式总结；
- 跨时间持续学习；
- 跨项目经验沉淀；
- 行业知识学习；
- 将可复用经验形成新的 Experience / Template / Recommendation 资产。

EC 的学习结果如需回到 EVO，必须通过正式、版本化的公开契约返回，不能直接修改 EVO 内部数据结构或规则。

### 16.3 Development Intelligence 与 Runtime Learning 分离

EVO 项目开发过程中使用的 LLM 智能，仅用于：

- 架构；
- 编码；
- 测试；
- 调试；
- 文档；
- 迁移；
- 认证；
- 设计验证。

不得把当前开发对话中的模型记忆或隐式推理，当成 EVO 产品运行后的持续学习机制。

产品运行后的长期学习职责属于 EC。

因此：

```text
LLM for EVO Development
≠
EC Runtime Learning
```

### 16.4 Telemetry 不是 BusinessData

Usage Telemetry 必须和企业业务事实分离。

```text
BusinessData
= 企业发生了什么

Usage Telemetry
= 用户如何使用 EVO
```

Usage Telemetry 不得成为 Ledger / Journal / Balance 的权威事实来源，也不得通过删除或重建 Usage 数据改变企业业务结果。

### 16.5 隐私与治理

EVO 的 Usage Telemetry 必须是可治理能力，至少支持：

- tenant / enterprise isolation；
- purpose tagging；
- schema version；
- retention policy；
- access control；
- pseudonymization / anonymization where appropriate；
- export / deletion policy；
- sensitive field exclusion；
- audit of data access；
- configurable telemetry levels。

默认不应把 Form 中的完整业务字段值无差别复制到使用日志。

优先采集：

```text
event type
application / view / field semantic id
action
timestamp
duration
result
relation / navigation context
role / permission context
non-sensitive dimensions
```

只有明确业务目的和治理策略允许时，才采集必要的值级数据。

### 16.6 EC 不得成为 EVO 的隐藏强依赖

EVO 应在没有 EC 的情况下仍然完整运行。

推荐依赖方向：

```text
EVO → Public Telemetry Contract → EC
EC → Public Recommendation / Experience Contract → EVO
```

而禁止：

```text
EVO Core → EC internal database
EC → EVO internal tables
```

这与 Eidos / EVO / EC 的既有项目边界一致：互相知道公开能力和契约，但不依赖对方内部实现。

### 16.7 Enterprise Template 与 Usage Telemetry

Enterprise Template 可以声明：

- 哪些 Application / View 开启 Usage Telemetry；
- 哪些事件允许采集；
- telemetry purpose；
- retention class；
- EC consumption policy；
- 是否允许用于跨企业匿名经验学习。

但模板不得把真实用户行为历史打包进 Enterprise Definition Package。

### 16.8 长期目标

长期架构应形成：

```text
EVO
负责企业运行

Eidos
负责 Experience Runtime / UI

EC
负责长期学习 / 经验沉淀 / 行业知识 / 使用习惯分析
```

三者通过公开、版本化、可审计契约协作。

EVO 应主动产生足够高质量、可解释的 telemetry，让 EC 能学习；但“如何学习、学习出什么、长期如何演化”属于 EC，而不是 EVO Core。


### 16.9 EC Offline Continuity / EC 离线时的持续采集原则

EC 不应成为 EVO 或 Eidos 的运行时可用性依赖。

即使 EC 暂停、升级、故障、断网或长期离线：

```text
EVO + Eidos
仍必须完整运行
```

但同时必须满足另一个强约束：

> **EC 离线期间，EVO / Eidos 仍持续产生并保存符合治理要求的 Usage Telemetry，不能因为 EC 不在线而停止采集。**

因此长期架构不是同步调用：

```text
EVO → EC → 才能继续业务
```

而应是异步、可积压、可恢复消费：

```text
EVO / Eidos Runtime
        ↓
Usage Event Contract
        ↓
Durable Telemetry Store / Event Log
        ↓
EC Consumer Offset / Checkpoint
        ↓
EC Analysis / Learning
```

### 16.10 Durable Telemetry / 可持久化行为事件

Usage Telemetry 必须具有 durable / replayable 特性。

最低要求包括：

- EC 离线时事件仍可持久化；
- 不因 EC 消费失败影响 EVO 主业务；
- 事件具有稳定 event id；
- schema version 可识别；
- 事件时间与接收时间可区分；
- 支持按 tenant / enterprise 分区；
- 支持消费 offset / checkpoint；
- EC 恢复后可以从上次确认位置继续读取；
- 重复消费必须可识别 / 幂等处理；
- 保留策略必须足以覆盖允许的 EC 离线窗口；
- 超过保留窗口后的归档 / 冷存储策略必须显式；
- Telemetry 丢失、积压、延迟应可观测。

### 16.11 EC 恢复上线后的 Catch-up Learning

EC 恢复后，不要求 EVO 重新发送业务请求。

EC 应基于保存的 Usage Telemetry 做 Catch-up：

```text
last_consumed_checkpoint
        ↓
read pending telemetry
        ↓
validate schema/version
        ↓
deduplicate
        ↓
reconstruct time sequence
        ↓
analysis / learning
        ↓
advance checkpoint
```

因此 EC 的“持续学习”在逻辑上持续，但物理执行可以间歇。

即：

> **Learning can be delayed; observation must not be lost.**

### 16.12 Online Learning 与 Offline Learning 解耦

EVO 不应假设 EC 必须实时在线。

允许：

- near-real-time consumption；
- hourly / daily batch；
- 长时间离线后批量追赶；
- 冷存储历史数据重放；
- EC 更换模型后重新分析历史 Telemetry。

这点对 EC 的长期演进非常重要：

```text
same historical telemetry
→ new EC version / new model
→ new analysis
→ new learned experience
```

历史 Usage Telemetry 因此应被视为长期经验学习的重要原始资产，但仍必须遵守隐私、保留期限、用途限制和企业授权。

### 16.13 Backpressure 与 EVO 主业务隔离

Telemetry 采集不能拖慢或阻塞核心业务提交。

推荐原则：

```text
Business Transaction
        ↓
commit canonical business result
        ↓
emit telemetry asynchronously
```

Telemetry 系统故障时：

- 不应回滚已经合法完成的 BusinessData；
- 不应阻止 Ledger / Journal / Work 正常运行；
- 应进入本地 / 持久缓冲或故障队列；
- 应产生明确的 telemetry health / backlog 告警。

对于必须审计的系统操作日志，应单独定义更强的一致性要求，不能与普通 Usage Analytics Telemetry 混为一类。

### 16.14 Eidos 的采集角色

部分使用行为只存在于 UI / Experience 层，例如：

- 页面停留；
- View 切换；
- Filter 使用；
- Grid 批量编辑交互；
- Form 字段交互；
- 可视化切换；
- 导航路径。

因此 Eidos 可以作为 Experience Telemetry Producer。

但事件应遵循 EVO / EC 约定的公开 Telemetry Contract，不应形成 Eidos 私有、EC 私有且无法治理的数据格式。

推荐：

```text
Eidos Experience Events
          \
           → Governed Telemetry Contract → Durable Store → EC
          /
EVO Domain / Operation Events
```

### 16.15 最终可用性边界

明确系统可用性关系：

```text
EC unavailable
→ EVO available
→ Eidos available
→ Telemetry collection continues
→ Durable backlog grows within policy

EC restored
→ resume from checkpoint
→ consume backlog
→ analyze / learn
→ no impact on historical EVO business truth
```

因此项目边界原则最终定义为：

> **EVO 负责运行并持续观察，Eidos 负责体验并持续产生必要的体验事件，EC 负责在可用时消费这些历史观察并持续学习。EC 可以离线，观察不能因此丢失。**


## 17. BusinessData 在最小 Core 中的弱语义定位

在进一步压缩 EVO Core 后，BusinessData 可以保留在 Core，但其定位必须非常克制。

结合 bookkeeping 项目的历史设计，BusinessData 更接近：

> **面向记账执行的高速事实缓存 / Posting Cache**

而不是完整的企业业务主模型。

因此 BusinessData 在 Core 中不应承载：

- Application 定义；
- Field 定义；
- Form / List / View；
- Workflow；
- 行业业务语义；
- 复杂对象模型；
- 完整业务生命周期。

这些能力应由可安装的 Application / Definition Pack 提供。

### 17.1 Core 中 BusinessData 的最小职责

BusinessData 在 Core 中只需要承担少量通用职责：

```text
Business Fact / External Input
        ↓
BusinessData Cache
        ↓
Posting Rule Evaluation
        ↓
Ledger Entry
        ↓
Balance
```

它至少需要保留能够支持记账、追溯和重放的最小信息，例如：

```text
fact_id
fact_type / source_type
occurred_at
posting_sequence / ordering key
payload / values needed by posting
dimensions
source identity
version / digest
lineage reference
```

具体字段以最终实现为准，但设计目标是：

> **够记账、够追溯、够 Replay，不承担完整业务应用模型。**

### 17.2 BusinessData 的缓存属性

BusinessData 可以理解为 Application / 外部系统提交给 Ledger Kernel 的标准化高速缓存层。

例如：

```text
Eidos Application
External API
Excel Import
Industry Plugin
        ↓
normalize
        ↓
BusinessData
        ↓
Posting Rules
```

Core 不需要知道这些数据原来来自哪个页面、哪个表单设计器或哪个行业模块。

BusinessData 的主要价值是：

- 避免 Posting Runtime 反复读取复杂上层 Application 数据；
- 固化记账时需要的历史值；
- 为 Replay 提供稳定输入；
- 为 Rule Evaluation 提供统一数据形态；
- 与上层业务模型解耦。

### 17.3 BusinessData 不等于权威业务应用模型

需要明确：

```text
Application Data Model
≠
BusinessData Cache
```

Application Pack 可以维护更丰富的：

- master / detail；
- object relations；
- form state；
- workflow state；
- domain-specific fields。

进入 Core 时，只把当前 Posting / Replay 所需的业务事实投影到 BusinessData。

因此 BusinessData 是一种 canonical posting representation，而不是强迫所有企业业务都直接按照 Core 的 BusinessData 结构建模。

### 17.4 BusinessData 与历史快照

虽然 BusinessData 能力较弱，但它必须保留与记账相关的历史快照语义。

例如对象当前值后续变化时：

```text
Object current value changes
        ↓
historical BusinessData remains unchanged
        ↓
Replay gets the same posting input
```

这样才能保证记账规则重放的确定性。

### 17.5 BusinessData 与 Core 最小闭环

进一步压缩后，EVO Core 可以形成：

```text
BusinessData (thin posting cache)
        ↓
Posting Rule
        ↓
Ledger Entry
        ↓
Balance
```

因此最小 Kernel 可以理解为围绕以下核心原语运行：

```text
BusinessData
Posting Rule
Ledger
Ledger Entry
Balance
```

其中：

- BusinessData：薄事实缓存；
- Posting Rule：解释事实；
- Ledger：定义状态容器；
- Ledger Entry：不可变发生；
- Balance：Entry 的累计结果。

### 17.6 对插件边界的影响

因为 BusinessData 在 Core 中保持弱语义，所以以下能力仍然可以完全插件化：

```text
Object Definitions
Field Definitions
Transaction Types
Applications
Form / List / View
Editable Grid
Workflow
Finance
Reports
DW / Analytics
Industry Templates
```

这些插件只需要将需要记账的结果投影为 Core 可接受的 BusinessData。

这使 EVO Core 可以保持极小，同时仍然支持复杂企业系统。

### 17.7 设计原则

最终原则：

> **BusinessData belongs to Core as a weak, stable, replayable posting cache — not as the enterprise domain model.**

中文：

> **BusinessData 可以属于 EVO Core，但只能作为弱语义、稳定、可重放的记账事实缓存，不能演变成整个企业业务领域模型。**


### 17.8 bookkeeping 作为 EVO Kernel 历史原型的定位

结合现有设计理解，bookkeeping 项目应被视为 EVO Kernel 的重要历史原型参考，而不只是另一套记账实现。

其关键价值在于：

- 核心关注 Ledger / Posting / Balance；
- BusinessData 保持弱语义；
- BusinessData 只保存记账和重算真正需要的必要数据；
- 重点支持基于历史事实的重新记账 / 重算；
- 上层 Application、Form、Field、Workflow 等复杂业务能力不应反向侵入最小记账内核。

因此 EVO 后续 Core Boundary Audit 应把 bookkeeping 作为重要对照：

```text
bookkeeping
→ minimal posting facts
→ posting rules
→ ledger entries
→ balances
→ replay / recalculation

EVO Kernel
→ preserve the same minimality principle
```

### 17.9 BusinessData 的首要价值是 Recalculation Input

BusinessData 在 Core 中最重要的用途之一，是作为稳定的重算输入。

它不是为了完整还原业务界面，也不是为了替代 Application 数据库，而是确保：

```text
same historical BusinessData
+ same rule version
+ same ordering
=
same posting result
```

当规则、成本算法、会计映射或账本配置发生合法版本变化时：

```text
historical BusinessData
        ↓
new / selected rule version
        ↓
re-posting / recalculation
        ↓
new derived Ledger Entries / Balance
```

历史 BusinessData 本身不因重算而被改写。

### 17.10 BusinessData 最小化原则

BusinessData 是否保留某个字段，优先问：

> **这个值是否是未来确定性重记账 / 重算所必需的历史输入？**

如果不是，则默认不应为了“以后可能有用”继续扩大 Core BusinessData。

因此 Core BusinessData 应尽量：

- 小；
- 稳定；
- append-only；
- 可排序；
- 可版本追溯；
- 能独立支持 Replay；
- 不依赖当前 Object 主数据重新 JOIN 才能恢复当时语义。

### 17.11 上层业务数据与 Core BusinessData 的关系

推荐长期结构：

```text
Rich Application Data
├─ master/detail
├─ fields
├─ workflow
├─ UI state
└─ domain-specific relations
        ↓ project only required historical facts
Core BusinessData
        ↓
Posting / Recalculation
        ↓
Ledger Entry
        ↓
Balance
```

这样复杂企业可以拥有丰富 Application Model，而一人公司或轻量系统也可以直接向 BusinessData / Posting API 提交最小事实。

### 17.12 Core 边界判断补充

因此 EVO Core 的一个重要边界标准应增加：

> **凡是不直接服务于稳定记账、余额计算、追溯或确定性重算的业务复杂度，默认不进入最小 Core。**

这条原则用于持续防止 BusinessData 和 EVO Kernel 再次膨胀成完整 ERP Domain Model。

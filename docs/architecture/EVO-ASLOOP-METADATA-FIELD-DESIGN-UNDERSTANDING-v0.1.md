# EVO 对 Asloop 元数据 / 字段设计的理解基线 v0.1
# EVO Understanding Baseline for Asloop Metadata and Field Design v0.1

**Status: EVOLVING DESIGN UNDERSTANDING / ADDITIVE**  
**Date: 2026-09-22**  
**Purpose: 记录 Asloop 既有设计思想及其对 EVO 的可继承语义。后续用户补充旧系统设计意图时，按新增法继续扩展，不以当前版本视为最终结论。**

## 1. 文档目的

Asloop 不仅是旧代码库，也是 EVO 的 Enterprise Application Corpus / 企业应用语料库。

分析 Asloop 时，不能只看表结构和代码现象，还必须记录当年的设计意图。尤其是字段、对象、交易类型、应用、表单、列表、API、账本和 DW 之间的关系。

本文件记录当前已经确认或高置信度还原出的设计思想，并作为后续销售主线、企业模板和字段模型设计的输入。

## 2. 基础对象 / Base Objects

当前高置信度历史还原表明，Asloop 早期六大基础对象对应 OBJ01~OBJ06：

| Code | Object | 中文 |
|---|---|---|
| OBJ01 | Inventory | 物料 |
| OBJ02 | Warehouse | 仓库 |
| OBJ03 | Dealer | 往来 |
| OBJ04 | Fund | 资金 |
| OBJ05 | Cost | 费用 |
| OBJ06 | Facility | 设施 |

后续又出现：

- OBJ07 — Procedure / 工序
- OBJ08 — Technics / 工艺

其中 Dealer / 往来是一个重要抽象：客户、供应商、员工、加工商、渠道商等可以通过同一个往来对象加标签 / 关系角色表达，而不是每种角色都成为一种独立基础对象。

该设计应作为 EVO 后续对象语义层的重要参考，但不能机械复制旧实现。

## 3. SharePoint 2017 风格的字段组合设计

Asloop 的字段设计参考了 SharePoint 2017 的字段 / 列表式元数据思想。

一个字段进入应用后，并不只代表数据库字段，它同时会参与：

- 对象 / Object；
- 列表 / List；
- 表单 / Form；
- 列表视图 / List View；
- 表单视图 / Form View；
- 表单 API / Form API；
- 列表 API / List API。

因此删除一个字段会影响多个位置，这是该设计模型的自然结果，不应简单视为偶然技术耦合。

可以概括为：

```text
Field
  ↓
Application Definition
  ├─ Object / Data Structure
  ├─ List
  ├─ Form
  ├─ List View
  ├─ Form View
  ├─ List API
  └─ Form API
```

## 4. 字段不是单纯数据库 Column

Asloop 中的字段资产至少包含以下语义：

- 业务名称；
- 稳定字段编码；
- 字段类型；
- 所属业务 / 对象；
- 是否必填；
- 是否隐藏；
- 默认值；
- 数据映射；
- 表达式；
- 字段模板 / 控件；
- 配置；
- 是否主键；
- 长度；
- 是否基础对象字段。

因此，字段更接近一个“可复用业务数据部件定义”，而不是某张表里的一个 column。

EVO 应继承“一处定义，多处使用”的思想。

推荐表述：

> **Field is authored once, projected many times.**  
> 字段定义一次，可以被投影到 Data / Form / List / View / Filter / API / Rule 等多个用途。

## 5. Object → Field → Transaction Type → Application

当前代码和关系表已经确认，Asloop 至少存在以下四层关系：

```text
Object / 基础对象
    ↓
Field / 业务字段
    ↓
Transaction Type / 交易类型
    ↓
Application / 应用
```

其中：

- `tpl_object`：对象定义；
- `tpl_fields_setting`：字段资产；
- `tpl_trans_type_obj_field_rel`：业务类型与对象、字段的关系；
- `list`：应用定义。

`tpl_trans_type_obj_field_rel` 明确表达：

```text
Transaction Type
× Object
× Field
```

历史分析中，该关系表曾累计约 13,743 条配置，说明这是大规模真实业务配置资产，而不是少量 Demo。

## 6. Transaction Type 高于 Application

当前理解：

> Transaction Type 定义一类业务发生允许 / 需要哪些对象与字段；Application 是该业务类型在具体企业场景中的一个可安装实现。

例如销售域可以存在：

```text
Transaction Type: Sales Order
        │
        ├─ 产品销售订单
        ├─ 经销销售订单
        ├─ 电商销售订单
        ├─ 出口销售订单
        ├─ 客制销售订单
        └─ 服务销售订单
```

不同 Application 可以复用相同语义字段，同时拥有不同：

- 默认值；
- 是否必填；
- 数据源；
- 显示方式；
- 字段组；
- 表单位置；
- 列表显示；
- API 暴露；
- 工作流；
- 计算规则；
- Posting Rules。

后续销售主线分析应重点统计不同销售 Application 的公共字段与差异字段。

## 7. 对象字段与交易字段具有不同时间语义

这是当前最重要的字段设计原则之一。

### 7.1 Object Field

对象里的字段表达：

> 当前主数据 / 当前默认值。

例如 Dealer 当前可能保存：

```text
客户名称 = ABC Trading
付款条件 = NET30
收货地址 = 九龙 A 地址
```

### 7.2 Transaction Field

交易表单可以从对象字段取得默认值，但当交易发生并提交后，该值被保存为本次交易的历史快照。

例如：

```text
Dealer.paymentTerm = NET30
        ↓ default
SalesOrder.paymentTerm = NET30
        ↓ commit
BusinessData.paymentTerm = NET30
```

之后即使：

```text
Dealer.paymentTerm = NET60
```

历史销售订单仍保持 NET30。

因此：

> **Object 提供当前值；Transaction 固化历史值。**

## 8. Reference Identity + Historical Snapshot

EVO 不应只在交易中保存对象 ID，然后在查询时统一回查当前主数据。

否则对象变化后，历史交易的展示和 Replay 都可能改变。

推荐同时保存：

```text
Reference Identity
+
Historical Snapshot
```

例如销售订单中的客户：

```text
customer_id              → Reference
customer_code            → Snapshot / business identifier
customer_name            → Snapshot
payment_term             → Snapshot
delivery_address         → Snapshot
```

这样既知道“指向哪个对象”，也知道“交易发生当时是什么”。

## 9. 交易快照的两个核心价值

### 9.1 历史真实性

对象后续变化不能改变已经发生交易所表达的历史事实。

### 9.2 查询与 Replay 独立性

读取历史交易时无需为了名称、规格、付款条件等常用历史值再次 JOIN 当前对象表。

Replay 也不应依赖当前主数据，否则会出现：

```text
今天修改对象
→ 重放三年前交易
→ 得到不同结果
```

因此历史 BusinessData 应尽可能携带当时需要用于业务解释和规则执行的快照值。

## 10. Application Field Binding 应承担的语义

EVO 中需要明确区分：

### Field Definition

定义“这个字段是什么”。

### Application Field Binding

定义“这个 App 如何使用这个字段”。

Binding 至少可能需要表达：

- 是否仅用于选择对象；
- 是否从对象字段取默认值；
- 提交时是否 snapshot；
- 是否允许用户修改默认值；
- 是否必填；
- 是否显示；
- 表单编辑组件；
- 表单只读组件；
- 列表展示组件；
- 列表内编辑组件；
- 筛选组件；
- 数据源；
- 验证；
- API exposure；
- Posting / expression 是否可以引用。

## 11. 推荐的 EVO 字段层次

当前建议继续验证如下结构：

```text
Object
→ Semantic Fields
          │
          ↓
Transaction Type
→ Transaction Fields
          │
          ↓
Application
→ Application Field Bindings
          │
          ↓
Field Groups / Components
          │
          ↓
Form / List / Filter / API / Posting
```

其中 Semantic Field 应具有稳定 ID；Form / List / API / Posting 都引用这个稳定语义标识。

EVO 的改进目标不是取消 Asloop 的“一字段多用途”，而是让这些用途形成显式 Binding / Projection 和依赖图，而不是依赖字符串式同步修改。

## 12. 字段与 Conditional Posting 的连接

Posting Rule 应优先引用稳定的语义字段，而不是某个具体页面控件或 UI 字段。

例如：

```text
sales.amount
customer.id
inventory.id
warehouse.id
```

如果产品销售、经销销售、电商销售、出口销售共享同一业务语义字段，则它们应能够复用通用 Posting 规则，而不是为每个 Application 创建完全独立的业务金额字段。

这形成：

```text
横向：
不同 Application
复用 Transaction Type / Semantic Fields

纵向：
Semantic Fields
继续被 Conditional Posting / Ledger / GL / Projection 使用
```

## 13. DW / 数据仓库的正确定位

Asloop 中 `dw_*` 表是定时更新的数据仓库 / 报表派生层，主要服务报表与分析。

它的数据仍来自账本等权威业务数据层。

正确关系：

```text
业务发生
→ 记账规则
→ 账本
→ 余额 / 发生
→ 定时汇总 / 加工
→ DW
→ 报表 / 分析
```

因此：

- DW 不是 canonical BusinessData；
- DW 不是 Ledger；
- DW 不是权威 Balance；
- DW 可以删除和重建；
- DW 可以作为报表 / 分析包单独安装。

EVO 可将其对应为：

```text
Projection / Read Model / Analytics Package
```

## 14. 可安装 Reporting / Analytics Pack

DW / 报表能力可以独立于业务应用安装。

例如：

```text
Sales App
→ 已产生 BusinessData / Ledger

安装 Sales Analytics Pack
→ 建立 DW / Projection
→ 销售订单分析
→ 应收分析
→ 毛利分析
→ Dashboard / KPI
```

报表包可以安装、卸载、升级、重建，但不得改变 BusinessData、Ledger Entry 或权威 Balance。

## 15. 当前销售主线的研究重点

销售域将作为第一条 Asloop → EVO 语义重构主线。

重点分析：

1. 销售相关 Transaction Types；
2. 产品销售、经销销售、电商销售、出口销售、客制销售、服务销售等 Applications；
3. 每个 Transaction Type 引用哪些 Base Objects；
4. 每个 Object 提供哪些字段；
5. 不同 Application 共享哪些字段；
6. 哪些字段是对象默认值并在交易中 snapshot；
7. 哪些字段是纯交易字段；
8. 不同 Application 对同一 Field 的 Binding 有何差异；
9. 字段如何被 Form / List / View / API 消费；
10. 字段如何进入计算、Posting、Ledger；
11. 哪些 DW / Report 是可独立安装的派生能力。

目标不是复制 Asloop，而是：

```text
Preserve design intent
→ Recover semantics
→ Remove accidental coupling
→ Re-express through EVO primitives
→ Verify by executable evidence
```

## 16. 后续补充原则

本文件明确采用新增法。

后续用户补充 Asloop 过去的设计思想时：

- 优先记录“为什么这样设计”；
- 区分设计意图与实现偶然性；
- 不因当前 EVO 技术方案而覆盖历史语义；
- 新结论与旧结论冲突时，新增“修正 / 演进说明”，不静默改写背景；
- 有条件时用旧代码、迁移、配置数据和运行证据交叉验证。

本文件应持续成为 EVO 分析 Asloop Application Corpus 时的语义基线。


## 17. Form Designer / 表单设计器

Asloop 中还存在一个重要的 Form Designer / 表单设计器。

它的产出物不是新的业务事实，而是把已经定义好的 Field 进一步编译成界面运行时配置，包括：

- Field 在表单中的展示方式；
- Field 的布局位置；
- Field 所使用的控件；
- Field 的只读 / 编辑状态；
- Field 的默认值；
- Field 的数据源；
- Field 的数据源参数；
- Field 之间的联动 / 触发条件；
- Field 的可见性条件；
- Field 的过滤条件；
- 以及其他界面行为。

因此 Asloop 的完整关系需要补充为：

```text
Field Definition
        ↓
Transaction Type / Application
        ↓
Form Designer
        ↓
Form Runtime Definition
        ├─ Layout
        ├─ Widget / Editor
        ├─ Data Source
        ├─ Data Source Filter
        ├─ Dependency / Trigger
        ├─ Visibility
        ├─ Readonly / Editable
        └─ Default / Mapping
```

Form Designer 应理解为 Field/Application Definition 到 UI Runtime Definition 之间的一层“界面编译器 / 配置编译器”。

## 18. Field Data Source / 字段数据源

表单里的部分字段会配置 Data Source。

这里的数据源不只是固定下拉选项，也可以是远程 / 动态数据源。

一个字段的数据源至少可能由以下部分组成：

```text
Data Source
├─ source / endpoint
├─ returned fields
├─ value field
├─ display field
├─ fixed parameters
├─ context parameters
├─ parameters from other fields
└─ filter conditions
```

因此一个字段的数据源可以依赖当前表单中的其他字段。

例如：

```text
Country
   ↓
Province data source filter

Province
   ↓
City data source filter

Customer
   ↓
Delivery Address data source filter
```

这种关系不能简单理解为 UI 事件，而应被视为声明式 Field Dependency / Data Source Dependency。

## 19. 字段之间的触发 / 依赖关系

Asloop 的 Field 在 Form Designer 中可以配置字段之间的相互触发条件。

例如一个字段变化后，可以影响另一个字段的：

- 数据源参数；
- 数据源过滤条件；
- 可见性；
- 是否必填；
- 是否可编辑；
- 默认值；
- 可选范围；
- 其他运行时行为。

因此 Form Runtime 实际上形成了一个依赖图：

```text
Field A
   ↓ change / value dependency
Field B data source / visibility / validation
   ↓
Field C
```

EVO 后续不应把这些联动固化成页面脚本，而应优先表达为可分析、可验证、可编译的声明式 Dependency Graph。

## 20. 数据源过滤的 Visual Studio 2019 设计来源

Asloop 在 Data Source Filter / 数据源过滤方面的设计思想，参考过 Visual Studio 2019 的相关交互 / 配置理念。

当前应保留的设计意图是：

> 数据源过滤不是写死 SQL，而是由设计器通过字段、参数、操作符、上下文值和其他字段值组合出过滤条件。

可以抽象为：

```text
Filter Expression
├─ Left Operand
│   └─ Data Source Field
├─ Operator
│   ├─ eq
│   ├─ neq
│   ├─ gt / gte
│   ├─ lt / lte
│   ├─ in
│   ├─ contains
│   └─ ...
└─ Right Operand
    ├─ Static Value
    ├─ Current Form Field
    ├─ Current User / Entity Context
    ├─ Parent Object
    └─ Runtime Context
```

多个过滤条件可进一步组合为 AND / OR / nested group。

后续分析 Asloop 表单和数据源配置时，需要特别恢复这种“可视化条件构造器”的语义，而不是只读取最终生成的 URL、SQL 或 JSON。

## 21. EVO 对 Form Designer 的继承方向

EVO 应继承的不是旧 UI 技术，而是下面这些能力：

1. Field 在多个 Application 中可以拥有不同 UI Binding；
2. 布局由元数据定义；
3. Data Source 是一等定义资产；
4. Data Source Filter 是声明式表达式；
5. Field 之间可以存在显式 Dependency；
6. Dependency 应可形成可分析的图；
7. 表单定义应可由 LLM 生成、修改、解释和验证；
8. UI Runtime 应根据定义编译，而不是将业务语义硬编码在页面代码中。

推荐 EVO 的概念结构继续演进为：

```text
Semantic Field
        ↓
Application Field Binding
        ↓
Form / List Binding
        ├─ Layout
        ├─ Renderer / Editor
        ├─ Data Source Binding
        ├─ Filter Expression
        ├─ Dependency
        ├─ Validation
        └─ Interaction Rule
        ↓
Experience Compiler / UI Runtime
```

这里的 Experience Compiler / UI Runtime 名称只表示编译 / 运行职责，不代表 Eidos 必须依赖 EVO 内部实现；实际跨项目边界仍遵守公开契约。

## 22. 后续销售主线新增分析项

销售主线除 Field 集合分析外，应进一步恢复：

- 哪些销售 Field 配了 Data Source；
- Data Source 来自哪个 Object / Dataset；
- Data Source 使用哪些固定参数；
- 哪些参数来自其他表单字段；
- 字段之间有哪些 Dependency；
- 哪些字段变化会刷新另一个字段的数据源；
- 哪些条件控制字段显示 / 隐藏；
- 哪些条件控制必填 / 可编辑；
- 相同 Semantic Field 在不同销售 Application 中的 Data Source / Filter 是否不同；
- 哪些联动属于通用 Field Binding；
- 哪些联动属于特定 Application 规则。

这些内容将用于验证 EVO 的 Application Field Binding、Data Source Contract 和声明式 Dependency Graph 是否足以承载真实企业应用。


## 23. Application 的主表 / 从表字段结构

Asloop 的一个 Application 可以包含大量 Field，这些 Field 并不一定处于同一个数据层次。

至少需要区分：

- 主表字段 / Header or Master Fields；
- 从表字段 / Detail or Line Fields。

例如销售订单可以抽象为：

```text
Sales Order Application
├─ Master / Header
│  ├─ orderCode
│  ├─ customer
│  ├─ orderDate
│  ├─ paymentTerm
│  └─ deliveryAddress
│
└─ Detail / Lines
   ├─ inventory
   ├─ specification
   ├─ quantity
   ├─ unitPrice
   ├─ taxRate
   └─ amount
```

因此 Application Field Binding 除了说明字段如何显示和交互，还需要说明字段所处的数据结构层次，例如：

```text
scope = master
scope = detail:<detail-group>
```

后续还应允许一个 Application 存在多个不同 Detail Group，而不能把模型限制成固定的一主一从。

## 24. 字段平铺与列表数据集

Asloop 的应用字段可以按照列表查询需要被“平铺 / Flatten”。

也就是说，Application 的结构化主从数据可以被投影成列表使用的数据集：

```text
Master Fields
+
Detail Fields
        ↓
Flatten / Projection
        ↓
Application List Dataset
```

例如：

```text
Order Header
customer = A
orderDate = 2026-09-23

Order Lines
1. Product X / Qty 10
2. Product Y / Qty 20
```

列表投影可以形成：

```text
customer | orderDate  | product   | qty
A        | 2026-09-23 | Product X | 10
A        | 2026-09-23 | Product Y | 20
```

这里的 Flatten 是查询 / 展示 Projection，不应改变原始 Application / BusinessData 的主从结构。

## 25. 主表列表视图与明细列表视图

同一个 Application 可以拥有不同粒度的列表视图。

至少包括：

### Master List View

一笔业务一行，例如：

```text
orderCode | customer | totalAmount | status
SO001     | A        | 1000        | Open
```

### Detail List View

一条业务明细一行，例如：

```text
orderCode | customer | product | qty | amount
SO001     | A        | X       | 10  | 600
SO001     | A        | Y       | 20  | 400
```

两者可以来自同一个 Application / Data Source，但拥有不同的 Projection Grain / 数据粒度。

因此 EVO 后续应把 View 的 grain / row semantics 作为显式定义，而不能只把“列表”理解成一种固定表格。

## 26. Data Source 与 Visualization 解耦

Asloop 中同一个 Data Source 不只能够用于 Table / Grid。

在相同数据集基础上，还可以配置为不同 Visualization，例如：

- Table / Grid；
- Bar Chart / 柱状图；
- Pie Chart / 饼状图；
- Line Chart / 折线图；
- Status Chart / 状态图；
- 其他可视化表现。

因此更准确的结构是：

```text
Application / Reporting Data Source
              ↓
         Dataset / Projection
              ↓
         View Definition
              ↓
        Visualization
        ├─ Table
        ├─ Bar
        ├─ Pie
        ├─ Line
        ├─ Status
        └─ ...
```

Data Source 定义“数据是什么”，Visualization 定义“数据如何表现”。

同一个 Data Source 可以拥有多个 View，而同一个 View Dataset 也可以拥有多个 Visualization。

## 27. View 不应等同于 Table

EVO 应继承 Asloop 的一个重要思想：

> List View 的本质不是 HTML Table，而是一个带有字段选择、过滤、排序、分组、聚合和粒度语义的 Data Projection。

Table 只是其中一种 Renderer。

建议 EVO 明确区分：

```text
Data Source
→ Dataset
→ Projection / View
→ Visualization Renderer
```

其中：

### Data Source

回答数据从哪里来。

### Dataset

回答可用字段和记录集合是什么。

### Projection / View

回答：

- 选哪些字段；
- 主表还是明细粒度；
- 如何 Flatten；
- 如何 Filter；
- 如何 Sort；
- 如何 Group；
- 如何 Aggregate；
- 是否 Summary；
- 使用哪些 Dimensions / Measures。

### Visualization Renderer

回答：

- Table；
- Bar；
- Pie；
- Line；
- Status；
- Dashboard Card；
- 未来其他 Renderer。

## 28. 主从结构与分析视图的关系

主从结构属于业务数据语义。

可视化平铺属于查询和表现语义。

两者不得混为一个模型。

推荐：

```text
Canonical Application Data
├─ Master
└─ Detail(s)
        ↓
Read Projection
        ├─ Master Grain
        ├─ Detail Grain
        ├─ Aggregated Grain
        └─ Analytical Grain
                ↓
Visualization
```

这样既保留交易数据的准确结构，也允许报表 / 列表 / Dashboard 灵活查看。

## 29. EVO 对 Visualization 的继承方向

EVO 后续的 Application / Experience 定义应允许：

1. 同一个 Data Source 创建多个 View；
2. View 显式定义 row grain；
3. Master / Detail 可选择性 Flatten；
4. View 可以定义 Dimension / Measure；
5. View 可以定义 Filter / Sort / Group / Aggregate；
6. Visualization 与 Dataset 解耦；
7. 同一 View 可切换多个兼容 Renderer；
8. AI 可以根据数据语义推荐 Visualization，但不能改变权威数据含义；
9. Visualization 配置属于可安装 Experience / Reporting Asset；
10. 若 Visualization 来源于 DW / Analytics Pack，则其删除或重建不得影响 canonical BusinessData / Ledger。

可进一步抽象为：

```text
Application
→ Structured Data
→ Dataset Projection
→ View Semantics
→ Visualization
```

这使 EVO 可以同时承载业务列表、明细列表、分析图表和管理看板，而不需要为每种表现复制一套业务数据。


## 30. Grid Editing / 轻量 Excel 式批量编辑

Asloop 中还设计过以表格形式对 Application 数据进行批量编辑的能力。

这类界面不是单纯的 List View，而是一个轻量化 Spreadsheet / Excel-like Frontend：

```text
Application Dataset
        ↓
Editable Grid
        ↓
Batch Change Set
        ↓
Validation / Rule Evaluation
        ↓
Business Submit / Update
```

它允许业务人员在表格中直接对多行应用数据进行编辑，而不是逐条打开 Form。

## 31. Editable Grid 与普通 List View 的区别

普通 List View 主要用于：

- 查询；
- 浏览；
- 筛选；
- 排序；
- 分组；
- 汇总；
- 跳转详情。

Editable Grid 额外承担：

- 单元格内编辑；
- 多行连续编辑；
- 批量复制 / 填充；
- 批量修改同一字段；
- 批量新增行；
- 批量删除 / 作废候选；
- 批量校验；
- 批量提交。

因此在 EVO 中应明确区分：

```text
Read View
vs
Editable Grid View
```

二者可以共享同一个 Dataset / Projection，但具有不同 Interaction Contract。

## 32. Field Definition 对 Grid Editing 的影响

老系统字段设计本身已经包含“列表内编辑组件”这一类能力。

因此同一个 Field 在 Editable Grid 中需要显式知道：

- 是否允许编辑；
- 使用什么 Cell Editor；
- 数据源是什么；
- 如何过滤数据源；
- 是否必填；
- 校验规则；
- 默认值；
- 是否允许批量填充；
- 是否允许复制；
- 是否只读；
- 是否受其他字段联动影响；
- 修改后是否触发其他列重算 / 刷新。

这进一步说明 Field 应被定义一次，并在 Form / List / Editable Grid 等不同 Experience Surface 中通过 Binding 使用。

## 33. Batch Change Set

EVO 后续不应把 Editable Grid 理解成“前端直接逐行 UPDATE 数据库”。

更合理的模型是：

```text
User edits many cells
        ↓
Batch Change Set
        ├─ Row 1 / Field A changed
        ├─ Row 2 / Field B changed
        ├─ Row 3 / Field A changed
        └─ ...
        ↓
Validation
        ↓
Command / Business Operation
        ↓
Canonical BusinessData / governed mutation
```

对于 append-only 或不可静默修改的业务事实，Grid Editing 必须遵守同样的业务规则。

也就是说，“Excel 式体验”只改变交互效率，不改变 EVO 对历史事实、权限、校验、审计和业务命令的约束。

## 34. Master / Detail 与批量编辑

Editable Grid 可以作用在不同粒度：

### Master Grid

一行代表一个 Application Instance，例如一张销售订单。

### Detail Grid

一行代表一个 Detail Line，例如销售订单明细。

### Analytical / Projected Grid

来自 Projection 的聚合数据原则上应默认只读；只有能够明确映射回合法业务 Command 的情况下，才允许编辑。

因此每个 Editable Grid 必须明确：

```text
row_grain
editable_fields
write_target
command_semantics
validation_policy
```

## 35. EVO 的 Spreadsheet-like Experience 方向

EVO 应保留 Asloop 轻量 Excel 前端的核心价值：

> 面对大量结构化业务数据时，用户可以在一个高密度界面中快速完成批量录入、批量修改、复制和校验。

但 EVO 应进一步做到：

1. Grid 来自 Application / View Metadata，而不是专用页面代码；
2. Cell Editor 复用 Field Binding；
3. Data Source / Filter / Dependency 复用字段声明式规则；
4. 批量编辑形成显式 Change Set；
5. Change Set 通过 Command / Policy 执行；
6. 每行 / 每字段校验结果可解释；
7. 权限可以控制到 Field / Row / Operation；
8. append-only 事实不得通过 Grid 绕过不可变约束；
9. AI 可以辅助批量填充、异常检测和建议，但最终写入仍通过确定性业务契约；
10. 同一个 Application 可同时提供 Form Experience 与 Spreadsheet Experience。

推荐关系：

```text
Application
→ Dataset / View
→ Editable Grid Binding
→ Cell Editors / Data Sources / Dependencies
→ Batch Change Set
→ Command / Validation
→ BusinessData
```

## 36. AI-Native 批量编辑的潜在增强

在不改变确定性业务规则的前提下，AI 可以增强 Spreadsheet-like Experience，例如：

- 根据历史值批量建议填写；
- 自动识别异常行；
- 根据自然语言生成批量修改条件；
- 解释哪些行为什么校验失败；
- 根据对象主数据推荐默认值；
- 识别重复 / 冲突数据；
- 将自然语言意图转为可预览的 Change Set；
- 提交前生成影响范围摘要。

AI 只能生成或建议 Change Set，不能绕过 Field Binding、Validation、Permission、Command 和审计边界直接修改权威数据。


## 37. 核销 / 被核销关系与上下游业务导航

Asloop 中“核销 / 被核销”关系不仅用于结算或数量 / 金额匹配，也被用于界面上的业务导航。

用户可以从当前业务数据出发，查看：

- 哪些上游业务数据形成了当前记录；
- 当前记录又被哪些下游业务数据继续处理；
- 与当前记录存在核销关系的其他业务数据；
- 一笔业务在整个链路中的前后关联。

因此，核销关系实际上同时承担了：

```text
Settlement / Match Relation
+
Business Lineage
+
Upstream / Downstream Navigation
```

## 38. Relation Graph / 业务关系图

EVO 后续应将这种能力提升为显式 Relation / Lineage Graph，而不是只把核销理解为财务功能。

推荐抽象：

```text
BusinessData A
   ├─ settles / 核销
   ├─ settled_by / 被核销
   ├─ derives_from / 来源
   ├─ fulfills / 履约
   ├─ reverses / 冲销
   ├─ allocates_to / 分配
   └─ references / 引用
BusinessData B
```

其中“核销 / 被核销”可以继续作为一种非常重要的 Relation Type。

## 39. 上下游导航语义

在 UI / Experience 层，一条业务数据应能够通过 Relation Graph 展示：

```text
Upstream
  ↑
当前 BusinessData
  ↓
Downstream
```

例如：

```text
销售订单
   ↓ 被销售出库履约
销售出库
   ↓ 被收款 / 应收核销
收款
```

或者：

```text
采购订单
   ↓
采购入库
   ↓
付款
```

实际业务关系可以是一对多、多对一、多对多，不应假设固定链式结构。

## 40. 核销关系不能仅靠金额或时间猜测

EVO 中 Relation / Settlement 必须显式保存。

例如：

```text
relation_type = settlement
source_business_data_id = ...
target_business_data_id = ...
quantity = ...
amount = ...
currency = ...
effective_time = ...
```

具体字段以最终数据模型为准，但原则是：

> 哪一笔业务处理了哪一笔业务，必须有显式、可追溯的关系证据。

不能仅依靠“金额相同、日期接近”在查询时猜测。

## 41. Relation 与不可变历史

Relation 本身也是企业历史的一部分。

如果后续发生：

- 取消核销；
- 重新核销；
- 冲销；
- 重新分配；

应优先通过新增 Relation / Reversal / Adjustment 表达，而不是静默修改历史关系。

这与 EVO 的 append-only / replay / audit 原则保持一致。

## 42. Relation 对 UI 的价值

有了显式 Relation Graph，EVO 可以自动生成多种导航体验：

- 查看来源单据；
- 查看后续处理；
- 查看已核销 / 未核销；
- 查看完整业务链；
- 查看相关 Ledger Entry；
- 查看对应 Work；
- 查看对应 GL / Journal；
- 查看报表数字的来源链。

因此 UI 不需要为“销售订单查出库”“出库查收款”等场景分别硬编码专用跳转。

推荐：

```text
BusinessData
→ Relation Graph
→ Contextual Navigation
```

## 43. AI-Native Relation Navigation

AI 可以利用 Relation Graph 做解释和导航，例如：

- “这笔应收是由哪些销售订单形成的？”
- “这笔收款核销了哪些应收？”
- “为什么这个销售订单还显示待收款？”
- “这笔出库的上游订单和下游收入确认分别是什么？”
- “从这个报表数字追溯到原始业务。”

AI 的解释必须建立在显式 Relation / Lineage 数据上，而不是推测业务关联。

## 44. 与 Ledger / Work / Projection 的连接

Relation Graph 应能够横跨：

```text
BusinessData
↕
Relation / Settlement
↕
Ledger Entry
↕
Balance / Work
↕
Projection / Report
```

这样 EVO 才能真正做到：

> 一个业务事实从发生，到被后续业务处理，到进入账本，到形成余额和报表，全链路可导航、可解释、可审计。


## 45. 业务详情页中的记账凭证导航

Asloop 在查看 Application 的业务数据详情时，可以直接查看这笔业务数据对应的记账凭证 / 会计凭证。

这说明旧系统并不是把业务和财务完全割裂成两个独立模块，而是允许从具体业务事实直接进入其财务解释结果。

推荐理解：

```text
Application Business Data
        ↓
Business Detail View
        ↓
Accounting / Posting Evidence
        ↓
Journal / Voucher
```

这里的核心价值不是“详情页多一个按钮”，而是：

> 用户可以从业务事实直接追溯到这笔业务产生的财务记账结果。

## 46. EVO 中的业务 → 记账凭证可追溯关系

EVO 应将该能力建立在显式 Lineage 上，而不是通过单号、时间或金额临时查询匹配。

推荐关系：

```text
BusinessData
   ↓ posting lineage
Ledger Entry
   ↓ accounting recognition
Journal Entry / Journal
   ↓ archival / print representation
Voucher
```

因此在 Application Detail Experience 中，可以自然展示：

- 该业务产生了哪些业务账本分录；
- 哪些分录进一步进入 GL；
- 对应哪个 Journal；
- 是否已经生成 Voucher；
- Voucher 当前编号 / 归档状态；
- 是否存在冲销 / 更正 / 重记账版本；
- 当前看到的是哪一个规则版本产生的结果。

## 47. 业务详情中的“业财同屏”

EVO 后续应支持一种统一详情体验：

```text
Business Detail
├─ Business Facts
├─ Master / Detail Data
├─ Upstream / Downstream Relations
├─ Ledger Impact
├─ Work / Balance Impact
├─ Journal / Voucher
└─ Report / Projection Trace
```

这样业务人员、财务人员和 AI 都能围绕同一 BusinessData 查看不同层次的解释，而不是维护多套互相割裂的页面。

## 48. Voucher 与 Journal 的边界

结合当前 EVO 财务设计，必须继续区分：

- Journal / 会计分录：正式、可审计的会计记录；
- Voucher / 凭证：面向编号、打印、归档、纸质/电子档案要求的表现与归档对象。

业务详情页可以查看 Voucher，但底层 lineage 应优先追溯到 Journal / Ledger Entry，而不是把 Voucher 当成唯一财务事实源。

推荐：

```text
BusinessData
→ Ledger Entry
→ Journal
→ Voucher / Print / Archive Representation
```

这样即使后续 Voucher 编号、打印格式或归档政策变化，也不会破坏业务事实与会计事实之间的权威关系。

## 49. AI-Native 业务到财务解释

有了显式 BusinessData → Ledger → Journal → Voucher lineage，AI 可以可靠回答：

- “这张销售订单产生了哪些会计影响？”
- “为什么这笔业务借记这个科目、贷记那个科目？”
- “这张单据对应哪张凭证？”
- “这张凭证又来自哪些业务数据？”
- “如果重新记账，这笔业务的凭证发生了什么变化？”

AI 的解释必须基于正式 lineage、规则版本和记账结果，而不是根据业务类型名称猜测会计处理。

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

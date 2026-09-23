# EVO Core Boundary and Code Planning v0.1
# EVO 核心边界与代码规划 v0.1

**Status: AUTHORITATIVE PLANNING BASELINE**  
**Date: 2026-09-23**  
**Purpose: 以 bookkeeping 式最小记账内核为基准，重新规划 EVO 代码边界，防止 Core 膨胀，并指导现有代码逐步迁移到可安装 Pack / Plugin。**

## 1. 核心原则

EVO Core 不等于完整 ERP。

EVO Core 的目标是：

> 一个可配置、可追溯、可重算的多维账本与记账规则执行内核。

最小闭环：

```text
BusinessData (thin posting cache)
        ↓
Posting Rule
        ↓
Ledger Entry
        ↓
Balance
```

其中 BusinessData 只保存稳定记账和重算所需的必要历史事实。

## 2. Core 必须拥有的最小原语

第一阶段将 Core 收敛到以下能力：

- BusinessData：弱语义、可重放的 Posting Cache；
- Posting Rule：条件、表达式、目标 Ledger、方向和计算；
- Ledger Definition：账本定义、维度、度量和方向语义；
- Ledger Entry：不可变发生；
- Balance：Ledger Entry 的累计结果；
- Posting Sequence / Ordering：确定性顺序；
- Replay / Re-posting：基于 BusinessData 重新计算；
- Provenance / Trace：BusinessData → Rule → Entry → Balance；
- Import / Export：Ledger / Posting Rule / minimal BusinessData contracts；
- Version / Digest：保证规则和定义可重现。

若某能力不直接服务于上述闭环，默认不进入 Kernel。

## 3. 明确不属于最小 Core 的能力

以下能力默认外移为可安装 Pack / Plugin：

- Object / Master Data Definition；
- Field Definition；
- Transaction Type；
- Application；
- Form / List / View；
- Form Designer；
- Editable Grid；
- Data Source / Filter UI；
- Workflow；
- Work / Todo 产品体验；
- Finance / GL；
- Voucher；
- Trial Balance；
- Balance Sheet；
- Income Statement；
- Cash Flow Statement；
- DW；
- Reporting；
- Dashboard；
- Application–Ledger topology visualization；
- APQC mapping；
- industry template；
- user behavior analysis；
- EC learning。

其中部分能力可以保留非常薄的公共 Contract，但不进入业务实现。

## 4. Pack / Plugin 分类

### 4.1 Definition Pack

绝大多数企业能力都应使用 Definition Pack 实现。

例如：

- Foundation Objects Pack；
- Sales Pack；
- Procurement Pack；
- Inventory Pack；
- Manufacturing Pack；
- Finance Definition Pack；
- Industry Pack。

Definition Pack 主要包含声明式定义，不应新增 Core 业务代码。

### 4.2 Runtime Plugin

只有确实需要新增执行能力时才使用 Runtime Plugin。

例如：

- 新成本算法；
- 特殊估值算法；
- 特殊优化器；
- 外部协议 Adapter。

Runtime Plugin 必须证明其能力跨多个业务场景通用，且现有 Kernel primitive 无法表达。

### 4.3 Experience Pack

由 Eidos 等 Experience Runtime 使用：

- Form；
- List；
- Grid；
- Visualization；
- Dashboard；
- Designer；
- Navigation。

### 4.4 Analytics / Learning

- DW / Reporting：Analytics Pack；
- EC：独立学习系统；
- EVO 只持续产生治理后的 telemetry。

## 5. 代码目录目标形态

推荐逐步收敛为：

```text
/core
  /business-data
  /posting
  /ledger
  /balance
  /replay
  /provenance
  /contracts
  /versioning

/runtime
  /api
  /worker
  /bootstrap

/packs
  /foundation
  /sales
  /procurement
  /inventory
  /manufacturing
  /finance
  /reporting
  /industry-*

/plugins
  /costing-*
  /valuation-*
  /adapters-*

/integration
  /eidos
  /ec

/docs
  /architecture
  /contracts
  /packs
```

这只是目标边界，不要求一次性物理迁移全部目录。

## 6. Core 禁止业务语义规则

Core 代码不得新增与具体业务名称绑定的逻辑，例如：

- sales；
- purchase；
- customer；
- supplier；
- production；
- fixed asset；
- financial statement；
- inventory-specific workflow。

如果某个测试场景需要这些概念，应放在 fixture / pack / certification sample，而不是 Kernel runtime。

允许 Core 使用中性的：

```text
ledger
rule
entry
balance
dimension
source
fact
version
sequence
```

## 7. Application / Field 的新定位

EVO Kernel 本身不需要理解完整 Application / Field 模型。

推荐：

```text
Application Platform Pack
├─ Object Definition
├─ Field Definition
├─ Transaction Type
├─ Application
├─ Master / Detail
├─ Form / List / View
├─ Data Source / Dependency
└─ Editable Grid
```

该 Pack 将需要记账的历史事实投影为 Core BusinessData。

因此：

> Rich Application Data → minimal BusinessData → Posting Kernel

## 8. Finance 的新定位

Finance 不属于最小 Kernel。

Finance Pack 可以建立在同一个 Ledger / Posting Kernel 上提供：

- Chart of Accounts；
- Debit / Credit semantics；
- Journal；
- Period Close；
- Voucher；
- Trial Balance；
- Financial Statements。

已实现的三大报表应视为 Finance / Reporting Pack 能力，而不是 Core 扩展理由。

## 9. 一人公司作为 Core Boundary Test

以后判断一个能力是否应进入 Core，可使用“一人公司测试”：

假设企业只需要：

- 库存；
- 应收；
- 应付；
- 现金；
- 少量进货 / 销售规则。

如果无需安装某能力仍能运行，则该能力不属于最小 Kernel。

例如：

```text
EVO Kernel
+ Simple Trading Pack
=
lightweight inventory / receivable / payable system
```

不要求 Finance、Form Designer、APQC、Reporting、EC 存在。

## 10. Core Boundary Audit 方法

对当前仓库每个模块 / 表 / API 分类为：

```text
KEEP_IN_KERNEL
MOVE_TO_OFFICIAL_PACK
MOVE_TO_BUSINESS_PACK
MOVE_TO_EIDOS
MOVE_TO_EC
DEPRECATE
UNKNOWN_NEEDS_EVIDENCE
```

每项至少记录：

- 当前路径；
- 当前职责；
- 是否直接服务 Posting / Ledger / Balance / Replay；
- 是否绑定具体业务语义；
- 外移目标；
- 兼容影响；
- 数据迁移影响；
- 测试证据；
- 是否需要保留 Public Contract。

## 11. 迁移原则

不能为了“架构变漂亮”破坏已有认证能力。

迁移采用：

```text
inventory current behavior
→ classify ownership
→ extract stable contract
→ add compatibility layer
→ move implementation
→ run existing certification
→ remove obsolete coupling
```

所有迁移必须保留：

- Replay determinism；
- Ledger balance correctness；
- existing certified flows；
- financial traceability；
- migration path；
- rollback path。

## 12. 下一阶段执行顺序

### Phase A — Repository Audit
完整盘点当前 EVO 模块、数据库表、API 和依赖，标记边界归属。

### Phase B — Kernel Contract Freeze
固定最小 BusinessData / Posting Rule / Ledger / Entry / Balance / Replay contracts。

### Phase C — Extract Packs
优先把明显非 Core 的 Finance Reporting、Application metadata、Reporting / Analytics 等能力抽出。

### Phase D — Simple Company Proof
建立一个最小 Trading Pack，证明只使用 Kernel 即可形成库存 / 应收 / 应付 / 现金闭环。

### Phase E — Regression Certification
重新执行现有 Replay、Ledger、Finance 等认证，证明架构收缩没有破坏功能。

## 13. 长期判断规则

任何新能力进入 Core 前必须回答：

1. 是否直接服务 Ledger / Posting / Balance / Replay？
2. 不加入 Core 是否无法实现？
3. 是否至少被多个异构业务共同证明需要？
4. 是否与具体业务名称无关？
5. 是否能保持 Kernel 在一人公司场景下仍然合理？

如果不能同时通过，默认做 Pack / Plugin。

## 14. 最终架构目标

```text
                 ┌────────────────────┐
                 │        EC          │
                 │ learning/experience│
                 └─────────▲──────────┘
                           │ telemetry / recommendations

┌───────────────┐   ┌──────┴───────────────┐
│     Eidos     │   │  Installable Packs   │
│ Experience UI │◄──┤ App / Finance / DW   │
└───────▲───────┘   └─────────▲─────────────┘
        │                     │
        └──────────┬──────────┘
                   │ BusinessData / contracts
          ┌────────▼────────┐
          │    EVO Kernel   │
          │ BusinessData    │
          │ Posting Rules   │
          │ Ledgers         │
          │ Entries         │
          │ Balances        │
          │ Replay          │
          └─────────────────┘
```

最终原则：

> **EVO Kernel 只负责把必要历史事实按规则可靠地变成账本发生和余额，并支持确定性重算；企业业务、财务产品、体验、分析和学习都围绕它安装和生长。**

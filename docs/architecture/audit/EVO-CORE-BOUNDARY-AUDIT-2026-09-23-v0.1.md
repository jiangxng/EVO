# EVO Core Boundary Audit — 2026-09-23 v0.1

**Status: ACTIVE ARCHITECTURE MIGRATION AUDIT**  
**Branch: `evo/core-boundary-audit-v0.1`**  
**Authority: `docs/architecture/EVO-CORE-BOUNDARY-AND-CODE-PLANNING-v0.1.md`**

## 1. Audit Goal

本次不是删除已有能力，而是重新定义代码所有权：

```text
EVO Kernel
= BusinessData + Posting Rule + Ledger Entry + Balance + Replay
```

并将其余能力迁移到低耦合 Pack / Plugin / Eidos / EC 边界。

迁移原则：

```text
preserve behavior
→ classify ownership
→ freeze public contract
→ add compatibility layer
→ move implementation
→ rerun certification
→ remove obsolete coupling
```

## 2. Current Critical Finding

当前最大的结构性耦合点是：

`apps/api/src/evo-runtime.ts`

该 composition root 同时直接装配：

- command
- business-data
- posting
- ledger
- workflow
- replay
- cost
- valuation
- allocation
- economic rates
- materialization
- accounting
- financial statements
- AI
- flow
- enterprise-template
- query

因此当前运行时仍然隐式假设“完整 EVO = 所有能力同时存在”。

第一阶段不删除这些实现，而是拆分为：

```text
createEvoKernelRuntime()
createOfficialPackRuntime()
createCompatibilityRuntime()
```

最终 Pack 必须只通过 Public Contract 依赖 Kernel。

## 3. First-pass Module Classification

| Current module | Classification | Target ownership | Notes |
|---|---|---|---|
| business-data | KEEP_IN_KERNEL | Kernel | 必须继续收缩为薄 Posting Cache；保留 replay 所需最小事实 |
| posting | KEEP_IN_KERNEL | Kernel | Posting rule evaluation / ordering / atomic posting |
| ledger | KEEP_IN_KERNEL | Kernel | LedgerEntry / Balance / generic ledger semantics |
| replay | KEEP_IN_KERNEL_SPLIT | Kernel + runtime extension | Full deterministic replay 属于 Kernel；高级 checkpoint/materialization/parallel execution 可外置 |
| dimensions | KEEP_IN_KERNEL_SPLIT | Ledger contract | 通用 dimension identity/policy 可并入 Ledger contract；业务维度定义由 Pack 提供 |
| lineage | KEEP_IN_KERNEL_SPLIT | Provenance + replay extension | BusinessData→Rule→Entry 最小 provenance 留 Kernel；复杂 dependency graph 可外置 |
| metadata | SPLIT | Kernel definitions + Application Platform Pack | ledger/posting version metadata 留 Kernel；Object/Field/App/Transaction Type 外移 |
| command | MOVE_TO_OFFICIAL_PACK | Application Platform Pack | Kernel 接收 BusinessData/Posting input，不要求 Command runtime |
| application | MOVE_TO_OFFICIAL_PACK | Application Platform Pack | 具体 Application runtime 不属于 Kernel |
| enterprise-package | MOVE_TO_OFFICIAL_RUNTIME | Package Runtime | 安装/验证/依赖解析是官方 Runtime，不属于记账 Kernel |
| enterprise-template | MOVE_TO_OFFICIAL_PACK | Enterprise Definition / Package layer | 企业模板是定义资产 |
| accounting | MOVE_TO_OFFICIAL_PACK_SPLIT | Finance Accounting Pack + Finance Reporting Pack | Journal/GL 与三大报表均不属于 Kernel |
| cost | MOVE_TO_RUNTIME_PLUGIN | Costing Plugin | 通用算法可官方维护，但不是最小 Kernel |
| valuation | MOVE_TO_RUNTIME_PLUGIN | Valuation Plugin | 同上 |
| allocation | MOVE_TO_RUNTIME_PLUGIN | Allocation Plugin | 可独立于 Kernel 演进 |
| economic | MOVE_TO_RUNTIME_PLUGIN | Economic/Rate Plugin | Rate dataset / economic interpretation 非 Kernel |
| position | MOVE_TO_RUNTIME_PLUGIN | Position/Valuation Plugin | 非最小 Kernel |
| materialization | MOVE_TO_OFFICIAL_RUNTIME | Replay/Projection Runtime | generation/materialization 属于高阶执行优化 |
| query | SPLIT | Kernel Public Query + Read Model Pack | Balance/Entry bounded query 留 Kernel；dashboard 聚合外移 |
| workflow | MOVE_TO_OFFICIAL_PACK | Workflow/Work Pack | Work projection 可消费 Ledger，不进入 Kernel |
| flow | MOVE_TO_OFFICIAL_PACK | Flow/Relation Pack | 业务流程模型外移 |
| capability | MOVE_TO_OFFICIAL_PACK | Capability/APQC Pack | 企业能力语义不是 Kernel |
| metrics | MOVE_TO_ANALYTICS_PACK | Analytics Pack | 指标定义与查询不属于 Kernel |
| sop | MOVE_TO_OFFICIAL_PACK | SOP Pack | 不属于 Kernel |
| ai | MOVE_TO_EC | EC integration | EVO Core 不承担长期学习；当前 AI runtime 应逐步退出 Kernel composition |
| identity | SPLIT | Platform Security + Kernel tenant boundary | tenant/enterprise isolation 要保留；完整 auth/role policy 外置 |
| integration | MOVE_TO_OFFICIAL_RUNTIME | Integration Runtime | Outbox/change feed 是公共出口能力，可独立运行 |

## 4. Accounting Split

当前 `modules/accounting` 同时包含：

- Journal / double-entry
- recognition
- accounting periods
- reconciliation
- trial balance
- financial statements
- statement replay / reconciliation

目标至少拆成：

```text
packs/finance-accounting
├─ chart of accounts
├─ journal
├─ recognition
├─ accounting period
├─ reconciliation
└─ trial balance

packs/finance-reporting
├─ balance sheet
├─ income statement
├─ cash flow statement
├─ statement mapping
├─ statement replay
└─ statement reconciliation
```

现有 FAI 认证必须保留为迁移回归证据。

## 5. Metadata Split

当前 `metadata` 同时拥有：

- Enterprise
- Domain
- Transaction Type
- ApplicationDefinition
- FieldGroup / FieldDefinition
- CommandDefinition
- PostingRule
- LedgerDefinition
- ValuationPolicy

新边界应拆成：

```text
Kernel Definition Registry
├─ LedgerDefinition
├─ PostingRuleDefinition
├─ rule version / digest
└─ minimal replay-compatible definition identity

Application Platform Pack
├─ Object / Domain
├─ Transaction Type
├─ Application
├─ Field / Field Group
├─ Command Definition
├─ Form/List/View bindings
└─ enterprise application overlay
```

ValuationPolicy 转入相应 Runtime Plugin。

## 6. Replay Split

`replay` 当前已经包含大量高级能力：

- full replay
- checkpoint
- dependency topology
- incremental planner
- candidate/oracle digest
- checkpoint promotion
- materialization
- generation activation

需要保留的 Kernel 核心：

```text
Replay Contract
├─ scope
├─ pinned BusinessData
├─ pinned Rule Version
├─ deterministic ordering
├─ rebuild
├─ digest
└─ validation
```

以下可以逐步迁移到 Official Replay Runtime：

- checkpoint optimization
- incremental planner
- candidate/oracle generations
- materialization
- parallel execution
- async jobs

原则：优化层可以移除，Full Replay 正确性仍成立。

## 7. Query Split

当前 `query` 的 `EnterpriseDashboard` 聚合了：

- balances
- work items
- business data
- posting inputs
- cost
- valuation
- flow
- replay

这不是 Kernel Public API。

Kernel 只应保留：

```text
Ledger Entry bounded query
Balance current/as-of/by-dimension
BusinessData bounded history
Posting status
Replay status
Provenance trace
Snapshot / Bulk Export
Change Feed
```

Dashboard 应成为可安装 Read Model / Experience Pack。

## 8. Database Migration Ownership

现有 migration 需要逐步标注 owner，而不是现在立刻移动。

初步分组：

### Kernel candidate
- `202609090020_m2_command_business_data.sql` — 需要拆分 command / business-data ownership
- `202609090030_m3_posting_ledger.sql`
- replay 中与最小 deterministic replay 直接相关的 schema

### Application Platform / Enterprise Definition
- `202609090010_m1_metadata_kernel.sql` — 名称需要重新评估，实际包含大量非 Kernel metadata
- `202609110010_v10_alpha1_enterprise_model.sql`
- `202609160010_enterprise_template_v01.sql`

### Runtime Plugin / Advanced Runtime
- dimensions / valuation / economic runtime / materialization / position / checkpoint 系列

### Finance Packs
- `202609220010_fai_double_entry.sql`
- `202609220020_fai_recognition_trial_balance_replay.sql`
- `202609220030_fai_period_reconciliation_statement_metadata.sql`
- `202609220040_fai_three_financial_statements.sql`

数据库先做 ownership 标记，物理 schema/数据库迁移后做。

## 9. Immediate Migration Gates

第一批代码改造前必须先完成：

1. 冻结最小 Kernel Public Contract；
2. 新建独立 Kernel composition root；
3. 现有 `createEvoRuntime()` 保留为 compatibility composition；
4. architecture tests 禁止 Pack import Kernel `infrastructure/`；
5. 定义 Pack → Kernel 只能使用 Public API / Contract；
6. 为 Finance / Cost / Valuation 等建立明确 owner；
7. 跑当前全部认证作为 baseline。

## 10. First Physical Refactor Slice

建议第一刀只做 composition，不搬数据库：

```text
apps/api/src/evo-runtime.ts
        ↓
runtime/kernel-runtime.ts
runtime/official-packs-runtime.ts
runtime/compatibility-runtime.ts
```

验收：

- Kernel Runtime 可单独构造；
- Kernel Runtime 不 import accounting/cost/valuation/workflow/ai/application；
- Compatibility Runtime 仍能构造全部现有服务；
- 所有现有测试通过；
- FAI / EEL 认证逻辑不变。

## 11. Explicit Non-goals of Audit v0.1

本轮不：

- 删除任何已认证模块；
- 修改财务结果；
- 修改 Replay 结果；
- 立即拆 GitHub 仓库；
- 立即分数据库；
- 立即重写 metadata schema；
- 立即实现新的 Pack installer；
- 立即优化性能。

本轮只建立可执行所有权边界，并开始最小风险迁移。

## 12. Success Criterion

本次大改动最终成功不是“目录变漂亮”，而是：

```text
EVO Kernel can run independently
+
Business Packs can be absent
+
Finance can be absent
+
Eidos can be absent
+
EC can be absent
+
same BusinessData + rules + order
= same entries + balance
```

同时现有完整 EVO compatibility distribution 仍然可以通过安装官方 Packs 恢复当前全部能力。

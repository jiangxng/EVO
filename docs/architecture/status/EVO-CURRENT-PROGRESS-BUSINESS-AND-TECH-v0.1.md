# EVO 当前项目进度：业务视角 + 技术视角 v0.1

**状态：CURRENT-STAGE STATUS / 持续更新**  
**日期：2026-09-19**  
**适用分支：`evo/apm-certification-enterprise-template-v0.1`**

---

## 当前权威摘要 — 2026-09-22

> **本节是当前状态入口。本文后续较早章节保留为追加式历史记录，不应覆盖本节、`project.status.json`、`requirements.status.json` 与最新 Context Checkpoint 的当前指针。**

当前 authoritative integration branch：`main`。

当前已认证的 Stage E 企业闭环：

```text
EEL-C01  Order-to-Cash                         CERTIFIED
EEL-C02  Procure-to-Pay                       CERTIFIED
EEL-C03  Return / Exchange / Refund / Red     CERTIFIED
EEL-C04  Manufacturing Execution              CERTIFIED
```

EEL-C04 最终远程证据：

- PR #39 / CI #640：C04.2–C04.5 Manufacturing Execution Bundle；
- PR #40 / CI #642：C04.6 Full Replay + C04.7 Final Certification；
- main merge commit：`11ee7618c12da214e8e0270b321e0f098a448488`；
- 正式认证：`docs/architecture/certification/EEL-C04-MANUFACTURING-EXECUTION-CERTIFICATION-v0.2.md`；
- 当前 handoff checkpoint：`docs/architecture/continuity/checkpoints/EVO-CONTEXT-CHECKPOINT-2026-09-22-v1.5.md`。

制造闭环已经证明：

```text
Production Demand
→ Material Issue
→ FIFO Cost / Manufacturing WIP
→ Partial + Final Completion
→ Finished Goods Inventory
→ PRODUCE Work Closure
→ Full Replay Equality
```

并修复了一项真实 Replay 缺陷：Valuation 在 Replay 中晚执行时，Ledger Balance 的最新排序元数据现在按
`(effective_at, posting_priority, posting_sequence)` 保持语义上的最新值，不再倒退。

**当前下一步不是继续扩 EEL-C04。**

completed-loop requirement-alignment trigger 已触发。下一项 Stage E 实现必须先从业务价值 / APQC capability gap 重新选择，避免因技术惯性继续制造域扩展。

---

## 0. 为什么需要这份文档

EVO 是大模型原生项目，但项目最终不是为了展示技术，而是为了让企业真实业务可以长期、稳定、可解释地运行。

因此从本阶段开始，项目状态不再只使用：

- 模块编号；
- ADR；
- migration；
- commit；
- CI；
- replay digest。

所有重要进度都必须同时回答四个问题：

1. **业务上要解决什么问题？**
2. **企业现在已经获得了什么能力？**
3. **技术上采用什么路线实现和验证？**
4. **目前还缺什么，下一步为什么要做？**

以后状态汇报统一使用：

```text
业务问题
   ↓
业务能力
   ↓
技术实现
   ↓
验证状态
   ↓
剩余风险 / 下一步
```

技术状态不能替代业务状态；业务描述也不能替代可验证的工程证据。

---

# 1. EVO 的业务初心

EVO 的目标不是重新制造一个传统 ERP。

业务上的最终目标是：

> 企业发生的真实业务被可靠记录后，系统可以根据不同时间、规则、政策和解释方式，自动形成库存、应收、应付、待生产、待发货、成本、利润、现金、会计账、管理指标和工作任务，同时保留完整历史，并且可以重新解释、重新计算和证明结果。

传统 ERP 经常把：

- 业务单据；
- 当前状态；
- 库存余额；
- 成本；
- 会计结果；
- 流程状态；

混在一套大量可修改的数据表中。

EVO 当前正在证明另一条路线：

```text
真实业务事实
    ↓
明确的业务意图
    ↓
版本化规则 / 政策 / 参考数据
    ↓
确定性解释
    ↓
业务头寸 / 分配 / 成本 / 估值
    ↓
账本和工作状态
    ↓
余额 / 报表 / 管理视图
```

如果算法、规则或管理要求发生变化：

> 不篡改原来的业务历史，而是重新解释和重新生成派生结果。

---

# 2. 考古阶段：业务上解决了什么

## 状态

**当前 Economic Runtime 所需的核心语义考古：阶段性完成。**

主要来源：

- Asloop-Backend；
- bookkeeping；
- 历史数据库 Schema；
- 配置与规则；
- WaterBal / TbMatched / Component / MATCH_REL 等旧运行模型。

## 业务意义

考古不是为了复制 Java。

它解决的是：

> 老系统过去十几年为什么能支撑采购、销售、库存、成本、往来、外币等业务，其中真正值得保留的企业管理语义是什么？

已经提炼出来的重要业务能力包括：

- 一笔业务可以同时影响多个业务/财务账本；
- “待生产、待发货、待收款”等本质上也是企业 Position/余额；
- 一个来源可以被另一笔业务部分或全部消费；
- 手工指定来源与系统自动匹配必须区分；
- 数量流、金额流、价值解释不能混为一谈；
- 成本可以在业务已经发生后再确定；
- FIFO / LIFO / Moving Average / Specific ID 属于不同 Cost/Allocation Policy；
- 外币数量与本位币账面价值必须分开；
- 期末汇兑重估不能修改原来的外币业务事实；
- 历史业务必须支持按新的解释规则重新计算。

旧 Java 现在主要承担“历史语义证据”的角色，而不是新 EVO 的实现模板。

---

# 3. 新 EVO Runtime：现在业务上已经建立了哪些基础能力

## 3.1 企业与应用

### 业务问题

不同企业需要安装不同业务应用，并且未来能够升级模板而不把企业历史破坏掉。

### 当前能力

已经建立：

- Enterprise；
- EnterpriseTemplate；
- EnterpriseTemplateVersion；
- EnterpriseBinding；
- ApplicationDefinition / Version；
- ApplicationInstance；
- Enterprise Overlay。

### 业务意义

未来可以表达：

> “A 企业当前安装的是制造业模板 v3；销售应用使用 v5；企业自己有两个字段覆盖；升级到 v4 模板前先做差异规划。”

而不是把所有客户写死在一份代码里。

---

## 3.2 Command → BusinessData

### 业务问题

企业员工、AI、自动化和外部系统都会发起动作，但“发起请求”与“业务事实已经发生”不是一回事。

### 当前能力

已经明确分离：

```text
Command
→ 授权 / 前置条件 / 幂等验证
→ CommandExecution
→ BusinessData
```

### 业务意义

例如：

“批准销售订单”是一个 Command。

当 Command 被系统正式接受后：

“销售订单已批准”才成为 BusinessData。

Replay 时重放 BusinessData，**不会重新批准订单**。

这为 AI Agent 将来直接操作企业系统提供了安全边界。

---

## 3.3 Posting → Ledger

### 业务问题

一笔销售、采购、生产业务发生后，需要自动形成：

- 待生产；
- 待发货；
- 应收；
- 库存；
- 成本；
- 其他管理账。

但这些结果不应该硬编码在业务单据程序里。

### 当前能力

已经建立：

```text
BusinessData
→ PostingRule
→ LedgerEntry
→ LedgerBalance
→ WorkItem
```

### 业务意义

企业可以通过版本化规则定义：

> “什么业务发生时，增加/减少哪些业务或财务账本。”

账本机制已经不局限于传统会计科目。

---

## 3.4 Allocation / Position

### 业务问题

企业大量业务都包含“这笔业务到底消费/核销哪一个来源”。

例如：

- 哪批采购满足了哪次出库；
- 哪批库存被哪张销售单消耗；
- 哪笔收款核销哪张应收；
- 哪个生产投入被哪个产出消耗。

### 当前能力

已经分开：

```text
AllocationInstruction
= 业务明确指定的来源意图

AllocationPolicy
= 系统如何自动选择来源

AllocationRelation
= 系统最终算出的实际来源消费关系
```

并引入 PositionDefinition 来定义开放头寸。

### 业务意义

这使 FIFO、LIFO、个别指定、手工核销、自动核销等可以共享统一底层。

---

## 3.5 Cost

### 业务问题

库存成本不是单据上的一个永远正确的字段。

采购、生产、退货、调拨、追溯业务会让成本需要重新解释。

### 当前能力

目前已经建立统一 Cost Method substrate，并支持/表达：

- FIFO；
- LIFO；
- Moving Average；
- Specific Identification；
- AllocationPolicy pin；
- ValuationPolicy pin；
- CostRun / CostResult；
- residual closure；
- deterministic order。

### 业务意义

未来可以做到：

> “业务事实不改，换一个成本政策，把某一段历史重新计算，然后证明新的成本和旧成本为什么不同。”

---

## 3.6 外币 / 汇兑

### 业务问题

外贸企业的一笔 USD 应收同时存在：

- USD 1000 的外币经济数量；
- CNY 7000 的当前账面价值；
- 期末汇率变化；
- 最终收款汇率/结算金额；
- 未实现与已实现汇兑损益。

不能把它们压缩成一个 amount 字段。

### 当前能力

已经证明/正在最终认证：

```text
销售形成外币应收
USD 1000 / carrying CNY 7000

      ↓

期末 RateDataset = 7.2

      ↓

期末 carrying = CNY 7200
未实现重估差额 = +200

      ↓

实际收到 CNY 7300

      ↓

核销开放应收 Position

      ↓

已实现汇兑差额 = +100
```

### 业务意义

系统能够明确区分：

- 原始外币业务事实；
- 当前本位币账面价值；
- 期末重估；
- 实际结算；
- 来源核销关系。

---

# 4. Replay：当前整个项目最重要的验证主线

## 业务问题

企业运行十年后，如果：

- 成本算法改变；
- 规则发现错误；
- 汇率数据修正；
- 财务政策升级；
- 系统升级；
- 换一个 LLM；
- 原来的派生表损坏；

我们能不能仍然回答：

> “当年的真实业务是什么？”
>
> “按这套规则重新计算，结果应该是什么？”
>
> “为什么得到这个数字？”

这就是 Replay 的业务意义。

---

## 4.1 已经证明的部分

Full Replay 基础主线已经建立：

```text
Canonical Facts
+ Explicit Instructions
+ Pinned Definitions
+ Pinned Policies
+ Pinned Reference Datasets

             ↓

删除可重建 Derived State

             ↓

FULL REPLAY

             ↓

重新生成 Posting / Ledger / Cost / Allocation / Valuation

             ↓

Economic Runtime Digest

Before == After
```

依赖关系图的 producer family coverage 已经建立，覆盖：

- Posting Projection；
- Allocation；
- Cost Valuation；
- FX Period End；
- FX Realized Settlement；
- Work Projection。

---

# 5. 当前我们准确进行到哪里

当前主线：

`ER-C05B3.2B — Canonical FX Realized Settlement Full Replay`

## 用业务语言解释

现在不是在测试：

> “系统会不会算 100 块汇兑损益。”

而是在测试更严格的问题：

> 一家企业已经发生销售、形成外币应收、期末重估、收到货款并明确核销了哪笔应收。
>
> 如果我们把系统后来算出来的 AllocationRelation、ValuationResult、Ledger 等派生结果全部删除，只留下当时真实发生的业务事实、业务指令和当时固定的政策/汇率数据，EVO 能不能把这些结果完全重新算回来？

目标场景：

```text
销售应收
USD 1000
账面 CNY 7000

→ 期末重估
CNY 7200
差额 +200

→ 客户付款
CNY 7300

→ 指定核销该销售应收

→ realized FX
+100
```

Full Replay 后仍然必须得到：

- +200 期末重估；
- +100 已实现汇兑；
- 同样的 Allocation lineage；
- 同样的 Cost/Valuation/Projection 状态；
- 同样的最终 Economic Runtime Digest。

---

# 6. 当前技术验证状态

当前真正的认证标准已经提升为：

```text
migration
→ typecheck
→ build
→ unit tests
→ seed:demo（真实 PostgreSQL）
→ validate:demo（完整参考企业）
```

之前 CI 只跑到 unit tests，这个证据问题已经纠正。

新的真实 E2E 已经暴露并修复了 PostgreSQL JSONB array persistence 问题，包括：

- PositionDefinition dimensions/source_rules；
- AllocationRelation measurements；
- ValuationResult source IDs / measurements。

当前 B3.2B 仍然保持：

**IN PROGRESS / TRUE E2E CERTIFICATION REQUIRED**

在真正 `seed:demo + validate:demo` 全绿以前，不宣称完成。

---

# 7. B3.2B 完成后，业务上意味着什么

如果当前 gate 关闭，我们将第一次拥有一个比较完整的证明：

> 企业经济解释层不是“算完存在数据库里就算完成”，而是真的可以从业务历史重新生成。

这对后续业务能力非常关键：

- 成本重算；
- 财务重过账；
- 外币历史重估；
- 历史规则修复；
- 追溯业务插入；
- 企业模板升级；
- 系统版本升级；
- LLM 替换；
- 数据灾难恢复；
- 审计解释。

---

# 8. B3.2B 后面的路线

## 下一阶段 1：Checkpoint Promotion / Incremental Replay

业务问题：

全量重算十年历史可以保证正确，但企业不能每改一笔历史数据都把十年全部重算。

因此下一阶段要证明：

> 找到受影响范围，从安全 Checkpoint 开始局部重算，最终结果必须和 Full Replay 完全相同。

业务价值：

- 历史追溯修正可以落地到生产环境；
- 大企业长期数据仍然可以高性能重新解释。

---

## 下一阶段 2：扩大 Reference Enterprise 业务覆盖

当前底层已经用销售、生产、库存、成本、外币等场景做了核心证明。

后续要逐步扩大到：

- Purchase → Receipt → AP；
- Sales → Shipment → AR；
- Production Input / Output；
- Inventory Transfer；
- Sales/Purchase Return；
- Payment / Receipt / Settlement；
- FIFO / LIFO / MWA / Specific ID；
- multi-currency；
- corrections / reversals；
- backdated transactions；
- multi-enterprise isolation。

业务目标：

从“证明底层内核成立”，进入“证明企业主要经济循环都能由同一内核表达”。

---

# 9. 当前阶段不是产品完成度

必须区分：

```text
Economic Runtime architecture
        ≠
完整 ERP 产品
```

当前工作的重点仍是：

> **把企业经济运行底座证明正确。**

还没有进入完整产品阶段的内容包括大量：

- 最终业务 UI；
- 行业模板丰富度；
- 权限产品化；
- 报表中心；
- 管理驾驶舱；
- 企业配置工具；
- 模板市场；
- EC 学习系统；
- Eidos 最终交互；
- 大规模生产部署治理。

但这些未来层都依赖当前底座正确。

---

# 10. 以后每次推进的固定汇报格式

从本文件生效后，每一个重要 work packet 的进度汇报至少包含：

### A. 业务问题

企业现实中遇到什么问题？

### B. 业务能力

完成后企业获得什么能力？

### C. 技术路线

EVO 用什么模型/模块解决？

### D. 当前验证状态

- NOT STARTED
- IMPLEMENTED
- UNIT VERIFIED
- E2E VERIFIED
- CERTIFIED

必须说明证据等级。

### E. 当前还差什么

不能把“代码写完”说成“业务能力已经验证”。

### F. 下一步及业务原因

不仅说明下一个技术任务，还说明为什么业务上值得做。

---

# 11. 当前一句话状态

> **EVO 已完成当前 Economic Runtime 核心语义考古和主要架构冻结，正在用新的 TypeScript/PostgreSQL Runtime 做真实 E2E 认证；当前聚焦证明“外币应收从期末重估到实际结算的全部派生结果，可以只依靠历史业务事实、显式核销意图以及固定规则/汇率数据，被 Full Replay 完整重建”。**

这一步完成后，主线将进入：

> **从 Full Replay correctness oracle 推进到可生产使用的安全 Incremental Replay。**

---

# 12. 2026-09-20 追加状态：B4.3A 隔离 Oracle 已认证

> 本节为追加记录，不覆盖第 5–11 节在 2026-09-19 时的历史状态。

## A. 业务问题

企业不能为了验证一份局部重算结果，先破坏当前正在使用的账、成本和工作状态；也不能在 Full Replay 对照验证时销毁准备上线的 Candidate。

## B. 企业现在获得的能力

EVO 已经可以同时保留：

- 当前生产状态 `CURRENT`；
- 从安全 Checkpoint 开始局部重算的 `CANDIDATE`；
- 从第一笔历史开始完整重算的独立 `ORACLE`。

Candidate 与 Oracle 使用同一归一化经济语义摘要进行比较，Oracle 验证过程不推进 CURRENT 的 Posting 状态，不改变 CURRENT 的工作余额，也不删除 Candidate 派生数据。

## C. 技术路线

```text
CURRENT / ACTIVE
      ├─ CANDIDATE：恢复前缀 + 重算 suffix
      └─ ORACLE：隔离 generation 内完整重放

Candidate digest == Oracle digest
```

隔离边界覆盖 Posting、Ledger、Cost、Allocation、Valuation、Work 和 Dependency。

## D. 当前验证状态

`ER-C05B4.3A — CERTIFIED`

证据：

- implementation head `2caf3433bc539646cfde9ff4a700e7390cee3162`；
- PostgreSQL 18 E2E run `35431321738`；
- migration、typecheck、build、30 个测试文件/79 项单测、seed:demo、validate:demo 全部通过；
- DB schema version 21。

## E. 当前还差什么

生产安全增量重放尚未全部关闭。

当前已有通用的 Candidate `markVerified` 与 `activateVerified` 原语，但尚未通过一个不可绕过的治理服务强制绑定：

- exact Candidate；
- exact VERIFIED Oracle；
- 相同 parent / boundary / plan / checkpoint / promotion；
- 完全相等的 semantic digest；
- 不可变 equivalence certification。

## F. 下一步及业务原因

下一工作包是：

`ER-C05B4.3B — Governed Candidate Equivalence Certification & Atomic Activation`

业务原因是：

> “算得一样”必须进一步变成“只有拿着这份精确等价证据的那一代 Candidate 才能成为新的生产 CURRENT”；任何错配或过期都必须保持旧 CURRENT 不动并拒绝切换。

## 当前一句话状态（2026-09-20）

> **EVO 已证明局部重算 Candidate 与独立 Full Replay Oracle 可以在不破坏当前生产状态的情况下得到完全相同的企业经济语义；当前正在把该数学/工程等价证明升级为不可绕过、可审计、失败关闭的生产激活治理。**

---

# 13. 2026-09-20 追加状态：B4.3B 治理激活已认证

> 本节追加在 B4.3A 之后，不覆盖任何历史状态。

## A. 业务问题

企业需要的不只是 Candidate 与 Full Replay Oracle “算得一样”，还必须保证只有这份被精确认证的 Candidate 能替换当前正式状态，并且切换过程中不能重复记账、不能选错 parent、不能绕过治理。

## B. 企业现在获得的能力

在参考 FIFO 场景中，EVO 已能：

- 保存 Candidate↔Oracle 不可变等价证据；
- 拒绝摘要、范围、parent、Checkpoint 或 Promotion 错配；
- 原子归档旧 CURRENT；
- 原子激活 Candidate Runtime 与 Ledger；
- 将已认证 suffix PostingInput 从 QUEUED 切换为 POSTED；
- 将企业 Posting cursor 推进到认证边界；
- 将正式待发货余额从 8 更新为 7；
- 保留 +200 未实现和 +100 已实现汇兑语义。

## C. 技术路线

新增 Schema 22 `runtime_equivalence_certification`，并移除通用 Candidate `markVerified/activateVerified` 绕过路径。所有认证、状态切换和 Posting cursor 更新在同一 PostgreSQL 事务内完成。

## D. 当前验证状态

`ER-C05B4.3B — CERTIFIED FOR REFERENCE FIFO SCENARIO`

- remote head `07f6a97c453e9697595fab1b2f3c7dfc48281382`；
- GitHub Actions `35478570102`；
- migration/typecheck/build 全绿；
- 31 个测试文件、83 项测试全绿；
- seed:demo/validate:demo 真实 PostgreSQL 18 全绿。

## E. 当前还差什么

尚需证明激活后所有历史读取能正确组合 parent prefix 与 CURRENT suffix，并扩大到多成本方法、mismatch/stale-parent 数据库 E2E、并发 Worker、重试和崩溃恢复。

## F. 下一步及业务原因

进入：

`ER-C05B4.4 — Activation Safety Matrix & Generation-Overlay Read Certification`

业务原因：

> 新 CURRENT 不仅要有正确余额，还必须让审计、成本、分配、估值和业务查询看到完整历史；同时任何并发或失败都不能产生两个 CURRENT 或重复记账。

## 当前一句话状态（2026-09-20 B4.3B）

> **EVO 已在参考场景中打通“安全 Checkpoint → 局部 Candidate → 隔离 Full Replay Oracle → 不可变等价认证 → 原子正式切换”的完整闭环；下一步转向激活后的完整历史读取与并发/失败安全认证。**

---

# 14. 2026-09-20 追加状态：B4.4A CURRENT 代际叠加读取已认证

> 本节追加在 B4.3B 之后，不覆盖任何历史状态。

## A. 业务问题

增量 Candidate 上线后，新世代只保存恢复后的当前余额和重算 suffix，并不复制全部历史分录。只读新 dataset 会丢历史；不分世代全读则会混入 Archived、Candidate 和 Oracle。

## B. 企业现在获得的能力

在参考 FIFO 场景中，EVO 已能：

- 沿已认证 parent chain 组合历史前缀与当前后缀；
- 从 active leaf generation 读取正式余额与待办；
- 组合 Ledger、Cost、Allocation、Valuation 和 Work 语义；
- 用激活认证摘要校验最终正式视图；
- 对循环、跨域、断档、缺少认证或摘要不一致执行失败关闭。

## C. 技术路线

新增 `PostgresCurrentEconomicRuntimeViewService`。在 `REPEATABLE READ` 事务中锁定 CURRENT，验证每个 parent→child 的 CERTIFIED 激活证据，按 sequence interval 组合历史 family，并只从叶子读取快照 family。

## D. 当前验证状态

`ER-C05B4.4A — CERTIFIED FOR REFERENCE FIFO SCENARIO`

- remote head `6fa8abde08b26d1096b2ab89be23425a795f7604`；
- GitHub Actions `35479404204`；
- migration/typecheck/build 全绿；
- 31 个测试文件、83 项测试全绿；
- seed:demo/validate:demo 真实 PostgreSQL 18 全绿；
- Candidate = Oracle = activated CURRENT overlay digest：`3d39e82014a071558293e96dbe5e38e02689b9d8dc23955242aab98761eed291`。

## E. 当前还差什么

B4.4 整体尚未关闭。Dashboard、LedgerReader 等旧默认读取仍需统一路由；还缺多代连续激活、mismatch/stale/revoked、重复请求、并发 Worker 和 crash recovery 数据库认证。

## F. 下一步及业务原因

进入：

`ER-C05B4.4B — Read Routing & Activation Failure Matrix`

业务原因：

> 不能只提供一个正确的新读取服务，还必须确保所有正式入口都无法绕开它，并证明异常与并发不会产生残缺历史、重复结果或两个 CURRENT。

## 当前一句话状态（2026-09-20 B4.4A）

> **EVO 已证明激活后的增量世代能够与父代历史组合成和 Full Replay 完全相同的正式经济视图；下一步封闭旧读取旁路，并完成激活失败与并发安全矩阵。**


---

# 15. 2026-09-21 追加状态：B4.4B 第一阶段正式读取路由已通过数据库 E2E

> 本节追加在 B4.4A 之后，不代表 B4.4B 整体关闭。

## A. 业务问题

B4.4A 已经证明 generation-aware CURRENT overlay 本身可以得到正确完整的正式经济视图，但 Dashboard、LedgerReader、WorkProjection 等默认入口仍可能绕开该模型，直接读取历史表或 legacy 空 generation 数据。

这会产生一个实际生产风险：

> 内核已经算对，但不同页面、报表或工作队列可能各自看到不同的“正式状态”。

## B. 企业现在获得的能力

当前第一阶段已实现并验证：

- Dashboard 的余额、Work、Cost 正式语义在 generation 生命周期启用后统一走 CURRENT overlay；
- LedgerReader 只读取精确绑定当前 CURRENT generation 的 ACTIVE LedgerDataset；
- WorkProjection 默认读取在激活后自动解析 CURRENT generation；
- 激活后的正常 Work refresh 继续写入 CURRENT generation，不再新增 legacy-null WorkItem；
- 在尚未进入 Economic Runtime generation 生命周期前，初始化/传统 baseline 仍可正常运行；
- 一旦 generation 已存在，正式读取不再回退到旧 baseline。

## C. 技术路线

采用两段式正式读取边界：

```text
尚无 ACTIVE Economic Runtime generation
    → legacy baseline 是唯一正式状态

ACTIVE generation 已存在
    → 必须解析 CURRENT / ACTIVE
    → Dashboard 走 CurrentEconomicRuntimeView
    → Ledger / Work 读取当前 leaf generation
    → 禁止回退 legacy baseline
```

跨 generation 的完整历史组合仍由 Query 模块拥有；Ledger 和 Workflow 不反向依赖 Query，而是只解析当前 snapshot generation，保持现有模块依赖方向。

## D. 当前验证状态

**DATABASE E2E VERIFIED — B4.4B READ ROUTING FIRST SLICE**

- branch: `evo/er-c05b4-4b-read-routing-v0.1`
- implementation head: `b6a3f04a4ff7b34021ad397fdb1cfacad1f58b85`
- GitHub Actions: `35580699604 — SUCCESS`
- PostgreSQL: 18
- schema: 22（无新增 migration）
- docs validation: PASS
- migration: PASS
- typecheck: PASS
- build: PASS
- tests: 31 files / 83 tests PASS
- seed:demo: PASS
- validate:demo: PASS

数据库 E2E 明确验证激活后：

- Dashboard `pending_shipment = 7`；
- 默认 LedgerReader `pending_shipment = 7`；
- 默认 WorkProjection `pending_shipment = 7`；
- 再次执行默认 Work refresh 不增加 legacy-null scoped WorkItem。

## E. 当前还差什么

B4.4B 尚未认证关闭。仍需数据库级证明：

1. 两次及以上连续 generation activation；
2. semantic mismatch 拒绝；
3. stale parent 拒绝；
4. revoked Checkpoint / Promotion governance 拒绝；
5. duplicate activation retry / idempotency；
6. activation 与 Worker 并发；
7. crash / retry recovery。

## F. 下一步及业务原因

下一子阶段优先进入：

`B4.4B — Activation Failure Matrix`

先证明 mismatch、stale/revoked governance 与重复激活全部 fail-closed，再推进并发与 crash recovery。

## 当前一句话状态（2026-09-21）

> **EVO 已把“正确的 CURRENT overlay”接入默认 Dashboard、Ledger 和 Work 正式入口，并通过真实 PostgreSQL 18 E2E；当前继续证明错误、过期、撤销和重复激活请求都不能改变唯一可信 CURRENT。**


---

# 16. 2026-09-21 追加状态：B4.4B 激活失败矩阵第一组已通过数据库 E2E

> 本节追加在读取路由第一阶段之后；B4.4B 整体仍未关闭。

## A. 业务问题

正式切换不能只证明“正确请求能成功”，还必须证明错误、过期、被撤销或重复的请求不会改变生产 CURRENT。

## B. 当前已经证明

真实 PostgreSQL 18 环境现已验证：

- **Duplicate activation retry**：同一 Candidate/Oracle 再次提交只返回同一 certification，不新增第二份认证、不产生第二次切换，仍只有一个 CURRENT；
- **Semantic mismatch**：Candidate 与 Oracle digest 不一致时形成 `REJECTED`，包含 `SEMANTIC_DIGEST_MISMATCH`；
- **Stale active parent**：Candidate 计算完成后 CURRENT parent 已变化时形成 `REJECTED`，包含 `STALE_ACTIVE_PARENT`；
- **Revoked promotion**：Candidate/Oracle 已计算完成，但其 Checkpoint Promotion 在激活前被撤销时形成 `REJECTED`，包含 `PROMOTION_NOT_ACTIVE`；
- 所有失败场景均不激活 Candidate，并最终保持原正式 CURRENT 唯一。

## C. 技术路线

新增独立数据库验证脚本：

`scripts/validate-activation-failure-matrix.ts`

并将其加入 CI：

`npm run validate:activation-failure-matrix`

失败矩阵直接调用正式 `PostgresRuntimeEquivalenceCertificationService` 及其 PostgreSQL 事务边界。Digest Port 在失败夹具中使用受控输入，以隔离并验证治理事务本身；真实 Candidate/Oracle digest 计算路径已经由 B4.3A/B4.3B/B4.4A 的完整认证覆盖。

## D. 当前验证状态

**DATABASE E2E VERIFIED — B4.4B FAILURE MATRIX FIRST SET**

- implementation head before this documentation update: `d8babb3e6fc987567027a4502cee23b89eced2c9`
- GitHub Actions: `35581245021 — SUCCESS`
- PostgreSQL 18
- Schema 22
- `validate:docs` PASS
- migration PASS
- typecheck PASS
- build PASS
- 31 files / 83 tests PASS
- `seed:demo` PASS
- `validate:demo` PASS
- `validate:activation-failure-matrix` PASS

## E. B4.4B 尚未关闭的核心证据

当前剩余重点收敛为：

1. 两次及以上连续正式 generation activation；
2. activation 与 Worker 并发互斥/一致性；
3. crash / retry recovery；
4. 必要时补充更深的 Checkpoint invalidation / transaction interruption 组合矩阵。

## 当前一句话状态（2026-09-21 B4.4B）

> **EVO 已证明正式读取入口能够统一服从 CURRENT generation，并已在数据库层证明重复、摘要不一致、旧 parent 和被撤销治理证据都不能错误切换生产状态；下一步进入连续多代激活与并发/崩溃恢复。**


---

# 17. 2026-09-22 追加状态：B4.4B 连续多代 Activation 已通过数据库 E2E

> 本节继续采用新增法。B4.4B 整体仍未关闭；Worker 并发与 crash/retry recovery 仍是开放 gate。

## A. 业务问题

企业运行不会只发生一次规则切换或一次增量重算。真正长期运行的 EVO 必须允许正式经济状态持续演进：

```text
Baseline
  ↓
Generation 1
  ↓
Generation 2
  ↓
Generation 3 ...
```

每一代都必须以前一代正式 CURRENT 为 parent，并且不能因为代数增加而重复计算、漏历史、误读旧数据集或失去独立 Full-Replay 校验能力。

## B. 本轮发现并修复的两个真实缺口

### 1. Candidate checkpoint prefix 不能依赖 ACTIVE LedgerDataset

第一代激活以后，原 baseline LedgerDataset 已经归档。如果第二代 Candidate digest 仍按 `ds.status = ACTIVE` 找 checkpoint prefix，会把 baseline 历史漏掉。

现已改为按稳定 generation identity 读取：

```text
checkpoint prefix
→ ledger_dataset.economic_runtime_dataset_id IS NULL
```

这使 checkpoint prefix 的身份不再受后续 CURRENT 切换影响。

### 2. LedgerEntry canonical ordering 必须是全序

第二代 E2E 揭示同一 posting sequence / ledger / effectIndex 下可以同时存在：

- 普通业务 POSTING 分录；
- Cost → Valuation 产生的 VALUATION 分录。

旧排序在 effectIndex 处结束，PostgreSQL 可以任意交换两行，导致 Candidate 与 Oracle 内容完全相同但 digest 不一致。

现已统一 Candidate、Oracle、CURRENT overlay、Full Replay digest 的稳定排序，并增加 postingPriority、entrySourceKind、businessDataId、valuationRuleId、dimensionHash 等 tie-break。

同时新增 per-family semantic digest，可在未来等价性失败时直接定位 Ledger / Cost / Allocation / Valuation / Work 哪一族发生漂移。

## C. 数据库 E2E 已证明

参考 FIFO 场景现在真实发生第二笔增量 shipment，并完成：

1. Generation 1 已处于正式 CURRENT；
2. 第二 Candidate 绑定 Generation 1 为 ACTIVE parent；
3. 第二 Candidate 复用同一个已认证 checkpoint；
4. Candidate 隔离恢复 checkpoint prefix，并重放 checkpoint 后的两笔 suffix；
5. Candidate 2 重算两笔 suffix FIFO Cost；
6. 独立 Full-Replay Oracle 2 从零重放完整边界；
7. Candidate 2 semantic digest = Oracle 2 semantic digest；
8. governed activation 原子激活 Candidate 2；
9. Generation 1 转为 ARCHIVED；
10. CURRENT overlay generation chain 为三节点：Baseline → Generation 1 → Generation 2；
11. Activated CURRENT overlay digest = Candidate 2 digest；
12. Dashboard / LedgerReader / WorkProjection 全部显示 `pending_shipment = 6`。

## D. 验证状态

**DATABASE E2E VERIFIED — B4.4B CONSECUTIVE MULTI-GENERATION ACTIVATION**

- branch: `evo/er-c05b4-4b-multigeneration-v0.1`
- implementation head: `4b888e09a359489c3e7ba66fcf9cbac882058bf6`
- GitHub Actions: `35647593407 — SUCCESS`
- PostgreSQL: 18
- schema: 22（无 migration）
- docs validation: PASS
- migration: PASS
- typecheck: PASS
- build: PASS
- tests: 31 files / 83 tests PASS
- seed:demo: PASS
- validate:demo: PASS
- validate:activation-failure-matrix: PASS

## E. 当前业务能力

EVO 现在不再只是证明“一次增量上线正确”，而是已经证明：

> 一代增量结果成为正式 CURRENT 后，下一代仍可以继续以它为正式 parent 做隔离增量重算、独立 Full-Replay 对照、治理认证和原子切换，并保持完整正式账史与查询视图一致。

这开始满足企业长期连续升级、长期重算和长期保留历史解释链的基础要求。

## F. B4.4B 当前剩余重点

1. Activation 与 Worker 并发；
2. crash / retry recovery；
3. 如并发/恢复测试暴露需要，再补 Checkpoint invalidation / transaction interruption 组合矩阵。

## 当前一句话状态（2026-09-22）

> **EVO 已在真实 PostgreSQL 18 中证明连续两代 governed activation 可以保持 Candidate = Full-Replay Oracle = 正式 CURRENT overlay；B4.4B 下一步进入 Worker 并发与崩溃恢复。**


---

# 17. 2026-09-22 追加状态：B4.4B Worker / Activation 并发 Gate 已通过数据库 E2E

## A. 业务问题

企业正常业务不能因为增量 Replay Candidate 正在上线而丢单、重复记账或把新业务写回旧代账本；反过来，Worker 刚完成的新业务也不能被一个已经过期的 Candidate 覆盖。

## B. 当前已经证明

真实 PostgreSQL 18 环境已经验证：

- Worker 正常 Posting 与 Candidate Activation 共享 `enterprise_runtime_state FOR UPDATE` cutover lock；
- Worker 先取得 cutover 顺序时，新 Posting 先提交，随后 Activation 会重新读取 runtime cursor；
- 当 runtime posting cursor 已超过 Candidate boundary 时，Activation 以 `POSTING_CURSOR_AHEAD_OF_CANDIDATE` fail-closed；
- Activation 先进入 cutover 顺序时，Worker 必须等 Activation 事务结束后才能继续；
- 已激活 CURRENT generation 可以继续承接正常 Worker Posting；
- CURRENT overlay 可以把 certified activation boundary 之后的 normal-posting live tail 合成正式经济视图；
- 并发拒绝场景不会产生第二个 CURRENT。

## C. 证据方式

新增：

`scripts/validate-worker-activation-concurrency.ts`

该验证不是依赖 JavaScript `Promise.all()` 的偶然调度，而是：

1. 独立数据库连接先持有 runtime row 的 `FOR UPDATE`；
2. 分别启动 Worker 与 Activation；
3. 通过 PostgreSQL `pg_stat_activity` 确认真实 Lock wait；
4. 控制释放顺序；
5. 验证数据库最终状态与 blocker。

## D. 当前验证状态

**DATABASE E2E VERIFIED — B4.4B WORKER / ACTIVATION CONCURRENCY**

- branch: `evo/er-c05b4-4b-worker-concurrency-v0.1`
- implementation head before this documentation update: `f14232188b7a94b1f876cf02acfaf8f3954f2a8f`
- GitHub Actions: `35659095633`
- PostgreSQL: 18
- schema: 22
- docs validation: PASS
- migration: PASS
- typecheck: PASS
- build: PASS
- tests: PASS
- seed:demo: PASS
- validate:demo: PASS
- validate:worker-activation-concurrency: PASS
- validate:activation-failure-matrix: PASS

## E. B4.4B 当前剩余核心 Gate

1. crash / retry recovery；
2. 根据 crash 证据决定是否还需要补充 checkpoint invalidation / transaction interruption 组合矩阵。

## 当前一句话状态

> **EVO 已证明正常 Worker 与 Candidate Activation 在同一企业一致性域内通过数据库 cutover lock 串行化，既不会让旧 Candidate 覆盖新业务，也不会让激活后的新业务脱离 CURRENT generation；B4.4B 现在只剩 crash/retry recovery 主 Gate。**


---

# 18. 2026-09-22 追加状态：ER-C05B4.4B 已认证关闭

## A. 业务问题

B4.4B 的目标不是再证明一次“重算结果正确”，而是证明企业长期运行时，正式经济状态在连续升级、正常 Worker 写入、错误治理证据和事务中断下仍然只有一个可信 CURRENT。

## B. 当前已经证明

参考 FIFO Economic Runtime 场景现已完整覆盖：

- Dashboard / LedgerReader / WorkProjection 正式读取统一服从 CURRENT generation；
- 连续两次 governed activation：Candidate = Full-Replay Oracle = activated CURRENT overlay；
- duplicate activation retry 幂等；
- semantic mismatch fail-closed；
- stale active parent fail-closed；
- revoked promotion fail-closed；
- invalidated checkpoint fail-closed（CHECKPOINT_NOT_ACTIVE）；
- Worker 与 Activation 共享 PostgreSQL cutover row lock；
- Worker 先提交时，过期 Candidate 以 POSTING_CURSOR_AHEAD_OF_CANDIDATE 拒绝；
- activation boundary 之后的正常业务形成 CURRENT live tail；
- Activation 最深 cutover 点发生数据库异常时，全事务回滚；
- 删除故障后，同一 Candidate/Oracle 可以安全重试并成功激活；
- 重试后仍只有一个 CURRENT、一个 ACTIVE Ledger、一个 certification。

## C. 最终数据库证据

**CERTIFIED — ER-C05B4.4B / REFERENCE FIFO ECONOMIC-RUNTIME SCENARIO**

- certified implementation head: `d3dab3ed7a1d4b2a285d9564ac03f058555bfd64`
- final evidence run: `35659612160 — SUCCESS`
- PostgreSQL 18
- schema 22
- validate:docs PASS
- migrate PASS
- typecheck PASS
- build PASS
- test PASS
- seed:demo PASS
- validate:demo PASS
- validate:worker-activation-concurrency PASS
- validate:activation-crash-retry PASS
- validate:activation-failure-matrix PASS

Certification:
`docs/architecture/certification/ER-C05B4.4B-READ-ROUTING-ACTIVATION-SAFETY-CERTIFICATION-v0.1.md`

## D. 阶段结论

`ER-C05B4.4B — Read Routing & Activation Failure Matrix`

**CLOSED**

B4.4B 当前没有剩余 open gate。

## E. 明确未证明的范围

本认证不能外推为：

- LIFO / Moving Average / Specific Identification 同等级认证；
- 大规模性能与高可用/容灾；
- 产品化权限、UI、报表、行业模板；
- EC / Eidos 最终集成。

这些需要后续独立 packet。

## F. 下一步

仓库目前没有已经批准的 B4.4C / B4.5 编号。

下一步应先从整体 roadmap 与上述 non-claims 中正式定义新的 bounded work packet，再开始实现；未来 LLM 不得沿编号惯性自行发明下一阶段。

## 当前一句话状态（2026-09-22）

> **EVO 已在参考 FIFO 场景中完成“正式读取 → 连续多代增量重算 → 独立 Full Replay 对照 → 治理认证 → Worker 并发切换 → 崩溃全回滚 → 同 Candidate 安全重试”的 PostgreSQL 18 数据库闭环；ER-C05B4.4B 已认证关闭。**

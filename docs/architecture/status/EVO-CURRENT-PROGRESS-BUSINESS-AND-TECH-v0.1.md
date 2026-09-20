# EVO 当前项目进度：业务视角 + 技术视角 v0.1

**状态：CURRENT-STAGE STATUS / 持续更新**  
**日期：2026-09-19**  
**适用分支：`evo/apm-certification-enterprise-template-v0.1`**

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

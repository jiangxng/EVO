# EVO Context Checkpoint — 2026-09-19 v0.1

**Status / 状态：ACTIVE HANDOFF CHECKPOINT**  
**Protocol：`docs/architecture/continuity/EVO-CROSS-CHAT-CONTEXT-PROTOCOL-v0.1.md`**  
**Branch：`evo/apm-certification-enterprise-template-v0.1`**  
**Snapshot base HEAD：`e5144a7bfa7f1d35c93552926934d0f06a5f36a0`**  
**Creation rule：ADDITIVE — 本 checkpoint 创建后永不覆盖**

---

# 1. 这份 Checkpoint 用来解决什么

EVO 已经经历多次超长聊天窗口切换。

未来新聊天不应该依赖：

- 旧聊天页面仍然能打开；
- 某个模型“记得”上一窗口；
- 用户重新把几十万字上下文解释一遍。

本文件是 2026-09-19 时点的实际恢复入口。

新聊天必须先按 Cross-Chat Context Protocol 做 Context Handshake，再把本 checkpoint 与当前 Git HEAD / CI 对齐。

---

# 2. 当前项目业务目标

EVO 当前不是在复刻旧 Asloop Java。

当前核心 Economic Runtime 考古已经阶段性完成，新系统正在验证：

> 企业已经发生的业务事实保持不变；成本、分配、外币估值、账本投影等派生结果可以在固定历史规则、政策和参考数据的条件下被确定性重建。

当前具体业务证明：

```text
销售形成 USD 1000 应收
初始 carrying = CNY 7000

→ 期末汇率 7.2
→ carrying = CNY 7200
→ 未实现重估差额 +200

→ 客户实际支付 CNY 7300
→ 明确核销该应收来源
→ 已实现汇兑差额 +100

→ 删除可重建派生结果
→ Full Replay
→ 必须重新得到相同 Allocation / Valuation / Projection / Digest
```

业务目的：

- 支持历史规则修复；
- 成本重算；
- 财务重过账；
- 外币历史重估；
- backdated transaction；
- 系统/LLM 升级；
- 派生数据灾难恢复；
- 可解释审计。

---

# 3. 当前技术路线

核心模型：

```text
Command
  ↓
Canonical BusinessData
  ↓
Versioned Definitions / Policies / Reference Datasets
  ↓
Posting / Position / Allocation / Cost / Valuation
  ↓
Ledger / Work Projection
  ↓
Materialization
  ↓
Full Replay correctness oracle
  ↓
future safe Incremental Replay
```

核心原则：

- Replay 不重新执行 Command；
- BusinessData 是 canonical business fact；
- Explicit AllocationInstruction 与 derived AllocationRelation 分离；
- Cost / Valuation / RateDataset 必须显式 pin version/digest；
- LedgerEntry / Balance / CostResult / ValuationResult 等可以重建；
- Full Replay 的结果摘要必须与原运行状态一致；
- Incremental Replay 只有证明等价于 Full Replay 才能进入生产路径。

---

# 4. 已完成的主要阶段

## Semantic Archaeology

状态：

**当前 Economic Runtime 核心范围 — 阶段性完成**

已从 Asloop / bookkeeping 恢复并规范化：

- WaterBal / TbMatched source-consumption semantics；
- Matching / Allocation；
- Component 解耦；
- FIFO / LIFO / MWA / Specific ID；
- Fact-before-value；
- Cost recalculation；
- foreign quantity vs local carrying value；
- realized settlement vs period-end revaluation；
- full replay vs incremental recalculation。

不要重新进行 broad archaeology，除非有明确 evidence gap。

## Economic Runtime Architecture Freeze

状态：

**COMPLETED**

Authority：

`docs/architecture/decisions/2026-09-18-economic-runtime-architecture-freeze-v0.1.md`

## ER-C01

Semantic contracts — **COMPLETE**

## ER-C02

Invariants/tests — 已建立主要不变量，仍会随 runtime 扩展追加。

## ER-C03

Additive Economic Runtime schema — **COMPLETE**

## ER-C04

Allocation / RateDataset / Replay topology / Cost runtime adaptation — 主要底座已实现。

## ER-C05B3.1

Dependency Graph Coverage Certification — **CLOSED**

Required producer families：

- POSTING_PROJECTION
- ALLOCATION
- COST_VALUATION
- FX_PERIOD_END
- FX_REALIZED_SETTLEMENT
- WORK_PROJECTION

## ER-C05B3.2A

Canonical FX Period-End Replay — **CLOSED at implementation/unit evidence level**

Canonical model：

`valuation.requested → pinned PositionDefinition + RateDataset + Policy → derived ValuationRun/Result`

重要 correction：

早期 CI 并没有包含真实 `seed:demo + validate:demo`，因此旧绿灯不能当作完整 E2E certification。

---

# 5. 当前 Active Work Packet

`ER-C05B3.2B — Canonical FX Realized Settlement Full Replay`

目标：

- canonical payment BusinessData；
- canonical AllocationInstruction；
- canonical FX_REALIZED_SETTLEMENT `valuation.requested`；
- pinned PositionDefinition；
- pinned AllocationPolicy；
- period-end carrying overlay；
- Full Replay 重建 AllocationRelation + ValuationResult；
- final Economic Runtime digest MATCH；
- ReplayCoverageCertification = CERTIFIED。

当前 validation level：

**IMPLEMENTED / UNIT PATH EXISTS / TRUE E2E NOT YET CERTIFIED**

---

# 6. 当前真实 CI / Blocker

CI workflow 已修正为必须执行：

```text
migrate
→ typecheck
→ build
→ unit test
→ seed:demo
→ validate:demo
```

第一轮真实 E2E 暴露 PostgreSQL JSONB array 编码问题。

已修：

- PositionDefinition `dimensions/source_rules`
- AllocationRelation `measurements`
- ValuationResult `source_business_data_ids/source_measurements/target_measurements`

当前最新明确 blocker：

**TYPECHECK FAILURE AFTER EXPLICIT JSONB ARRAY SERIALIZATION**

Observed errors include：

```text
PostgresAllocationStore:
RawBuilder<JsonValue> is not assignable to allocation_relation.measurements column expression

PostgresPositionDefinitionStore:
RawBuilder<JsonValue> is not assignable to dimensions/source_rules column expression

PostgresValuationStore:
RawBuilder<JsonValue> is not assignable to valuation_result JSON-array column expression
```

业务算法本身尚未进入新的 true E2E validate 阶段，因为 workflow 在 typecheck 被阻断。

下一步不得降低测试标准。

正确下一步：

> 调整 PostgreSQL JSONB 数组持久化边界与 Kysely column typing，使显式 JSON 序列化既满足真实 PostgreSQL JSONB 编码，又满足 TypeScript InsertExpression 类型；然后重新跑完整 E2E。

---

# 7. 数据库当前学习基线

Current snapshot：

- PostgreSQL
- DB Schema Version：13
- Tables：60
- Fields：635
- Migration SQL files：15

中文快照：

`docs/architecture/database/EVO-CURRENT-DATABASE-DESIGN-v0.1.md`

中英双语新增快照：

`docs/architecture/database/EVO-CURRENT-DATABASE-DESIGN-BILINGUAL-v0.2.md`

规则：

v0.2 不覆盖 v0.1；未来 v0.3/v0.4 继续新增。

---

# 8. 当前业务 + 技术进度入口

读取：

`docs/architecture/status/EVO-CURRENT-PROGRESS-BUSINESS-AND-TECH-v0.1.md`

以后进度汇报必须同时说明：

1. 业务问题；
2. 业务能力；
3. 技术路线；
4. 验证等级；
5. 当前还差什么；
6. 下一步为什么有业务价值。

---

# 9. 新聊天最低读取集合

按顺序：

1. `docs/architecture/continuity/EVO-CROSS-CHAT-CONTEXT-PROTOCOL-v0.1.md`
2. 本文件：`EVO-CONTEXT-CHECKPOINT-2026-09-19-v0.1.md`
3. `docs/architecture/legacy/EVO-WORK-STAGE-HANDOFF-v0.1.md`
4. `docs/architecture/legacy/EVO-WORK-CONTINUATION-PLAN-v0.1.md`
5. `docs/architecture/status/EVO-CURRENT-PROGRESS-BUSINESS-AND-TECH-v0.1.md`
6. Economic Runtime Freeze ADR
7. 当前 Git HEAD / latest CI

按任务再读取专题文档。

---

# 10. 新聊天对齐后应得到的简洁结论

```text
Business:
正在证明外币应收从期末重估到实际核销的派生经济结果，
可以只靠 canonical facts + explicit allocation intent + pinned semantics 完整重建。

Technology:
Full Replay + dependency graph + canonical valuation.requested.

Active packet:
ER-C05B3.2B.

Current blocker:
JSONB-array PostgreSQL encoding 修复后，与 Kysely JsonArray insert typing 不匹配，
workflow 当前卡在 typecheck。

Next:
修复持久化 typing → full CI → seed:demo → validate:demo →
digest MATCH + coverage CERTIFIED。

After that:
Checkpoint promotion → safe Incremental Replay certification.
```

---

# 11. 项目连续性规则

> 聊天是临时工作缓存，Git 是项目工程记忆。

> 未来上下文切换不是“复制聊天”，而是“重新验证 Git reality + 恢复已提交的决策、证据和当前 gate”。

> 新聊天如果发现本 checkpoint 落后于仓库，必须以仓库更新事实为准，并创建新的 additive checkpoint，而不是修改本文件。

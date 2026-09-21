# EVO 需求 → 能力 → 证据矩阵 v0.1
# EVO Requirement → Capability → Evidence Matrix v0.1

**Status: ACTIVE HUMAN-READABLE ALIGNMENT VIEW**  
**Date: 2026-09-22**  
**Authority scope: business-facing progress interpretation**

## 0. 给业务负责人的 60 秒对齐摘要

以后如果不想读技术细节，只需要先看这一段。

当前判断只回答 6 个问题：

1. **最终目标有没有变？** — 没有，仍是 AI-Native Enterprise Operating System。
2. **现在在做什么业务？** — Stage E，第一个完整 Order-to-Cash 收款闭环。
3. **企业已经多了什么能力？** — 订单形成应收、生产/发货待办关闭、收款增加现金并关闭应收、明确核销关系、计算已实现汇兑损益、收款待办关闭。
4. **还缺什么才算当前闭环完成？** — 最终 EEL-C01 certification。
5. **有没有明显过度设计？** — 当前未发现；最近 Work closure 明确复用了既有 WorkProjection，没有新增 Workflow 引擎。
6. **下一步为什么值得做？** — 因为只有证明完整 O2C 删除派生状态后仍可重建一致，才能确认这不是“某次跑对”，而是可长期重放的企业闭环。

如果这 6 个答案无法用业务语言说清楚，应标记 `COMPREHENSION_GAP`，暂停扩大技术范围。

## 0.1 2026-09-22 EEL-C01 完成后更新

当前正式判断：

1. **最终目标有没有变？** — 没有。
2. **Stage E 是否结束？** — 没有；第一个完整企业闭环已经完成。
3. **EEL-C01 是否完成？** — 是，参考边界已 CERTIFIED。
4. **还有 EEL-C01 功能缺口吗？** — 当前确认需求范围内没有。
5. **有没有明显过度设计？** — 当前审查未发现；相邻复杂支付/银行/通用化能力保持延后。
6. **下一步是什么？** — 回到业务需求层选择第二个 Stage E bounded packet，而不是顺着现有技术继续扩 O2C。

这意味着当前最重要的项目动作从：

```text
继续实现 EEL-C01
```

变成：

```text
选择下一个企业业务闭环
→ 写业务验收
→ 做反过度设计四问
→ 再允许技术设计
```

最终认证：

`docs/architecture/certification/EEL-C01-ORDER-TO-CASH-SETTLEMENT-CERTIFICATION-v0.1.md`

需求对齐记录：

`docs/architecture/status/EVO-REQUIREMENT-ALIGNMENT-REVIEW-2026-09-22-EEL-C01-v0.1.md`

## 1. 使用方法

这张表不是技术任务列表。

它回答：

> 我们想要什么业务能力？  
> 现在做到哪里？  
> 用什么证据证明？  
> 还差什么？

## 2. 项目级

| 需求 | 当前能力 | 当前证据 | 状态 |
|---|---|---|---|
| 企业历史可以被重新解释和重算 | Full Replay + Safe Incremental Replay | Stage C/D certification | 已证明参考边界 |
| 重算不能污染正式状态 | Candidate / Oracle / CURRENT 隔离与原子激活 | ER-C05B4.4B certification | 已证明参考边界 |
| 换 LLM 后仍能继续项目 | Repository-first context/router/status/topology | validate:docs + repo governance | 已实现 |
| 不同 LLM 不应误判分支 | branch.topology.json + live compare rule | validate:docs | 已实现 |
| 技术不能脱离业务需求自行扩张 | Business baseline + alignment protocol + anti-overdesign gate | 本轮治理机制 | 正在建立 |

## 3. Stage E — EEL-C01

| 业务需求 | 企业应该看到的结果 | 当前能力 | 证据 | 状态 |
|---|---|---|---|---|
| 销售订单形成应收 | 企业知道客户欠多少钱 | Sales Order → Receivable | PostgreSQL E2E | 已有 |
| 客户收款增加现金 | 实际现金余额增加 | cash.received → Cash +7300 CNY | CI 35661825887 | 已验证 |
| 收款减少应收 | 对应应收减少/归零 | cash.received → Receivable -1000 USD | CI 35661825887 | 已验证 |
| 收款与被结清应收明确关联 | 能回答“这笔钱结了哪笔应收” | AllocationInstruction / Relation 路径 | PR #15 / CI 35663507253 | 已验证：显式选择并消耗目标 1000 USD 应收 |
| 外币收款产生已实现汇兑损益 | 能解释实际到账和账面价值差额 | FX realized settlement | PR #15 / CI 35663507253 | 已验证：realized FX = +100 CNY |
| 收清后待收任务关闭 | 不再出现该订单待收款；生产/发货待办也在全量完成后关闭 | 现有 balance-derived WorkProjection | PR #16 / CI 35664093669 | 已验证；无需新增 Workflow 引擎 |
| 完整 O2C 可重放 | 删除派生结果后重建一致 | Full Replay equality | PR #19 / CI 35666804875 | 已验证 |
| 历史旧收款类型仍可重放 | 升级不破坏旧事实 | compatibility path | 部分已有 | 待专门验证 |

## 4. 当前必要设计

当前 EEL-C01 必须做：

- 显式结算关系；
- Cash / Receivable 双 measurement；
- realized FX；
- Work closure；
- Full Replay equality；
- legacy receipt replay compatibility。

## 5. 当前暂缓设计

除非后续需求明确触发，暂缓：

- 通用支付/结算平台；
- 部分付款与多对多复杂核销；
- 银行账户/银行对账完整模型；
- 收款手续费、拒付、退款通用框架；
- 多币种同一 Cash ledger 的最终 balance identity 通用化；
- 复杂信用/催收体系。

这些不是“永远不做”，而是：

> 当前没有必要为 EEL-C01 提前承担复杂度。



## 6. 当前红灯如何解释

PR #13 的 CI `35662063042` 在新 EEL-C01.3 validator 失败。

分类：

`TEST_ISOLATION_ASSUMPTION`

原因：

验证脚本假定当前数据库只会重放 1 个 realized-settlement request，但同一 CI 数据库在前面的 seed/demo 已经存在相关请求，实际得到 3 个。

因此当前结论不是“显式结算业务语义错误”，而是：

> EEL-C01.3 尚未获得通过证据；验证脚本必须精确隔离本场景后重新证明。

在重新验证通过以前，PR #13 不得合入 main，也不得标记为 DATABASE E2E VERIFIED。


## 7. PR #13 → PR #15 收敛

PR #13 没有被强行 rebase/merge。

原因：

- 新的 Human–LLM alignment governance 已进入 main；
- PR #13 同时修改了旧 project/status/topology 指针；
- 机械合并会把已经修正的治理状态重新带回主线。

因此采用最小迁移：

- PR #13：保留为 superseded evidence；
- PR #15：从最新 main 重建；
- 只迁移当前 EEL-C01.3 必要实现；
- 删除“全数据库只能有一条 replay request”的测试假设；
- 不增加任何新的通用结算框架。


## 8. 2026-09-22 — EEL-C01.3 数据库证据

PR #15 已通过 PostgreSQL 18 E2E。

- implementation head: `36d8de14c746b94f7ecc9b195aa9e75214200656`
- CI: `35663507253 — SUCCESS`
- `cash.received` 是本场景 settlement consumer；
- 显式 AllocationInstruction 指向目标销售订单/应收来源；
- AllocationRelation 消耗 `1000.00 USD`；
- 实际现金仍为 `7300 CNY`；
- carrying basis 为 `7200 CNY`；
- realized FX = `+100 CNY`；
- operational Receivable 保持为 0。

业务结论：

> EVO 现在不仅知道“客户付了钱”，还能够明确回答“这笔钱结清了哪笔应收，以及因此产生了多少已实现汇兑损益”。

仍未关闭：

- Work closure；
- Full Replay equality；
- legacy compatibility replay certification；
- EEL-C01 final certification。


## 9. 2026-09-22 — EEL-C01.4 Work closure 数据库证据

PR #16 已通过 PostgreSQL 18 E2E。

业务生命周期：

```text
Sales Order
  → PRODUCE   OPEN
  → SHIP      OPEN
  → COLLECT   OPEN

Full Production
  → PRODUCE   DONE

Full Shipment
  → SHIP      DONE
  → COLLECT   still OPEN

Full Customer Receipt
  → COLLECT   DONE
  → no O2C Work remains OPEN
```

同时证明：

- Cash 仍然是资金/财务头寸，不会被错误投影成 WorkItem；
- 默认正式 Work 读取也不再返回该已完成订单；
- 现有 WorkProjection 已足够满足当前业务要求；
- 本阶段没有因为“以后可能需要”而引入新的通用 Workflow Runtime。

证据：

- implementation head: `1063f825bf331ac1b28c55b027da57b6af51137c`
- CI: `35664093669 — SUCCESS`
- validator: `npm run validate:eel-c01-work-closure`

下一业务缺口：

- Full Replay equality；
- legacy `customer_payment.received` replay compatibility；
- EEL-C01 final certification。


## 10. 2026-09-22 — EEL-C01.5 Full Replay equality

PR #19 已在最新 Human–LLM alignment 主线上通过完整 CI 与独立 PostgreSQL 18 Full Replay proof。

业务结论：

> 完整 O2C 订单在删除并重建派生状态后，企业看到的正式经济结果不变，而且 canonical BusinessData / AllocationInstruction 没有被 Replay 改写。

关键结果：

- pending production = 0；
- pending shipment = 0；
- receivable = 0；
- Cash = 7300 CNY；
- PRODUCE / SHIP / COLLECT 三个 WorkItem 仍为 DONE；
- 显式 1000 USD settlement relation 保持；
- realized FX = +100 CNY；
- FIFO shipment cost = 100 CNY；
- replay-input digest unchanged；
- economic-runtime digest unchanged。

证据：

- PR: #19
- verified head: `a39989a6b335acd10a11805484e99b747bf85cd6`
- CI: `35666804875 — SUCCESS`

当前 EEL-C01 只剩：

1. legacy `customer_payment.received` replay compatibility；
2. final EEL-C01 database certification。


## 11. 2026-09-22 — Legacy receipt replay compatibility

PR #21 在独立 PostgreSQL 18 环境证明：

- 历史 BusinessData 仍是 `customer_payment.received`；
- 旧 foreign/local payment measurements 不变；
- 显式 AllocationInstruction 保留；
- legacy settlement relation 仍消费 1000 USD；
- period-end FX = +200 CNY；
- realized FX = +100 CNY；
- canonical replay-input digest 不变；
- economic-runtime digest 不变；
- 不会把旧 payment 偷偷重解释成新的 Cash/Receivable posting。

结论：

> 新的 `cash.received` 是未来正式路径；旧的 `customer_payment.received` 是可重放的历史兼容输入。兼容不是改写历史。

证据：

- PR: #21
- verified head: `69c1744d24fc7c4211b91cea3fe7343433d33cbd`
- CI: `35667578606 — SUCCESS`

当前 EEL-C01 只剩最终 certification。

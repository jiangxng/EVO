# EVO 需求 → 能力 → 证据矩阵 v0.1
# EVO Requirement → Capability → Evidence Matrix v0.1

**Status: ACTIVE HUMAN-READABLE ALIGNMENT VIEW**  
**Date: 2026-09-22**  
**Authority scope: business-facing progress interpretation**

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
| 收款与被结清应收明确关联 | 能回答“这笔钱结了哪笔应收” | AllocationInstruction / Relation 路径 | PR #15（PR #13 已 superseded） | v0.2 已修正测试隔离假设，等待数据库证据 |
| 外币收款产生已实现汇兑损益 | 能解释实际到账和账面价值差额 | FX realized settlement | 现有内核 + PR #15 接入 | 实现中；沿用现有 FX 内核，等待 v0.2 验证 |
| 收清后待收任务关闭 | 不再出现该订单待收款 | Work projection closure | 尚未完成 | 未完成 |
| 完整 O2C 可重放 | 删除派生结果后重建一致 | Full Replay equality | 尚未完成 | 未完成 |
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

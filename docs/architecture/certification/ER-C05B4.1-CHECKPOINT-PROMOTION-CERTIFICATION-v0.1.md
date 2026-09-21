# ER-C05B4.1 — Certified Checkpoint Promotion Gate v0.1

**Status: CERTIFIED / CLOSED**  
**Date: 2026-09-19**  
**Certified implementation head: `c13269a197c50bf1cf190e5d1c8032405a33fee6`**  
**GitHub Actions run: `35404542720`**  
**DB Schema Version: 14**

---

## 1. 业务问题 / Business Problem

Full Replay 已证明可以从 canonical history 重建企业经济状态。

但“Full Replay 正确”不等于：

> 任意 ReplayCheckpoint 都可以直接拿来作为生产环境局部重算的起点。

企业需要一个明确治理动作回答：

- 哪一个历史边界被批准用于 Incremental Replay？
- 是依据哪一份机器认证批准的？
- 谁批准的？
- 为什么批准？
- 如果认证失效或治理决定变化，能否撤销？
- 撤销以后系统是否自动回退 Full Replay？

---

## 2. 核心设计 / Core Design

没有修改原始 `replay_checkpoint.validity`。

新增独立治理实体：

`replay_checkpoint_promotion`

流程：

```text
Verified Full Replay
        ↓
ReplayCheckpoint
safeForIncremental = false
        ↓
ReplayCoverageCertification
status = CERTIFIED
        ↓
Explicit ReplayCheckpointPromotion
status = ACTIVE
        ↓
Promoted checkpoint view
safeForIncremental = true
        ↓
IncrementalReplayPlanner
may select this checkpoint
```

因此：

> Coverage Certification 是“证据充分”；Promotion 是“批准用于局部重算”。

两个动作不能合并。

---

## 3. Promotion 必须重新核验

Promotion Service 不是单纯检查 `status=CERTIFIED`。

批准前重新核验：

- checkpoint 必须 ACTIVE；
- certification 必须 CERTIFIED；
- 五类 coverage 必须全部 true；
- certification evidence 必须明确指向当前 checkpoint；
- enterprise 必须一致；
- consistency domain 必须一致；
- runtime semantic version 必须一致；
- dependency graph version 必须一致；
- active runtime semantic version 仍与 checkpoint 一致；
- canonical ordered-input digest 必须没有漂移；
- 当前 Enterprise Template binding 必须仍等于 checkpoint；
- certification semantic digest 被固定进 promotion。

任何漂移：

> 拒绝 Promotion，要求重新 Full Replay / Certification。

---

## 4. Promotion 审计字段

Promotion 保存：

- checkpoint id；
- certification id/version；
- certification semantic digest；
- promoted by；
- reason；
- evidence；
- promotion digest；
- promoted at；
- revoke metadata。

Promotion 可以 REVOKE。

撤销以后，该 checkpoint 不再通过 incremental-safe 查询暴露给 Planner。

---

## 5. Planner 治理边界

保留：

`getLatestValidCheckpoint()`

用于 checkpoint genealogy 等一般查询。

新增：

`getLatestIncrementalSafeCheckpoint()`

IncrementalReplayPlanner **只调用后者**。

也就是说：

> ACTIVE checkpoint ≠ incremental-safe checkpoint.

只有：

`ACTIVE checkpoint + ACTIVE promotion`

才有资格进入 incremental planning。

---

## 6. E2E 认证证据

GitHub Actions run `35404542720`：

```text
migrate        PASS
typecheck      PASS
build          PASS
unit tests     PASS
seed:demo      PASS
validate:demo  PASS
```

Reference validation：

```text
ReplayCoverageCertification.status = CERTIFIED

originalCheckpointSafeForIncremental = false
promotedViewSafeForIncremental = true

ReplayCheckpointPromotion.status = ACTIVE

incrementalPlannerFallback = false
incrementalPlannerCheckpointId = promoted checkpoint id
planDigest = deterministic SHA-256
```

原 checkpoint 没有被修改。

---

## 7. 业务能力现在证明到哪里

EVO 现在已经证明：

> 一个通过 Full Replay correctness oracle 验证的历史边界，在 coverage 完整后，还必须经过一项独立、可审计、可撤销的治理批准，才有资格被系统作为未来局部历史重算的起点。

这解决了“技术证明”和“生产授权”混为一谈的问题。

---

## 8. 尚未证明的能力

B4.1 **没有证明实际 Incremental Replay 执行结果正确**。

当前 Planner 已经可以：

- 找 impact roots；
- 做 dependency closure；
- 找 promoted checkpoint；
- 判断是否必须 fallback；
- 生成 deterministic plan digest。

但还没有完成：

```text
promoted checkpoint
→ restore boundary state
→ recompute affected suffix
→ produce incremental result
→ compare against Full Replay oracle
```

因此不能宣称 Incremental Replay 已经 CERTIFIED。

---

## 9. 下一阶段

`ER-C05B4.2 — Incremental Replay Execution & Full-Replay Equivalence`

业务问题：

> 企业补录/修正一笔历史业务后，系统能不能只重新计算受影响部分，并得到与完整重算整个历史完全相同的结果？

成功条件：

```text
digest(incremental result)
==
digest(full replay result)
```

任何不确定性或 mismatch：

`fallback → FULL REPLAY`

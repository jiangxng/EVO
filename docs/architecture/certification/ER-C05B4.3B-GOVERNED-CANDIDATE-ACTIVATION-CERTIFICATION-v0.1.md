# ER-C05B4.3B — Governed Candidate Equivalence Certification & Atomic Activation v0.1

**Status: CERTIFIED / CLOSED FOR REFERENCE FIFO SCENARIO**  
**Date: 2026-09-20**  
**Certified implementation head: `07f6a97c453e9697595fab1b2f3c7dfc48281382`**  
**GitHub Actions run: `35478570102`**  
**DB Schema Version: 22**

---

## 1. 业务问题 / Business Problem

B4.3A 已证明 Incremental Candidate 与独立 Full Replay Oracle 可以在不破坏 CURRENT 的情况下精确相等。

但生产系统还必须保证：

> 只有与这份精确 Oracle 等价、治理来源仍有效、parent 仍是当前正式世代的那个 Candidate，才能成为新的 CURRENT。

不能允许调用方自行提交一个 digest，然后分别调用 `markVerified` 和 `activateVerified` 绕过等价证明。

---

## 2. 已关闭的绕过路径 / Closed Bypass

普通 RuntimeDataset 接口不再暴露 Candidate 的通用验证与激活：

- `markVerified(candidate, callerDigest)` 已移除；
- `activateVerified(candidate)` 已移除；
- 仅保留 Oracle 专用 `markOracleVerified`；
- Candidate 只能由 `RuntimeEquivalenceCertificationService` 认证并激活。

---

## 3. 激活前重新核验 / Revalidation Before Activation

服务重新计算 Candidate 与 Oracle 的完整经济语义摘要，并在事务内锁定和核验：

- Candidate 必须为 `CANDIDATE / BUILDING`；
- Oracle 必须为 `ORACLE / VERIFIED`；
- Oracle 必须通过 `oracle_of_dataset_id` 精确指向 Candidate；
- enterprise、consistency domain、parent、checkpoint、promotion、plan digest、boundary 必须一致；
- Candidate parent 必须仍是当前 `CURRENT / ACTIVE`；
- Checkpoint 必须仍为 ACTIVE；
- Promotion 必须仍为 ACTIVE 且指向该 Checkpoint；
- Oracle 已保存摘要必须等于重新计算摘要；
- Candidate 重新计算摘要必须等于 Oracle 重新计算摘要。

任何一项失败都会生成 `REJECTED` 证据，使 Candidate 失败/不可激活，并保持 CURRENT 不变。

---

## 4. 不可变认证证据 / Immutable Certification Evidence

新增表：

`runtime_equivalence_certification`

它唯一绑定：

- Candidate generation；
- Oracle generation；
- active parent；
- source Checkpoint 与 Promotion；
- Incremental Plan digest；
- common boundary；
- 两侧 semantic digest；
- blockers、evidence、certifier、reason；
- deterministic certification digest；
- certification / activation time。

数据库约束保证：

```text
CERTIFIED
→ candidateDigest == oracleDigest
→ blockers = []
→ activatedAt != null

REJECTED
→ blockers non-empty
→ activatedAt = null
```

---

## 5. 原子切换边界 / Atomic Cutover Boundary

认证成功时同一 PostgreSQL 事务完成：

```text
insert immutable CERTIFIED evidence
→ exact Candidate VERIFIED
→ certified suffix PostingInput POSTED
→ enterprise posting cursor advances to certified boundary
→ old active LedgerDataset ARCHIVED
→ Candidate LedgerDataset CURRENT / ACTIVE
→ old EconomicRuntimeDataset ARCHIVED
→ Candidate EconomicRuntimeDataset CURRENT / ACTIVE
```

因此 Worker 不会在激活后再次处理已经在 Candidate 中重放的 suffix PostingInput。

---

## 6. 真实 E2E 证据 / True E2E Evidence

GitHub Actions run `35478570102`，PostgreSQL 18：

```text
migrate        PASS — Schema 22
typecheck      PASS
build          PASS
unit tests     PASS — 31 files / 83 tests
seed:demo      PASS
validate:demo  PASS
```

运行结果：

```text
status = PASS

Candidate digest = Oracle digest
incrementalEqualsFullReplay = true

equivalenceCertificationStatus = CERTIFIED
equivalenceCertificationDigest =
51e29f2f1b79402d24126eac3db583e4124fcdb1cecb7e506219682811d2c105

governedActivatedKind = CURRENT
governedActivatedStatus = ACTIVE
previousDatasetFinalStatus = ARCHIVED

CURRENT pending_shipment before activation = 8
activated pending_shipment after activation = 7
suffix PostingInput before activation = QUEUED
suffix PostingInput after activation = POSTED

FX period-end delta = +200
FX realized settlement delta = +100
```

参考运行中的完整归一化经济语义摘要：

```text
f04f4cd788489f3ecd626e0008f6058ff10bdc123782df2cece771207d2bde0e
```

Candidate 与 Oracle family counts 均为：

```text
ledgerEntries       = 13
ledgerBalances      = 5
costResults         = 2
allocationRelations = 3
valuationPositions  = 2
valuationResults    = 2
workItems           = 3
```

---

## 7. 本次 CI 暴露并修复的问题 / Failure Learned and Preserved

第一次真实 E2E run `35478472647` 失败：

```text
PostgreSQL 22023
cannot get array length of a non-array
```

原因：`blockers` 是 JSONB array，但初版直接传入 JavaScript array，`pg` 将其按 PostgreSQL array 方式编码，违反 `jsonb_array_length(blockers)` 约束。

修复：在写入边界显式执行 `JSON.stringify(blockers)::jsonb`。

这与此前 Position/Allocation/Valuation JSONB array 问题属于同一持久化边界规律，现已保留为工程证据，不删除失败记录。

---

## 8. 当前证明边界 / Current Proof Boundary

本认证关闭的是参考 FIFO 场景中的：

- isolated Candidate；
- isolated Full Replay Oracle；
- exact equivalence certification；
- fail-closed governance predicates；
- atomic Runtime/Ledger/Posting cursor activation；
- CURRENT Work 状态切换。

尚不能宣称所有生产场景都已覆盖。仍需扩展：

- LIFO、Moving Average、Specific ID；
- 更多 Checkpoint prefix family；
- mismatch/stale-parent 的真实 PostgreSQL E2E（当前有确定性单测）；
- generation-overlay 历史查询与归档保留验证；
- 并发 Worker/activation 竞争测试；
- crash/retry/idempotency 测试。

---

## 9. 下一工作包 / Next Packet

`ER-C05B4.4 — Activation Safety Matrix & Generation-Overlay Read Certification`

业务问题：

> Candidate 已安全成为 CURRENT 后，所有查询能否把 parent prefix 与 activated suffix 组合成一条完整历史，并在 mismatch、并发和重试条件下保持唯一、可解释、可恢复的正式状态？

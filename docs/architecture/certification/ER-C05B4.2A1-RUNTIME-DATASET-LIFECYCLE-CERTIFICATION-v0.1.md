# ER-C05B4.2A-1 — Economic Runtime Dataset Lifecycle Certification v0.1

**Status: CERTIFIED / CLOSED**  
**Date: 2026-09-19**  
**Certified implementation head: `69513bc771adcfa48b577a3126d4f1f462aec938`**  
**GitHub Actions run: `35405169593`**  
**DB Schema Version: 15**

---

## 1. 业务问题 / Business Problem

Incremental Replay 不能在当前生产派生状态上直接“边删边改”。

企业需要：

> 先建立一套与当前正式状态隔离的候选解释，在候选环境中重算和验证；只有验证通过以后，才允许原子切换为新的正式解释。

这样可以保证：

- 当前生产状态在候选计算期间不被污染；
- candidate 失败不会影响当前正式账；
- 旧解释可以归档保留；
- 新解释必须先验证再激活；
- 后续能够追溯“哪一代派生状态是由哪次历史重算产生的”。

---

## 2. 新抽象 / New Abstraction

新增：

`economic_runtime_dataset`

生命周期：

```text
CURRENT / ACTIVE
        ↓
CANDIDATE / BUILDING
        ↓
CANDIDATE / VERIFIED
        ↓ atomic activation
new CURRENT / ACTIVE
old CURRENT → ARCHIVED
```

Candidate 必须绑定：

- 当前 ACTIVE parent dataset；
- promoted ReplayCheckpoint；
- ReplayCheckpointPromotion；
- deterministic IncrementalReplay plan digest；
- start sequence；
- boundary sequence。

---

## 3. 治理不变量 / Governance Invariants

已实现：

- enterprise + consistency domain 同时最多一条 ACTIVE generation；
- Candidate 只能从当前 ACTIVE parent 创建；
- Candidate 必须绑定 ACTIVE promoted checkpoint；
- Candidate 初始状态只能 BUILDING；
- 只有 BUILDING 可以标记 VERIFIED；
- 只有 VERIFIED Candidate 可以激活；
- 激活必须在一个事务中：
  - old ACTIVE → ARCHIVED；
  - candidate → CURRENT / ACTIVE；
- parent 已不再 ACTIVE 时，旧 Candidate 不允许激活；
- FAILED candidate 不影响 CURRENT generation。

---

## 4. E2E 认证证据 / E2E Evidence

GitHub Actions run:

`35405169593`

全部通过：

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
candidateInitialStatus = BUILDING
verifiedStatus = VERIFIED
activatedKind = CURRENT
activatedStatus = ACTIVE
previousDatasetFinalStatus = ARCHIVED
```

同时此前的关键证明没有回归：

- Full Replay deterministic = true；
- ReplayCoverageCertification = CERTIFIED；
- Checkpoint Promotion = ACTIVE；
- Incremental Planner fallback = false；
- FX period-end = +200 CNY；
- FX realized settlement = +100 CNY；
- beforeDigest == afterDigest。

---

## 5. 已证明与未证明 / Proven vs Not Yet Proven

### 已证明

已证明候选 Economic Runtime generation 的：

- 创建；
- provenance 绑定；
- 状态生命周期；
- verification gate；
- atomic activation；
- previous generation archival。

### 尚未证明

尚未证明：

- Ledger/Cost/Allocation/Valuation/Work 的实际 derived rows 已经按 runtime dataset 隔离；
- Checkpoint prefix state 已可恢复；
- suffix-only recomputation 已真实发生；
- candidate digest 与 Full Replay oracle 等价；
- 激活后所有业务读取自动切到新 generation。

因此本 packet 仅关闭：

`B4.2A-1 — Generation Lifecycle Substrate`

不是整个 Incremental Replay。

---

## 6. 下一步 / Next

`B4.2A-2 — Derived Family Generation Scoping`

首先解决 ownership/dependency direction：

> EconomicRuntimeDataset 是多个经济模块共享的 materialization identity，不应导致 Cost/Allocation/Valuation 反向依赖 Replay implementation。

然后逐步把 derived family 接入 generation identity，并保持 additive compatibility。

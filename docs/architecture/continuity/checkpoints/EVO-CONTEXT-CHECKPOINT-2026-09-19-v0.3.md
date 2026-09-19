# EVO Context Checkpoint — 2026-09-19 v0.3

**Status: ACTIVE HANDOFF CHECKPOINT**  
**Supersedes for current-state recovery:** `EVO-CONTEXT-CHECKPOINT-2026-09-19-v0.2.md`  
**Historical checkpoints remain preserved.**  
**Branch:** `evo/apm-certification-enterprise-template-v0.1`  
**Certified implementation head:** `571fb4281e7edcbb7d5fc2626475690995b2a163`  
**Certification document commit:** `c76bc0b38890249243ddf5aaebeca26c96184a60`  
**True E2E run:** `35404108068 — SUCCESS`

---

## 1. Current business state

ER-C05B3.2B is now **CLOSED / CERTIFIED**.

Business capability proven:

An FX receivable can be:

- recognized as USD 1000 / CNY 7000 carrying value;
- period-end revalued at 7.2 to CNY 7200;
- settled at CNY 7300 with explicit source allocation;
- produce +200 unrealized/revaluation delta and +100 realized settlement delta;
- have derived Allocation / Cost / Valuation / Projection / Materialization removed;
- be reconstructed deterministically from canonical facts, explicit intent and pinned semantics.

---

## 2. True E2E evidence

GitHub Actions run:

`35404108068`

Pipeline:

```text
migrate        PASS
typecheck      PASS
build          PASS
unit tests     PASS
seed:demo      PASS
validate:demo  PASS
```

Validation:

```text
status = PASS
replayDeterministic = true

periodEndDelta = +200 CNY
realizedSettlementDelta = +100 CNY

beforeDigest =
efb0e84b54a6aa23fb58a603b99bc97559e995183b34b10a9e5a6349411f7061

afterDigest =
efb0e84b54a6aa23fb58a603b99bc97559e995183b34b10a9e5a6349411f7061
```

ReplayCoverageCertification:

```text
status = CERTIFIED
materializationDigestComplete = true
templateBindingComplete = true
referenceDatasetPinsComplete = true
dependencyGraphComplete = true
derivedRuntimeReplayComplete = true
blockers = []
```

---

## 3. Dependency coverage evidence

- POSTING_PROJECTION = 7
- ALLOCATION = 2
- COST_VALUATION = 3
- FX_PERIOD_END = 1
- FX_REALIZED_SETTLEMENT = 1
- WORK_PROJECTION = 3

---

## 4. Important remaining governance state

The ReplayCheckpoint created before coverage certification still has:

`safeForIncremental = false`

This is intentional and correct.

Do not manually flip this boolean.

Coverage certification and checkpoint promotion are separate governance acts.

---

## 5. Active packet

`ER-C05B4 — Certified Checkpoint Promotion & Safe Incremental Replay Gate`

Business problem:

Full Replay is now proven correct, but a long-running enterprise cannot replay its entire history after every backdated fact or policy change.

Required capability:

- identify a certified checkpoint before the impacted boundary;
- explicitly promote a checkpoint to incremental-safe authority;
- bind promotion to exact certification evidence;
- reject promotion if any semantic pin/digest/template/dependency condition drifted;
- plan impact closure from the dependency graph;
- recompute only the affected suffix;
- compare resulting digest with Full Replay oracle;
- fall back to Full Replay on any uncertainty/mismatch.

---

## 6. Next exact engineering step

Read current:

- ReplayCheckpoint contract/service;
- ReplayCoverageCertification service/schema;
- IncrementalReplayPlanner;
- dependency topology store.

Then design an explicit additive promotion record or equivalent governed transition.

Do not make `safeForIncremental=true` an untracked mutable flag.

Promotion must have:

- checkpoint id;
- certification id/version/digest;
- actor/reason;
- promotion timestamp;
- revocation/invalidity semantics;
- immutable audit evidence.

---

## 7. Current learning/business framing

Business meaning of next packet:

> “完整重算十年历史已经证明正确。现在要解决的是：企业补录三年前一笔单据时，能不能只从最近一个已证明安全的历史点开始重算受影响部分，而且结果和十年全量重算完全一样。”

This is the bridge from correctness proof to production-scale historical recalculation.

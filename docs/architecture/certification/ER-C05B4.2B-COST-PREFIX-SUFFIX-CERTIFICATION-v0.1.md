# ER-C05B4.2B — Cost Prefix Restore & Suffix-Only Recompute Certification v0.1

**Status: CERTIFIED / CLOSED FOR COST FAMILY**  
**Date: 2026-09-19**  
**Certified implementation head: `f22d81922c9e9cd062c900c104e9ef866b6a0214`**  
**GitHub Actions run: `35430178723`**  
**DB Schema Version: 19**

---

## 1. Business problem

企业已经运行到某个经过 Full Replay 认证并 Promotion 的安全历史点。

如果安全点之后新增一笔业务：

> 系统能否不从企业第一天重算成本，而是恢复安全点当时的成本池状态，只计算新增后缀？

本认证针对 Cost family 给出第一次真实 E2E 证明。

---

## 2. Certified reference scenario

Before checkpoint:

```text
Production:
10 units
total basis = CNY 100
unit cost = CNY 10

Shipment before checkpoint:
2 units
```

Checkpoint COST_POOL:

```text
remaining quantity = 8
unit cost = 10
source = original production BusinessData
```

Checkpoint capture is digest-protected and idempotent.

After checkpoint:

```text
new shipment = 1 unit
```

Incremental candidate:

```text
restore 8 @ 10
read only posting_sequence > checkpoint boundary
process exactly one suffix shipment
```

Expected cost:

```text
quantity = 1
unitCost = 10
totalCost = 10
```

---

## 3. True suffix execution evidence

Reference validation:

```text
checkpointBoundarySequence = 6
targetBoundarySequence = 7

processedSuffixResultCount = 1

quantity = 1.000000000000
unitCost = 10.000000000000
totalCost = 10.000000000000

plannerFallback = false
```

This proves the candidate Cost path did not recalculate the entire cost history for the reference case.

---

## 4. Prefix-state evidence

Checkpoint COST_POOL:

```text
snapshotCount = 1
poolKey = warehouse=HK|productId=P-100
remainingProductionQuantity = 8
unitCost = 10
idempotent = true
```

The snapshot preserves source lineage to the canonical production BusinessData.

---

## 5. Candidate generation isolation evidence

The suffix calculation produced derived state in the candidate generation:

- CostRun;
- AllocationRun / AllocationRelation;
- ValuationPosition;
- Candidate LedgerDataset;
- CalculationDependencyEdge.

Evidence:

```text
candidateDatasetId = candidate EconomicRuntimeDataset
candidateLedgerDatasetId = candidate BUILDING ledger dataset
generationScopedDependencyCount = 3
```

Allocation source:

> original production BusinessData from the restored checkpoint layer.

The current production generation is not used as the write target for these candidate outputs.

---

## 6. Existing correctness guarantees remained green

Same E2E run also preserved:

- Full Replay deterministic = true;
- ReplayCoverageCertification = CERTIFIED;
- ReplayCheckpointPromotion = ACTIVE;
- promoted checkpoint selected by IncrementalReplayPlanner;
- FX period-end delta = +200 CNY;
- FX realized settlement delta = +100 CNY;
- beforeDigest == afterDigest for the existing Full Replay reference.

---

## 7. What this certification proves

For the certified FIFO reference scenario:

> EVO can restore a real cost prefix state from a promoted checkpoint and compute only a newly affected suffix inside an isolated candidate generation.

This is the first real execution proof of:

```text
prefix restore
+
suffix-only recomputation
```

rather than only planning or architecture.

---

## 8. What this does NOT yet prove

This certification does not close Production-Safe Incremental Replay.

Still required:

- complete candidate Economic Runtime digest;
- unaffected-prefix + candidate-suffix composition semantics;
- full Posting / Work / remaining materialization-family convergence;
- independent Full Replay against the same post-change canonical history;
- exact candidate digest == full replay oracle digest;
- candidate verification from that equivalence;
- whole-runtime atomic activation;
- mismatch fallback certification;
- equivalent production proofs for remaining cost methods and required prefix-state families.

---

## 9. Next packet

`ER-C05B4.2C — Candidate Economic Runtime Digest & Full-Replay Oracle Equivalence`

Business question:

> Now that EVO can truly resume from a checkpoint and recompute only the suffix, does the complete economic state produced by that incremental path exactly equal the state obtained by independently replaying the entire updated history from the beginning?
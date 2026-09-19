# ER-C05B4.2C — Incremental Candidate vs Full Replay Oracle Equivalence v0.1

**Status: CERTIFIED FOR REFERENCE SCENARIO / PRODUCTION ACTIVATION NOT YET CLOSED**  
**Date: 2026-09-19**  
**Certified implementation head: `7ddc1f58143d835e1cfcd9485f1cbabd6845bd30`**  
**GitHub Actions run: `35430987056`**  
**DB Schema Version: 20**

---

## 1. Business question

> 当企业历史新增一笔受影响业务以后，从认证 Checkpoint 恢复前缀状态并只重算受影响 suffix，最终得到的企业经济状态，是否与从第一天对更新后的完整历史执行 Full Replay 完全一致？

这是 Production-Safe Incremental Replay 当前阶段最核心的正确性问题。

---

## 2. Certified scenario

Checkpoint state:

```text
FIFO inventory cost pool = 8 units @ CNY 10
checkpoint boundary sequence = 6
```

Updated canonical history:

```text
new shipment after checkpoint = 1 unit
target boundary sequence = 7
```

Incremental path:

```text
promoted checkpoint
→ restore COST_POOL prefix
→ restore LEDGER_BALANCE prefix
→ isolated Candidate generation
→ replay only suffix PostingInput
→ suffix Cost / Allocation / Valuation
→ Candidate Work projection
→ normalized Candidate Economic Runtime semantic view
→ candidate digest
```

Independent oracle path:

```text
same updated canonical history
→ destructive certification-only Full Replay from the beginning
→ rebuild Posting / Ledger / Cost / Allocation / Valuation / Work
→ oracle digest
```

---

## 3. Exact equivalence evidence

```text
candidateDigest =
eda48c2c2b7a264babf0b975b850bda2f2060ee91ff932d61f0141126b144dbf

fullReplayOracleDigest =
eda48c2c2b7a264babf0b975b850bda2f2060ee91ff932d61f0141126b144dbf

incrementalEqualsFullReplay = true
```

This is the first true proof that suffix-only incremental interpretation can produce the same normalized economic state as a complete replay of the updated history.

---

## 4. Candidate semantic family counts

```text
ledgerEntries       = 13
ledgerBalances      = 5
costResults         = 2
allocationRelations = 3
valuationPositions  = 2
valuationResults    = 2
workItems           = 3
```

The digest compares semantic state, not raw physical row layout.

---

## 5. Candidate execution evidence

```text
restoredLedgerBalanceCount = 5
candidatePostingInputCount = 1
candidatePostingLedgerEffectCount = 2
postingInputStatusAfterCandidate = QUEUED

processedSuffixResultCount = 1
quantity = 1
unitCost = 10
totalCost = 10

candidateWorkItemCount = 3
pendingShipmentQuantity = 7
generationScopedDependencyCount = 3
plannerFallback = false
```

The suffix posting input remains QUEUED in the normal/current runtime, proving the Candidate execution path did not advance CURRENT posting state.

---

## 6. Why Oracle ReplayRun says MISMATCH

Oracle ReplayRun evidence:

```text
oracleReplayValidationStatus = MISMATCH
```

This is expected.

The existing Full Replay validation status answers:

> Is an unchanged canonical history rebuilt identically to its previous derived state?

But the oracle scenario intentionally includes a newly added canonical suffix fact.

Therefore:

```text
old derived state != updated-history Full Replay state
```

is correct.

The Incremental equivalence criterion is instead:

```text
updated-history Candidate digest
==
updated-history Full Replay Oracle digest
```

which is certified above.

---

## 7. Full Replay correctness gap closed during this packet

`work_item` was identified as derived materialization that previously survived Full Replay cleanup.

Full Replay now deletes enterprise WorkItems before rebuilding them from reconstructed ledger state.

This prevents stale CURRENT/CANDIDATE WorkItem rows from contaminating oracle semantics.

---

## 8. What is now proven

For the reference FIFO scenario, EVO now has actual evidence for:

- certified promoted checkpoint;
- prefix-state restoration;
- isolated Candidate materialization generation;
- suffix-only Posting replay;
- suffix-only FIFO Cost calculation;
- generation-scoped Allocation / ValuationPosition / Ledger / Work / dependency evidence;
- normalized complete Candidate economic semantic digest;
- independent complete Full Replay over the same updated canonical history;
- exact semantic digest equality.

---

## 9. What remains before Production-Safe Incremental Replay can close

The current Full Replay oracle is a certification harness that destructively rebuilds derived state after the Candidate digest is frozen.

This proves correctness, but it destroys the Candidate before production activation.

Therefore remaining production gate:

```text
isolated Full Replay Oracle generation
+
governed equivalence certification
+
Candidate VERIFIED only from exact oracle match
+
atomic activation of the still-intact Candidate
+
mismatch / revoke / fallback proof
```

Additional coverage is still required for other cost methods and required prefix-state families before claiming broad production coverage.

---

## 10. Next packet

`ER-C05B4.3 — Isolated Oracle Certification & Governed Candidate Activation`

Business question:

> Can EVO prove a Candidate equal to Full Replay without destroying it, then activate exactly that certified Candidate as the new production CURRENT state?
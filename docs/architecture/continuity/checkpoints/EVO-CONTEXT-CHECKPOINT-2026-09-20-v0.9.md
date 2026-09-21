# EVO Context Checkpoint — 2026-09-20 v0.9

**Status: ACTIVE HANDOFF CHECKPOINT**  
**Historical checkpoints remain preserved.**

## 1. Newly certified milestone

`ER-C05B4.3B — Governed Candidate Equivalence Certification & Atomic Activation`

Certified remote head:
`07f6a97c453e9697595fab1b2f3c7dfc48281382`

True PostgreSQL 18 E2E:
`35478570102 — SUCCESS`

Certification:
`docs/architecture/certification/ER-C05B4.3B-GOVERNED-CANDIDATE-ACTIVATION-CERTIFICATION-v0.1.md`

## 2. Business capability now proven

For the reference FIFO scenario, EVO can:

1. keep CURRENT untouched;
2. restore a promoted checkpoint into Candidate;
3. recompute only the affected suffix;
4. independently Full Replay the same updated history into Oracle;
5. recompute and compare complete economic semantic digests;
6. persist immutable Candidate↔Oracle certification;
7. atomically activate the exact Candidate;
8. archive the prior CURRENT;
9. consume the certified suffix PostingInput;
10. expose the activated Work state.

## 3. Technical route completed

- DB schema version 22;
- new `runtime_equivalence_certification` table;
- caller-supplied Candidate verification/activation bypass removed;
- Oracle-only verification remains available;
- fail-closed blocker evaluation;
- transactionally locked revalidation;
- RuntimeDataset + LedgerDataset + Posting cursor cutover;
- deterministic certification digest;
- 31 test files / 83 tests plus true database E2E.

## 4. Important failure evidence

Run `35478472647` failed because a JSONB array was sent through `pg` without explicit JSON encoding.

Correction head:
`07f6a97c453e9697595fab1b2f3c7dfc48281382`

Rule preserved:

> JSONB arrays crossing the PostgreSQL driver boundary must be explicitly serialized and cast to `jsonb`.

## 5. Exact current boundary

B4.3B is certified for the reference FIFO scenario, but broad Production-Safe Incremental Replay coverage is not yet complete.

The next risk is no longer Candidate activation authority. It is complete post-activation read semantics and safety coverage across generations, policies, mismatch, concurrency and retries.

## 6. Active packet

`ER-C05B4.4 — Activation Safety Matrix & Generation-Overlay Read Certification`

Required first result:

```text
activated CURRENT generation
→ compose parent prefix + current suffix
→ complete Ledger/Cost/Allocation/Valuation/Work history
→ same normalized semantic view as certified activation digest
```

Then certify fail-closed database scenarios for:

- semantic mismatch;
- stale parent;
- revoked promotion/checkpoint;
- duplicate certification retry;
- concurrent activation/worker processing.

## 7. Current status in business language

> EVO 已经不只是“算出一份局部重算结果”，而是能在不影响当前企业运行的情况下，用独立全量重算验真，并且只允许持有精确等价证据的那一代结果原子成为新的正式状态。下一步要证明切换后的所有历史查询与并发行为同样完整、安全、可恢复。

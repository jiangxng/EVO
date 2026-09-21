# EVO Context Checkpoint — 2026-09-20 v0.8

**Status: ACTIVE HANDOFF CHECKPOINT**  
**Historical checkpoints remain preserved.**

## 1. Newly certified milestone

`ER-C05B4.3A — Isolated Full Replay Oracle Certification`

Certified implementation head:
`2caf3433bc539646cfde9ff4a700e7390cee3162`

True PostgreSQL 18 E2E run:
`35431321738 — SUCCESS`

Certification document:
`docs/architecture/certification/ER-C05B4.3A-ISOLATED-ORACLE-CERTIFICATION-v0.1.md`

## 2. Business capability now proven

EVO can build two independent interpretations of the same updated enterprise history while leaving production state untouched:

- incremental Candidate from a promoted checkpoint;
- complete Full Replay Oracle from sequence 1.

Their complete normalized economic runtime digests match, while:

- CURRENT remains ACTIVE;
- CURRENT work and posting state remain unchanged;
- Candidate remains intact and BUILDING;
- Oracle becomes VERIFIED.

This removes the destructive-oracle limitation recorded in checkpoint v0.7.

## 3. Technical route completed

- schema version 21 adds ORACLE runtime generation;
- EconomicRuntimeDataset supports `kind = ORACLE`;
- materialization context supports `mode = ORACLE`;
- Posting, Ledger, Cost, Allocation, Valuation, Work and Dependency writes are generation-scoped;
- a complete Oracle economic semantic digest uses the same normalized schema as Candidate;
- E2E asserts Candidate equality and CURRENT/Candidate non-destruction.

## 4. Exact current boundary

Production-Safe Incremental Replay is still not closed.

The system has generic Candidate verification and activation primitives, but no single governed service currently proves and freezes Candidate↔Oracle equivalence before Candidate verification and activation.

Do not describe B4.3 as complete.

## 5. Active packet

`ER-C05B4.3B — Governed Candidate Equivalence Certification & Atomic Activation`

Required result:

```text
bound Candidate + VERIFIED Oracle
→ revalidate scope and exact digest equality
→ persist immutable equivalence certification
→ mark exact Candidate VERIFIED
→ atomically activate that Candidate
→ archive old CURRENT
```

Mismatch or stale parent must preserve CURRENT and refuse activation.

## 6. Next exact engineering step

Introduce a first-class equivalence-certification record and service that binds:

- enterprise and consistency domain;
- Candidate id and Oracle id;
- active parent dataset id;
- source checkpoint and promotion;
- incremental plan digest;
- common boundary sequence;
- Candidate and Oracle semantic digests;
- certification status, evidence and deterministic certification digest.

Then make governed activation consume that exact certification instead of trusting a caller-supplied digest.

## 7. Verification state

```text
Local typecheck: PASS
Local build: PASS
Local unit tests: 30 files / 79 tests PASS
GitHub Actions PostgreSQL 18 E2E: PASS
```

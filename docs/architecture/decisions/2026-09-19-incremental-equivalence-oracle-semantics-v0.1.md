# ADR — Incremental Replay Equivalence Oracle Semantics v0.1

**Status: ACCEPTED FOR ER-C05B4.2C**  
**Date: 2026-09-19**

## 1. Two different correctness questions

Existing unchanged-history Full Replay certification asks:

> If canonical history and pinned semantics are unchanged, can derived state be deleted and rebuilt identically?

Therefore:

```text
beforeDigest == afterDigest
```

is correct for that certification.

Incremental Replay after a canonical/history change asks a different question:

> Given the updated canonical history, does suffix-only incremental recomputation produce exactly the same final economic state as an independent complete replay of the updated history?

The old current state is expected to differ from the updated state.

Therefore the required equivalence is:

```text
updated canonical history
    ├─ incremental candidate → candidateDigest
    └─ independent full replay → oracleDigest

candidateDigest == oracleDigest
```

and NOT:

```text
oldCurrentDigest == oracleDigest
```

## 2. Consequence

Existing ReplayRun `validation_status=MATCH` remains the unchanged-history deterministic-rebuild proof.

Incremental equivalence requires a separate certification/evidence boundary that records:

- impact/change identity;
- promoted checkpoint;
- incremental plan digest;
- candidate runtime dataset;
- candidate semantic digest;
- independent full-replay oracle semantic digest;
- exact equality/mismatch;
- oracle execution identity/evidence.

## 3. Oracle independence

The oracle must not simply call the incremental algorithm internally.

It must interpret the complete updated canonical history from the beginning under the same pinned semantics.

For early certification harnesses, a controlled destructive Full Replay may be used after the candidate digest has been frozen, provided this is explicitly not treated as the production activation path.

Long-term production certification should use an isolated oracle generation / equivalent safe execution environment so candidate evidence is not destroyed before activation.

## 4. Digest comparability

Candidate and oracle digests may only be compared if they normalize the same semantic economic state.

Do not compare hashes of different physical row layouts.

Candidate state may be physically represented as:

```text
certified prefix state + generation-scoped suffix overlay
```

while Full Replay may be physically represented as a complete rebuilt generation.

The digest layer must normalize both into the same family-level semantic view.

## 5. Next

Complete generation-aware Posting/Ledger/Work paths and define the composed Candidate Economic Runtime View before implementing candidate/oracle digest comparison.
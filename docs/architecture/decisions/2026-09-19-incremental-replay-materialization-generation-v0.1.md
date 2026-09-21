# ADR — Incremental Replay Materialization Generation v0.1

**Status: PROPOSED / ER-C05B4.2 DESIGN FREEZE CANDIDATE**  
**Date: 2026-09-19**  
**Context: ER-C05B4.2 — Incremental Replay Execution & Full-Replay Equivalence**

---

## 1. Business problem

Full Replay is now certified.

Checkpoint Promotion is now certified.

The next goal is to support:

> A historical correction or backdated fact should recompute only the affected part of enterprise history while producing the exact same economic state as Full Replay.

However, correctness is not only a final-balance problem.

An enterprise must also preserve audit truth:

- which interpretation run produced a cost result;
- which allocation run produced a source-consumption relation;
- which valuation run produced a value adjustment;
- which generation of derived state is currently authoritative.

Incremental Replay must therefore avoid producing a state where final balances look correct while old run/result audit semantics become internally inconsistent.

---

## 2. Current architecture finding

### Ledger already has generation semantics

Existing:

`ledger_dataset`

with concepts:

- CURRENT;
- CANDIDATE;
- ARCHIVED;
- ACTIVE / BUILDING / ARCHIVED.

This shows an existing architectural intention:

> Build a derived candidate generation, verify it, then activate it.

### Other Economic Runtime families are not generation-scoped

Current derived families include:

- `allocation_run`
- `allocation_relation`
- `cost_run`
- `cost_result`
- `valuation_posting_run`
- `valuation_position`
- `valuation_run`
- `valuation_result`
- `work_item`

These are currently enterprise-scoped but not part of one explicit derived generation.

Full Replay currently works by deleting derived rows and rebuilding them.

That is acceptable for a correctness oracle.

It is not sufficient for production Incremental Replay.

---

## 3. Why naive suffix deletion is rejected

A tempting implementation is:

```text
keep prefix rows
delete rows after affected sequence
recompute suffix
```

This is rejected as the canonical B4.2 design.

Example:

A completed CostRun originally interpreted:

```text
movement A
movement B
movement C
movement D
```

If an Incremental Replay keeps A/B results but deletes C/D results, the original CostRun remains marked COMPLETED even though the database now contains only a subset of the outputs it actually produced.

The same problem exists for AllocationRun and ValuationRun.

Therefore:

> final-state correctness cannot be purchased by corrupting execution/audit lineage.

---

## 4. Required new abstraction

Introduce:

`EconomicRuntimeDataset`

or equivalent derived-materialization generation identity.

Conceptually:

```text
Canonical History
        ↓
Interpretation Semantics
        ↓
Economic Runtime Dataset / Generation
        ├─ Ledger projection
        ├─ Allocation results
        ├─ Cost results
        ├─ Valuation results
        ├─ Valuation positions
        └─ Work materialization
```

Canonical facts and explicit business instructions do NOT belong to a derived dataset.

Examples that stay outside:

- BusinessData;
- AllocationInstruction;
- published Policy/Definition;
- RateDataset;
- EnterpriseTemplateBinding.

---

## 5. Dataset lifecycle

Candidate lifecycle:

```text
CURRENT
   ↓ historical impact discovered
CANDIDATE
   ↓ restore promoted checkpoint prefix
   ↓ recompute affected suffix
   ↓ compute digest
   ↓ compare with Full Replay oracle
VERIFIED CANDIDATE
   ↓ governed atomic activation
CURRENT
   ↓
previous CURRENT → ARCHIVED
```

A failed/mismatched candidate is never activated.

---

## 6. Incremental Replay meaning

A true Incremental Replay must NOT simply call Full Replay internally.

It may use Full Replay independently as the correctness oracle during certification.

Incremental candidate path:

```text
Promoted Checkpoint
        ↓
restore/preserve certified prefix generation
        ↓
Impact Roots
        ↓
Dependency Closure
        ↓
Earliest Affected Boundary
        ↓
recompute only affected suffix into CANDIDATE generation
        ↓
candidate digest
```

Independent oracle path:

```text
same canonical history
        ↓
FULL REPLAY
        ↓
oracle digest
```

Certification:

`candidate digest == oracle digest`

---

## 7. Checkpoint materialization state

A ReplayCheckpoint currently stores:

- canonical ordered input digest;
- semantic pins;
- materialization digest;
- source replay identity.

It does not yet contain sufficient family state to restore a prefix cheaply.

B4.2 therefore requires a checkpoint materialization representation.

Candidate forms:

### A. Family snapshot segments

A table such as:

`replay_checkpoint_materialization`

with:

- checkpoint_id;
- family;
- schema_version;
- payload / object reference;
- semantic digest.

Possible families:

- LEDGER_BALANCE;
- COST_POOL_STATE;
- VALUATION_POSITION;
- POSITION_RESIDUAL;
- other required runtime state.

### B. Immutable dataset reference

If the active EconomicRuntimeDataset corresponding to a Checkpoint is retained immutably, the Checkpoint can reference that dataset instead of serializing every state object.

Long-term, immutable dataset/generation reference is preferred where practical.

---

## 8. Cost-specific requirement

Cost cannot safely begin at an arbitrary suffix without prior state.

Required prefix state depends on method:

### FIFO / LIFO

Need remaining layers:

- source BusinessData identity;
- pool key;
- remaining quantity;
- unit cost / carrying basis;
- specific identity where relevant;
- deterministic layer order.

### Moving Average

Need:

- pool quantity;
- pool carrying amount;
- contributor/dependency state required for provenance.

### Specific Identification

Need remaining source identities/layers.

Therefore Cost checkpoint state is a first-class semantic requirement, not merely a performance cache.

---

## 9. FX / valuation requirement

Incremental FX settlement may depend on prior rebuilt valuation state.

Example:

```text
receivable carrying 7000
→ period-end revaluation 7200
→ later settlement 7300
```

If Incremental Replay starts after period-end revaluation, the restored prefix must expose carrying basis 7200, not reconstruct settlement from original 7000.

Therefore valuation prefix state must be generation/checkpoint aware.

---

## 10. Work projection requirement

WorkItem is materialized state.

Incremental activation must not leave stale work items whose source balance disappeared in the candidate generation.

Work projection should therefore be generated from the candidate materialized ledger state and activated with the same generation, or fully regenerated as part of candidate activation.

---

## 11. Dataset ownership rule

A completed Run is immutable audit history.

Do not partially delete outputs from an immutable completed Run while keeping the Run as if it still described the current state.

Instead:

- outputs belong to a derived generation;
- a new generation has new Runs;
- old generation/run lineage remains queryable or archivable;
- current reads are scoped to the active generation.

---

## 12. Relationship with existing ledger_dataset

Do not create a second unrelated generation model if convergence is possible.

B4.2 implementation must evaluate whether:

1. `ledger_dataset` can be generalized/renamed conceptually into EconomicRuntimeDataset; or
2. a parent `economic_runtime_dataset` owns one `ledger_dataset` plus allocation/cost/valuation/work generations.

Preferred direction:

> one enterprise Economic Runtime generation identity with module-specific materialization children.

This preserves low coupling while enabling atomic activation.

---

## 13. Certification rule

B4.2 is not closed merely because one Incremental Replay candidate produces expected business numbers.

Required certification:

- actual suffix recomputation occurred;
- unaffected prefix was not recalculated as derived outputs;
- completed historical Runs were not semantically corrupted;
- candidate generation remained isolated before verification;
- candidate digest equals independent Full Replay digest;
- mismatch forces Full Replay fallback;
- activation is atomic/governed;
- provenance identifies checkpoint, promotion, plan digest and impact roots.

---

## 14. Current business interpretation

B4.1 answered:

> “Which historical point is trusted enough to start from?”

B4.2 must answer:

> “How do we create a new interpretation of only the affected future without damaging the old interpretation, and switch to it only after proving it is identical to full recalculation?”

This is the bridge from a replayable accounting kernel to a production-grade long-running enterprise runtime.

---

## 15. Next implementation packet

Before coding IncrementalReplay execution, define:

1. EconomicRuntimeDataset contract;
2. module ownership / dependency direction;
3. active/candidate/archive lifecycle;
4. minimum checkpoint state families;
5. CostPool checkpoint contract;
6. candidate read/write scoping;
7. atomic activation protocol;
8. independent Full Replay equivalence harness.

No destructive migration of existing tables should occur before candidate-generation certification is complete.

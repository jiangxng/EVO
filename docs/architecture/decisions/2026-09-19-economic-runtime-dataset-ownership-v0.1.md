# ADR — Economic Runtime Dataset Ownership v0.1

**Status: ACCEPTED FOR B4.2A-2**  
**Date: 2026-09-19**

---

## 1. Problem

EconomicRuntimeDataset is needed by:

- Replay;
- Ledger;
- Cost;
- Allocation;
- Valuation;
- Workflow/Work projection.

If the contract remains owned by the Replay module, these modules would need to depend on Replay merely to understand materialization generation identity.

That dependency direction is rejected.

Replay is an orchestration/correctness mechanism.

Materialization generation is a lower-level shared runtime concept.

---

## 2. Decision

Introduce an independent module:

`materialization`

Ownership:

- economic_runtime_dataset;
- runtime materialization generation identity;
- candidate/current/archive lifecycle contract;
- activation semantics;
- future generation-scoped read/write context.

Dependency direction:

```text
metadata / identity foundations
        ↓
materialization
        ↓
ledger / allocation / cost / valuation / workflow
        ↓
replay orchestration
```

More precisely, domain modules may depend on `materialization` contracts.

`materialization` must NOT depend on Cost, Allocation, Valuation, Ledger, or Replay implementation.

Replay depends on the domain modules and materialization to orchestrate rebuilding/certification.

---

## 3. Compatibility migration

Current B4.2A-1 files were initially created under `modules/replay`.

Do not destructively rewrite history.

Migration strategy:

1. add canonical contracts under `modules/materialization/api`;
2. add canonical PostgreSQL implementation under `modules/materialization/infrastructure`;
3. keep replay-side compatibility re-exports/wrappers temporarily if required;
4. migrate runtime imports to the canonical materialization module;
5. update architecture manifest;
6. remove compatibility paths only in a later explicit cleanup packet after all dependents move.

Repository history therefore preserves why the abstraction was discovered during Replay work while the final dependency ownership is corrected.

---

## 4. Business meaning

This prevents a technical implementation detail from controlling business semantics.

A Cost Engine should be able to say:

> "write this derived result into candidate generation X"

without knowing anything about Replay orchestration.

Likewise Allocation, Valuation, Ledger and Work can share one materialization generation contract.

Replay remains responsible for:

> when to create a candidate, what historical impact to recompute, how to verify it, and when a verified candidate may be activated.

---

## 5. Module rule

Future code must not introduce imports such as:

```text
cost → replay
allocation → replay
valuation → replay
ledger → replay
workflow → replay
```

merely for EconomicRuntimeDataset identity.

Allowed direction:

```text
cost → materialization
allocation → materialization
valuation → materialization
ledger → materialization
workflow → materialization
replay → materialization
```

---

## 6. Next

Move the public contract/implementation to the neutral module additively, update manifest/runtime, then begin generation-scoping the derived families.

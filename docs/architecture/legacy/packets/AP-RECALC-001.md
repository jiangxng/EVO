# AP-RECALC-001 — Change Impact / Local Recalculation vs Full Replay

**Status:** SEMANTIC GATE CLOSED  
**Date:** 2026-09-18  
**Scope:** bookkeeping + prior Asloop/bookkeeping genealogy → EVO replay/checkpoint architecture  
**Branch:** `evo/apm-certification-enterprise-template-v0.1`

---

## 0. Question

How can EVO support efficient historical recalculation while preserving full deterministic replay as the correctness oracle?

Legacy evidence shows several local-recalculation techniques with different scopes. The semantic goal is not to copy any one of them, but to normalize:

`Change → Impact Set → Dependency Closure → Recalculation Boundary → Deterministic Recompute → Equivalence Check against Full Replay`.

---

## 1. Sources inspected

bookkeeping:
- `src/main/resources/recalc.sql`
- `src/main/resources/balance.sql`
- `src/main/resources/cost.sql`
- `src/main/resources/db_fn_proc_part_1.sql`
- `src/main/resources/db_fn_proc_part_2.sql`
- `OrderService.java`
- `TransdataService.java`
- `BalanceService.java`
- `CostMwaService.java`
- `SysQueues.java`
- `controller/r2022.java`

Prior durable evidence:
- `LEGACY-CALCULATION-GENEALOGY-v0.1.md`
- `AP-COST-METHOD-001.md`
- `AP-MANUAL-ALLOC-001.md`

---

## 2. OBSERVED — legacy has multiple recalculation strategies

The legacy system does not have one unified replay mechanism.

Recovered strategies include:

1. **Boundary snapshot / scoped replay**
   - initialize `balance_recalc` and `cost_mwa_recalc` from the latest state before a selected transaction;
   - replay later transactions into recalculation tables.

2. **Dependency/path-scoped cost recomputation**
   - use `cost_mwa.path` and source cost references to identify downstream affected objects;
   - recompute only the resulting scope.

3. **Direct differential materialization update**
   - `proc_update_balance_by_diff` computes `current factor - prior factor`;
   - applies differences directly to balance/balance_log and recalculates affected moving-average price.

4. **Broad existing-data replay**
   - `recalculateWithExistingData` reads stored transactions by time range and pushes them back through processing queues.

These are historical optimization paths, not one canonical truth model.

---

## 3. Boundary snapshot behavior

`proc_innit_balance_calc_by_transnumber` creates recalculation seed state from the latest:

- `balance_log` rows before the selected transaction time;
- `cost_mwa` rows before the selected transaction time;

grouped by account/dimensions/object.

This is checkpoint-like behavior.

Normalized interpretation:

`Checkpoint(before boundary) + ordered facts after boundary → recomputed projection`.

The old implementation hard-codes account `1406` in this path; that is a legacy scope decision, not a general EVO rule.

---

## 4. Time-scoped replay behavior

`OrderService.getNeedRecalcTransnumbers(beginTransnumber)` selects later transactions by:

- `trans_time > begin transaction time`;
- account filter `1406`;
- ordered by `trans_time`.

`OrderService.recalc()` reloads stored business facts, reconstructs transaction-account interpretations under current loaded policies, synthesizes balances, and writes to the `recalc` path.

This is explicit evidence that legacy design expected recalculation from stored facts rather than requiring original command execution.

### Limitation

This implementation uses a coarse time/account scope.

It is not a complete generic dependency closure.

EVO must not copy the account-specific boundary.

---

## 5. Dependency-scoped cost impact

`proc_get_todo_list_by_uuid` constructs an affected scope using:

- changed transaction UUID(s);
- transaction time lower boundary;
- affected object IDs;
- `cost_mwa.path`;
- cost references / source UUIDs.

It selects later records whose valuation lineage depends on the changed source object/cost.

This is strong evidence for a calculation dependency graph.

Normalized:

`changed source`
` → direct dependents`
` → transitive cost/valuation descendants`
` → deterministic recomputation order`.

`cost_mwa.path` is therefore provenance/dependency evidence, not merely debugging metadata.

---

## 6. Backdated insertion behavior

Legacy functions locate insertion positions by effective transaction time:

- `fn_get_index_for_cost_insert`;
- `fn_get_index_for_transdata_account_insert`.

`proc_check_account_cost_uuid` repairs later references when a newly inserted historical cost should supersede an older referenced cost.

The source comments explicitly state:

> after inserting a new cost, later business that still references an older pre-insertion cost must be changed to reference the new cost.

This proves:

- effective ordering matters;
- a backdated occurrence can invalidate later valuation references;
- impact propagation must follow dependency + time/order semantics.

---

## 7. Direct diff update is an optimization, not truth

`proc_update_balance_by_diff` calculates:

`quantity_diff = quantity - quantity_factor`

`amount_diff = amount - amount_factor`

and applies those deltas directly to:

- `balance`;
- `balance_log`;
- non-financial balance/materialization;
- `cost_mwa.price = amount / quantity`.

This is useful for local trial recalculation where full historical replay would be unnecessarily expensive.

However it mutates materialized/derived state in place.

### EVO classification

This mechanism belongs to:

`incremental materialization maintenance`

not:

`canonical fact history`.

Correctness cannot depend on it.

---

## 8. Recalculation control / pause behavior

The service exposes:
- queue status;
- termination;
- continue;
- recalc by transaction number;
- recalculation from existing data;
- clearing/truncating calculation results.

`SysQueues` can:
- clear queues;
- stop recalculation context;
- pause recalculation when data-error checks fail;
- expose recalculation context/state.

This proves replay/recalc was treated as an operational mode with explicit control.

### EVO requirement

Historical replay and live derived-state mutation must not race on the same materialization boundary.

EVO should formalize this as a runtime mode / epoch boundary rather than rely on ad hoc queue clearing.

---

## 9. Full replay vs incremental replay

### Full replay

Correctness/reference path:

`canonical immutable facts`
` + pinned definitions/rules/policies`
` + deterministic order`
` → complete derived state`.

Properties:
- no dependency on existing materializations;
- no “latest policy” lookup;
- reproducible digest;
- oracle for validation.

### Incremental replay

Optimization path:

`change set`
` → impact analysis`
` → valid checkpoint`
` → dependency closure`
` → recompute only affected derived state`.

Properties:
- may use checkpoints/materializations;
- must not alter canonical facts;
- must be invalidated when checkpoint assumptions fail;
- must be verifiable against full replay.

---

## 10. Change categories

Impact analysis should classify at least:

1. **New/backdated business fact**
2. **Additive correction/reversal fact**
3. **Allocation instruction change/correction**
4. **Rule/policy version change**
5. **Reference dataset change** such as FX rate dataset
6. **Template/definition change**
7. **Materialization-only rebuild**
8. **Algorithm implementation version change**, where semantics/version are explicitly governed

Different changes produce different roots in the dependency graph.

---

## 11. Impact Set

Candidate:

`ImpactSet = direct roots + dependency closure + ordering descendants within affected semantic scopes`.

Direct roots can include:
- facts;
- positions;
- allocation instructions/results;
- cost bases;
- valuation pools;
- rate datasets;
- projections;
- template/rule versions.

Impact Set must be computed from explicit dependency/lineage edges rather than broad “recalculate everything after date X” unless no narrower safe boundary exists.

---

## 12. Dependency Closure

EVO needs a calculation dependency DAG/graph separate from business causality.

Examples:

- inventory receipt cost affects moving-average pool;
- pool affects later outbound cost;
- outbound cost affects production input;
- production input affects finished-goods basis;
- finished-goods basis affects later sale cost;
- FX rate dataset affects open-position valuation;
- manual allocation instruction affects selected position consumption.

Dependency edges must be queryable in both directions.

---

## 13. Recalculation Boundary

Candidate boundary:

`earliest affected ordering key within each dependency/valuation scope`.

A safe incremental boundary may be:
- a checkpoint before the earliest affected fact;
- source-position creation;
- valuation-pool checkpoint;
- period boundary;
- explicit template/rule effective-version boundary.

If dependency closure crosses the checkpoint's validity conditions, move the boundary earlier or fall back to full replay.

---

## 14. Replay ordering

Replay must use a deterministic total/partial order contract, not database insertion order.

Candidate ordering identity:

`effective_time + explicit sequence/order key + deterministic tie-breaker`.

The exact canonical contract is decided at architecture freeze, but every replay/checkpoint must pin it.

Backdated facts are inserted according to this semantic ordering, not merely appended to physical storage order.

---

## 15. Candidate ReplayCheckpoint contract

`ReplayCheckpoint` should contain or cryptographically bind:

- checkpoint ID;
- enterprise/tenant;
- semantic scope(s);
- boundary ordering key;
- last included fact/order identity;
- ordered input digest up to boundary;
- template version;
- rule/policy versions;
- allocation/cost method versions;
- external/reference dataset versions;
- runtime semantic version;
- derived projection/materialization digest;
- dependency-graph/version identity;
- created-at / provenance;
- validity conditions;
- parent checkpoint if any.

Checkpoint content is optimization state, not business truth.

---

## 16. Checkpoint validity

A checkpoint is usable only when all pinned semantics before its boundary remain equivalent.

Invalidate or move earlier when:
- a backdated fact precedes the checkpoint;
- a rule/policy version changes with retroactive effect;
- a manual allocation correction changes prior source consumption;
- an FX/reference dataset is intentionally replaced for historical revaluation;
- dependency semantics/runtime version changes;
- checkpoint digest fails verification.

---

## 17. Equivalence invariant

The central correctness invariant is:

`digest(incrementalReplay(change, checkpoint, dependencyClosure))`
` == digest(fullReplay(canonicalFacts, pinnedDefinitions, pinnedPolicies))`

for the same:
- facts;
- definitions;
- policy versions;
- external datasets;
- ordering boundary;
- semantic scope.

If equivalence cannot be demonstrated, incremental replay is invalid and full replay wins.

---

## 18. Materialization strategy

EVO should distinguish:

- canonical fact store;
- derived allocation/valuation/projection records;
- current materialized balances/read models;
- replay checkpoints.

Incremental updates may mutate/rebuild materializations.

They must never rewrite canonical historical facts to make the derived state “fit”.

---

## 19. Recalculation mode / live-write isolation

User requirement and legacy operational evidence support an explicit replay mode.

Candidate:

`RuntimeMode = LIVE | REPLAY_PREPARING | REPLAY | REPLAY_VERIFYING | RECOVERY`.

During a historical rebuild of a semantic scope:
- live posting to the affected projection/materialization scope is paused or isolated into a later epoch;
- facts may be accepted only under a clearly defined buffering policy;
- replay reads a pinned fact boundary;
- verification completes;
- materialization epoch swaps atomically;
- buffered/new facts continue after the replay boundary.

The exact concurrency model is implementation work after architecture freeze.

---

## 20. Legacy limitations that EVO must not preserve

Do not preserve:
- hard-coded account `1406` as generic recalculation scope;
- mutation of historical derived rows as the correctness mechanism;
- reliance on sequential numeric IDs as semantic ordering;
- implicit current-policy lookup;
- opaque path strings as the only dependency representation;
- queue-clearing as the only replay isolation mechanism;
- endpoint-specific partial logic as the architecture.

Preserve the business intent:
- local recalculation should be much cheaper than full replay when safe;
- dependency-scoped impact should prevent unrelated domains from recomputing;
- backdated data must correctly propagate;
- errors must pause unsafe continuation;
- results must remain explainable.

---

## 21. Unified normalized model

`Change`
` → ImpactRoot`
` → DependencyClosure`
` → EarliestAffectedBoundary`
` → ValidCheckpoint?`
` → DeterministicRecompute`
` → MaterializationBuild`
` → Equivalence/InvariantVerification`
` → AtomicActivation`.

If no valid checkpoint or safe closure exists:

`fallback → FullReplay`.

---

## 22. Classification

| Object | Candidate status |
|---|---|
| canonical business facts | CORE CANONICAL |
| correction/reversal facts | CORE CANONICAL |
| calculation dependency edges | DERIVED/INDEXED RESULT with durable lineage |
| impact set | ephemeral/derived execution plan |
| replay checkpoint | MATERIALIZATION / optimization artifact |
| materialized balances | MATERIALIZATION |
| full replay algorithm | CORE/MODULE correctness contract |
| incremental replay algorithm | optimization/module contract |
| replay run metadata | durable operational/audit record |
| replay digest/equivalence result | durable certification/audit evidence |

---

## 23. Gate result

Legacy evidence proves the need and feasibility of local historical recalculation while also exposing why it cannot be the truth model.

**AP-RECALC-001 semantic gate: CLOSED.**

Required architecture invariant:

> Full deterministic replay is the correctness oracle. Incremental recalculation is a dependency-scoped optimization that must be equivalent to full replay under the same pinned facts, definitions, policies, datasets and ordering contract.

All four semantic blockers in the current continuation plan are now closed:

- AP-FX-001;
- AP-MANUAL-ALLOC-001;
- AP-COST-METHOD-001;
- AP-RECALC-001.

The next action is the:

`Economic Runtime Architecture Freeze Gate`

which must classify candidate concepts as CORE CANONICAL / MODULE CONTRACT / DERIVED RESULT / MATERIALIZATION / REFERENCE-TEMPLATE SEMANTIC / REJECTED.

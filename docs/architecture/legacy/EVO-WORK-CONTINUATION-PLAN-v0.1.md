# EVO Work Continuation Plan v0.1

**Status:** ACTIVE EXECUTION PLAN  
**Version:** v0.1  
**Date:** 2026-09-18  
**Branch:** `evo/apm-certification-enterprise-template-v0.1`  
**Depends on:** `docs/architecture/legacy/EVO-WORK-STAGE-HANDOFF-v0.1.md`  
**Purpose:** continue the current EVO work from the completed chat lineage 0→1→2→3 without repeating broad archaeology, while closing the remaining evidence gates before freezing the Economic Runtime and resuming broader Enterprise Template convergence.

---

# 0. Execution rule

This plan is not a brainstorming backlog.

Each item is an evidence-gated work packet.

Default workflow:

`Known baseline`
` → named evidence gap`
` → minimal source set`
` → raw extraction`
` → observed facts`
` → interpretation`
` → contradiction / alternative`
` → EVO impact`
` → update genealogy / handoff / inventory`
` → tests or architecture change only if gate closes`
` → commit`

Do not reopen broad source families unless a named evidence gap requires it.

Do not freeze canonical objects from naming similarity.

Do not make runtime changes merely because a legacy implementation exists.

---

# 1. Priority order

Work continues in this strict priority order unless new evidence blocks a stage:

1. **AP-FX-001 — Foreign Currency / Settlement / Revaluation**
2. **AP-MANUAL-ALLOC-001 — Manual vs Automatic Allocation**
3. **AP-COST-METHOD-001 — FIFO / LIFO / Average / Specific Identification genealogy**
4. **AP-RECALC-001 — Change Impact / Local Recalculation vs Full Replay**
5. **Architecture Freeze Gate — Economic Runtime**
6. **Runtime/Contract implementation changes, if justified**
7. **Complete Enterprise Template archaeology outside accounting/economic runtime**
8. **Certification / reference enterprise packs**

The first four packets are the remaining semantic blockers.

---

# 2. AP-FX-001 — Foreign Currency / Settlement / Revaluation

## Question

How did Asloop/bookkeeping represent foreign-currency resources, exchange, settlement and valuation differences, and what parts should become canonical EVO semantics versus rebuildable valuation/projection results?

## Known baseline

Already known:

- physical/resource flow, monetary flow and valuation are distinct;
- a foreign currency holding may behave like an economic resource;
- `foreignAmount` is not enough to define semantics;
- rates must have semantic roles;
- revaluation must not rewrite underlying business facts;
- legacy evidence contains `sys_foreign_exchange`, `trans_settlement_exchange`, foreign calculation fields and foreign expressions.

## Named evidence gaps

Recover:

- exact foreign measure semantics;
- source-currency versus reporting/base-currency roles;
- caller chain of settlement/revaluation tables/functions;
- realized versus unrealized difference behavior;
- settlement transaction generation;
- rate effective-time selection;
- whether rate is snapshotted on fact, interpretation run, settlement, or projection;
- period/entity uniqueness behavior;
- reverse lineage from exchange result to original economic resource.

## Minimal source set

Asloop:

- `sys_foreign_exchange`;
- `trans_settlement_exchange`;
- foreign `c_calc_field` rows;
- foreign `c_expression` rows;
- classes/functions referencing `foreignAmount`, exchange tables, settlement transaction codes;
- transaction types related to currency/exchange/settlement.

bookkeeping:

- `ExchangeRate`;
- any policy/formula paths consuming exchange rates;
- financial settlement/revaluation SQL/functions if present.

## Required output

Create:

`docs/architecture/legacy/packets/AP-FX-001-FOREIGN-CURRENCY-SETTLEMENT.md`

Must include:

- source list with repo/ref/path/object;
- raw evidence snippets summarized;
- state/event model;
- rate-role matrix;
- fact vs interpretation classification;
- lineage graph;
- correction notes;
- EVO candidate mapping;
- unresolved residual questions;
- confidence labels.

## Completion gate

AP-FX-001 closes only when EVO can answer, without ambiguity:

1. what is the immutable fact?
2. what is the foreign/resource measurement?
3. what rate role applies and when?
4. what is settlement?
5. what is revaluation?
6. what is realized/unrealized difference?
7. what is replayable/rebuildable?
8. how do we trace both directions?

No architecture freeze before this packet closes.

---

# 3. AP-MANUAL-ALLOC-001 — Manual vs Automatic Allocation

## Question

Which source-consumption relations are explicit human/business decisions, and which are algorithm-generated interpretation results?

## Known baseline

Already proven:

- legacy matching performs ordered source consumption;
- `MATCH_TYPE` distinguishes automatic/manual/manual-or-automatic;
- `MANUALLY_FIELD` exists;
- `TRANS_MATCHED_DETAIL_ID / PARENT_ID / ORIGIN_ID / TRANS_MATCHED_SEQ` preserve lineage;
- AllocationRelation and AllocationPolicy must be distinct.

## Named evidence gaps

Recover:

- UI/API/service path for manual matching;
- persistence path of user-selected source rows;
- whether manual selection becomes immutable business evidence or simply pins algorithm input;
- correction/reallocation behavior;
- mixed manual+automatic behavior;
- provenance fields identifying actor/mode/reason;
- replay semantics when manual selection existed historically.

## Minimal source set

Asloop:

- `MATCH_TYPE`;
- `MANUALLY_FIELD`;
- services/controllers/actions named verification/match/manual;
- data-store path for manually selected matches;
- any workflow/UI configuration referencing manual matching.

bookkeeping:

- any explicit settlement/selection relation if present;
- evidence that opposite-side references are user-selected versus formula-derived.

## Required output

Create:

`docs/architecture/legacy/packets/AP-MANUAL-ALLOC-001.md`

Include a classification matrix:

| Relation kind | Source of decision | Mutable? | Replay behavior | Canonical status candidate |
|---|---|---|---|---|
| explicit user-selected settlement | | | | |
| automatic FIFO-like source choice | | | | |
| deterministic cost allocation | | | | |
| corrective reallocation | | | | |

## Completion gate

Close when EVO can distinguish at least:

- Allocation Fact;
- Allocation Instruction/Constraint;
- Allocation Interpretation Result;
- Residual Position Projection.

Only then decide persistence contract.

---

# 4. AP-COST-METHOD-001 — Cost method genealogy

## Question

How should EVO model FIFO, LIFO, weighted/average and specific identification as policies over the same allocation/valuation substrate?

## Known baseline

- weighted/average semantics are strongly evidenced in bookkeeping;
- Asloop matching already supports ordered source consumption;
- `lastStockOut(current.qty)` exists but does **not** prove LIFO;
- source ordering and calculation dependency ordering are separate;
- exact conservation and residual assignment are required.

## Named evidence gaps

Find implementation evidence for:

- FIFO-like source ordering;
- LIFO-like source ordering;
- specific identification / explicit lot/source selection;
- weighted/average pool behavior;
- negative inventory interaction;
- transfer/cross-warehouse basis carry-over;
- return/reversal basis restoration;
- backdated transaction behavior.

## Required output

Create:

`docs/architecture/legacy/packets/AP-COST-METHOD-001.md`

Required model:

`CostMethodPolicy`
- source eligibility;
- source ordering;
- allocation unit;
- pool grain;
- negative policy;
- return/restoration policy;
- precision policy;
- dataset/version;
- effective ordering contract.

Required comparison table:

| Method | Selection semantics | Allocation relation needed? | Cost basis form | Replay impact |
|---|---|---|---|---|
| FIFO | | | | |
| LIFO | | | | |
| Weighted average | | | | |
| Specific identification | | | | |

## Completion gate

Close only when each required cost method can be represented without creating a separate incompatible runtime model.

---

# 5. AP-RECALC-001 — Change Impact / Replay

## Question

How can EVO support efficient historical recalculation while preserving full replay as the correctness oracle?

## Known baseline

- business history is immutable;
- replay does not re-execute Commands;
- legacy systems use local recalculation/checkpoint-like mechanisms;
- balance/cost state can be rebuilt;
- incremental recalculation is a performance path, not truth.

## Named evidence gaps

Recover:

- caller chain for `proc_update_balance_by_diff`;
- `recalc.sql` boundaries;
- balance-log dependencies;
- cost_mwa/source-path dependencies;
- how backdated data propagates;
- when local recalculation stops;
- how historical comments explain design intent.

## Required output

Create:

`docs/architecture/legacy/packets/AP-RECALC-001.md`

Formal candidate:

`Change`
` → Impact Set`
` → Dependency Closure`
` → Recalculation Boundary`
` → Deterministic Recompute`
` → Equivalence Check against Full Replay`

Must define candidate checkpoint contract:

- input boundary;
- ordered input digest;
- rule/policy versions;
- projection state digest;
- validity conditions;
- rebuild path.

## Completion gate

Incremental path is acceptable only if:

`incremental result == full replay result`

under the same pinned facts/definitions/policies.

---

# 6. Economic Runtime Architecture Freeze Gate

Only after AP-FX-001, AP-MANUAL-ALLOC-001, AP-COST-METHOD-001 and AP-RECALC-001 close, review and update:

`docs/architecture/decisions/2026-09-17-economic-flow-valuation-and-materialization.md`

Potential canonical concepts to decide:

- EconomicOccurrence / BusinessFact;
- Measurement;
- Position;
- Reservation/Lock;
- AllocationRelation;
- AllocationPolicy;
- DerivationRelation;
- CostBasis;
- ValuationRun / ValuationResult;
- Projection;
- MaterializedProjection;
- ReplayCheckpoint.

The gate must explicitly classify each as one of:

- **CORE CANONICAL**
- **MODULE CONTRACT**
- **DERIVED RESULT**
- **MATERIALIZATION**
- **REFERENCE / TEMPLATE SEMANTIC**
- **REJECTED / NOT NEEDED**

Do not create a concept solely to mirror a legacy table.

---

# 7. Runtime implementation after freeze

If the architecture freeze changes existing contracts, perform changes in this order:

1. interfaces/contracts;
2. invariants;
3. schema/migration;
4. domain implementation;
5. infrastructure;
6. replay behavior;
7. observability;
8. certification tests;
9. reference Enterprise Template/package;
10. docs/checkpoint.

Required properties:

- deterministic;
- pinned versions;
- no hidden latest-rule selection;
- append-only fact history;
- idempotent writes;
- lineage queryability;
- full replay;
- explicit materialization rebuild;
- no LLM in deterministic runtime execution.

---

# 8. Complete Enterprise Template continuation

Economic Runtime is not the end of Enterprise Template work.

After the freeze, continue lossless archaeology by family.

## 8.1 Definition families

Create packets for:

- `AP-TXTYPE-*` — TransactionType / Application semantics;
- `AP-FIELD-*` — Field / FieldGroup / semantic input definitions;
- `AP-FORM-*` — Form / FormView;
- `AP-LIST-*` — List / ListView / filter/sort;
- `AP-MENU-*` — navigation/menu;
- `AP-REPORT-*` — reporting;
- `AP-DASH-*` — dashboard/card;
- `AP-PROC-*` — workflow/process/task;
- `AP-PERM-*` — permission/role semantics;
- `AP-RULE-*` — operational/accounting rules.

## 8.2 Machine-readable inventory

Do not keep these only as Markdown.

Create/update a machine-readable legacy definition inventory with:

- source repo/ref;
- source object;
- semantic family;
- normalized EVO target;
- preservation status;
- confidence;
- loss notes;
- implementation status;
- certification fixture link.

## 8.3 Loss ledger

Create a formal loss ledger proving that each legacy semantic asset is one of:

- preserved;
- normalized;
- superseded with lineage;
- intentionally excluded as instance data;
- intentionally rejected as obsolete implementation coupling;
- unresolved.

“Complete” must be demonstrable, not asserted.

---

# 9. Enterprise Package / Template re-certification

After normalized definitions and Economic Runtime contracts stabilize:

1. regenerate/reference Enterprise Template;
2. validate deterministic package export;
3. validate digest stability;
4. validate version immutability;
5. validate explicit enterprise binding/upgrade;
6. validate deploy plan/diff;
7. validate rollback/migration path;
8. validate restart persistence;
9. validate multi-enterprise isolation;
10. run end-to-end reference scenario.

Reference scenarios should include at least:

- purchase demand → purchase order → receipt → inventory;
- sales order → delivery/issue → receivable/invoice;
- production consumption → completion;
- inventory transfer;
- return/reversal;
- backdated occurrence;
- cost replay;
- FX/settlement;
- manual allocation;
- all four cost methods where meaningful.

---

# 10. Cross-repository boundary continuation

Keep the constitutional boundary:

> EC thinks and learns. EVO executes. Eidos interacts.

After EVO Economic Runtime stabilizes, re-run cross-repo certification for:

`EVO Observation`
` → EC Proposal`
` → Eidos ActionRequest`
` → EVO Command`
` → Outcome`

Certification must prove:

- proposal cannot mutate truth;
- Eidos cannot bypass authorization;
- EVO independently validates current state;
- schema/version is pinned;
- idempotency works;
- stale proposals fail safely;
- outcomes are observable;
- replay is unaffected by EC/Eidos availability.

APM remains a reference scenario, not a canonical core module.

---

# 11. Commit cadence and checkpoint policy

Commit whenever one of these happens:

- a named hypothesis is proven/refuted;
- a runtime call graph closes;
- a state machine becomes reconstructable;
- a canonical architecture implication appears;
- a packet reaches a coherent evidence boundary;
- before switching source family;
- before opening a new chat window.

Each packet commit should record:

- source refs;
- evidence status;
- current conclusion;
- corrections;
- unresolved;
- exact next target.

Never let chat be the only place containing a stable conclusion.

---

# 12. New-chat continuation command

For the next chat window, use:

> Continue EVO from `docs/architecture/legacy/EVO-WORK-STAGE-HANDOFF-v0.1.md` and `docs/architecture/legacy/EVO-WORK-CONTINUATION-PLAN-v0.1.md`. Check the latest completed packet/commit first. Do not redo broad Asloop/bookkeeping archaeology. Continue from the first unresolved evidence gate in the plan.

A new LLM should then:

1. read the handoff;
2. read this plan;
3. inspect the latest commit after these docs;
4. locate the first incomplete packet;
5. load only that packet + named raw evidence;
6. continue.

---

# 13. Immediate next action

`AP-FX-001 — Foreign Currency / Settlement / Revaluation` is now **SEMANTIC GATE CLOSED**.

Completed packet:

`docs/architecture/legacy/packets/AP-FX-001-FOREIGN-CURRENCY-SETTLEMENT.md`

Closure commit:

`0e003907e5d14839c8658ab6f9fb50694f18c422`

The immediate next packet is:

`AP-MANUAL-ALLOC-001 — Manual vs Automatic Allocation`

Entry sequence:

`MATCH_TYPE`
` → MANUALLY_FIELD`
` → manual verification/matching controller/service/UI path`
` → persisted selected source references`
` → correction/reallocation behavior`
` → mixed manual+automatic behavior`
` → provenance`
` → replay classification`
` → EVO persistence contract candidate`

Do not start broad runtime refactoring before the remaining semantic gates close.

---

# 14. Definition of success for this work phase

This phase is complete when a different capable LLM, using the repository only, can:

`recover the 0→1→2→3 evolution`
` → understand why current concepts exist`
` → see all corrected false paths`
` → locate current evidence gaps`
` → continue without repeating archaeology`
` → freeze Economic Runtime only from closed evidence`
` → rebuild a complete Enterprise Template without semantic loss`

> Repository continuity is part of the architecture, not project administration.


---

# 15. Progress ledger — 2026-09-18

| Evidence gate | Status | Durable artifact |
|---|---|---|
| AP-FX-001 | **CLOSED** | `packets/AP-FX-001-FOREIGN-CURRENCY-SETTLEMENT.md` |
| AP-MANUAL-ALLOC-001 | **CLOSED** | `packets/AP-MANUAL-ALLOC-001.md` |
| AP-COST-METHOD-001 | **IN PROGRESS / NEXT** | pending |
| AP-RECALC-001 | pending | pending |
| Economic Runtime Freeze | blocked by remaining three gates | pending |

FX closure established the distinction between foreign measurement, local carrying basis, settlement result and period-end valuation. It also strengthens the need to classify Allocation provenance before freezing canonical persistence.


---

# 16. Manual allocation closure — 2026-09-18

`AP-MANUAL-ALLOC-001` is now **SEMANTIC GATE CLOSED**.

Completed packet:

`docs/architecture/legacy/packets/AP-MANUAL-ALLOC-001.md`

Closure commit:

`c2df7e74d366d5b8159679db9d4d2da09e37ad47`

The next active packet is:

`AP-COST-METHOD-001 — FIFO / LIFO / Average / Specific Identification genealogy`

Do not reopen the manual-allocation source family unless new evidence is needed to resolve `U-MANUAL-001` or certification requires stronger provenance proof.


---

# 17. Cost method closure — 2026-09-18

`AP-COST-METHOD-001` is now **SEMANTIC GATE CLOSED**.

Completed packet:

`docs/architecture/legacy/packets/AP-COST-METHOD-001.md`

Closure commit:

`77356fa5f6a21fe1cf880d87631a033b494ebf29`

The next and final semantic blocker before the Economic Runtime Architecture Freeze Gate is:

`AP-RECALC-001 — Change Impact / Local Recalculation vs Full Replay`.


---

# 18. Recalculation closure and freeze entry — 2026-09-18

`AP-RECALC-001` is now **SEMANTIC GATE CLOSED**.

Completed packet:

`docs/architecture/legacy/packets/AP-RECALC-001.md`

Closure commit:

`1a28aafcd9fcb8006f37dbe6a70e2b401196e44e`

The four required semantic blockers are now closed.

Current active stage:

`Economic Runtime Architecture Freeze Gate`

No broad runtime refactor should begin until the freeze document classifies canonical truth, module contracts, derived results and materializations.


---

# 19. Economic Runtime Architecture Freeze — COMPLETED

The Economic Runtime Architecture Freeze Gate is now **CLOSED**.

Authoritative decision:

`docs/architecture/decisions/2026-09-18-economic-runtime-architecture-freeze-v0.1.md`

Commit:

`5907e36faac787400f57980757357d77b3b38ee0`

## Current active phase

`Economic Runtime Contract Convergence & Implementation`

Execution order:

1. inventory current public contracts/schema against the freeze classification;
2. introduce additive Allocation contracts;
3. introduce Measurement / Basis / Rate dataset contracts where needed;
4. extend lineage so business causality, allocation, valuation and projection are distinguishable;
5. align Cost contracts to the unified `CostMethodPolicy`;
6. extend Replay contracts with dependency impact/checkpoint semantics while keeping full replay as oracle;
7. add invariants/certification tests before replacing implementation;
8. migrate physical schema additively;
9. adapt existing cost/valuation/replay infrastructure;
10. re-certify existing reference scenarios;
11. resume complete Enterprise Template archaeology by non-economic definition families.

Implementation MUST preserve existing working assets and use additive convergence rather than repository replacement.


---

# 20. Economic Runtime Contract Convergence progress — 2026-09-18

## ER-C01 — Semantic contracts

Status: **COMPLETE**

Delivered:
- `modules/economic/api/contracts.ts`
- `modules/allocation/api/contracts.ts`
- CostMethodPolicy expansion
- replay impact/checkpoint/equivalence contracts
- module ownership in `architecture.manifest.json`

## ER-C02 — Invariants / certification

Status: **IN PROGRESS**

Delivered:
- economic semantic ordering invariant;
- explicit → automatic allocation phase invariant;
- moving-average pool conservation/residual tests;
- authoritative cost policy pin requirement;
- valuation-rule pin requirement.

## ER-C03 — Additive schema

Status: **COMPLETE**

Migration:

`migrations/schema/202609180010_economic_runtime_v01.sql`

Adds:
- `allocation_policy`
- `allocation_instruction`
- `allocation_run`
- `allocation_relation`
- `rate_dataset`
- `rate_observation`
- `calculation_dependency_edge`
- `replay_checkpoint`

No legacy table was dropped.

Database schema version advances to **8**.

## ER-C04 — Runtime adaptation

Status: **IN PROGRESS**

Completed so far:
- `PostgresAllocationStore` for durable explicit instructions/runs/relations;
- Allocation store exposed through EVO runtime;
- Cost Engine no longer resolves latest ACTIVE valuation policy internally;
- authoritative CostRun requires explicit policy id/version;
- authoritative outbound valuation requires explicit valuation-rule pin;
- cost ordering now uses `effective_at + posting_sequence + stable business_data id`;
- business-data types, quantity field, basis field, specific identity field and pool dimensions are policy-driven;
- Moving Average is now a true quantity+amount pool rather than fake layer consumption.

Next:
1. complete RateDatasetStore;
2. add ReplayCheckpoint/DependencyGraph store;
3. persist AllocationRelation from cost/settlement paths where appropriate;
4. add normalized valuation input adapter;
5. complete CI and integration certification.


---

# 21. Stable implementation checkpoint — 2026-09-18

Latest verified implementation checkpoint:

`0191f55e29416a68d52772e1eb7124f33d72260a`

GitHub CI:

`SUCCESS`

Verified pipeline:
- migrations;
- TypeScript typecheck;
- build;
- tests.

This checkpoint includes:
- Economic Runtime schema v8;
- economic/allocation public contracts;
- AllocationStore runtime persistence;
- RateDataset contracts/store;
- ReplayTopology contracts/store;
- pinned valuation policy/rule enforcement;
- semantic cost ordering;
- policy-driven cost input mapping;
- corrected Moving Average quantity+amount pool;
- exact final residual closure invariant.

Subsequent documentation-only commits do not invalidate this verified code checkpoint.

## Next active work

Continue ER-C04 in this order:

1. expose and certify RateDatasetStore / ReplayTopologyStore through runtime;
2. add DB-backed tests for Allocation idempotency and published-policy enforcement;
3. persist AllocationRelation from FIFO/LIFO/Specific Identification cost runs;
4. introduce normalized valuation input adapter so cost engine no longer reads BusinessData payload directly;
5. add FX settlement/revaluation runtime on the same Allocation + Valuation substrate;
6. then enter ER-C05 incremental replay planning/equivalence.


---

# 22. Stable implementation checkpoint — Allocation lineage + ValuationInput — 2026-09-18

Verified code checkpoint:

`32feed18fd214bfe8d45fcd6e5a02b8666921ad6`

GitHub CI:

`SUCCESS`

All preceding Economic Runtime commits in this batch are confirmed ancestors of the current branch HEAD.

## Delivered in this checkpoint

### Allocation policy / lineage

- reference inventory AllocationPolicies are published explicitly;
- CostRun persists allocation policy id/version;
- ReplayRun preserves and restores the same allocation pin;
- FIFO/LIFO/Specific Identification require a compatible published AllocationPolicy pin;
- layer consumption produces durable derived `allocation_relation` rows;
- full replay removes/rebuilds AllocationRun/AllocationRelation;
- canonical `allocation_instruction` survives replay.

### Cost input normalization

Cost Engine no longer parses application BusinessData payload fields directly.

Pipeline:

`BusinessData + posting sequence + pinned valuation-policy mapping`
` → PostgresValuationInputReader`
` → ValuationInput`
` → Cost/Allocation algorithm`.

ValuationInput now carries:
- inbound/outbound direction;
- EconomicOrderKey;
- pool key/dimensions;
- quantity Measurement;
- optional basis Measurement;
- optional specific identity.

Reference template explicitly declares:
- quantity field/unit;
- basis field/unit;
- pool dimensions;
- input business-data types;
- specific identity field.

### Deterministic replay refinement

A layer-based cost replay now pins both:
- ValuationPolicy;
- AllocationPolicy.

This is required for allocation lineage to be replayable, not merely cost totals.

## Next active runtime packet

`ER-FX-001 — FX Period-End Revaluation Runtime`

Implementation target:

`Pinned RateDataset`
` + open foreign Position input`
` + carrying-value basis`
` → FX ValuationResult`
` → deterministic accounting projection`.

The first implementation will cover period-end revaluation before realized settlement because it has no business-source allocation ambiguity.

After ER-FX-001:
- ER-FX-002 — realized settlement/closure;
- ER-C05 — dependency-scoped incremental replay/equivalence.


---

# 23. ER-FX-001 — Period-End FX Revaluation Runtime — COMPLETED

Verified implementation checkpoint:

`7d3c3f845efc1072f0e9d2e069d99b87c3c3d940`

GitHub CI:

`SUCCESS`

Database schema baseline:

`v10`

Delivered:

- generic `valuation_run` / `valuation_result` persistence;
- `FxPositionSnapshot`, `FxPeriodEndRequest`, `FxRevaluationResult` contracts;
- pinned immutable `RateDataset` validation;
- `PERIOD_END_VALUATION` rate selection by role/currency/effective time;
- period-end valuation formula:
  `foreign quantity × pinned period-end rate → carryingAfter`;
- `delta = carryingAfter - carryingBefore`;
- original foreign measurement remains unchanged;
- result lineage records rate observation + dataset id/version/digest;
- FX valuation runtime is exposed through `createEvoRuntime()`;
- executable tests cover currency mismatch, amount precision and foreign-measure immutability.

The implementation follows AP-FX-001:

`open foreign position + period-end rate dataset → derived valuation result`

and does not model period close as a settlement event.

## Next active runtime packet

`ER-FX-002 — Realized FX Settlement / Position Closure`

First implementation boundary:

`Open Foreign Position Snapshot`
` + canonical Settlement BusinessData`
` + explicit settlement measurements`
` + Allocation/closure evidence`
` → realized settlement valuation result`.

Initial scope is deliberate:

- settlement must fully close the selected foreign position;
- allocated carrying basis uses the exact remaining carrying amount on final closure;
- realized delta is derived from actual local settlement value versus remaining carrying basis;
- the foreign quantity is consumed through Allocation semantics, not changed by valuation;
- accounting projection remains a later deterministic projection from the realized result.

Partial settlement/general multi-source settlement can extend the same substrate after the closure path is certified.


---

# 24. ER-FX-002 — Realized FX Settlement / Position Closure — COMPLETED

Verified implementation checkpoint:

`bfdc65e4c9b177ced0f91ca11607b2a7d43fe2e6`

GitHub CI:

`SUCCESS`

Verified pipeline:
- migrations;
- TypeScript typecheck;
- build;
- tests.

Delivered:

- `FxSettlementClosureRequest / Result / RunResult` contracts;
- domain invariant for full foreign-position closure;
- realized delta:
  `actual local settlement value - exact remaining carrying basis`;
- unit/role validation between foreign resource, carrying basis and settlement measurements;
- explicit rejection of partial settlement in the first certified implementation;
- `DefaultFxSettlementService`;
- one deterministic semantic input digest shared by AllocationRun and ValuationRun;
- settlement closure emits one derived `allocation_relation` from source position key to canonical settlement BusinessData;
- realized FX emits `FX_REALIZED_SETTLEMENT` generic `valuation_result`;
- AllocationInstruction remains canonical and survives replay;
- AllocationRun/Relation and generic ValuationRun/Result are deleted/rebuilt by full replay;
- enterprise isolation checks are enforced when allocation lineage references BusinessData;
- valuation module dependency on allocation is declared in `architecture.manifest.json`;
- module docs distinguish period-end revaluation from realized settlement.

Current FX runtime separation is now executable:

`FX_PERIOD_END`
= open foreign position + pinned period-end RateDataset → revaluation delta

`FX_REALIZED_SETTLEMENT`
= open foreign position + canonical settlement BusinessData + Allocation closure → realized delta

These operations share valuation infrastructure but are not the same semantic event.

## Next active phase

`ER-C05 — Dependency-Scoped Incremental Replay Planning & Equivalence`

Implementation sequence:

1. build pure ImpactRoot → DependencyClosure planner;
2. select the latest valid ReplayCheckpoint at/before earliest affected sequence;
3. fall back to full replay when graph/checkpoint safety cannot be proven;
4. add deterministic plan digest;
5. add plan-level tests before any incremental mutation execution;
6. only after planning is certified, implement candidate incremental rebuild;
7. compare candidate digest against full replay before enabling activation.

Generic valuation-result accounting projection remains a separate downstream packet and must not block replay correctness work.


---

# 25. ER-C05A — Incremental Replay Planner — COMPLETED

Verified planner checkpoint:

`9fcce1b3a1dbeb806d5ebb3cc34da1ad1d9e8436`

GitHub CI:

`SUCCESS`

Runtime wiring:

`f988bbc4471f88deb88a8c99537c79bac9665003`

The current runtime exposes `incrementalReplayPlanner` as a read-only planning capability. It does **not** execute incremental mutations.

Delivered:

- deterministic transitive dependency closure;
- cycle-safe graph traversal;
- deterministic edge/root ordering;
- latest checkpoint selection strictly before the earliest affected sequence;
- checkpoint graph-version compatibility;
- checkpoint runtime-semantic-version compatibility;
- explicit `safeForIncremental=true` requirement;
- conservative fallback for incomplete dependency graphs;
- forced full replay for runtime-semantic changes;
- conservative full-replay fallback for retroactive/unknown template and policy changes;
- stable fallback reason codes;
- SHA-256 `planDigest`;
- tests proving plan digest is independent of dependency-store return ordering.

Current normalized decision:

`ImpactRoot(s)`
` → DependencyClosure`
` → EarliestAffectedSequence`
` → Checkpoint Safety Evaluation`
` → IncrementalReplayPlan`

If any required safety proof is missing:

`fallbackToFullReplay = true`.

## Next active packet

`ER-C05B — Dependency Lineage Production + Checkpoint Certification`

Before incremental execution exists, the runtime must prove that it can produce sufficient dependency edges and valid checkpoints from real Cost / Allocation / FX / Projection runs.

Execution order:

1. emit CalculationDependencyEdge from Cost/Allocation/Valuation runtime;
2. generate a ReplayCheckpoint from a verified full replay;
3. mark checkpoint `safeForIncremental=true` only after its pins/digests are complete;
4. run planner against real dependency/checkpoint data;
5. add integration tests for backdated fact and valuation-policy/rate-dataset impact;
6. only then design candidate incremental rebuild execution.


---

# 26. ER-C05B1 — Real Dependency Graph Production — COMPLETED

Verified checkpoint:

`5cdd2359589f1d9f781cb3b6fc03e1ab9a15ae43`

GitHub CI:

`SUCCESS`

Delivered:

- new neutral `lineage` module for calculation-dependency contracts;
- Replay consumes lineage contracts instead of owning producer-facing types;
- Cost/Valuation can emit dependency edges without importing Replay;
- stable dependency graph version:
  `economic-runtime-v0.1`;
- stable version-qualified policy/reference node identity:
  `<id>@v<version>`;
- dependency edge identity is generated by persistence, while semantic uniqueness is based on graph/from/to/kind;
- FIFO/LIFO/Specific Identification source facts emit valuation dependency edges to consuming business facts;
- Moving Average conservatively links all current pool basis contributors to each outbound fact;
- valuation-policy and allocation-policy versions emit policy dependency edges to affected cost facts;
- FX period-end emits:
  - source BusinessData → foreign Position;
  - pinned RateDataset version → foreign Position;
- FX realized settlement emits:
  - foreign Position → settlement BusinessData;
  - source BusinessData → settlement BusinessData;
  - AllocationPolicy version → settlement BusinessData;
- `architecture.manifest.json` declares the neutral lineage boundary.

Important safety status:

`dependencyGraphComplete = false`

remains the required planner input for production use.

The graph is now real and queryable, but coverage completeness has **not** been certified for every Posting / Cost / Allocation / Valuation / Projection path.

Therefore the IncrementalReplayPlanner must still fall back to Full Replay for production execution.

## Next

`ER-C05B2 — Full Replay Checkpoint Production`

Create durable ReplayCheckpoint records from successfully verified Full Replay runs.

Initial checkpoint policy:

- capture real ordered-input digest;
- capture materialization digest;
- capture template/policy/reference pins that are currently provable;
- pin runtime semantic version and dependency graph version;
- set `safeForIncremental=false` by default;
- persist explicit blocker reasons for any incomplete pin/graph/replay coverage;
- never infer safety merely because Full Replay itself matched.


---

# 27. ER-C05B2 — Full Replay Checkpoint Production — IMPLEMENTED / CERTIFICATION PENDING

Implementation commits in this packet include:

- `bdcccf2665be111d9fd2b4b70e708a98784adaa0`
  - frozen economic runtime semantic version constant;
- `1a3482d4340312fd281e33e7c976502886d055d3`
  - conservative `PostgresReplayCheckpointService`;
- `96ebbabde06bf91ff0ea3c2eb57ef4a6f725a9c9`
  - runtime exposure;
- `4bb4132b1cac250faf989d4928b181728150e95b`
  - demo validation path creates checkpoint only after verified Full Replay;
- `9a6e971460c87e897602aea04087dae357608ed5`
  - schema v11: explicit `source_replay_run_id` and one-checkpoint-per-source-replay uniqueness;
- `0cdf5d72a008a5341a36cc9c56a15384cedd0876`
  - checkpoint contract exposes source replay run identity;
- `60e9e3b7dc5a48e6abe9f2414c1327fbe22efc6c`
  - exact checkpoint lookup by source replay run;
- `80cc001940d331c72bc212bffa9f8f2d3f73197e`
  - idempotency certification in demo validation;
- `bf798f880cda0238934ae9d71319a385266b2d99`
  - CI now includes `seed:demo` + `validate:demo` after migrate/typecheck/build/test.

## Checkpoint safety policy

A checkpoint can only be produced from:

`FULL replay + COMPLETED + validation_status=MATCH`.

Initial checkpoint policy is intentionally conservative:

`safeForIncremental = false`.

The checkpoint persists explicit blocker reasons instead of inferring safety.

Current mandatory blockers include:

- `DEPENDENCY_GRAPH_COVERAGE_NOT_CERTIFIED`;
- `MATERIALIZATION_DIGEST_LEDGER_ONLY`;
- `FULL_REPLAY_DERIVED_RUNTIME_COVERAGE_NOT_CERTIFIED`;
- `REFERENCE_DATASET_PIN_COVERAGE_NOT_CERTIFIED`;
- `ENTERPRISE_TEMPLATE_BINDING_MISSING` when no binding exists.

## Durable checkpoint inputs

Checkpoint currently records or binds:

- semantic posting boundary;
- ordered canonical BusinessData/posting input digest;
- last included fact identity;
- Enterprise Template binding/version/digest when present;
- posting rule/schema metadata pins provable from rebuilt ledger entries;
- cost valuation-policy pin;
- allocation-policy pin;
- valuation-rule pins;
- rate-dataset pins observable from completed valuation runs;
- economic runtime semantic version;
- dependency graph version;
- materialization digest from verified Full Replay;
- parent checkpoint lineage;
- source replay run identity.

## Important correctness rule

A successful Full Replay is necessary but **not sufficient** for incremental safety.

Checkpoint promotion to `safeForIncremental=true` requires independent closure of:

1. dependency graph coverage completeness;
2. materialization digest coverage beyond ledger-only state;
3. replay coverage for Allocation / Cost / FX / other derived runtime families;
4. reference dataset pin completeness;
5. template/policy pin completeness.

## Current certification state

Implementation is complete enough for end-to-end certification.

Certification is **pending** until the updated CI path successfully runs:

`migrate → typecheck → build → test → seed:demo → validate:demo`.

Do not mark ER-C05B2 CLOSED until that pipeline is green.

## Next after green certification

`ER-C05B3 — Checkpoint Coverage Closure`

Primary targets:

1. expand materialization digest coverage;
2. certify real dependency-graph coverage families;
3. certify reference-dataset pin coverage;
4. bind Enterprise Template in the reference enterprise scenario;
5. define objective promotion rules from unsafe checkpoint to incrementally-safe checkpoint;
6. keep incremental execution disabled until every promotion condition is proved.


---

# 28. ER-C05B2 — Full Replay Checkpoint Production — CLOSED

Certified PR-head checkpoint:

`2f752e798723ae03b1deb73c536e23f6b338ae39`

GitHub Actions:

`CI run 35324891541 — SUCCESS`

Certified pipeline:

`migrate → typecheck → build → test → seed:demo → validate:demo`

This is the first checkpoint where the CI pipeline validates both structural correctness and the full EVO reference runtime scenario.

## Certified behavior

- Full Replay must complete with `validation_status=MATCH` before checkpoint creation;
- replay checkpoint creation is idempotent per `source_replay_run_id`;
- schema v11 enforces at most one checkpoint per source replay run;
- ordered input digest is computed from deterministic posting sequence + canonical BusinessData evidence;
- materialization digest is captured from verified replay output;
- template/policy/reference pins are persisted only when provable;
- economic runtime semantic version and dependency graph version are pinned;
- parent checkpoint lineage is preserved;
- checkpoint remains `safeForIncremental=false` by default;
- explicit safety blockers are persisted.

## Safety status

Incremental replay execution remains DISABLED.

Current certified blocker family:

- `DEPENDENCY_GRAPH_COVERAGE_NOT_CERTIFIED`;
- `MATERIALIZATION_DIGEST_LEDGER_ONLY`;
- `FULL_REPLAY_DERIVED_RUNTIME_COVERAGE_NOT_CERTIFIED`;
- `REFERENCE_DATASET_PIN_COVERAGE_NOT_CERTIFIED`;
- template binding blocker when the enterprise is unbound.

A successful Full Replay does not remove these blockers automatically.

## Next active packet

`ER-C05B3 — Checkpoint Coverage Closure`

Execution order:

1. expand materialization digest beyond ledger-only state;
2. define and certify dependency-graph coverage by runtime family;
3. certify reference-dataset pin completeness;
4. bind the reference enterprise to a versioned Enterprise Template;
5. define objective promotion criteria for `safeForIncremental=true`;
6. keep incremental mutation disabled until every promotion criterion is machine-verifiable.


---

# 29. ER-C05B3 — Checkpoint Coverage Closure — IN PROGRESS

Started machine-verifiable coverage certification.

Implementation commits:

- `404c744bd0822d10c4272685f1539764ef98455a`
  - public ReplayCoverageCertification contract;
- `3241a41997da0aad04849273d58266ca328450a4`
  - conservative PostgreSQL coverage evaluator;
- `607192d62935ff349cc45d2c54a3bfd09e0669de`
  - EVO runtime exposure;
- `a60048432caa394ddd8ba2f5db45b175764500d4`
  - reference validation executes real coverage evaluation.

## Machine-verifiable certification rule

A replay coverage certification may become `CERTIFIED` only when all five conditions are objectively true:

1. dependency graph complete;
2. materialization digest complete;
3. derived runtime full-replay coverage complete;
4. reference dataset pins complete;
5. Enterprise Template binding complete.

No service is allowed to promote incremental safety merely because Full Replay matched.

## Current conservative evidence model

The evaluator currently proves from database state:

### Materialization digest coverage

The checkpoint must originate from:

`FULL + COMPLETED + validation_status=MATCH`

and the checkpoint materialization digest must equal the source replay `after_digest`.

The checkpoint must explicitly cover the current Economic Runtime materialization families:

- ledger_entry;
- ledger_balance;
- cost_result;
- allocation_relation;
- valuation_position;
- valuation_result;
- work_item.

### Enterprise Template binding

The checkpoint template identity must equal the current bound:

`<templateCode>@v<version>:<semanticDigest>`.

The reference seed already publishes and binds:

`enterprise-core@v1`

to `EVO_DEMO`.

### Reference dataset pins

All completed valuation runs that used a RateDataset must have an exact:

`datasetId + version + digest`

match in the checkpoint reference-dataset pins.

A scenario with no used rate dataset is complete only when both expected and checkpoint pin sets are empty.

## Intentionally still false

The evaluator currently keeps these false regardless of partial evidence:

- `dependencyGraphComplete`;
- `derivedRuntimeReplayComplete`.

Reason:

Partial dependency edges do not prove full producer-family coverage.

A successful Full Replay does not prove that every Allocation / Cost / FX / Projection family was independently rebuilt and verified.

These two items require separate certification packets.

## Expected reference-scenario state

After `seed:demo → validate:demo`:

Expected true:
- materializationDigestComplete;
- templateBindingComplete;
- referenceDatasetPinsComplete.

Expected false:
- dependencyGraphComplete;
- derivedRuntimeReplayComplete.

Therefore overall certification status must remain:

`DRAFT`

and incremental mutation remains disabled.

## Next active work

`ER-C05B3.1 — Dependency Graph Coverage Certification`

Define the producer families that must emit dependency edges and certify each family from real runtime evidence.

Initial required families:

1. Posting / Projection;
2. Allocation;
3. Cost / Valuation;
4. FX period-end valuation;
5. FX realized settlement;
6. materialization dependency where impact propagation requires it.

Do not change `dependencyGraphComplete=true` until all required families have machine-verifiable evidence.


## ER-C05B3 certification checkpoint

Commit:

`a60048432caa394ddd8ba2f5db45b175764500d4`

GitHub Actions:

`CI run 35331385514 — SUCCESS`

Certified pipeline includes:

`migrate → typecheck → build → test → seed:demo → validate:demo`

Machine-verifiable result for the reference scenario:

- materialization digest coverage: certified by runtime evidence;
- Enterprise Template binding: certified by bound `enterprise-core@v1`;
- reference dataset pin coverage: certified for datasets actually used by completed valuation runs;
- dependency graph completeness: intentionally not certified yet;
- derived-runtime Full Replay coverage: intentionally not certified yet.

Overall ReplayCoverageCertification therefore remains `DRAFT`.

Design refinement:

Calculation dependency edges are derived/rebuildable indexes.

For Posting / Work Projection families, prefer rebuilding dependency edges from committed authoritative projection/materialization rows rather than coupling dependency-index writes into the canonical posting transaction. A missing/rebuildable dependency index must never make BusinessData or LedgerEntry non-canonical.


---

# 30. ER-C05B3.1 — Dependency Graph Coverage Certification — IMPLEMENTED / CI PENDING

Implementation commits:

- `95b1bd7dde900c75141b0db3a707776424b207a6`
  - dependency graph rebuilder contract;
- `d3a8aac04a5560b96ba73b7fc33a0609d9d395f5`
  - explicit producer-family split, including separate FX period-end and FX realized settlement families;
- `ee03db111901476da20c89197c335b54cf8e368d`
  - rebuild dependency graph from committed runtime state;
- `f0f5946eada3ae05ee3ec8855f34da7581eb9130`
  - ReplayCoverageCertification derives graph completeness from real family evidence;
- `c6afab2740647da1c7b9b8f3d9941e358bcd7a49`
  - dependency graph rebuilder exposed through EVO runtime;
- `a1f6f030fa9f8afb9ed6240f4ad72af1deb3aa5d`
  - reference enterprise gains canonical customer-payment command and explicit FX settlement AllocationPolicy;
- `1fa7a9f2034f1d428c63603e3bf0c85e0f646e1f`
  - reference validation exercises FX period-end + realized settlement after the verified Full Replay checkpoint.

## Producer families

Dependency graph completeness now requires all of:

1. `POSTING_PROJECTION`
2. `ALLOCATION`
3. `COST_VALUATION`
4. `FX_PERIOD_END`
5. `FX_REALIZED_SETTLEMENT`
6. `WORK_PROJECTION`

The rebuilder reconstructs these edges from committed canonical/derived runtime rows.

Important design rule:

> CalculationDependencyEdge is a rebuildable impact/provenance index. It must not become a prerequisite for committing BusinessData or LedgerEntry.

## Reference FX coverage scenario

The reference validation now performs the following **after** the already-verified Full Replay checkpoint:

1. publish immutable USD→CNY period-end RateDataset;
2. interpret the sales-order receivable as a foreign open position;
3. run period-end revaluation:
   - USD 1000,
   - carrying CNY 7000,
   - period-end rate 7.2,
   - delta = CNY 200;
4. create canonical `customer_payment.received` BusinessData through Command;
5. preserve explicit source-selection intent with AllocationInstruction;
6. close the position using:
   - settlement foreign = USD 1000,
   - post-revaluation carrying = CNY 7200,
   - settlement local = CNY 7300,
   - realized FX delta = CNY 100;
7. rebuild dependency graph;
8. require every producer family count > 0.

The FX scenario intentionally runs after the verified replay checkpoint.

Reason:

The current Full Replay orchestrator does not yet rebuild generic FX valuation/settlement derived state.

Running FX before the checkpoint would correctly expose a replay digest mismatch and would break the already-certified B2 checkpoint.

Therefore B3.1 producer coverage and B3.2 derived-runtime replay coverage remain separate certification gates.

## Current CI status

Commit under certification:

`1fa7a9f2034f1d428c63603e3bf0c85e0f646e1f`

GitHub Actions:

`CI run 35331926544 — IN PROGRESS`

Do not mark B3.1 CLOSED until this run is green.

## Next after green

`ER-C05B3.2 — Derived Runtime Full-Replay Coverage`

Primary architecture problem:

Full Replay currently rebuilds Posting and pinned Cost, but generic FX period-end / FX settlement execution inputs are not yet represented as deterministic replay instructions that can be automatically re-executed.

The next packet must decide and implement how derived interpretation runs are replayable without replaying Commands or treating derived rows as canonical truth.


---

# 31. ER-C05B3.1 — Dependency Graph Coverage Certification — CLOSED

Certified implementation checkpoint:

`1fa7a9f2034f1d428c63603e3bf0c85e0f646e1f`

GitHub Actions:

`CI run 35331926544 — SUCCESS`

Certified behavior:

- dependency graph is rebuildable from committed runtime state;
- producer-family coverage is explicit and machine-verifiable;
- reference scenario exercises all six required producer families:
  - POSTING_PROJECTION;
  - ALLOCATION;
  - COST_VALUATION;
  - FX_PERIOD_END;
  - FX_REALIZED_SETTLEMENT;
  - WORK_PROJECTION;
- FX period-end reference result:
  - USD 1000;
  - carrying CNY 7000;
  - period-end rate 7.2;
  - revaluation delta CNY 200;
- canonical customer-payment BusinessData is created through Command;
- explicit FX settlement source intent is preserved through AllocationInstruction;
- realized settlement reference result:
  - post-revaluation carrying CNY 7200;
  - settlement local CNY 7300;
  - realized FX delta CNY 100;
- dependencyGraphComplete becomes true only after all producer families are actually exercised.

Incremental replay remains disabled.

The pre-FX checkpoint correctly becomes insufficient for later FX RateDataset pins, proving that dependency-graph completeness alone does not imply checkpoint safety.

## Next active packet

`ER-C05B3.2 — Derived Runtime Full-Replay Coverage`

Question:

How should deterministic derived interpretations such as Cost, FX period-end valuation and FX realized settlement be represented as replayable instructions so Full Replay can reconstruct them without:

- re-executing Commands;
- treating prior derived result rows as canonical truth;
- relying on mutable “latest policy/rate” lookup?

The next step is to evaluate the existing valuation-request abstraction before introducing any new persistence model.


---

# 32. ER-C05B3.2A — Canonical FX Period-End Replay — CLOSED

Verified implementation checkpoint:

`bf706e15f39ef67ef2ac64eae21d24a296038122`

GitHub Actions:

`CI run 35332507393 — SUCCESS`

Certified architecture:

`Command (decision time only)`
` → canonical BusinessData: valuation.requested`
` → pinned PositionDefinition + RateDataset + Policy`
` → ValuationRequestInterpreter`
` → derived FX valuation_run / valuation_result`

During Full Replay:

- Command is **not** re-executed;
- canonical `valuation.requested` BusinessData survives;
- previous FX valuation derived state is deleted;
- Posting is rebuilt to the same replay boundary;
- pinned Cost is rebuilt;
- canonical valuation requests are scanned in `posting_sequence` order;
- the request is re-interpreted;
- FX period-end valuation result is rebuilt;
- Economic Runtime digest remains MATCH.

## New durable components

- `PostgresFxPositionResolver`
  - reconstructs FX position input from canonical BusinessData + pinned PositionDefinition;
- `ValuationRequestReplayService`
  - scans canonical `valuation.requested` BusinessData inside replay boundary;
  - invokes the deterministic interpreter;
- reference `fx_receivable` PositionDefinition;
- dedicated `valuation` application and `request-valuation` Command in the reference enterprise.

Reference period-end result remains:

- foreign open position: USD 1000;
- canonical carrying basis: CNY 7000;
- pinned period-end rate: 7.2;
- rebuilt carrying value: CNY 7200;
- delta: CNY 200.

## Important architectural result

A derived interpretation run is replayable when its **request is canonical and fully pinned**.

The durable input is not the old `valuation_run` or `valuation_result`.

The model is:

`Canonical interpretation request + canonical facts + pinned definitions/datasets/policies → derived run/result`.

This is now proven for FX period-end valuation.

## Next active sub-packet

`ER-C05B3.2B — Canonical FX Realized Settlement Replay`

Required proof:

- canonical payment BusinessData;
- canonical AllocationInstruction;
- canonical valuation.requested settlement instruction;
- pinned PositionDefinition + AllocationPolicy;
- position resolver uses previously rebuilt period-end carrying value;
- Full Replay regenerates allocation relation + realized FX valuation result;
- replay digest remains MATCH.


---

# 33. ER-C05B3.2B — Canonical FX Realized Settlement Replay — IN PROGRESS

Durable implementation completed so far:

- `dd43e27dde65938b4c9cf9edaba735719b689a4a`
  - valuation_run now carries `request_business_data_id` lineage to canonical valuation.requested;
- `b6b89a5fe26db71a445a276f2bcd54e845d20dbf`
  - valuation.requested is now a discriminated union:
    - FX_PERIOD_END;
    - FX_REALIZED_SETTLEMENT;
- `77f2ebf17a0df76d4cd6347d2c787189fedb8506`
  - strong parser for canonical settlement request pins;
- `f9e60af6c8bff347a6066dc34b32b3beebc2f44c`
  - FX PositionResolver carries forward prior rebuilt period-end carrying value;
- `9d9fc80f1a1abf70bdd81650e392578f4e49fe53`
  - settlement interpreter verifies canonical payment fact + AllocationInstruction + AllocationPolicy and maps payment measurements;
- `386183da431c92666e68bb0e7fceeed9b5a09145`
  - settlement interpreter wired into EVO runtime;
- `1e727db2e0465cf52deb78382b3fe7bd748e00ef`
  - reference sales-order posting is isolated from payment facts by explicit eventKind;
- `1246fa50929dfcaa0bb63269d33aa0b614c53a03`
  - reference scenario places payment + settlement request inside Full Replay boundary;
- `ce3aa5b13c12b4de1515faf2ff5553681289b0d7`
  - ReplayCoverageCertification now verifies derived-runtime execution inside the source Full Replay time window rather than hard-coding false;
- `09d9290beffacbee78e849da60caba4a798fec5d`
  - architecture manifest explicitly declares valuation → business-data dependency.

## Frozen canonical settlement request

`valuation.requested / FX_REALIZED_SETTLEMENT` now pins:

- valuation effective time;
- PositionDefinition id/version/digest;
- position scope;
- canonical settlement BusinessData id;
- AllocationPolicy id/version;
- AllocationInstruction id;
- field mapping for:
  - settlement foreign value/unit;
  - settlement local value/unit.

The request does **not** copy prior valuation results or mutable open balances.

## Replay sequence

Within one Full Replay boundary:

1. canonical sales-order fact rebuilds base FX receivable position;
2. canonical FX_PERIOD_END valuation.requested rebuilds period-end carrying value;
3. canonical payment fact remains business truth;
4. canonical AllocationInstruction preserves explicit source-selection intent;
5. canonical FX_REALIZED_SETTLEMENT valuation.requested resolves the same position;
6. PositionResolver overlays the already-rebuilt prior period-end carrying basis;
7. settlement interpreter rebuilds AllocationRelation + realized FX valuation result.

Reference expected values:

- initial carrying: CNY 7000;
- period-end rate: 7.2;
- rebuilt carrying after period-end: CNY 7200;
- actual settlement local amount: CNY 7300;
- realized FX delta: CNY 100.

## Machine certification rule added

`derivedRuntimeReplayComplete` may become true only when:

- source replay is FULL / COMPLETED / MATCH;
- every canonical valuation.requested inside the replay boundary has exactly one matching COMPLETED valuation_run;
- that valuation_run is linked by `request_business_data_id`;
- the matching run started/completed inside the source Full Replay execution window;
- FX settlement requests also regenerate a COMPLETED AllocationRelation matching:
  - settlement BusinessData;
  - instruction id;
  - allocation policy id/version;
- pinned CostRun is also regenerated inside the same Full Replay window when cost_method is present.

No prior derived result row is accepted as replay input.

## Current certification state

Implementation is complete enough for end-to-end CI, but **B3.2B is not closed yet**.

Pending proof:

`migrate → typecheck → build → tests → seed:demo → validate:demo`

must complete green with:

- period-end delta = 200;
- realized settlement delta = 100;
- Full Replay digest MATCH;
- dependencyGraphComplete = true;
- derivedRuntimeReplayComplete = true;
- materializationDigestComplete = true;
- referenceDatasetPinsComplete = true;
- templateBindingComplete = true;
- ReplayCoverageCertification status = CERTIFIED.

Checkpoint `safeForIncremental` must still remain false until a separate explicit promotion step.


---

# 34. CORRECTED — CI certification scope

Correction date: 2026-09-18

Earlier continuation notes described several successful GitHub CI runs as if the workflow had executed:

`migrate → typecheck → build → test → seed:demo → validate:demo`.

That description was inaccurate.

Direct inspection of:

`.github/workflows/ci.yml`

showed that the workflow at those checkpoints actually executed only:

`migrate → typecheck → build → test`.

Therefore:

- those green runs remain valid compile/unit-test evidence;
- they are **not** accepted as end-to-end reference-enterprise certification evidence;
- prior architecture conclusions are not reverted, but their CI evidence level is corrected.

Correction commit:

`a8235baaa4c7a39c7e4e659663acb8e046186cb1`

The CI workflow now explicitly includes:

`npm run seed:demo`
`npm run validate:demo`

after unit tests.

From this correction forward:

> A work packet that claims reference-enterprise or replay integration certification is CLOSED only when the GitHub workflow including seed:demo + validate:demo is green.

## ER-C05B3.2B current status after correction

Status remains:

`IN PROGRESS / AWAITING TRUE END-TO-END CI`

Do not mark canonical FX settlement Full Replay CLOSED based solely on the previous unit-test-only green runs.

The next accepted evidence must be a GitHub CI run produced after commit `a8235baa...` with both reference-enterprise steps successful.


---

# 35. True E2E CI defect #1 — PositionDefinition JSONB array encoding

First corrected end-to-end workflow:

`CI run 35333389052`

Verified before failure:

- migrate — PASS;
- typecheck — PASS;
- build — PASS;
- unit tests — PASS.

First real reference-enterprise failure:

`seed:demo — FAIL`

PostgreSQL error:

`22P02 invalid input syntax for type json`

Root cause:

`PostgresPositionDefinitionStore.publish()` passed object arrays directly for the JSONB columns:

- `dimensions`;
- `source_rules`.

The PostgreSQL driver encoded those JavaScript arrays as PostgreSQL array literals rather than JSON text, so JSONB parsing failed.

This defect had not been exercised by unit tests and was discovered only after `seed:demo` became a mandatory CI step.

Fix:

`8f7dc807909a0ab73b5d9731cbc85e06b17e65c8`

The store now explicitly serializes those arrays as JSON and casts them to JSONB at the persistence boundary.

New true E2E run:

`35401050549`

Status at this checkpoint:

`IN PROGRESS`

Do not close ER-C05B3.2B until this or a later workflow passes both:

`seed:demo`
`validate:demo`.


---

# 36. PostgreSQL JSONB array persistence invariant

True E2E execution exposed a driver-boundary rule that must be preserved.

## Problem

Passing a JavaScript array of objects directly through the PostgreSQL/Kysely driver to a `jsonb` column can be encoded as a PostgreSQL array literal instead of JSON text.

Observed failure:

`22P02 invalid input syntax for type json`

## Correct persistence rule

For JSONB columns whose runtime value is an array:

`JSON.stringify(value) → ::jsonb`

must be explicit at the PostgreSQL persistence boundary.

Object-valued JSONB fields may continue using the normal object path when the driver serializes them correctly.

## Corrected stores

- `PostgresPositionDefinitionStore`
  - dimensions;
  - source_rules;
  - fix: `8f7dc807909a0ab73b5d9731cbc85e06b17e65c8`

- `PostgresAllocationStore`
  - allocation_relation.measurements;
  - fix: `86bf5c32225c623d98f3d9eb7df8ef0f9f42fdc2`

- `PostgresValuationStore`
  - valuation_result.source_business_data_ids;
  - valuation_result.source_measurements;
  - valuation_result.target_measurements;
  - fix: `dff7fb0cdcf6c7d7de5c70550c4e85d110bc0669`

This is a persistence implementation invariant, not an Economic Runtime semantic rule.

## Current ER-C05B3.2B status

Still:

`IN PROGRESS / TRUE E2E REQUIRED`

The next accepted evidence is a GitHub workflow against the latest fixes where:

- seed:demo passes;
- validate:demo passes;
- Full Replay digest MATCH;
- ReplayCoverageCertification = CERTIFIED.


---

# 37. Current database design dictionary — SAVED

New learning/engineering reference document:

`docs/architecture/database/EVO-CURRENT-DATABASE-DESIGN-v0.1.md`

Commit:

`1eec9f1e299af98ef3a5e80745abccde6d19ecf5`

Purpose:

- explain the current physical PostgreSQL design in Chinese;
- make the database understandable to the project owner and future LLMs;
- explicitly distinguish canonical facts, canonical instructions/bindings, versioned definitions/policies, execution/audit records, derived results/projections and materializations/indexes;
- provide a versioned snapshot instead of pretending the current schema is final.

Current verified code-side counts:

- PostgreSQL tables: **60**
- fields: **635**
- migration infrastructure table: **1** (`schema_migrations`)
- EVO system/business/runtime tables: **59**
- schema migration SQL files: **15**
- declared DB schema version: **13**

Authoritative sources used:

- `platform/database/src/types.ts`
- `migrations/schema/*.sql`
- `scripts/migrate.ts`

Maintenance rule:

When table/field structure materially changes, create/update a newer database-design snapshot version and preserve the previous stage as genealogy. Do not silently rewrite the meaning of the current-stage snapshot.


---

# 38. Progress reporting now requires business + technical views

New current-stage status document:

`docs/architecture/status/EVO-CURRENT-PROGRESS-BUSINESS-AND-TECH-v0.1.md`

Commit:

`e559fa41971c51ea4b7d12d71a68a8c3e5eb936d`

From this point forward, major EVO progress reports must not consist only of work-packet names, commits, CI runs and architectural terminology.

Every important progress update must include:

1. **业务问题** — what enterprise problem is being solved;
2. **业务能力** — what the enterprise gains when the packet is complete;
3. **技术路线** — how EVO represents/implements the capability;
4. **验证等级** — distinguish implemented / unit verified / E2E verified / certified;
5. **当前还差什么** — do not equate code-complete with capability-complete;
6. **下一步及业务原因** — explain why the next technical task matters to enterprise operation.

Current one-line project state in business language:

EVO has completed the current core Economic Runtime semantic archaeology and architecture freeze and is now certifying the new TypeScript/PostgreSQL runtime end-to-end. The active proof is whether a foreign-currency receivable can be period-end revalued, explicitly settled against its source, and then have all derived allocation/valuation/projection state deleted and reconstructed from canonical business facts, explicit settlement intent and pinned policies/reference data with an identical Economic Runtime digest.

After this gate closes, the main line moves from Full Replay correctness to safe Checkpoint Promotion / Incremental Replay so backdated corrections and rule changes can be recalculated efficiently in long-running enterprises.


---

# 39. Cross-chat continuity + bilingual database documentation — SAVED

## 39.1 Cross-chat context protocol

New additive protocol:

`docs/architecture/continuity/EVO-CROSS-CHAT-CONTEXT-PROTOCOL-v0.1.md`

Commit:

`de01318254956bf5ef4f0d1ebbd1fa578da61aaa`

Purpose:

- make repository-backed context authoritative over chat memory;
- require a Context Handshake in every future EVO chat window;
- preserve Stage 0→1→2→3 genealogy without rereading all original chats;
- require business + technical state to travel together;
- create additive Context Checkpoints before/when changing long chat windows;
- support future LLM/model replacement without relying on hidden memory.

Core rule:

`Repository reality > chat memory.`

## 39.2 First durable Context Checkpoint

New additive checkpoint:

`docs/architecture/continuity/checkpoints/EVO-CONTEXT-CHECKPOINT-2026-09-19-v0.1.md`

Commit:

`3629a5fc6da65e8d52a54c5f320bfdc42f44456a`

It records:

- current business objective;
- current technical architecture;
- closed gates;
- active packet ER-C05B3.2B;
- true E2E validation standard;
- current typecheck blocker after JSONB-array persistence correction;
- exact next execution order;
- minimum document set for a new-chat Context Handshake.

This checkpoint must never be overwritten. Future handoffs create new checkpoint versions/files.

## 39.3 Database bilingual snapshot v0.2

Chinese-only current-stage snapshot remains unchanged:

`docs/architecture/database/EVO-CURRENT-DATABASE-DESIGN-v0.1.md`

New additive bilingual snapshot:

`docs/architecture/database/EVO-CURRENT-DATABASE-DESIGN-BILINGUAL-v0.2.md`

Commit:

`e5144a7bfa7f1d35c93552926934d0f06a5f36a0`

Coverage:

- 60 tables;
- 635 fields;
- Chinese + English table explanations;
- Chinese + English field explanations;
- bilingual semantic-role and maintenance guidance.

Documentation genealogy:

```text
v0.1 Chinese snapshot
      ↓ additive
v0.2 Chinese-English bilingual snapshot
      ↓
future v0.3 / v0.4 ...
```

No existing database-design or continuity document was overwritten for this work.


---

# 40. ER-C05B4 progress — Promotion certified, Incremental Generation substrate started

## 40.1 ER-C05B4.1 — CLOSED / CERTIFIED

Certification:

`docs/architecture/certification/ER-C05B4.1-CHECKPOINT-PROMOTION-CERTIFICATION-v0.1.md`

Certified implementation head:

`c13269a197c50bf1cf190e5d1c8032405a33fee6`

True E2E run:

`35404542720 — SUCCESS`

Proven:

- original ReplayCheckpoint remains `safeForIncremental=false`;
- ReplayCoverageCertification is independently CERTIFIED;
- explicit `replay_checkpoint_promotion` authorizes use of the checkpoint;
- promoted read view becomes `safeForIncremental=true`;
- IncrementalReplayPlanner selects only promoted checkpoints;
- planner does not fall back when promotion and semantic scope are valid;
- promotion is auditable and revocable.

Schema v14 added:

`replay_checkpoint_promotion`

Database snapshot after v14:

- 61 tables;
- 651 fields.

Bilingual delta:

`docs/architecture/database/EVO-CURRENT-DATABASE-DESIGN-BILINGUAL-v0.3.md`

## 40.2 ER-C05B4.2 architecture finding

A real Incremental Replay cannot safely be implemented as:

`delete suffix rows → rebuild suffix`

because completed CostRun / AllocationRun / ValuationRun may have originally produced both prefix and suffix outputs. Partially deleting their results would leave false audit lineage even if final balances happened to match.

ADR:

`docs/architecture/decisions/2026-09-19-incremental-replay-materialization-generation-v0.1.md`

Frozen direction:

> derived state must belong to an explicit materialization generation / Economic Runtime Dataset so a candidate interpretation can be built and verified without corrupting the currently active interpretation.

## 40.3 B4.2 decomposition

Main line is now:

```text
B4.2A Economic Runtime Generation substrate
→ B4.2B Checkpoint prefix-state restore
→ B4.2C real suffix recompute + Full Replay equivalence
```

Do not implement a fake Incremental Replay that internally performs Full Replay and merely changes the label.

## 40.4 Economic Runtime Dataset substrate

Contract:

`modules/replay/api/runtime-dataset.ts`

Schema migration:

`migrations/schema/202609190010_economic_runtime_dataset.sql`

Service:

`modules/replay/infrastructure/postgres-economic-runtime-dataset-service.ts`

DB Schema Version:

`15`

Dataset lifecycle:

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

Candidate binds:

- parent active dataset;
- promoted checkpoint;
- checkpoint promotion;
- incremental plan digest;
- start/boundary sequence.

A failed candidate never replaces current production state.

## 40.5 Current E2E validation

Reference validation now includes the EconomicRuntimeDataset lifecycle but does NOT yet claim module-level candidate isolation or actual incremental execution.

Current target head:

`69513bc771adcfa48b577a3126d4f1f462aec938`

Target workflow:

`35405169593`

At this checkpoint the workflow is still running (npm install stage after runner initialization).

Already verified separately:

- migration/contract/type/service commits before the final reference assertion have produced green CI;
- the remaining proof is the complete E2E lifecycle assertion at the target head.

## 40.6 Next after lifecycle green

Do not jump directly to IncrementalReplay execution.

Next engineering packet:

1. scope derived families to EconomicRuntimeDataset generation;
2. converge existing `ledger_dataset` under/with the parent generation;
3. preserve immutable completed Run semantics;
4. define minimum Checkpoint prefix state, especially Cost pool state:
   - FIFO/LIFO layers;
   - Moving Average quantity/value pool;
   - Specific-ID source state;
   - valuation carrying state;
5. build isolated candidate suffix;
6. only then compare candidate digest to independent Full Replay digest.

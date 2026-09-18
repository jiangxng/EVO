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

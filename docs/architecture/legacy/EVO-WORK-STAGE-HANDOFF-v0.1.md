# EVO Work Stage Handoff — Chat Lineage 0→1→2→3

**Status:** ACTIVE STAGE CHECKPOINT  
**Version:** v0.1  
**Date:** 2026-09-18  
**Branch:** `evo/apm-certification-enterprise-template-v0.1`  
**Base commit before this handoff:** `6aa272a808bce1d813a1ee43fe4f06aa577cf582`  
**Scope:** EVO project origin → Architecture Convergence → Enterprise Package / Enterprise Template → legacy semantic archaeology → Economic Flow / Matching / Allocation / Cost / Valuation convergence  
**Purpose:** let a new chat/LLM recover the complete current work stage without replaying the four long chat windows.

---

## 0. Chat lineage and use rule

The work evolved through four user-confirmed chat windows in this strict order:

| Stage | Chat lineage id | Role |
|---|---|---|
| 0 | `6a8ff0bd…` | original/main EVO work window |
| 1 | `6aab9633…` | first branch — broad legacy/economic-flow semantic convergence |
| 2 | `6aabf5d5…` | second branch — WaterBal/TbMatched + Matching/Component genealogy |
| 3 | `6aacb907…` | current branch — runtime closure + Allocation/Cost genealogy |

These chat identifiers are preserved only as lineage labels. The repository, not chat history, is the durable source of truth.

A future LLM MUST recover context in this order:

`Stage 0 → Stage 1 → Stage 2 → Stage 3 → current continuation plan`

Do not collapse Stage 1/2/3 into one generic “semantic archaeology” phase; each stage changed the evidence level and confidence of the model.

---

# 1. Stage 0 — original EVO architecture and execution baseline

## 1.1 Project origin

EVO was started as an AI-native enterprise operating system / ERP foundation.

The user explicitly delegated architecture and technical leadership to the assistant/LLM, while keeping execution/verification visible and repository-backed.

The goal is an industry-agnostic, modular enterprise system that can grow across full enterprise processes, support installable business applications/templates, and survive long-term LLM/model changes without depending on chat memory.

## 1.2 Original core semantics

The early architecture established these durable ideas:

- business history is preserved;
- correction/cancellation/reversal is additive, not destructive rewriting;
- transaction/business occurrence data is distinct from metadata/definitions;
- `TransactionType ≠ Application`;
- one business occurrence may affect multiple operational and financial ledgers;
- ledgers are generic governed accumulators, not finance-only accounts;
- balances are derived from occurrence/entry history;
- Posting rules are versioned;
- historical posting can be replayed under governed rules;
- cost is recalculable;
- FIFO, LIFO, weighted/average and specific-identification must be supportable;
- real-time posting and historical replay cannot race against each other;
- replay must be deterministic and observable.

These requirements predate later names such as Economic Flow / Allocation / Valuation and remain binding.

## 1.3 Repository-bootstrap correction

A major early correction occurred when the live GitHub repository was inspected and found not to contain the previously discussed/virtual implementation state.

**CORRECTED:** chat-produced architecture/code cannot be treated as “already in the repository.”

From that point:

> GitHub/repository state is the engineering baseline; chat is a working buffer.

This directly led to stronger repository-first context, machine-readable manifests, architecture docs and repeatable build/test/bootstrap discipline.

## 1.4 LLM Context Determinism

By the alpha stage the repository explicitly carried LLM-readable architecture/context assets such as:

- philosophy;
- concepts;
- invariants;
- public API;
- LLM guidance;
- context manifest / dependency boundaries.

The purpose was not documentation polish. It was to let another LLM continue work inside bounded modules without rereading the whole project history.

## 1.5 EVO / EC / Eidos Architecture Convergence

Stage 0 later converged the three-system boundary to:

> **EC thinks and learns. EVO executes. Eidos interacts.**

### EVO owns

- authoritative enterprise/business facts;
- active governed definitions;
- Command admission and execution;
- authorization relevant to execution;
- deterministic Posting / Ledger / Balance;
- Cost / Valuation execution under pinned versions;
- Work/runtime state;
- Replay/recalculation;
- governed Query;
- authoritative Observation/Outcome.

### EC owns

- learning;
- long-term knowledge/experience;
- context compilation;
- diagnosis/reasoning;
- proposals/recommendations;
- industry/domain intelligence.

EC can propose change; it does not directly mutate EVO truth.

### Eidos owns

- interaction;
- experience rendering / UIDL;
- user approval/input;
- host-neutral ActionRequest.

Eidos does not own business truth and does not bypass EVO Command admission.

## 1.6 Cross-repository contract rule

Cross-repository integration was constrained to versioned Public Contracts.

The architectural chain became:

`EVO Observation`
` → EC diagnosis/proposal`
` → Eidos decision experience`
` → human approval where required`
` → host-neutral ActionRequest`
` → EVO independent authorization/revalidation`
` → Command`
` → authoritative Fact / Observation / Outcome`

Important protections include:

- idempotency;
- stale-state / TOCTOU defense;
- explicit base/version semantics;
- proposal ≠ Command;
- ActionRequest ≠ pre-authorized Command;
- Replay ≠ Simulation.

## 1.7 APM vertical-slice lesson

An APM / alternate-supplier scenario was used to exercise the public boundary.

A Convergence-side candidate implementation was created and proved executable, but this also produced an important governance correction:

**CORRECTED:** cross-repo certification/convergence work must not silently define EVO internals.

The candidate PR/runtime was therefore treated as reference evidence for EVO-owner review, not as automatic canonical architecture.

Reusable mechanisms such as schema validation, idempotency, TOCTOU defense and certification fixtures were valuable; APM-specific runtime hard-coding was not allowed to define generic EVO semantics.

## 1.8 Enterprise Package / Enterprise Template

The next convergence step made domain/application definitions portable and governed.

The intended model became:

`authoritative EVO metadata`
` → deterministic Enterprise Package`
` → Validate`
` → Plan/Diff`
` → Human Review / Authorization`
` → governed Deploy`

Command input schema began deriving from authoritative field semantics to prevent a second drifting business schema.

Then versioned Enterprise Template semantics were established:

`EnterpriseTemplate → TemplateVersion → EnterpriseBinding`

Stable runtime properties proven by the branch included:

- explicit version pinning;
- v1/v2 publishing;
- explicit binding/upgrade;
- digest consistency;
- restart persistence;
- published version immutability.

Representative checkpoint/fix commit:

`72f88f684f5e5eb915eb172b8e210555f272242c`
— certification tests aligned with runtime contracts.

## 1.9 Why Stage 0 branched into Stage 1

Enterprise Package/Template was structurally generic, but “generic” was not yet proven against the real semantic complexity accumulated in Asloop/bookkeeping.

The user required that roughly eleven years of historical enterprise design/detail not be lost simply because a new model was cleaner or chat context was limited.

This changed the question from:

> “Can we build a generic template?”

to:

> “Can EVO preserve and re-express the real enterprise semantics of the legacy systems without importing their implementation coupling?”

That is the entry point to Stage 1.

---

# 2. Stage 1 — broad legacy archaeology and Economic Flow separation

## 2.1 Archaeology principle

Asloop-Backend and bookkeeping were reclassified as **historical semantic evidence**, not implementation templates.

Canonical rule:

> Preserve business meaning, validated behavior and lineage; redesign implementation boundaries.

Evidence layers:

`Implementation code → Physical schema → Metadata/configuration → Historical/business data`

This stage established lossless archaeology/governance rather than ad-hoc migration.

## 2.2 Asloop versus bookkeeping responsibility

Stage 1 clarified that:

- Asloop is the broader enterprise system and contains metadata/forms/views/processes/sales/purchase/manufacturing/MRP/WMS/accounting/calculation assets;
- bookkeeping is a later, narrower bookkeeping/cost runtime extraction;
- bookkeeping can validate/simplify accounting/cost semantics but does not supersede the larger Asloop enterprise definition corpus.

**CORRECTED:** absence from bookkeeping is not evidence that an Asloop enterprise definition is obsolete.

## 2.3 Quantity / physical flow versus money/value flow

A major semantic correction happened in Stage 1.

**CORRECTED:** a legacy field called `amount` cannot automatically be interpreted as “money moved.”

The stronger separation became:

### Physical/resource flow

- quantity-primary;
- may carry value;
- value can be unknown/provisional/derived later.

### Monetary/cash flow

- value-primary;
- does not require physical quantity.

### Valuation

- interpretation assigning value to an economic/resource fact under a pinned rule/dataset/rate.

Therefore:

`physical flow ≠ monetary flow ≠ valuation`

and conversion between them must preserve bidirectional lineage.

## 2.4 Foreign currency as a resource candidate

Stage 1 introduced a strong candidate interpretation:

- foreign currency held/acquired can behave like a quantity-bearing economic resource;
- exchange/settlement is a conversion event;
- rates need semantic roles rather than one generic `exchangeRate`;
- revaluation must not rewrite the underlying resource-flow fact.

Precise FX/settlement behavior remained unresolved.

## 2.5 Fact before monetary interpretation

Legacy bookkeeping evidence showed that a business occurrence can exist before a final monetary cost/value is known.

This produced the working requirement:

> A valid immutable business/economic fact may have unresolved or provisional value; valuation is an interpretation step, not a prerequisite for fact existence.

This is the origin of the later separation between Fact / CostBasis / Valuation / Projection.

## 2.6 Materialization versus truth

Stage 1 also recovered intentional mutable/materialized structures from legacy systems.

**CORRECTED:** legacy redundancy/materialization is not automatically bad design.

The current principle became:

> **Semantic Normalization, Physical Denormalization.**

Canonical facts and derivations must remain explicit; rebuildable balances, read models, snapshots/checkpoints, caches or materialized cost state may exist for performance if lineage/rebuild semantics are explicit.

## 2.7 Stage 1 architecture direction

The working lifecycle became approximately:

`Enterprise Reality`
` → Business Fact`
` → Economic Flow + Measurement`
` → CostBasis`
` → Cost / Valuation Run`
` → Value Lineage`
` → Accounting / Operational Projection`
` → Ledger / Balance / Materialization`

The names were not all frozen. The semantic separation was the important result.

## 2.8 Why Stage 1 branched into Stage 2

Broad convergence still did not explain the legacy matching state machine.

The hard unresolved family was:

- `qtyWaterBal`;
- `qtyLocked`;
- `qtyTbMatched`;
- amount equivalents;
- `source(...)`;
- `match(...)`;
- Component directions;
- MATCH_REL / match fields;
- ordered selection;
- proportional quantity→value propagation.

The project therefore narrowed from broad Economic Flow convergence to the concrete question:

> What does the Asloop WaterBal / TbMatched / matching mechanism actually do at runtime?

That is Stage 2.

---

# 3. Stage 2 — WaterBal/TbMatched and Matching/Component genealogy

## 3.1 Research discipline

Stage 2 explicitly avoided premature canonicalization.

The rule was:

> Recover execution semantics first; do not translate legacy field/table names directly into EVO objects.

This branch investigated:

`MATCH_REL → Component → Expression → TransactionType → execution order`

with purchase genealogy first, then sales genealogy.

## 3.2 Candidate semantic decomposition

Before runtime closure, Stage 2 already indicated that several concepts must not be collapsed:

- Occurrence;
- Position;
- open/unconsumed position;
- Reservation/Lock;
- Allocation/Matching;
- Valuation.

A generalized Allocation/Matching Kernel became a candidate, not yet a canonical contract.

## 3.3 Matching appeared broader than AR/AP settlement

Asloop configuration showed matching/calculation behavior across:

- purchase;
- inventory;
- sales;
- invoice;
- current-account/settlement;
- operational pending positions.

This was strong evidence that “matching” was not merely financial reconciliation.

The working interpretation became:

> Matching may be a generalized open-position consumption mechanism.

But runtime behavior was still incomplete at this stage.

## 3.4 Component is not a UI component

Schema/configuration archaeology established that legacy `Component` bundles contextual runtime concerns such as:

- transaction type;
- calculation relation;
- check direction;
- match direction;
- automatic/manual matching;
- stock lock;
- negative handling;
- parent relation;
- merge;
- location/position policy;
- filters;
- source selection;
- expression context;
- sort/order.

**CORRECTED:** `Component` must not be copied as one monolithic EVO object.

It likely decomposes into posting, allocation/matching, dimension/positioning, expression/verification and execution policies.

## 3.5 Schema graph was not yet runtime graph

Stage 2 preserved an important evidence boundary:

`TransactionType + CalcRelation`
` → Component`
` → FieldGroup / Mapping / Filter`
` → CalcField / Expression`
` → MatchField / MatchRelation`
` → DataCollector selection/order`

was initially only a **configuration graph**.

It was explicitly forbidden to call this the runtime call graph until implementation evidence proved execution phases/order.

## 3.6 Purchase / sales genealogy became the next gate

The branch then required two concrete closures:

### Procurement

Recover how purchase demand/order/receipt consumes one open state and produces another.

### Sales

Recover how order/issue consumes pending delivery/inventory and propagates quantity/value/cost.

The branch intentionally postponed canonical EVO changes until these genealogies closed.

## 3.7 Why Stage 2 branched into Stage 3

Stage 2 ended with strong structure but unresolved execution questions:

- exact `source` versus `match` roles;
- meaning of WaterBal versus TbMatched;
- split sequence;
- persistence of source-consumption lineage;
- significance of `c_match_rel`;
- amount propagation timing;
- how bookkeeping cost lineage compares.

Stage 3 therefore moved from schema/configuration inference to implementation/runtime closure.

---

# 4. Stage 3 — runtime closure and Allocation/Cost genealogy

## 4.1 Runtime call graph is now evidence-backed

Stage 3 located and traced the actual Asloop calculation runtime.

The verified path is approximately:

`TransactionType / App / field-group detail`
` → Component selection + filters + sort`
` → component binding / merge / validation`
` → matching-source discovery`
` → CalculatePrepare`
` → CalculateObject`
` → BalanceCalculate`
` → VerificationCalculate`
` → negative/uncovered handling`
` → merge`
` → DataStore`

This closed the Stage-2 distinction between configuration graph and runtime graph.

## 4.2 WaterBal / TbMatched semantics are now explicit

Direct runtime/model comments and expressions establish:

- `QTY_TB_MATCHED` / `AMNT_TB_MATCHED` = current residual still available to be matched/consumed;
- `QTY_WATER_BAL` / `AMNT_WATER_BAL` = stepwise residual/history through matching;
- `TRANS_MATCHED_DETAIL_ID` = matched source detail;
- `ORIGIN_ID` = source lineage, including original-source/cost tracing;
- `PARENT_ID` = source/matching lineage/positioning;
- `TRANS_MATCHED_SEQ` = matching sequence.

**NORMALIZED INTERPRETATION:**

> TbMatched is legacy current residual state; WaterBal is stepwise residual/history evidence.

EVO must preserve the source-consumption semantics, not copy these mutable fields as canonical truth.

## 4.3 Verification is materially an allocation algorithm

`VerificationCalculateImpl` iterates source rows, consumes their available measure, splits the target occurrence if one source is insufficient, then continues with later sources.

For quantity+amount:

- quantity is the split driver;
- amount/value is propagated from source residuals proportionally;
- source residuals are reduced.

High-confidence result:

> legacy matching already implements ordered source consumption/allocation.

This significantly raises confidence in an EVO Allocation primitive.

## 4.4 `c_match_rel` significance was reduced

Current release data does not support `c_match_rel` as the active runtime core.

**CORRECTED:** `MATCH_REL` is not a one-to-one ancestor of EVO Allocation.

The runtime meaning is distributed across Component, source selection, expressions, direction, verification and persisted lineage.

## 4.5 Purchase genealogy closed

Representative purchase behavior demonstrates:

`purchase demand/open position`
` → purchase order`
` → pending receipt position`
` → purchase receipt`
` → inventory + returnable + invoice/current-account/project/org consequences`

This is position consumption/creation, not status mutation.

## 4.6 Sales genealogy closed

Representative sales behavior demonstrates:

`sales order`
` → pending delivery / invoice demand / pre-receipt positions`
` → sales issue`
` → consume pending delivery + inventory`
` → create returnable / receivable / invoice positions`
` → derive revenue / sales cost / project & organization revenue/cost`

A single business occurrence fans out into multiple positions and projections.

## 4.7 bookkeeping cross-validation

bookkeeping provides a later/simpler path:

`App → Policy → TransdataAccount → Balance → CostMwa`

Evidence includes:

- quantity and amount occurrence factors remain separate;
- monetary amount may be deferred as `成本`;
- opposite-side debit/credit cost/value may be referenced;
- balance grain is metadata-defined;
- weighted average is effectively amount/quantity balance materialization;
- source-cost/material paths preserve provenance;
- cost split performs proportional allocation and deterministic residual assignment.

This independently validates exact allocation conservation as a formal policy/invariant concern.

## 4.8 Current high-confidence candidate decomposition

The current evidence supports:

### Occurrence

Immutable business/economic fact.

### Position

Derived open/current remaining state.

### AllocationRelation

Which source was consumed by which target, including allocated measures, sequence and provenance.

### AllocationPolicy

How candidates are selected/ordered, automatic versus manual choice, negative handling, precision/rounding and residual assignment.

### DerivationRelation

A dependency/value derivation that is not necessarily source consumption.

### CostBasis

Factual/governed basis for valuation.

### Valuation

Versioned interpretation assigning value under pinned policy/dataset/rate.

### Projection

Operational, management, project, organization or accounting consequence/read model.

### Materialization / Checkpoint

Rebuildable performance structure, not canonical truth.

**Important:** exact names are still candidates where not formally promoted. The semantic separation is stronger than the naming.

## 4.9 Current durable result

Stage 3 is preserved in:

`docs/enterprise-template/convergence/BATCH-05-RUNTIME-ALLOCATION-COST-GENEALOGY.md`

Commit:

`6aa272a808bce1d813a1ee43fe4f06aa577cf582`

---

# 5. Cross-stage corrections that MUST remain visible

The following are not optional stylistic preferences; they are learned corrections.

1. **Repository reality beats chat assumption.**
2. **Business history is preserved; later change is additive.**
3. **APM/reference implementations do not define EVO core.**
4. **Asloop/bookkeeping are semantic evidence, not table/class migration targets.**
5. **bookkeeping does not supersede broader Asloop enterprise definitions.**
6. **`amount` does not automatically mean money flow.**
7. **physical/resource flow, monetary flow and valuation are separate.**
8. **a fact may exist before final valuation is known.**
9. **legacy materialization/redundancy may preserve legitimate performance intent.**
10. **Component is not one canonical EVO object.**
11. **schema relationship graph is not automatically runtime call graph.**
12. **EFFECTIVE_TIME ordering does not by itself prove FIFO.**
13. **`lastStockOut` does not by itself prove LIFO.**
14. **`c_match_rel` is not a one-to-one Allocation mapping.**
15. **mutable WaterBal/TbMatched are not canonical facts.**
16. **business causality, allocation lineage, cost/value derivation and accounting projection are distinct graph semantics.**
17. **AllocationRelation and AllocationPolicy are distinct.**
18. **full replay is the correctness path; incremental/local recalculation is an optimization path that must prove equivalence.**

Corrections remain append-only in the genealogy. Do not erase earlier reasoning.

---

# 6. Separate order/time semantics that MUST NOT collapse

At least these orderings are distinct:

- business/effective order;
- allocation candidate/source order;
- calculation dependency order;
- posting/replay sequence;
- materialization execution order.

At least these temporal roles are distinct:

- business effective time;
- recorded/accepted time;
- interpretation run identity/time;
- projection/materialization run identity/time.

Physical storage may optimize them. Semantic boundaries must remain explicit.

---

# 7. Current unresolved architecture gates

The Economic Runtime model MUST NOT be declared frozen until these close.

## 7.1 FX / settlement / revaluation

Still unresolved:

- foreign-currency resource semantics;
- acquisition versus transaction versus valuation versus settlement rate roles;
- realized/unrealized exchange differences;
- settlement conversion;
- period-end revaluation;
- source/value lineage across conversion.

## 7.2 Manual versus automatic allocation

Need to determine which relations are:

- explicit user/business allocation facts;
- deterministic algorithm-generated interpretations;
- rebuildable residual projections.

Correction/reallocation/replay semantics depend on this distinction.

## 7.3 Cost methods

EVO must support:

- FIFO;
- LIFO;
- weighted/average;
- specific identification.

Legacy archaeology must identify useful evidence but must not invent historical support from names alone.

## 7.4 Recalculation impact scope

Need to recover and formalize:

`Change → Impact Set → Recalculation Scope → Dependency Order → Equivalence Check against Full Replay`

## 7.5 Complete Enterprise Template

Economic runtime is only one template family.

Lossless archaeology still needs:

- Forms/FormViews;
- Lists/ListViews;
- menus/navigation;
- reports/dashboards;
- process/workflow;
- permissions;
- other enterprise definition families.

A “complete Enterprise Template” cannot mean “complete accounting template.”

---

# 8. Durable documents a new chat should load

## L0 — project intent / ownership

- `docs/architecture/EVO-13-Enterprise-Operating-Model-Convergence-v0.2.md`
- this handoff.

## L1 — current architecture decisions

- `docs/architecture/decisions/2026-09-17-economic-flow-valuation-and-materialization.md`
- relevant ADRs/interfaces/invariants.

## L2 — archaeology memory

- `docs/architecture/legacy/LEGACY-ARCHAEOLOGY-WORK-METHOD-v0.1.md`
- `docs/architecture/legacy/LEGACY-CALCULATION-GENEALOGY-v0.1.md`
- `docs/architecture/legacy/LEGACY-ARCHAEOLOGY-BACKFILL-2026-09-17.md`.

## L3 — current evidence batches

- `BATCH-01-FIELD-TRANSACTION-LEDGER-OBSERVATIONS.md`
- `BATCH-02-EXPRESSION-SEMANTICS.md`
- `BATCH-03-LEDGER-MEASURE-DIMENSION-CONVERGENCE.md`
- `BATCH-04-MATCHING-COMPONENT-GENEALOGY.md`
- `BATCH-05-RUNTIME-ALLOCATION-COST-GENEALOGY.md`.

Only after these should raw Asloop/bookkeeping files be reopened for a named evidence gap.

---

# 9. New-chat bootstrap summary

A future chat can bootstrap from this compact statement:

> EVO is a deterministic, repository-first enterprise execution kernel. Business history is preserved; definitions/rules are versioned; replay and cost recalculation are first-class. EC thinks/learns, EVO executes, Eidos interacts. Enterprise Packages/Templates are governed/versioned definitions, not domain-specific runtime hard-coding. Legacy Asloop/bookkeeping are being mined losslessly as semantic evidence. Current archaeology has proven that legacy WaterBal/TbMatched matching is an ordered source-consumption/allocation mechanism and that bookkeeping confirms deferred cost/value derivation and allocation conservation. The current candidate model separates Occurrence, Position, AllocationRelation, AllocationPolicy, Derivation, CostBasis, Valuation, Projection and rebuildable Materialization. Do not freeze the model until FX, manual-vs-automatic allocation, cost-method genealogy and recalculation-scope gates close.

The exact next execution sequence is defined in:

`docs/architecture/legacy/EVO-WORK-CONTINUATION-PLAN-v0.1.md`.

---

# 10. Handoff contract

A future LLM MUST:

- follow chat lineage 0→1→2→3 when reconstructing historical reasoning;
- reuse durable conclusions instead of rerunning broad archaeology;
- reopen raw source only for a named evidence gap;
- tag conclusions as OBSERVED / INTERPRETED / HYPOTHESIS / CORRECTED / UNRESOLVED / NORMALIZED where useful;
- preserve old/superseded interpretations through additive correction;
- record exact source repository/ref/path/object for new evidence;
- commit meaningful archaeology packets before context becomes their only storage;
- avoid large canonical/runtime changes until the evidence gate for that change is closed;
- treat Git/repository state as authoritative engineering context.

> Spend new context on discovering new knowledge, not rediscovering the four old chat windows.

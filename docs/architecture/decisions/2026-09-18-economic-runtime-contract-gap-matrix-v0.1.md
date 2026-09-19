# Economic Runtime Contract Gap Matrix v0.1

**Status:** ACTIVE IMPLEMENTATION PLAN  
**Date:** 2026-09-18  
**Depends on:** `2026-09-18-economic-runtime-architecture-freeze-v0.1.md`

## 1. Purpose

Translate the frozen Economic Runtime semantics into additive changes against the current EVO implementation.

Rule:

> Preserve working assets. Add missing contracts first. Migrate schema second. Adapt implementation third. Remove/deprecate legacy-compatible shortcuts only after certification.

## 2. Current-state gap matrix

| Frozen concept / invariant | Current implementation | Gap | Priority | Action |
|---|---|---|---|---|
| BusinessFact / EconomicOccurrence | `business_data` append-oriented history exists | naming is BusinessData rather than EconomicOccurrence; acceptable | KEEP | keep physical model; document semantic role |
| Semantic fields first-class | `business_data.payload` + metadata | present | KEEP | no generic-field rewrite |
| Measurement | ledger has fixed quantity/amount/unit/currency; business payload ad hoc | no typed reusable Measurement contract | **P0** | add semantic contract; preserve compatibility |
| Explicit Basis Evidence | direct `totalCost` and other payload fields used ad hoc | no typed basis contract/provenance | **P0** | add BasisEvidence contract |
| AllocationInstruction | `transMatchedCode` equivalent absent in generic EVO runtime | missing | **P0** | add allocation API contract |
| AllocationPolicy | cost method has limited implicit selection behavior | missing generic contract | **P0** | add versioned AllocationPolicy |
| AllocationRelation | cost engine has transient layer consumption only | no durable generic relation/lineage | **P0** | add contract then schema |
| Position | ledger balance/work projections provide partial position materializations | no explicit generic position contract | P1 | add after allocation primitives |
| CostMethodPolicy | `CostMethod` enum + `valuation_policy` | policy too narrow | **P0** | extend policy contract additively |
| Rate role/dataset | no generic governed rate dataset | missing | **P0** | add rate observation/dataset contracts |
| ValuationRun lineage | `cost_run` + valuation posting run | partial | P1 | extend pins/input digest/lineage |
| SettlementResult | absent as generic concept | missing | P1 | add result contract after allocation/rate |
| Projection | ledger posting + valuation posting | strong existing asset | KEEP/REFINE | extend lineage only |
| Materialization | ledger_balance, valuation_position | present | KEEP | mark rebuild semantics explicitly |
| Distinct lineage graphs | `business_object_link` mixes CAUSES/FULFILLS/ALLOCATES_TO/DERIVES_FROM | semantic collision | **P0** | restrict it to business links; create dedicated allocation/derivation/dependency lineage |
| CalculationDependencyEdge | `cost_mwa.path` legacy evidence; no EVO contract | missing | **P0** | add dependency contract/schema |
| ReplayCheckpoint | replay boundary/digest exists, no checkpoint object | missing | P1 | add after dependency graph |
| Full replay oracle | `PostgresReplayService` exists and digest check exists | strong existing asset | KEEP/REFINE | retain |
| Incremental replay equivalence | absent | missing | P1 | API/contract first; implementation after tests |
| Deterministic pinned policy | replay pins some valuation state | cost engine falls back to latest ACTIVE policy | **P0 violation** | forbid implicit latest policy in authoritative replay/recalc |
| Generic runtime | cost engine hardcodes 3 business types + warehouse/product pool | reference logic leaked into core | **P0 violation** | move selection/pool semantics to versioned template/policy |
| Specific identification | payload `lot` | hard-coded identity field | P1 | selector contract + dimension mapping |
| LIFO/FIFO | cost engine uses reversed/normal in-memory layers | usable reference | REFINE | policy-driven source ordering |
| Moving average | computed from layer aggregate | correct semantic direction | REFINE | model pool directly; no false layer genealogy |
| Replay modes | `NORMAL/REPLAYING/FAILED` physical state | coarser than freeze | P1 | add states only when implementation requires |
| Ordering | business_data sorted effective_at + created_at in cost engine | created_at tie-breaker not frozen semantic sequence | **P0** | consume explicit deterministic ordering contract |

## 3. Highest-risk mismatches

### G-001 — Mixed lineage table

`business_object_link.relation_type` currently allows:

- `CAUSES`
- `FULFILLS`
- `ALLOCATES_TO`
- `DERIVES_FROM`
- `REFERENCES`

Freeze requires business causality, allocation, value derivation and calculation dependency to remain semantically distinct.

Decision:

- retain `business_object_link` for business-level semantic links;
- do not add new runtime-derived allocation/cost/dependency edges to it;
- introduce dedicated contracts/tables before migrating existing uses;
- compatibility values remain readable until migration proves safe.

### G-002 — Implicit latest valuation policy

`PostgresCostEngine.recalculate()` can choose the latest ACTIVE `valuation_policy` when pins are absent.

This is acceptable only for a decision-time convenience layer that resolves and freezes a version **before** authoritative execution.

It is not acceptable inside deterministic replay/authoritative recalculation.

Decision:

- authoritative CostRun requires resolved policy identity/version;
- convenience caller may resolve “active” once, then pass explicit pins;
- replay always uses explicit pins.

### G-003 — Domain logic leaked into generic cost engine

Current cost engine recognizes:

- `production.completed`;
- `inventory.received`;
- `sales_shipment.created`;

and hard-codes `warehouse + productId` as the pool.

Decision:

- retain these as reference-enterprise compatibility behavior temporarily;
- move event eligibility, direction, pool grain, selector and basis mapping into versioned template/policy contracts;
- core cost runtime consumes normalized valuation inputs rather than application names.

### G-004 — Ordering relies on `created_at`

Current cost engine orders `effective_at`, then `created_at`.

Freeze requires an explicit stable semantic ordering contract.

Decision:

- add order identity to normalized valuation input;
- replay/cost must pin/use semantic sequence;
- physical creation time may be observed but is not the canonical tie-breaker.

## 4. Additive implementation batches

### ER-C01 — Semantic contracts

Create public types for:

- Measurement;
- BasisEvidence;
- AllocationInstruction;
- AllocationPolicy;
- AllocationRelation;
- SourceSelector;
- CostMethodPolicy;
- RateObservation / RateDatasetPin;
- CalculationDependencyEdge;
- ReplayCheckpoint descriptor.

No database migration in this batch.

### ER-C02 — Invariants and tests

Tests for:

- explicit policy pin required for authoritative cost execution;
- manual instruction distinct from generated relation;
- FIFO/LIFO differ only by ordering policy;
- latest-in-price is not LIFO;
- moving average does not claim receipt-layer cost selection;
- lineage type separation;
- deterministic order tie-breaker;
- FX rate role pinning.

### ER-C03 — Additive schema

Add dedicated storage for:

- allocation_instruction;
- allocation_run;
- allocation_relation;
- rate_dataset / rate_observation or equivalent versioned reference dataset;
- calculation_dependency_edge;
- replay_checkpoint.

Do not drop compatibility columns/tables yet.

### ER-C04 — Runtime adaptation

Refactor cost engine to consume normalized valuation/allocation inputs.

Remove hard-coded application names from generic algorithm path.

### ER-C05 — Replay adaptation

Add impact-analysis/checkpoint contracts.

Keep full replay unchanged as correctness oracle first.

### ER-C06 — Certification

Prove:

`incremental digest == full replay digest`

for certified scenarios before enabling incremental path.

## 5. Compatibility policy

During convergence:

- old APIs remain callable where safe;
- new fields/contracts are additive;
- migrations are forward-compatible;
- no destructive table drops;
- old lineage values remain readable;
- compatibility adapters must be explicit and observable;
- every compatibility path has a retirement condition.

## 6. Immediate implementation action

Start **ER-C01**.

Order:

1. economic measurement/basis contracts;
2. allocation contracts;
3. cost policy contract expansion;
4. rate dataset contracts;
5. dependency/checkpoint contracts;
6. compile;
7. add contract-level tests;
8. commit.

Only after ER-C01 + ER-C02 pass should schema migration begin.

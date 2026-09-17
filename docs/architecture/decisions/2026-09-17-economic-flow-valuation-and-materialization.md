# EVO Development Record — Economic Flow, Currency, Valuation, and Intentional Materialization

Status: DEVELOPMENT RECORD / CANDIDATE ARCHITECTURE INPUT
Date: 2026-09-17
Scope: EVO Enterprise Template, BusinessData, Ledger, Cost/Valuation, field semantics, physical data optimization

This document preserves the design reasoning developed during the Asloop + bookkeeping semantic convergence work. It is intentionally a development record rather than a final invariant. Candidate concepts MUST be validated against legacy evidence and external accounting/ERP practice before promotion to authoritative architecture.

## 1. Why this record exists

Asloop and bookkeeping contain years of accumulated enterprise knowledge, but neither implementation is the architectural ceiling for EVO. EVO is an LLM-native semantic convergence: preserve legacy knowledge losslessly, understand why historical structures existed, and redesign the runtime around explicit deterministic contracts.

Repository artifacts, not chat memory, must preserve this reasoning so another LLM can continue the work without reconstructing the discussion.

## 2. Two enterprise flow perspectives

A useful legacy/business distinction is:

- quantity/resource flow: primarily describes what resource moved and how much; monetary value may be absent;
- monetary flow: primarily describes monetary value; it does not require a physical quantity field.

The historical word "物流" in this discussion means physical/resource data flow recorded as ledger-like movements, not merely transportation logistics.

EVO should generalize this beyond physical goods. Inventory and foreign currency can share lower-level holding/movement mechanics without asserting that currency IS inventory.

Candidate abstraction:

`EconomicResource + Container + Measurement + EconomicFlow`

Examples:

- warehouse + material + 100 PCS;
- warehouse + copper + 500 KG;
- USD bank account + USD + 10,000 USD;
- CNY bank account + CNY + 50,000 CNY.

Currency can have at least two distinct roles:

1. held/traded economic resource;
2. unit of account / valuation currency.

These roles MUST NOT be conflated.

## 3. Do not make foreignAmount a premature core concept

Traditional models often collapse a transaction into:

`quantity / foreignAmount / localAmount / exchangeRate`

EVO should first preserve the underlying measurements and relationships. A USD 10,000 holding is first a resource measurement. A CNY valuation of that holding is a valuation result. A conversion from USD to CNY is an explicit economic relationship.

The Asloop semantics of `foreign` remain under archaeological investigation. It may mean different things in different calculation/accounting contexts. EVO MUST NOT map all historical `foreign` occurrences to one canonical field until evidence establishes their semantics.

## 4. Resource flow to monetary value requires explicit bidirectional lineage

When a quantity/resource flow becomes a monetary consequence, the conversion relationship must remain traceable in both directions.

Conceptually:

`BusinessData -> EconomicFlow/Measurement -> CostBasis -> Valuation -> MonetaryEffect -> AccountingProjection`

A monetary ledger amount must be traceable back through valuation/cost/allocation to the originating resource movements and BusinessData. A resource movement must be traceable forward to its cost, valuation, and accounting consequences.

This is required for operational-financial reconciliation. Coincidental equality of quantity, amount, timestamp, or identifiers MUST NOT be used to infer causation.

## 5. Fact, cost basis, and valuation are different layers

EVO should distinguish at least:

- Fact Flow: what actually moved/occurred;
- Cost Basis: observed/acquired basis supplied by business events or explicit allocation;
- Valuation: a deterministic interpretation of facts/basis under a pinned policy/version;
- Accounting Projection: deterministic financial consequences under pinned accounting rules.

Example: purchase 100 PCS for USD 1,000.

- `+100 PCS` is a resource-flow fact;
- `-1,000 USD` or payable USD 1,000 is another economic fact/obligation;
- their explicit relationship provides acquisition cost basis;
- conversion to functional currency is valuation/accounting interpretation.

An inbound transaction with an explicitly supplied acquisition amount does not require an algorithm to invent its cost, but the supplied amount and its lineage MUST be retained as CostBasis.

## 6. Foreign currency and inventory can share valuation mechanics

A foreign-currency holding can behave like another measurable economic resource for acquisition/disposal costing.

For example, USD acquired in multiple layers may be matched on disposal using a pinned cost policy. Historical acquisition cost rate and current/transaction FX rate are different semantics even if their numeric values happen to match.

Candidate shared kernel:

`Resource -> AcquisitionLayer -> Disposal -> MatchingPolicy -> AllocationPolicy -> ValuationPolicy -> Lineage`

Possible policies include FIFO, LIFO, moving average, specific identification, standard/actual costing, FX historical cost, and period-end FX revaluation. Sharing the kernel MUST NOT erase domain semantics for inventory, cash, FX, WIP, receivables, etc.

## 7. Transaction-time valuation and period valuation should coexist

EVO should not force a false choice between immediate cost and month-end recalculation.

Candidate behavior:

- immutable BusinessData/EconomicFlow is recorded immediately;
- an optional provisional/current valuation may be produced for operational use;
- a period-end authoritative valuation run may rebuild cost/valuation using the complete bounded dataset and pinned policies/rates;
- revaluation/recalculation does not rewrite the underlying resource-flow facts;
- all valuation outputs carry run/dataset/version/input-boundary lineage.

Period-end FX revaluation is not the same thing as rewriting historical acquisition cost. Multiple valuation datasets may legitimately answer different questions.

## 8. Rates are semantic roles, not one generic exchangeRate

Do not collapse these into one unqualified rate:

- acquisition cost rate;
- transaction FX rate;
- valuation FX rate;
- settlement FX rate;
- reporting conversion rate, where applicable.

Every rate used for a deterministic consequence needs explicit semantic role, effective time, source/version, and lineage.

## 9. Measurement is a candidate lower-level primitive

Instead of hard-coding all enterprise facts into `quantity`, `amount`, and `foreignAmount`, consider a typed Measurement concept:

`value + unit + semantic role`

Examples include PCS, KG, USD, JPY, HOURS, KWH, and monetary valuation units. This remains a candidate until legacy and runtime evidence proves it reduces complexity without erasing business meaning.

Semantic business fields remain first-class. EVO MUST NOT reduce `customerName`, `productionDate`, `materialCode`, etc. to generic primitive types merely because their storage types are text/date/identifier.

## 10. Intentional redundancy is a first-class performance concern

Asloop and bookkeeping intentionally retained redundant fields in places. During convergence, redundancy MUST NOT automatically be treated as a defect.

Every repeated/materialized field should be investigated for purpose, including historical snapshot semantics, avoiding high-frequency joins, avoiding repeated expression evaluation, balance/cost-chain acceleration, sorting/filtering/search, reporting aggregation, compatibility, deliberate denormalization, and accidental legacy duplication.

Only evidence-backed accidental/obsolete duplication is a deletion candidate, and legacy evidence is still retained under the lossless migration policy.

## 11. Semantic normalization, physical denormalization

Candidate principle:

> Semantic Normalization, Physical Denormalization.

Canonical semantics should identify truth and derivation explicitly. Physical storage may deliberately materialize derived values or projections for performance.

Suggested storage roles:

- FACT — authoritative business fact;
- DERIVED — deterministically computed, not necessarily persisted;
- MATERIALIZED_DERIVATION — persisted deterministic result for performance;
- SNAPSHOT — value intentionally frozen as-of the business occurrence;
- PROJECTION — read/report/search optimized representation.

Materialized data should declare, where applicable: canonical sources, derivation/rule version, purpose, consistency/refresh semantics, rebuildability, and lineage/dataset/run identity.

## 12. Performance must be designed with semantics, not after semantics

The Enterprise Template convergence must preserve legacy performance intent while redesigning physical implementation. Candidate optimization mechanisms include indexes, partitioning, materialized fields, balance projections, read models, pre-aggregation, caches, and other rebuildable projections.

Optimization MUST NOT silently redefine canonical business truth.

Template/field archaeology should therefore ask two questions for every property:

1. What business semantic does this property carry?
2. Why was this property physically stored here?

Property conservation must preserve both answers when evidence exists.

## 13. Current architectural direction

The candidate end-to-end model is:

`Enterprise Reality -> BusinessData -> EconomicFlow + Measurement -> CostBasis -> Cost/Valuation Run -> Value Lineage -> Accounting Projection -> Ledger/Balance`

with explicit bidirectional lineage and deterministic replay/recalculation.

This extends rather than replaces the existing EVO invariants: business history is preserved; derived ledger/cost/valuation results are rebuildable; runtime is deterministic without LLM participation; versions are explicitly pinned.

## 14. Evidence work still required before freezing concepts

Before promoting `EconomicResource`, `EconomicFlow`, `Measurement`, `CostBasis`, `ValueLink`, or similar names into core concepts, the convergence work must reconstruct Asloop `qty / amount / foreign / currency / cash / exchange / cost` semantics; compare them with bookkeeping App/Policy/Account/Balance/Cost semantics; classify legacy properties losslessly; distinguish business fact amount from calculated valuation amount; distinguish foreign-resource measurement from source-currency projection; validate operational-financial reverse reconciliation; test enterprise-scale performance; and compare useful mature ERP/accounting patterns without importing their constraints blindly.

## 15. Development-record policy

Substantial design discussions that change assumptions, reveal legacy intent, introduce candidate abstractions, or establish performance/data-conservation requirements should be captured in repository development/decision records. Chat history is supporting context, never the sole architectural memory.

## 16. Archaeology update — Asloop calculation kernel (2016 evidence)

The Asloop `c_calc` initialization snapshot exposes a configurable calculation kernel rather than only hard-coded accounting logic. Its calculation fields explicitly separate quantity and amount state:

- `qty`, `qtyWaterBal`, `qtyLocked`, `qtyTbMatched`;
- `amount`, `amntWaterBal`, `amntLocked`, `amntTbMatched`.

Calculation components show three historical patterns:

- quantity-oriented operational states such as pending purchase, pending warehouse receipt, pending processing and pending sales issue;
- amount-oriented states such as customer/supplier settlement, invoice states, revenue, cost, tax and expense;
- inventory itself carrying both `qty,amount`.

This is evidence that inventory historically acted as a bridge between resource quantity and value, while quantity and amount each maintained their own balance/matching state.

The Asloop expression resources also show explicit quantity-to-value allocation. Inventory matching calculates an allocated amount using the proportion of consumed quantity to available matched quantity multiplied by the matched amount balance. This means historical `match` semantics are broader than financial receivable/payable settlement: the same conceptual mechanism consumes available quantity/value state and carries remaining balances.

Candidate EVO interpretation:

`Allocation / Matching` is a lower-level enterprise primitive to investigate, not an accounting-only settlement feature.

Possible uses include order-to-shipment fulfillment, purchase-to-receipt fulfillment, production demand-to-completion, inventory-layer consumption, receivable-to-cash settlement, payable-to-payment settlement and cost allocation.

This concept remains CANDIDATE until the later bookkeeping implementation and more Asloop evidence are cross-checked.

Asloop expression functions/resources include `current`, `source`, `match`, `sum`, rule direction and a historical `lastStockOut(current.qty)` cost expression. The exact semantics of `lastStockOut` are NOT yet established and MUST NOT be equated to LIFO without implementation evidence.

Another important observation is that expressions can aggregate the results of other calculation relations (for example inventory amount feeding cost/expense calculations). Therefore the historical system contains a calculation dependency graph, not merely independent posting rules. EVO should preserve the semantic possibility while making dependency ordering, cycle detection, versions, replay boundaries and observability explicit.

## 17. Archaeology update — bookkeeping confirms balance materialization and cost-as-balance semantics

The later `bookkeeping` repository provides strong cross-evidence for the direction above.

`TransdataAccount` explicitly states that financial bookkeeping records asset movement, maps directions (`add/sub/cr/dr`) to inflow/outflow, carries both `quantityFactor` and `amountFactor`, and allows `amountFactor` to remain an expression/string because the amount may depend on cost calculated later.

Its comments also state that balance persistence can have different container granularities (for example account-level or order-level), and describe cost as persistence of amount balance / quantity balance. Cost lookup obtains the newest persisted balance context and derives an amount for a requested quantity.

`Balance` stores both quantity and amount plus configurable accounting-dimension names/values. Its persistence predicate states that weighted-average cost is, in essence, persistence of account balance.

`CostMwa` extends `Balance` and stores a latest cost price, while the adjacent historical comment in `TransdataAccount` says this price can be simplified away because the average is already present in balance history. This is strong evidence that at least this later implementation understood moving-average cost as a projection/materialization over quantity-and-amount balance history rather than an independent business fact.

The `recalc.sql` procedure further confirms replay intent: before recalculation it reconstructs the latest balance and cost state strictly before a target transaction time into separate recalculation tables. The legacy implementation is mutable/procedural and should not be copied, but the semantic requirement is important: deterministic historical recomputation needs an explicit starting state / checkpoint boundary.

Candidate EVO refinement:

`Immutable Entries -> Versioned Balance Projection -> Cost/Allocation State -> Checkpoint/Snapshot -> Replay/Revaluation`

A checkpoint is an optimization and replay boundary, not canonical business truth. EVO should be able to rebuild it from immutable facts/entries under pinned definitions.

## 18. New convergence hypotheses to test

The combined Asloop + bookkeeping evidence now supports testing these stronger hypotheses:

1. **Ledger state can carry multiple measures.** Avoid freezing a ledger to `QUANTITY`, `AMOUNT`, or `QUANTITY_AND_AMOUNT`; model a ledger/state definition as carrying typed measures whose semantics remain explicit.
2. **Matching is generalized consumption/allocation.** `source/match` relationships may be the historical ancestor of a general allocation graph connecting demand/supply, quantity/value and settlement.
3. **Cost is not necessarily a primary fact.** Acquisition basis can be factual, while outbound cost can be a deterministic allocation/valuation result over resource layers or persisted balance state.
4. **Balance materialization is intentional architecture.** Current-state and cost queries must not require summing the entire immutable history on every request. Rebuildable materialized projections/checkpoints are first-class performance structures.
5. **Calculation dependencies must be explicit.** EVO needs a deterministic dependency DAG between projections/cost/valuation/accounting calculations rather than hidden `sum(other_relation)` or stored-procedure dependencies.
6. **Legacy names are not canonical concepts.** `qty`, `amount`, `foreign`, `balance`, `match`, `cost` must be classified by observed semantics per context before mapping to EVO.

These are development hypotheses, not frozen constitutional invariants.

## 19. Next archaeology gate

Before promoting the hypotheses above, continue evidence collection on:

- Asloop `C_COMPONENT` direction/matching/data-collector semantics;
- implementation or historical meaning of `lastStockOut`;
- full calculation-relation genealogy (`crinvn`, `crunph`, `crniwh`, `crunpr`, `crnows`, `crclnt`, `crsppl`, invoice/revenue/cost/tax/expense relations);
- bookkeeping `Policy`, `Account`, `BalanceService`, `TransdataAccountService`, SQL cost functions and recalculation path;
- `foreign`, currency, exchange settlement and FX gain/loss evidence in both systems;
- physical indexes/materialized fields that reveal expected access patterns.

At the next evidence gate, produce a Legacy Calculation Genealogy and a field semantic/performance classification matrix before changing authoritative EVO contracts.

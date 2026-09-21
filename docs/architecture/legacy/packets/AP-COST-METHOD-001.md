# AP-COST-METHOD-001 — Cost Method Genealogy

**Status:** SEMANTIC GATE CLOSED — strict legacy LIFO implementation not evidenced  
**Date:** 2026-09-18  
**Scope:** Asloop-Backend + bookkeeping → EVO CostMethodPolicy  
**Branch:** `evo/apm-certification-enterprise-template-v0.1`

---

## 0. Question

Can FIFO, LIFO, weighted/average and specific identification be represented as policies over one Allocation + Valuation substrate rather than four incompatible runtimes?

The answer is yes.

Legacy evidence strongly proves weighted-average, explicit-source costing, ordered source selection, source cost carry-over and return restoration. Strict layer-consuming LIFO is **not** proven in the inspected legacy implementation and must not be retroactively invented.

---

## 1. Sources inspected

bookkeeping:
- `CostMwa.java`
- `CostMwaService.java`
- `BalanceService.java`
- `cost.sql`
- `db_fn_proc.sql`
- `db_fn_proc_part_1.sql`
- `db_fn_proc_part_2.sql`

Asloop:
- `LastStockInFunction.java`
- `StockOutCostFunction.java`
- `InventoryCostFunction.java`
- `GetOutCostFunction.java`
- `CalcDetailMapper.java/xml`
- `c_data_collector`
- `MatchedConfiguration.java`
- `CostMatchStrategy.java`
- `ComponentPojo.java`
- `c_component / calc_rel / c_match_rel` definition data

---

## 2. Weighted / moving average — STRONG EVIDENCE

bookkeeping `fn_get_price_from_balance` derives cost price from current valuation pool:

`price = amount / quantity`

`CostMwaService` persists the resulting price together with:
- object;
- account;
- dimensions;
- transaction UUID;
- dependency/path information;
- transaction time.

Outbound recalculation can use the referenced `cost_mwa` price × outbound quantity.

This is a pool model, not receipt-layer selection.

### Normalized semantics

`ValuationPool(scope)`
- total quantity;
- total carrying amount;
- derived unit price = amount / quantity.

An inbound changes the pool state.

An outbound consumes quantity at the current/pinned pool price, with final residual closure rules preventing ghost value.

**EVO method family:** `WEIGHTED_AVERAGE / MOVING_AVERAGE`.

---

## 3. Ordered source consumption — STRONG SUBSTRATE EVIDENCE

Asloop `c_data_collector` rows select open historical state and default to:

`ORDER BY CALC_TIME`

without descending order.

Matching then accumulates candidates until the required quantity/amount is covered and splits the final source if needed.

This is an ordered layer-consumption substrate.

### Important limitation

This evidence proves that the runtime supports deterministic ordered source consumption.

It does **not** prove that every inventory costing configuration was FIFO.

### FIFO candidate

FIFO can be expressed as:

- source eligibility = same valuation scope;
- source ordering = oldest eligible source first;
- allocation unit = source layer;
- consume partial/full layers;
- carry source cost basis along allocation edges.

No separate runtime is required.

---

## 4. Latest-in price is NOT strict LIFO — CORRECTION

`LastStockInFunction` is explicitly documented as:

`最近入库法计算成本`

It queries:

`ORDER BY EFFECTIVE_TIME DESC LIMIT 1`

and computes:

`latest inbound amount / latest inbound qty × current qty`.

This uses the **latest inbound unit price** for the whole current quantity.

It does not iteratively consume newest inventory layers and then move to the next-newest layer when quantity exceeds the latest layer.

Therefore:

`Latest-In Price Method != LIFO layer consumption`.

Any previous temptation to infer LIFO from `lastStockIn/lastStockOut` naming is rejected.

---

## 5. Strict LIFO — NOT EVIDENCED IN LEGACY, BUT REPRESENTABLE

No reliable inspected source proves strict:

`newest open layer → next newest open layer → ...`

cost consumption.

Therefore legacy status is:

`UNRESOLVED / NOT EVIDENCED`.

However, EVO does not need a new runtime for LIFO.

The same layer-allocation substrate used for FIFO can implement LIFO by changing:

`sourceOrdering = effective/order key DESC`.

Thus strict LIFO is a `CostMethodPolicy` variation, not a new canonical model.

---

## 6. Specific identification — STRONG EVIDENCE

`StockOutCostFunction` requires a business-specified:

`transMatchedCode`

and directly queries the specified outbound transaction + material to recover its cost.

`InventoryCostFunction` similarly uses a referenced sales-out transaction to recover cost for red-invoice/return-like behavior.

This proves a source-referenced valuation path.

### Normalized semantics

Specific identification is:

`explicit source selector / allocation instruction`
` → source cost-basis lineage`
` → derived cost for current occurrence`.

This directly composes with AP-MANUAL-ALLOC-001.

---

## 7. Transfer / cross-location basis carry-over

`GetOutCostFunction` computes cost for transfer/in-transit behavior from the source outbound calculation results:

`sum(source outbound amount) / sum(source outbound qty) × destination qty`.

The implementation comment says it is currently used for transfer-out/in-transit matching.

**Normalized:** a transfer should normally carry forward the source basis rather than independently revalue the resource merely because location changed.

Candidate invariant:

`basis(destination receipt) = basis(source transfer-out allocation)`

subject to explicit policy for additional freight/duties/etc.

---

## 8. Return / reversal basis restoration

`InventoryCostFunction` recovers cost using the referenced original sales-out transaction.

This is evidence that a return/restoration may use original source cost lineage rather than current average/latest cost.

**Normalized policy dimension:**

`returnRestorationPolicy`

Possible values include:
- restore original basis;
- use current pool basis;
- explicit policy-specific revaluation.

For deterministic accounting, the chosen policy must be versioned.

---

## 9. Negative inventory interaction

Asloop matching configuration has explicit `allowedNegative` behavior and can emit residual/negative-state handling when eligible source balance is insufficient.

Cost method and negative-position policy are orthogonal.

A `CostMethodPolicy` must not silently decide negative inventory behavior.

Required separate dimension:

`negativePositionPolicy`
- reject;
- provisional/estimated basis;
- defer valuation;
- use current pool/latest reference according to explicit policy;
- later revalue/reconcile when source basis arrives.

The exact EVO choices belong at architecture freeze, but the separation is required.

---

## 10. Backdated occurrence impact

bookkeeping contains explicit historical insertion/recalculation machinery:

- locate insertion point by transaction time;
- identify downstream affected cost objects;
- update cost references;
- recompute balances/costs from the affected boundary.

This proves that cost method semantics depend on a deterministic effective ordering contract.

For FIFO/LIFO/average alike, a backdated occurrence can change later cost results.

Therefore:

`effectiveOrderingContract`

is part of `CostMethodPolicy`, and backdated changes feed AP-RECALC-001 dependency closure.

---

## 11. Conservation / residual closure applies to all methods

Prior evidence already established:

- final pool/layer consumption takes remaining value to avoid rounding ghosts;
- proportional cost split reconciles residual difference;
- allocated child value must equal source value under declared precision policy.

Therefore every cost method must obey common conservation invariants.

Method selection cannot bypass:
- precision;
- rounding mode;
- remainder policy;
- residual recipient policy;
- quantity/value closure.

---

## 12. Unified CostMethodPolicy

Candidate policy contract:

`CostMethodPolicy`

- `method`
  - FIFO
  - LIFO
  - MOVING_AVERAGE
  - SPECIFIC_IDENTIFICATION
  - optional reference methods such as LATEST_IN_PRICE;
- `valuationScope / poolGrain`;
- `sourceEligibility`;
- `sourceOrdering`;
- `sourceSelectorMode`;
- `allocationUnit`;
- `basisCarryForwardPolicy`;
- `returnRestorationPolicy`;
- `negativePositionPolicy`;
- `precisionPolicy`;
- `residualPolicy`;
- `effectiveOrderingContract`;
- `policyVersion`.

The runtime substrate remains:

`Facts`
` → Positions/Pools`
` → Allocation policy/selector`
` → Cost basis propagation`
` → Valuation result`
` → Projection / materialization`.

---

## 13. Comparison matrix

| Method | Selection semantics | Allocation relation | Cost basis form | Replay impact |
|---|---|---|---|---|
| FIFO | oldest eligible open layer first | explicit derived layer edges | basis from consumed source layers | backdated earlier layers can affect downstream |
| LIFO | newest eligible open layer first | explicit derived layer edges | basis from consumed source layers | backdated/new ordering can affect downstream |
| Moving/weighted average | no per-receipt source selection for valuation; use pool | pool contribution lineage; outbound need not bind one receipt | pool amount / pool quantity | any prior pool-changing event may affect subsequent price |
| Specific identification | explicit source/lot/transaction selector | selector + derived allocation edge | exact selected source basis | changes scoped to selected source lineage |
| Latest-in price reference | latest eligible inbound price only | no layer-consumption semantics implied | latest inbound unit price × qty | sensitive to latest prior inbound |

---

## 14. Why one runtime is sufficient

FIFO and LIFO differ mainly by `sourceOrdering`.

Specific identification replaces algorithmic ordering with an explicit selector/constraint.

Moving average changes the valuation scope from source-layer basis to pool basis.

All still use the same higher-level concepts:

- occurrence;
- measurement;
- position/pool;
- allocation or selector;
- cost basis;
- valuation result;
- lineage;
- projection;
- replay.

No method requires a different truth model.

---

## 15. Canonical vs derived classification

| Concept | Candidate classification |
|---|---|
| inventory/resource occurrence | CORE CANONICAL fact |
| explicit lot/source selection | canonical Allocation Instruction / business fact where applicable |
| cost-method policy | versioned MODULE CONTRACT / template semantic |
| source-layer allocation edges | DERIVED RESULT |
| moving-average pool state | MATERIALIZATION / derived valuation state |
| cost basis result | DERIVED RESULT with lineage |
| cost snapshot/checkpoint | MATERIALIZATION / replay optimization |
| latest-in reference price | derived valuation result |
| accounting cost entries | Projection |

---

## 16. Corrections preserved

### C-COST-001

`lastStockIn()` / “最近入库法” must not be called LIFO.

It selects one latest inbound price and applies it to the current quantity.

### C-COST-002

Ascending collector ordering is evidence of ordered allocation machinery, not proof that every legacy stock issue used FIFO costing.

### C-COST-003

Specific identification is not “another ordering”. It is an explicit source constraint and therefore has different provenance semantics.

---

## 17. Residual unresolved legacy questions

- No strict layer-consuming LIFO implementation recovered.
- No comprehensive legacy inventory proving which enterprises/apps used each costing formula.
- Negative inventory valuation behavior across all legacy cost variants is not fully reconstructed.

These are migration/reference-template questions, not blockers to the unified EVO runtime model.

---

## 18. Gate result

The required methods can be represented on one substrate without incompatible runtimes.

**AP-COST-METHOD-001 semantic gate: CLOSED.**

The evidence supports:

`AllocationPolicy + ValuationScope + CostMethodPolicy + Lineage + ConservationPolicy`

as a unified design direction.

Next gate:

`AP-RECALC-001 — Change Impact / Local Recalculation vs Full Replay`

This final semantic blocker must define how backdated/corrective changes compute dependency closure and prove equivalence with full replay.

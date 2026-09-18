# AP-FX-001 — Foreign Currency / Settlement / Revaluation

**Status:** SEMANTIC GATE CLOSED — legacy enforcement details partially unresolved  
**Date:** 2026-09-18  
**Scope:** Asloop-Backend + bookkeeping → EVO Economic Runtime  
**Branch:** `evo/apm-certification-enterprise-template-v0.1`  
**Evidence baseline:** Asloop `main`; bookkeeping `main`

---

## 0. Question

How did the legacy systems represent foreign-currency quantities/resources, local-currency carrying value, settlement, period-end revaluation and FX gain/loss, and which semantics belong in EVO canonical runtime versus derived valuation/accounting projection?

This packet closes the semantic boundary. Narrow legacy implementation details remain explicitly unresolved rather than silently inferred.

## 1. Sources inspected

Asloop:
- `ForeignSplitApportionCalculate.java`
- `ForeignExchangeSettlementFunction.java`
- `ExchangeContactGainOrLossFuction.java`
- `ExchangeGainOrLossFuction.java`
- `ExchangePeriodCostFuction.java`
- `CalcDetailMapper.java/xml`
- `TransDetail.java`
- `CashConvertImpl.java`
- `SysForeignExchangeServiceImpl.java`
- `SysForeignExchangeDao.java`
- `SysForeignExchange.java`
- `CurrenciesExchangeServiceImpl.java`
- `V1.0.0.201906061939__updateColumnExchangeRate.sql`
- `V1.0.0.201906141435__sys_dict_currency.sql`
- `V1.0.0.202001151648__v_checkOutData.sql`
- `V1.0.0.202108191647__exchangeSettlement.sql`
- current `release-data.sql`, `recall-data.sql`, `release-schema.sql`

bookkeeping:
- `ExchangeRate.java`
- `Transdata.java`
- `Policy.java`
- `qigan.sql`
- `dictionary.sql`
- `记账规则.sql`

## 2. Separate foreign-measure and local-value channels

Current Asloop `calc_rel` evidence contains:

| Calc relation | Legacy meaning | Calc field | Container |
|---|---|---|---|
| `9005` | 外币往来 | `foreign` | dealer + accountSub + entity |
| `9001` | 往来余额 | `amount` | dealer + accountSub + entity |
| `2004` | 外币资金 | `foreign` | cash + entity + accountSub |
| `2003` | 货币资金 | `amount` | cash + accountSub + entity |

**Observed:** legacy FX semantics were not one generic monetary amount.

**Normalized:** a foreign/resource measurement and the local-currency carrying value are distinct measures over one economic context.

Do not normalize `foreignAmount` directly to `amount`.

## 3. Foreign split behaves like resource allocation

`ForeignSplitApportionCalculate` executes for the `foreign` calculation field.

When a foreign position is partially consumed:
1. foreign amount is the consumption driver;
2. local carrying amount is allocated proportionally;
3. remaining foreign amount and remaining local amount stay on the source;
4. final consumption takes the full remaining local amount to close residual rounding.

This matches the conservation behavior already recovered from inventory/cost allocation.

**Interpretation:** a currency denomination can act as a quantity-bearing economic resource for matching/allocation while also remaining a monetary unit.

## 4. Transaction facts can carry foreign amount, rate and local amount

`TransDetail` contains:
- `currency`;
- `foreignAmount`;
- `rates`;
- `amount`;
- `brokerage`;
- `cashType`.

Recovered export/prepayment formulas populate foreign and local-value channels together.

**Interpretation:** a business occurrence can snapshot the transacted foreign measurement and the local carrying value recognized for that occurrence.

**Unresolved:** the complete legacy population/provider chain for `rates` has not been recovered. EVO must therefore model rate source/version explicitly rather than imitate this implicit path.

## 5. Realized FX difference occurs at settlement closure

`ForeignExchangeSettlementFunction` performs this behavior:

`current settlement event`
` → foreign-current-account result (9005)`
` → dealer + order balance lookup`
` → test foreign residual after current event`
` → if foreign residual == 0`
` → calculate local carrying residual`
` → remove residual from carrying position`
` → emit FX difference through the invoking expense calculation`

The function is called from ordinary business transaction configurations including recovered export issue/invoice/receipt/refund paths. It is not a period-close-only function.

**Normalized settlement model:**

`Open foreign position + Settlement occurrence`
` → Allocation consumes foreign units`
` → foreign residual reaches zero`
` → remaining local carrying value becomes realized FX difference`

The original business fact is not rewritten.

## 6. Month-end revaluation is a separate path

Asloop has `YW205 = 汇兑损益`.

Its active components update:
1. `9001 往来余额` — local-currency current-account value;
2. `2003 货币资金` — local-currency cash value;
3. `5001 期间费用` — balancing accounting/expense projection.

It does **not** modify the foreign-measure relations `9005` or `2004`.

Custom expressions call:
- `exchangeGainOrLoss()`;
- `cashGainOrLoss()`;
- `periodCost()`.

This proves period-end processing changes local valuation/projection while leaving foreign resource quantity untouched.

## 7. Period-end valuation formula

For foreign cash and foreign current accounts, the mapper computes:

`foreign residual = SUM(QTY_TB_MATCHED)`

`current carrying amount = SUM(AMNT_TB_MATCHED)`

`period-end valued amount = foreign residual × EXCHANGE_RATE_END`

`gain/loss = period-end valued amount - current carrying amount`

**Normalized:** period-end FX revaluation is a `ValuationRun` over still-open foreign positions. It does not change the underlying foreign amount.

## 8. Rate history has explicit period-end semantics

Legacy rate history contains:
- `YEAR_MONTH`;
- `CURRENCY`;
- `EXCHANGE_RATE`;
- `EXCHANGE_RATE_END`.

Triggers and `CurrenciesExchangeServiceImpl` create/update monthly rate history and update `EXCHANGE_RATE_END` for the current/specified period.

**Observed:** `EXCHANGE_RATE_END` is a period-end valuation rate.

**Not promoted:** the monthly `EXCHANGE_RATE` behaves like an opening/reference value in the history row, but current evidence is insufficient to call it an acquisition rate.

## 9. EVO rate-role matrix

| Rate role | Meaning | Canonical classification |
|---|---|---|
| Transaction/recognition rate | local carrying-value basis when fact is recognized | governed fact input/snapshot |
| Settlement rate/value basis | basis implied/used by actual settlement event | fact-linked settlement input |
| Period-end valuation rate | reference rate at valuation date | versioned reference dataset |
| Reporting conversion rate | optional reporting conversion | projection/valuation dataset |
| Legacy monthly opening/reference rate | historical `EXCHANGE_RATE` field | legacy reference metadata |

Every deterministic FX result must identify:
- semantic role;
- currency pair/local currency;
- effective date/time;
- source/provider;
- dataset/version;
- precision/rounding;
- lineage.

## 10. Realized settlement vs period-end revaluation

### Realized settlement

`Business settlement occurrence`
` → consume open foreign position`
` → foreign residual = 0`
` → identify remaining local carrying value`
` → Realized FX Difference`
` → projection`

### Period-end revaluation

`Open foreign position residual`
` + Period-end rate dataset`
` → Valuation Run`
` → revalued local amount`
` → delta vs carrying amount`
` → Unrealized/Revaluation Result`
` → projection/materialization`

No settlement business event is required for revaluation.

**Correction:** the legacy table name `trans_settlement_exchange` must not cause EVO to collapse settlement and period-end revaluation into one semantic operation.

## 11. Period-close governance

`trans_settlement_exchange` stores:
- entity;
- year-month;
- generated transaction code;
- creator/time;

and has a unique key on `(ENTITY_ID, YEAR_MONTH)`.

Migration data backfills it from historical `YW205 / EXCHA_RAT_001` monthly transactions.

Function comments state intended governance:
- close months sequentially;
- already-closed months cannot be closed again;
- latest close can be reversed.

**Interpretation:** this is a close-governance/lineage registry, not the foreign economic position itself.

**Unresolved:** the exact current service/controller enforcement caller was not recovered. This is an implementation-genealogy gap, not a semantic blocker.

## 12. Fact / interpretation / projection classification

| Concept | EVO classification | Rebuildable? |
|---|---|---:|
| sale/purchase/payment/receipt/transfer | Business/Economic Fact | No |
| foreign amount + currency | Measurement on fact | No |
| accepted transaction rate snapshot | governed fact input | No, except additive correction |
| open foreign position | Position projection | Yes |
| source-consumption/settlement relation | Allocation relation/result | Depends on provenance; AP-MANUAL-ALLOC-001 |
| local carrying amount | Valuation/carrying state | Yes under pinned inputs |
| rate observation | Versioned reference dataset | preserve/version |
| realized FX difference | Derived settlement result | Yes |
| period-end revaluation | Valuation result | Yes |
| FX accounting entries | Accounting projection | Yes |
| materialized FX balance | Materialization | Yes |
| period-close request/registry | Governance/workflow fact | Preserve |
| generated YW205 calculation rows | Derived close/valuation projection | Yes |

## 13. Required lineage

EVO must preserve:

`Business Fact`
` → Measurement`
` → Position`
` → Allocation / Settlement`
` → Carrying Value / Valuation`
` → Realized or Revaluation FX Result`
` → Accounting Projection`

Reverse queries must answer:
- why this FX difference exists;
- which open position produced it;
- which settlement event closed it;
- which rate dataset/version was used;
- which source fact created the position;
- which projections came from the result.

A generic `source_id` is insufficient.

## 14. Cross-system result

bookkeeping retains:
- `ExchangeRate(logDate, currency, relative-to-local-currency rate)`;
- transaction `currency`;
- transaction `foreignAmount`.

In the inspected core Java/SQL set, no complete equivalent to Asloop's settlement + month-end revaluation runtime was recovered; many rules are explicitly RMB-scoped.

**Interpretation:** bookkeeping simplified/concentrated the accounting runtime but does not supersede Asloop as the richer FX genealogy source.

## 15. EVO normalized semantic model after AP-FX-001

Evidence now strongly supports separating:

- `EconomicOccurrence` / immutable business event;
- `Measurement` / value + unit + semantic role;
- `Position` / open foreign quantity by dimensions;
- `AllocationRelation / AllocationPolicy`;
- `RateObservation / RateDataset`;
- `CostBasis / CarryingBasis`;
- `ValuationRun`;
- `ValuationResult`;
- `SettlementResult`;
- `Projection`;
- `Materialization`.

Names remain subject to the final Economic Runtime freeze gate; the semantic separation is now evidence-backed.

## 16. Invariants strengthened by this packet

1. Currency-denominated resource quantity and local carrying value are independent measures.
2. A business fact remains immutable while valuation changes over time.
3. Revaluation never rewrites underlying foreign-resource quantity.
4. Realized settlement difference and period-end revaluation difference are different derivations.
5. Rate roles are explicit and versioned.
6. FX results are reproducible from pinned facts, allocations, carrying basis, rate datasets and policies.
7. Accounting entries are projections, not the original foreign business fact.
8. Period-close governance is separate from the valuation calculation.
9. Bidirectional lineage is required.
10. FX replay cannot depend on mutable “latest rate” lookup.

## 17. Corrections and residual unresolved items

Previous genealogy said exact FX settlement/revaluation behavior was not proven.

**CORRECTED:** semantic behavior is now proven strongly enough to close the architecture evidence gate.

Residual gaps:
- **U-FX-001:** exact legacy population/provider path of `TransDetail.rates`;
- **U-FX-002:** exact runtime caller enforcing `trans_settlement_exchange` duplicate/reversal rules.

Neither blocks EVO semantic modeling because EVO will explicitly version rate inputs and close governance.

## 18. Gate result

**AP-FX-001 semantic gate: CLOSED.**

FX is no longer a blocker to distinguishing Fact, Measurement, Position, Allocation, Carrying Basis, Valuation, Settlement Result, Projection and Materialization.

Do **not** freeze the complete Economic Runtime yet.

Next required gate:

`AP-MANUAL-ALLOC-001 — Manual vs Automatic Allocation`

FX itself demonstrates why this distinction matters: a settlement relation may be an explicit human/business decision or a deterministic source-selection result, and those require different persistence and replay semantics.

# Batch 02 — Expression Semantics Convergence

Status: IN PROGRESS

## Evidence scope

Uploaded Asloop definition data contains 8,553 `c_expression_custom` records. Expression text has 3,503 distinct raw values in the current extraction. This is evidence that expression rows are contextual usages, not 8,553 independent business concepts.

Observed high-frequency references include `rule.checkDirection`, amount/taxAmount, transaction/matching codes, dealer roles, quantity/quality quantity, warehouse in/out, productionDate, batchNo, project, processing and cost-related values. Observed functions include `sum`, `match`, `value`, `lastStockIn`, `sumApportion`, `lossAllocation`, `costAllocationOTM`, `foreignExchangeSettlement`, `MTMAllocation`, `costCarryOver`, `inventoryQuality`, `stockOut`, `openAccount`, `exchangeGainOrLoss`, `cashGainOrLoss`, `periodCost`, `inventoryCost`, `costAllocation`, `inventoryDismantled`, and `getFeedingCost`.

These names are legacy evidence only; their implementation behavior must be recovered before canonicalization.

## Convergence decision

EVO MUST NOT execute arbitrary legacy expression strings as runtime truth. Expressions converge to a typed deterministic rule AST. Original expression text, source IDs, component linkage and all source properties remain provenance/evidence.

Initial semantic families:

- REFERENCE — source field/dimension/object references.
- ARITHMETIC — deterministic decimal arithmetic.
- DIRECTION — signed effect/debit-credit/increase-decrease semantics.
- CONDITION — predicates and applicability.
- AGGREGATION — deterministic sum/group/window semantics.
- MATCHING — explicit settlement/matching relations; never inferred from coincidence.
- ALLOCATION — conserved source allocation with pinned precision/rounding/residual policy.
- INVENTORY — stock-in/out/quality/batch/location semantics.
- COST — valuation/cost carry-over/allocation/feeding-cost semantics.
- FX — exchange-rate, settlement and gain/loss semantics.
- OPENING_CLOSING — opening/period/closing operations.
- PROJECT_PRODUCTION — project node, production and processing semantics.
- UNKNOWN — preserved and blocked from silent semantic translation.

## Example convergence

Legacy `(current.amount-current.taxAmount)*rule.checkDirection` is not stored merely as executable text. Candidate canonical meaning is a signed net-of-tax monetary effect:

`multiply(subtract(ref(amount), ref(taxAmount)), direction())`

This remains CANDIDATE until contextual component/calc-rel/account linkage proves the intended effect and target ledger.

## Runtime invariant

A canonical rule is executable only when its references, decimal semantics, condition semantics, direction semantics, version, target effect and dimension mapping are explicit. UNKNOWN/UNRESOLVED legacy expressions remain evidence and fail closed if required by an installed definition.

## Next evidence join

`c_expression_custom → c_component → c_calc_fg_rel/c_calc_field → calc_rel/account → transaction type → transaction-field relations`.

The join is used to distinguish identical syntax used for different enterprise semantics.
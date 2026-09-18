# Valuation

Valuation converts a deterministic `CostResult` into ledger value effects. It does not create BusinessData and does not execute Commands.

Canonical chain:

`BusinessData -> CostRun -> CostResult -> Valuation Posting -> LedgerEntry -> LedgerBalance`

For shipment valuation the reference rule posts Inventory Value `-delta` and COGS `+delta`.


## FX valuation specialization

FX uses the generic valuation substrate; it is not a separate truth model.

### Period-end revaluation

`open foreign Position + pinned PERIOD_END_VALUATION RateDataset`
` → FX_PERIOD_END ValuationRun/Result`

- foreign resource quantity remains unchanged;
- carrying value is reinterpreted under the pinned rate dataset;
- the delta is derived/rebuildable;
- no settlement BusinessData is required.

### Realized settlement closure

`open foreign Position + canonical settlement BusinessData + Allocation closure`
` → FX_REALIZED_SETTLEMENT ValuationRun/Result`

Initial certified scope:
- one settlement closes the entire selected foreign position;
- the AllocationRelation consumes the exact remaining foreign quantity;
- final carrying basis is the exact remaining carrying amount;
- realized delta = actual local settlement value - remaining carrying basis;
- no market-rate lookup is required when actual settlement value is supplied;
- the accounting projection is downstream of the realized result.

Do not collapse period-end revaluation and realized settlement into one operation.


## PostgreSQL persistence boundary

Array-valued JSONB payloads must be explicitly serialized as JSON at the PostgreSQL boundary.

Do not pass arrays of measurements/source ids directly to the pg driver and assume JSONB encoding. Use explicit JSON serialization/cast so an array cannot be interpreted as a PostgreSQL array literal.

This applies to valuation result source ids and source/target measurement arrays.

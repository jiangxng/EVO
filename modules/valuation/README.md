# Valuation

Valuation converts a deterministic `CostResult` into ledger value effects. It does not create BusinessData and does not execute Commands.

Canonical chain:

`BusinessData -> CostRun -> CostResult -> Valuation Posting -> LedgerEntry -> LedgerBalance`

For shipment valuation the reference rule posts Inventory Value `-delta` and COGS `+delta`.

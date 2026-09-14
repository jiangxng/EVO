# EVO v1.0.0-alpha.1 → v1.0.0-alpha.2 Change Set

## Purpose

Close the semantic gap exposed by the alpha.1 reference flow: shipment quantity posting reduced Inventory quantity but CostResult did not formally reduce Inventory value or recognize COGS. At the same time, introduce explicit governed accounting/analytical dimensions for project, department, profit center and similar analysis.

## Added

- `DimensionDefinition`
- Ledger dimension policy in `LedgerDefinition.dimension_schema`
- Explicit dimension validation for normal Posting
- `ValuationRule`
- `ValuationPostingRun`
- `ValuationPosition`
- Valuation provenance on `LedgerEntry`
- Cost policy/rule version pins
- Replay cost/valuation pins
- Reference dimensions: order, customer, product, warehouse, project, department, profit center, cost center

## Reference result

Production 10 units / total cost 100, followed by shipment 2 under FIFO:

- Inventory quantity = 8
- Inventory amount = 80
- COGS amount = 20

All ledger dimensions are explicitly mapped and validated. Replay rebuilds the same digest using preserved cost and valuation versions.

## Compatibility

The migration is additive except that the existing `ledger_entry` posting foreign keys become nullable so the same canonical LedgerEntry table can carry valuation-derived entries with explicit provenance. Existing ordinary posting semantics remain unchanged.

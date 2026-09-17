# Dimensions Context

Owner: `dimensions`.

Read `PHILOSOPHY.md`, `CONCEPTS.md`, `INVARIANTS.md`, `PUBLIC-API.md` first.

Core invariants:
- Project, Department, Profit Center, Cost Center and Product remain distinct enterprise concepts.
- `DimensionDefinition` defines an analytical key; it does not own business truth.
- `LedgerDefinition.dimension_schema` is the ledger policy.
- `PostingRule.effect_ast.dimensions` and `ValuationRule.dimension_mapping` are explicit mappings.
- Resolved dimensions are persisted on `ledger_entry` for historical stability.

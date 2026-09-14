# EVO v1.0.0-alpha.2 Candidate Notes

## Scope

- Explicit governed analytical dimensions.
- Ledger dimension policies and posting-time validation.
- Project / Department / Profit Center / Cost Center reference dimensions.
- Versioned ValuationRule.
- CostResult -> Valuation Posting -> canonical LedgerEntry.
- Inventory value reduction + COGS recognition.
- Delta/idempotent valuation position.
- Cost policy and valuation-rule pinning.
- Replay preservation of cost/valuation pins.
- Integrated alpha.2 validation scenario.

## Acceptance scenario

10 units produced for total cost 100, 2 units shipped under FIFO:

- Inventory quantity 8
- Inventory value 80
- COGS 20
- Project/Department/Profit Center/Cost Center dimensions persist through explicit mapping
- Full replay produces the same ledger digest

## Verification status in artifact build environment

Repository JSON/manifests and module dependency boundaries were checked locally. TypeScript dependency installation and Docker/PostgreSQL runtime validation could not be completed in the artifact build environment because package installation did not complete and Docker/PostgreSQL executables were unavailable. The repository therefore includes `docs/operations/V1-ALPHA2-VALIDATION.md` for the required deployment acceptance run.

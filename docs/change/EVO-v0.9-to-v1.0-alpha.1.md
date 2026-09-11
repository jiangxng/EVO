# EVO v0.9 → v1.0.0-alpha.1 Architecture Change Set

## Why

Runtime validation of v0.9.4 proved the technical spine works, but also exposed semantic gaps that must not be patched with demo-only assumptions.

## Validated Baseline

- Docker/TypeScript/PostgreSQL 18 runtime
- migrations and seed
- Command → BusinessData → PostingInput → Posting → Ledger
- Work projection
- FIFO calculation
- deterministic Full Replay

## Confirmed v0.9 Gaps

1. Sales order had quantity/amount but no material/item identity.
2. Generic `Receive Inventory` had no business cause; it could mean purchase receipt, production completion, return, stock gain, transfer, opening balance or miscellaneous receipt.
3. Inventory shipment was not explicitly linked to the sales order, therefore it correctly did not reduce pending shipment.
4. Production completion semantics were absent.
5. Business Object Linkage / Allocation / Causation / Flow Trace were not first-class enough.
6. FIFO CostResult was correct, but valuation posting back to Inventory Value/COGS was not connected.
7. ReplayRun `before_digest` incorrectly stored a JSON snapshot while `after_digest` stored a SHA-256 digest.
8. Dashboard omitted cost_result details.

## Decisions

- Sales reference data now carries explicit Item identity.
- The reference flow removes semantic dependence on generic `Receive` and uses `production.completed` as the finished-goods receipt cause.
- Shipment carries order/item/warehouse relationship explicitly.
- Capability, Flow, Metric, SOP and business-object lineage enter the v1 enterprise model foundation.
- ReplayRun separates snapshot from digest semantics.
- Generic inventory movement endpoints may remain temporarily for compatibility/testing, but they are not the v1 semantic reference.
- Valuation Posting is an explicit next implementation boundary; CostResult must not mutate LedgerBalance directly.

## Reference Flow

Sales Order → Production Demand → Production Completion → Inventory → Shipment → Cost → Valuation Posting → Receivable → Collection

`v1.0.0-alpha.1` establishes the model, lineage and semantic reference. Full valuation posting and collection closure are subsequent alpha hardening items before v1.0 release.

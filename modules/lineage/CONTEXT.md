# Lineage Context

The Economic Runtime Freeze requires distinct graph semantics.

This module only provides the neutral calculation-dependency graph contract:

`derived source → affected derived target`.

Examples:
- AllocationRelation → CostResult
- RateDataset → FX ValuationResult
- ValuationResult → accounting Projection
- CostResult → downstream materialization

Replay owns planning/checkpoint behavior and may persist/query these edges.
Producer modules depend on lineage API, never Replay internals.

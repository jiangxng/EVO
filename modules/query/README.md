# query module

## Purpose

Read-only cross-module query composition.

The current Economic Runtime view is generation-aware: immutable history is
composed from certified parent/child sequence segments, while snapshot families
such as balances and open work are read only from the active leaf generation.

## Owns

`read models`

## Rules

- Public entry points belong under `api/`.
- Domain/application code must not expose persistence records as contracts.
- Another module may not write this module's owned data directly.
- Cross-module dependencies must be declared in `architecture.manifest.json`.
- Importing another module's `infrastructure/` is prohibited.
- Material interface or invariant changes require documentation and tests.

## Current generation-overlay invariant

- resolve exactly one `CURRENT / ACTIVE` Economic Runtime Dataset;
- reject cyclic, cross-scope, discontinuous, or uncertified parent lineage;
- compose Ledger / Cost / Allocation / Valuation history by generation interval;
- read Ledger balances and WorkItems only from the active leaf generation;
- require the composed semantic digest to equal the digest certified at activation.

## Status

B4.4A current-generation overlay reads are certified for the reference FIFO
scenario. B4.4B default Dashboard routing is database-E2E verified; failure,
multi-generation, concurrency, and recovery coverage remain open.

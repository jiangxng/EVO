# replay module

## Purpose

Full-rebuild orchestration and replay lifecycle.

## Owns

`replay_run`

## Rules

- Public entry points belong under `api/`.
- Domain/application code must not expose persistence records as contracts.
- Another module may not write this module's owned data directly.
- Cross-module dependencies must be declared in `architecture.manifest.json`.
- Importing another module's `infrastructure/` is prohibited.
- Material interface or invariant changes require documentation and tests.

## Status

M0 placeholder. Concrete contracts are introduced by the milestone that implements this module.


## Economic Runtime Freeze refinements

Full replay remains the correctness oracle.

Replay topology now distinguishes:
- ImpactRoot;
- versioned CalculationDependencyEdge;
- ReplayCheckpoint;
- IncrementalReplayPlan;
- equivalence result.

The dependency graph version is a first-class contract field, not opaque lineage metadata.

Incremental replay is not authoritative unless its result is verified equivalent to full replay under the same pinned facts, policies, datasets and ordering contract.

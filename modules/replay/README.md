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


## Incremental replay planner v0.1

The runtime exposes a **read-only** incremental replay planner.

The planner may:
- traverse a versioned CalculationDependencyGraph;
- compute deterministic transitive dependency closure;
- select a ReplayCheckpoint strictly before the affected sequence;
- generate explicit fallback reasons;
- generate a deterministic SHA-256 plan digest.

The planner MUST NOT mutate derived state.

Conservative v0.1 safety rules force full replay when:
- dependency graph completeness is not proven;
- no valid checkpoint exists before the affected boundary;
- checkpoint graph/runtime semantic version mismatches;
- checkpoint validity does not explicitly declare `safeForIncremental=true`;
- runtime semantic version changes;
- template/policy change may be retroactive.

A cycle in the dependency graph is traversal-safe but does not weaken these fallback rules.

Incremental execution remains disabled until candidate rebuild output can be compared with the full replay oracle.

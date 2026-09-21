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

Implemented through governed incremental Candidate, isolated Full-Replay Oracle,
equivalence certification, generation-overlay reads, consecutive activation,
Worker cutover serialization, and crash/retry recovery for the certified reference
FIFO scenario. Multi-policy coverage remains outside this certification boundary.


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


## Full Replay Checkpoint certification — 2026-09-18

Certified behavior:
- a ReplayCheckpoint may only originate from a completed FULL replay with digest MATCH;
- source replay run identity is first-class and unique;
- checkpoint production is idempotent;
- initial checkpoints are always unsafe for incremental activation;
- missing coverage is persisted as blocker reason codes;
- Full Replay success is necessary but not sufficient for incremental safety.

Certified end-to-end pipeline:
`migrate → typecheck → build → test → seed:demo → validate:demo`

PR-head certification:
`2f752e798723ae03b1deb73c536e23f6b338ae39`
CI run:
`35324891541 — SUCCESS`


## B4.4B Multi-generation status

Two consecutive governed production generations are now database-E2E verified for
the reference FIFO scenario. A later Candidate may reuse the same certified
checkpoint while rebuilding the complete isolated suffix state; its formal
generation interval remains contiguous with its ACTIVE parent.

Candidate, Oracle, CURRENT overlay, and Full Replay LedgerEntry semantics now use
a total canonical ordering so POSTING and VALUATION entries sharing the same
posting sequence cannot drift by database row order. Candidate/Oracle digest
results also expose per-family semantic digests for failure localization.

Worker concurrency, crash/retry recovery, invalidated-checkpoint rejection, and
duplicate/stale/revoked activation failure paths are database-E2E verified.
ER-C05B4.4B is closed for the reference FIFO Economic Runtime scenario.

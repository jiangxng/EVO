# materialization module

## Purpose

Own Economic Runtime generation identity, isolation, lifecycle, equivalence
certification, and governed activation.

## Owns

- `economic_runtime_dataset`;
- CURRENT / CANDIDATE / ORACLE / ARCHIVED lifecycle;
- materialization write context;
- `runtime_equivalence_certification`;
- fail-closed Candidate activation.

## Rules

- canonical BusinessData never belongs to a materialization generation;
- derived writes must target an explicit generation when replaying;
- Candidate activation requires exact Full-Replay Oracle equivalence evidence;
- callers cannot self-assert Candidate verification or bypass governed activation;
- parent, checkpoint, promotion, plan, boundary, and digest scope must be rechecked
  transactionally before activation.

## Status

B4.3B governed activation and B4.4A post-activation overlay reads are certified
for the reference FIFO scenario. Failure/concurrency matrix coverage remains open.


B4.4B database E2E additionally verifies duplicate activation idempotency and
fail-closed semantic mismatch, stale-parent, and revoked-promotion cases.


## Runtime cache semantics

The active Economic Runtime materialization participates in the broader **EVO Runtime Cache** concept.

EVO-internal recalculation may rebuild derived state from the current governed runtime input/fact set without asking Applications to resubmit data.

A governed cache-clear operation may replace an active runtime working set or Application-scoped subset. Cache clear is a logical/runtime operation: required historical/audit evidence must remain reconstructable and traceable.

Application-driven rebuild is separate:

```text
Application requests scoped cache reset
→ Application resubmits data through normal APIs
→ EVO processes submissions normally
```

EVO does not interpret "recalculate" as a special business mode.

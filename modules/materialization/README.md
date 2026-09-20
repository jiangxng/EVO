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

# EVO Performance Baseline

**Status:** M0 — infrastructure baseline not yet measured.

## End-to-end metrics

Future baseline records:

- Command latency p50/p95/p99
- BusinessData write throughput
- Posting inputs/sec
- Posting queue age
- Ledger entries/sec
- LedgerBalance update latency
- Cost entries/sec
- CostPool contention
- Replay rows/sec
- Replay duration/ETA
- Outbox backlog
- Work queue latency
- Ledger query p95/p99

## Benchmark rule

Every benchmark record must state:

- EVO build/commit
- Node version
- PostgreSQL version
- hardware/container limits
- dataset shape
- concurrency
- measurement method

Performance claims without a reproducible workload are not architectural facts.

## First benchmark

Planned after M3:

- 100 enterprises
- 10,000 BusinessData records per enterprise
- 1–5 LedgerEntries per PostingInput

A separate benchmark will model one very large enterprise.

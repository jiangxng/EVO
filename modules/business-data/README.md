# business-data module

## Purpose

Own durable business history semantics.

## Responsibilities

- BusinessData contract
- business-object version semantics
- posting canonical order primitives
- durable history model

## Non-responsibilities

- Command authorization
- Posting rule execution
- Ledger writes
- Cost calculation
- Replay orchestration

## Core rule

Business history is preserved.

Later business change creates additional BusinessData.

Do not introduce a universal correction/reversal graph without an accepted architecture change.

## Posting order

Canonical key:

```text
effective_at
posting_priority
posting_sequence
```

Retroactive detection is a pure deterministic function and is tested independently.

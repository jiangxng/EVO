# EVO M2 — Command + BusinessData Delivery

## Delivered

- Command public contract
- Actor-aware execution envelope
- Command capability resolver through MetadataReader
- CommandService
- PostgreSQL atomic Command transaction
- CommandExecution
- BusinessData
- business-object versions
- expectedBusinessVersion concurrency check
- PostingInput foundation
- EnterpriseRuntimeState
- per-Enterprise posting sequence allocation
- canonical posting-order comparator
- retroactive/backdated input detection
- replay_required state
- OutboxEvent
- idempotent completed-command replay
- unit tests
- interface documentation
- invariants
- ADR-0002 retroactive input policy
- ADR-0003 atomic write boundary

## Critical correctness decision

```text
CanonicalKey =
(effective_at, posting_priority, posting_sequence)
```

If a newly created input sorts at or before the authoritative high-water:

```text
candidate <= high-water
```

it is not live-posted.

Instead:

```text
retroactive = true
replay_required = true
status = BLOCKED_REPLAY_REQUIRED
```

This resolves the ordering problem identified after EVO-09.

## Important boundary

M2 creates PostingInput but does not execute Posting.

M3 owns:

- queue claim
- deterministic rule evaluation
- LedgerEntry
- LedgerBalance
- authoritative high-water advancement
- posting failure rollback/retry behavior

## Replay note

M6 must inspect inputs created after a replay boundary before resuming NORMAL mode.
A post-boundary input can itself be retroactive relative to the rebuilt high-water.

## Next

M3 — Posting + Ledger.

# ADR-0004 — Posting + Ledger Atomicity

**Status:** ACCEPTED  
**Milestone:** M3

## Decision

In v0.x normal posting, these actions execute in one PostgreSQL transaction:

```text
lock posting state
create PostingRun
insert LedgerEntry
update LedgerBalance
mark PostingInput POSTED
advance posting high-water
complete PostingRun
```

Posting owns ordering/state.

Ledger owns LedgerEntry/LedgerBalance writes.

They share an internal database transaction token.

## Why

Splitting these operations across asynchronous services at this stage creates failure states requiring distributed transaction/compensation complexity.

EVO does not accept that complexity before it is justified.

## Future extraction

A future Ledger service extraction must explicitly solve equivalent atomicity, idempotency, ordering and failure semantics.

Service extraction is not allowed to silently weaken these guarantees.

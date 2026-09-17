# command module

## Purpose

Own the controlled execution boundary for business writes.

## Responsibilities

- resolve Command capability
- validate execution envelope
- actor-aware idempotency scope
- orchestrate atomic business write
- optimistic business version check
- create CommandExecution
- coordinate BusinessData + PostingInput + Outbox creation through a transaction port

## Non-responsibilities

- mutate Ledger directly
- calculate Cost
- execute Replay
- expose metadata persistence
- publish external events synchronously

## Public API

- `CommandExecutor`
- `CommandCapabilityResolver`
- Command request/result contracts

See `docs/interfaces/command-business-data.md`.

## Critical invariants

See `docs/invariants/command-business-data.md`.

## Performance

M2 sequence allocation deliberately serializes one short critical section per Enterprise.

This is a correctness-first v0.x decision with a documented future Consistency Domain scale path.

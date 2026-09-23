# posting module

## Purpose

Own deterministic PostingInput scheduling, posting-rule evaluation, posting state and authoritative high-water advancement.

## Responsibilities

- select first canonical queued PostingInput
- respect replay_required
- evaluate controlled rule AST
- create PostingRun
- coordinate atomic Ledger commit
- mark PostingInput POSTED
- advance authoritative high-water
- persist structured posting failures

## Non-responsibilities

- create BusinessData
- define business metadata
- directly own LedgerEntry/LedgerBalance semantics
- calculate Cost
- orchestrate Replay

## Canonical order

```text
effective_at
posting_priority
posting_sequence
```

## Cross-module contracts

Uses:

- BusinessDataReader
- PostingMetadataReader
- LedgerWriter

See `docs/interfaces/posting-ledger.md`.

## Performance

Initial posting commit serializes by EnterpriseRuntimeState lock.

Do not optimize this away without preserving ordering correctness.

Future scale path is Consistency Domain partitioning.

## Initial posting ownership

When a governed public business/Command API accepts a business fact, EVO automatically owns the first posting lifecycle for that fact.

The posting module may execute immediately or through the worker/queue path. That is an implementation choice.

```text
QUEUED
```

means the fact is already under EVO posting control and awaits internal execution. It does not mean the originating Application must call a separate posting-start API.

Explicit Posting/PostingRun APIs remain valid for re-posting, Replay, bulk processing, retry/recovery, repair and administrative control.

External Applications do not provide LedgerEntry instructions. This module evaluates the effective governed PostingRules and derives ledger effects.

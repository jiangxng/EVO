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

# ledger module

## Purpose

Own generic operational/financial LedgerEntry and LedgerBalance state.

## Responsibilities

- LedgerEntry persistence
- LedgerBalance projection
- LedgerDataset identity
- canonical dimension hashing
- balance reads
- posting lineage retention

## Non-responsibilities

- decide posting order
- interpret Commands
- calculate valuation Cost
- mutate BusinessData
- infer correction semantics

## Numeric storage

```text
numeric(38,12)
```

Application contracts use decimal strings for authoritative quantity/amount.

## Dataset

Normal M3 operation uses one ACTIVE dataset per Enterprise consistency domain.

Replay may later build/switch candidate datasets.

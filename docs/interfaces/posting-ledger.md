# Posting → Ledger Contract

**Posting owner:** `modules/posting`  
**Ledger owner:** `modules/ledger`  
**Status:** M3 v0.1

## Purpose

Transform queued PostingInput into deterministic LedgerEntry and LedgerBalance state while advancing authoritative posting high-water atomically.

## Processing flow

```text
Peek first QUEUED PostingInput
↓
Load immutable BusinessData
↓
Load pinned metadata version / posting rules
↓
Evaluate controlled AST
↓
Begin transaction
↓
Lock EnterpriseRuntimeState
↓
Re-select first canonical QUEUED input
↓
Verify same candidate
↓
Create PostingRun
↓
LedgerWriter.applyPosting(...)
↓
Insert LedgerEntry
↓
Update LedgerBalance
↓
Mark PostingInput POSTED
↓
Advance High-Water
↓
Complete PostingRun
↓
Commit
```

## Ordering guarantee

The transaction locks `EnterpriseRuntimeState` before authoritative commit.

While that lock is held, Command-side sequence allocation for the same Enterprise cannot create a new PostingInput.

The first eligible queued input is selected by:

```text
effective_at
posting_priority
posting_sequence
```

If the optimistic preloaded candidate is no longer first, the transaction returns `RACE_RETRY`.

## Replay protection

If:

```text
replay_required = true
```

or posting mode is not `NORMAL`, normal posting does not advance.

## Atomicity

These effects commit in one PostgreSQL transaction:

```text
PostingRun
LedgerEntry[]
LedgerBalance updates
PostingInput → POSTED
EnterpriseRuntimeState high-water
```

Failure rolls all of them back.

A separate failure record can then be written without any partial ledger result.

## Controlled posting AST

M3 supports expression nodes:

```text
literal
field
not
and
or
eq / ne / gt / gte / lt / lte
add / sub / mul / div
```

No `eval`, JavaScript callback, SQL expression or arbitrary code is accepted.

## Numeric authority

Authoritative decimal arithmetic uses `decimal.js`.

JSON fractional `number` values are rejected for authoritative arithmetic.

Use:

```json
"12.50"
```

rather than:

```json
12.50
```

Safe integer JSON values such as `20` are accepted.

Ledger quantities/amounts persist as PostgreSQL `numeric(38,12)`.

## Ledger effect

A rule produces:

```text
ledgerCode
quantity
amount
unit
currency
dimensions
posting rule lineage
```

## Dimension identity

Dimensions are canonicalized by sorted JSON object keys and hashed using SHA-256.

Semantically equal dimension objects with different key insertion order produce the same hash.

## LedgerBalance

Balance is a materialized projection for the active LedgerDataset.

It is rebuildable from LedgerEntry.

It is not source business truth.

## Dataset

M3 introduces `LedgerDataset` even though normal operation uses only one ACTIVE dataset.

This preserves the later Replay/Candidate Dataset upgrade path without requiring a table redesign.

## Transaction boundary

`LedgerWriter` accepts an internal `DatabaseTransaction` token.

This is an in-process modular-monolith contract, not a future external service contract.

If Ledger is ever extracted, a remote transport adapter must preserve equivalent atomic/ordering semantics or the extraction is invalid.

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


## Target public submission boundary

The target EVO Ledger Runtime write contract is `BusinessDataSubmissionV010`.

It accepts only the minimal runtime inputs required by Core:

```text
scopeKey
applicationId
businessDataType
businessObjectKey
effectiveAt
payload
correlation / idempotency identity
optional posting priority / expected business version
```

It deliberately does not require:

- ApplicationInstance;
- ApplicationDefinitionVersion;
- CommandDefinition;
- capability discovery;
- actor/permission policy;
- rich Application metadata.

The current Command path remains a compatibility composition layer until the submission contract is backed by the existing atomic BusinessData + PostingInput transaction and PostgreSQL-proven.

`applicationId` is the exact ApplicationAnchor routing key used for PostingRule selection.

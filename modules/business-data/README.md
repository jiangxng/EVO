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


## ApplicationId schema convergence — phase 1

The compatibility schema now carries additive `application_id` columns on `business_data` and `posting_input`.

Migration behavior:

1. prefer explicit legacy compatibility metadata `application_instance.config.sourceApplicationId`;
2. fall back to `application_definition.code` only for older rows that predate that explicit mapping;
3. keep legacy `application_instance_id`, `command_execution_id` and `metadata_version` columns unchanged;
4. compatibility Command writes dual-write the resolved `application_id`.

The new columns intentionally remain nullable in phase 1 for rolling-deployment safety. A later gate may tighten constraints only after database evidence proves all active write paths populate the target routing key.


## ApplicationId schema convergence — phase 2

After phase 1 dual-write is active, migration phase 2 performs a fail-closed coverage check.

It refuses to continue if any persisted `business_data.application_id` or `posting_input.application_id` is null.

Only after complete coverage is proven does it apply:

```text
business_data.application_id NOT NULL
posting_input.application_id NOT NULL
```

Legacy `application_instance_id`, `command_execution_id` and `metadata_version` dependencies remain intact in this phase. Removing or relaxing them belongs to the direct BusinessDataSubmission transaction cutover, not this constraint step.


## Direct submission durable idempotency

Direct `BusinessDataSubmissionV010` does not create synthetic `CommandExecution` rows.

Its durable idempotency/result receipt is:

`business_data_submission_receipt`

The receipt stores:

- resolved internal enterprise scope;
- original `scopeKey`;
- exact `applicationId`;
- idempotency/correlation identity;
- deterministic request digest;
- PROCESSING / COMPLETED / FAILED status;
- stable result/error envelope.

The uniqueness key is:

```text
enterprise_id + application_id + idempotency_key
```

This is runtime idempotency only. It does not add actor, permission, CommandDefinition or rich Application semantics back into EVO Core.


## Shared atomic write core

The compatibility Command path and the future direct `BusinessDataSubmissionV010` path converge on one atomic write primitive:

`modules/business-data/application/atomic-business-data-write.ts`

That primitive owns, inside one database transaction:

1. business object version allocation by exact `applicationId`;
2. BusinessData insertion;
3. runtime-state lock and posting-sequence allocation;
4. retroactive/replay-required calculation;
5. PostingInput insertion;
6. runtime-state high-level sequence/replay update;
7. BusinessData outbox event creation.

The current Command adapter still supplies legacy provenance columns because the database schema has not yet relaxed them. The next bounded slice makes those legacy provenance fields optional for direct submission without changing the shared atomic write algorithm.


## Direct submission port — implementation slice

The target `BusinessDataSubmissionPortV010` now has a PostgreSQL adapter:

`modules/business-data/infrastructure/postgres-business-data-submission.ts`

The direct path:

```text
scopeKey
  -> injected scope resolver
  -> enterpriseId

applicationId
  -> canonical runtime routing key

BusinessDataSubmission
  -> durable idempotency receipt
  -> shared atomic BusinessData + PostingInput writer
  -> current Posting pipeline
```

It does **not** create a synthetic `CommandExecution` and does not require
`ApplicationInstance`, `CommandDefinition` or `metadataVersion`.

Legacy provenance columns remain readable/writable for compatibility Command
rows but are nullable for direct runtime submissions. `application_id`
remains mandatory.

Normal Posting may therefore carry a null legacy `metadata_version`; normal
rule execution already uses the current PostingRule registry keyed by exact
`applicationId`. Historical candidate replay remains fail-closed when its
legacy metadata pin is absent until a current-rule replay contract is defined.

This slice implements the port only. Public HTTP transport and PostgreSQL
end-to-end proof remain separate gates.


## PostgreSQL direct-submission proof

The isolated certification `direct-business-data-submission` proves the
target write path against PostgreSQL:

```text
BusinessDataSubmission(applicationId=sales_order)
  -> durable submission receipt
  -> BusinessData(no Command/ApplicationInstance provenance)
  -> PostingInput(applicationId=sales_order)
  -> current PostingRules(applicationId=sales_order)
  -> normal Posting
  -> LedgerEntry / LedgerBalance
```

The proof also verifies deterministic idempotent replay, rejection of
idempotency-key reuse with a changed request, and absence of synthetic
`CommandExecution` state.

This closes the database proof for the port. Public transport remains a
separate convergence slice.


## Minimal ApplicationAnchor registry

Direct BusinessData submission now requires a registered `applicationId`.

The target Core anchor is intentionally tiny:

```text
ApplicationAnchor
= applicationId
```

It does not own rich Application metadata, lifecycle, permissions, capability
discovery or package state.

The PostgreSQL compatibility migration backfills anchors from existing
Application/PostingRule/runtime identities. New reference/demo and Configurator
configuration paths register their runtime applicationId explicitly.

Unknown applicationId fails before a submission receipt or BusinessData row is
created.


## Generic HTTP transport

The target Core write transport is now `POST /api/v1/business-data`.

The route is intentionally thin:

```text
HTTP JSON
  -> runtime scope adapter
  -> ApplicationAnchor check
  -> BusinessDataSubmissionPortV010
```

It does not perform capability discovery, actor authorization, rich Application
resolution or Command orchestration. Those remain Host/Application concerns.

The isolated certification `business-data-submission-http` proves the HTTP
request reaches the same direct port and deterministic Posting/Ledger path
without synthesizing legacy Command metadata.

# Command → BusinessData Contract

**Owner:** `modules/command`  
**Durable history owner:** `modules/business-data`  
**Status:** M2 v0.1

## Purpose

Provide the single controlled business-write path used by Human, AI, Automation and External System actors.

## Canonical transaction

```text
Resolve Command Capability
↓
Begin DB Transaction
↓
Check Idempotency
↓
Create CommandExecution
↓
Allocate BusinessObjectVersion
↓
Create BusinessData
↓
Lock EnterpriseRuntimeState
↓
Allocate PostingSequence
↓
Detect Retroactive Input
↓
Create PostingInput
↓
Create OutboxEvent
↓
Complete CommandExecution
↓
Commit
```

`CommandExecution + BusinessData + PostingInput + OutboxEvent` are atomic.

## Idempotency

Scope:

```text
enterprise
+ actor type/id
+ application instance
+ command
+ idempotency key
```

A completed duplicate returns the previously persisted result.

It does not create new BusinessData.

## BusinessData

BusinessData is durable business history.

A change to a business object creates another BusinessData record with a higher `business_object_version`.

M2 does not create a universal correction/reversal graph.

## Optimistic business version

Caller may provide:

```text
expectedBusinessVersion
```

Mismatch produces:

```text
BUSINESS_VERSION_CONFLICT
```

## Posting sequence

Sequence is allocated under an EnterpriseRuntimeState row lock.

Initial consistency domain:

```text
enterprise
```

Future architecture may split this into finer Consistency Domains without changing the Command contract.

## Canonical posting key

```text
(effective_at, posting_priority, posting_sequence)
```

Sequence allocates stable uniqueness/tie-breaking.

It does **not** override effective business time.

## Retroactive input rule

Let:

```text
H = last authoritative posted canonical key
C = candidate canonical key
```

If:

```text
C <= H
```

then the candidate is retroactive.

M2 behavior:

```text
retroactive = true
replay_required = true
posting_input.status = BLOCKED_REPLAY_REQUIRED
```

It must not be silently appended to the authoritative live posting history.

## Replay interaction

If EnterpriseRuntimeState already has:

```text
replay_required = true
```

or posting mode is not NORMAL, newly created PostingInput is blocked rather than live-posted.

BusinessData creation is still allowed.

M6 will implement full replay orchestration and post-replay queued-input inspection.

## Security

M2 carries Actor identity but does not yet implement the complete permission engine.

The public Command boundary is designed so permission/precondition checks can be inserted before durable commit without changing downstream contracts.

## Performance

Command execution must not scan all BusinessData.

Business-object version lookup is bounded by:

```text
enterprise_id
application_instance_id
business_object_key
```

Posting sequence allocation locks one EnterpriseRuntimeState row.

This deliberately serializes sequence allocation per Enterprise in v0.x.

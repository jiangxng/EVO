# ADR-0002 — Retroactive PostingInput Requires Replay

**Status:** ACCEPTED  
**Milestone:** M2

## Context

EVO's canonical posting order is:

```text
effective_at
+ posting_priority
+ posting_sequence
```

A new business record can be created today with an effective time in the past.

If Posting has already advanced beyond that canonical position, appending the new record live would make normal execution differ from a full replay.

## Decision

Maintain an authoritative posting high-water key per initial Enterprise consistency domain:

```text
last_posted_effective_at
last_posted_priority
last_posted_sequence
```

For candidate `C` and high-water `H`:

```text
C <= H
```

means the candidate is retroactive.

The Command transaction:

```text
creates BusinessData
creates PostingInput
marks PostingInput BLOCKED_REPLAY_REQUIRED
sets replay_required = true
```

It does not live-post the input.

## Replay boundary clarification

Replay membership and replay ordering are separate concepts.

Membership can be bounded by a stable `posting_sequence` captured at replay start.

The included set is then sorted by canonical posting key:

```text
effective_at
posting_priority
posting_sequence
```

A BusinessData/PostingInput created during replay with a sequence above the boundary may itself be retroactive relative to the rebuilt high-water.

Before returning to NORMAL, M6 must inspect queued inputs.

If any are retroactive, another replay is required rather than silently resuming out of order.

## Consequences

- Deterministic full replay remains possible.
- Backdating remains supported.
- Heavy backdating can cause repeated replay work.
- Operational closed-period policies may later reduce replay frequency.
- Future Consistency Domain partitioning moves this high-water from Enterprise to `(enterprise, consistency_domain)`.

## Alternatives rejected

### Order only by posting_sequence

Rejected because it destroys effective business-time semantics.

### Append backdated data and fix later

Rejected because authoritative state would knowingly violate replay determinism.

### Reject all backdated business data

Rejected as a universal architecture rule; many enterprise domains require legitimate backdating.

## Roll-forward

M6 completes replay orchestration around this state.

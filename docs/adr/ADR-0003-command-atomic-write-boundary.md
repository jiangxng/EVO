# ADR-0003 — Command Atomic Write Boundary

**Status:** ACCEPTED  
**Milestone:** M2

## Decision

The initial Command persistence boundary is one PostgreSQL transaction containing:

```text
CommandExecution
BusinessData
PostingInput
OutboxEvent
EnterpriseRuntimeState sequence/replay update
```

## Why

A successful Command must not produce states such as:

```text
BusinessData without PostingInput
PostingInput without BusinessData
external event without committed BusinessData
```

## Consequence

Command/BusinessData remain close to the transactional core in the modular monolith.

Future message brokers consume the transactional outbox instead of being inserted into the business transaction.

## Service extraction

Do not extract Command/BusinessData into independent distributed services until a proven scaling or isolation requirement outweighs the atomicity benefit.

# EVO Philosophy — Canonical

Status: Authoritative
Context Version: 1.0

## Product Definition

EVO is an **Enterprise Operating System**.

> EVO models the enterprise. EVO runs the enterprise. EVO helps the enterprise improve itself.
>
> 描述企业。运行企业。持续优化企业。

EVO is not defined by a fixed collection of ERP modules. It is a computable enterprise operating model in which business semantics, commands, facts, derived state, work, management intelligence, and evolution are explicit and versioned.

## Truth Model

1. Business history is preserved.
2. Actual business writes enter through Command.
3. BusinessData is the durable historical business record used for reconstruction.
4. Posting, Ledger, Balance, Cost, Work, Metrics and management intelligence are derived from governed inputs.
5. Replay reconstructs derived actual state; it never re-executes Commands.
6. Simulation explores hypothetical state and never silently contaminates Actual.
7. AI is an actor and reasoning layer, not the source of enterprise truth.
8. Application/UI is a tool for operating enterprise capabilities, not an independent fact system.

## Engineering Philosophy

EVO must remain understandable by humans and by different LLMs without depending on a private conversation history.

The repository is the authoritative long-term engineering context. Architecture, concepts, invariants, public interfaces, ADRs, schemas, migrations, tests and runtime facts outrank recollection.

A design is not considered safely captured until it is represented by the appropriate combination of documentation, machine-readable contract and executable verification.

## Concept Introduction Rule

Do not add a new core conceptual object merely because an implementation is inconvenient.

Prefer existing primitives, lineage and semantic projections. Promote a concept to a first-class runtime object only when it has an independent lifecycle, independent invariants, or independent governance requirements.

## Change Rule

Architecture and contract change follows:

Requirement Change → Architecture/ADR → Interface Impact → Data Impact → Migration Plan → Tests → Release Plan.

Breaking semantic changes require explicit versioning and migration. "Latest" must not be an implicit source of truth for historical reconstruction.

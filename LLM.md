# EVO LLM Context Contract

Status: Authoritative
Context Contract Version: 1.0

This file is model-agnostic. It is intended for GPT, Claude, Gemini, local/open models, coding agents and future systems.

## Goal: LLM Context Determinism

Different LLMs are allowed to propose different implementations. They are not allowed to reinterpret EVO's canonical philosophy, concepts, invariants or public contracts without an explicit architecture change.

A model must be able to understand EVO from the repository without relying on prior chat history, account memory, hidden prompts or undocumented conventions.

## Mandatory Read Order

Before architecture or cross-module work, read:

1. `/PHILOSOPHY.md`
2. `/CONCEPTS.md`
3. `/INVARIANTS.md`
4. `/ARCHITECTURE.md`
5. `/PUBLIC-API.md`
6. `/architecture.manifest.json`
7. `/context.manifest.json`
8. relevant module `README.md` and `CONTEXT.md`
9. relevant interface docs and ADRs
10. relevant tests before implementation changes

For a bounded module change, load only the minimum authoritative context listed in `context.manifest.json` plus dependencies/interfaces. Do not ingest the repository indiscriminately if the bounded context is sufficient.

## Source Priority

When sources conflict, use this priority:

1. Explicit current Architecture Change / ADR with later version
2. Global Invariants
3. Public API / interface contracts
4. Architecture and canonical Concepts/Philosophy
5. Module context
6. Executable tests and schemas (tests may reveal drift; do not silently redefine architecture from an accidental test)
7. Implementation
8. comments / examples
9. chat history or model memory

If authoritative sources conflict at the same level, stop architectural modification and report the conflict. Do not invent a reconciliation.

## Required Change Behavior

Before changing code, state internally:

- owner module
- impacted public interfaces
- impacted invariants
- data migration impact
- replay/determinism impact
- compatibility impact
- required tests

Do not create a new core concept solely to simplify implementation.

## Forbidden Assumptions

- Do not assume BusinessData is a mutable current-state table.
- Do not replay by calling Commands.
- Do not let AI directly insert Actual BusinessData.
- Do not infer fulfillment/causation from equal quantities or matching timestamps.
- Do not write derived Cost results directly into balances without a declared valuation-posting interface.
- Do not treat Application as the enterprise truth model.
- Do not silently select latest metadata/rules for historical reconstruction.

## Output Expectations for Coding Agents

A code change should include, when relevant:

- implementation
- interface/schema changes
- migration
- contract tests
- architecture/invariant tests
- documentation/ADR update
- compatibility statement
- reproducible validation command

The repository, not the conversation, is EVO's long-term memory.

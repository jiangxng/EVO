# Human + LLM Operability Principle v0.1

**Status:** ACCEPTED  
**Date:** 2026-09-24

## Principle

All EVO-family products and plugins must be designed so that:

> LLMs can understand and maintain them, business users can understand and operate them, and ordinary users should not depend on developers for normal configuration and use.

This is a cross-project product and engineering principle, not a Ledger Runtime-specific rule.

## What LLM-native means here

LLM-native does **not** mean hiding the system behind generated code.

It means:

- LLMs can understand the domain model, contracts, configuration and runtime behavior from explicit repository artifacts;
- LLMs can implement, validate, explain and evolve the system without relying on undocumented author knowledge;
- business users interact with domain concepts rather than implementation concepts;
- normal configuration remains readable and editable without SQL, source-code changes or developer intervention.

## Human-readable configuration

A configurable business concept must have a human-readable source representation.

Example:

```text
Application: Sales Order
Condition: fulfillmentMode == 'MAKE'
Ledger: Pending Production
Direction: Increase
Quantity: quantity
```

is preferred over exposing only a machine AST.

Machine forms such as AST, IDs, hashes and compiled templates may exist, but they must not become the only understandable representation.

## One semantic truth

Do not maintain one meaning for humans and another meaning for machines.

Preferred model:

```text
business-readable source
        ↓ validate / compile
machine-executable form
        ↓
runtime
```

Both forms must map to the same declared semantics.

## No-developer dependency

Normal business operations should not require a developer to:

- edit source code;
- write SQL;
- modify database schemas;
- call hidden internal APIs;
- understand class names or framework internals;
- manually translate business rules into implementation structures.

Developers extend engine capabilities. They are not the mandatory operators of ordinary business configuration.

## Progressive disclosure

The default experience should be understandable to a novice.

Advanced detail may be available when needed, but complexity should be progressively disclosed.

```text
novice
→ business terms and guided forms

advanced user
→ formulas, conditions, dependencies, versions

developer / LLM
→ schemas, AST, contracts, diagnostics, implementation
```

## LLM-readable by construction

Every important business configuration should expose enough semantics for an LLM to answer:

- what this configuration means;
- why it exists;
- when it applies;
- what inputs it reads;
- what output/effect it creates;
- what dependencies it has;
- whether it is valid;
- what would change if it were edited.

Prefer explicit names, descriptions, types, examples and constraints over implicit convention.

## UI and error rule

Business-facing UI and errors should explain the business problem first.

Preferred:

```text
Rule cannot be activated because ledger "Inventory" does not exist.
```

Avoid requiring users to interpret only low-level technical error codes. Technical diagnostics may be shown as secondary detail.

## Configuration tools

A configuration/development tool should normally support:

- human-readable viewing;
- guided editing;
- validation;
- explanations;
- import/export;
- comparison when needed;
- safe publish/deploy/burn;
- machine-readable contracts for LLMs.

The simplest useful workflow should work without developer assistance.

## Admission test

For every significant configurable capability, ask:

1. Can a capable LLM understand it from repository/contracts without private conversation history?
2. Can a business user understand what it means without reading code?
3. Can a novice perform the normal operation through the product UI with reasonable guidance?
4. Does normal configuration avoid SQL/source-code changes?
5. Is there one semantic source of truth shared by human and machine representations?
6. Are validation failures explained in business language?
7. Can advanced technical detail remain available without overwhelming ordinary users?

Repeated failure on these questions is a product/architecture problem even if the code works.

## Scope

This principle applies across EVO, Eidos, App Platform, Ledger Runtime, Ledger Runtime Configurator, business plugins, future plugins and future projects derived from this architecture.

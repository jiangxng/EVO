# Project Continuous Integration Constitution v0.1

**Status:** Founder-confirmed / authoritative cross-project principle  
**Date:** 2026-09-24  
**Scope:** EVO, EVO App Platform, Eidos, Experience Compiler and future EVO-family repositories.

## 1. One growing system

The project is not a collection of experiments.

The intended development model is:

```text
small vertical slice
→ correct owner repository
→ stable public boundary
→ automated tests
→ CI gate
→ merge to main
→ next slice composes with it
→ ...
→ large integrated enterprise system
```

A demo may prove something. It is not a new product architecture.

## 2. Cross-project ownership

```text
EVO Ledger Runtime
  owns generic BusinessData → PostingRule → LedgerEntry → LedgerBalance execution

EVO App Platform
  owns Package / Feature lifecycle, dependency resolution, effective capabilities and Experience Contributions

Eidos
  owns reusable human-experience capabilities, renderers and the canonical App Host

Experience Compiler
  owns higher-level intelligence, learning and experience production through public contracts
```

Repository topology may evolve; ownership boundaries remain explicit.

## 3. Frontend constitution

For EVO-family products, Eidos is the frontend framework boundary.

```text
Product semantics / lifecycle
        ↓ public Experience contract
Eidos Capability + Runtime + Renderer
        ↓
Eidos App Host
        ↓
Human
```

If a required reusable interaction is missing:

1. identify the missing generic Eidos capability;
2. add it to Eidos behind a stable public contract;
3. validate it with Eidos tests/CI;
4. consume it from the product.

Do not create a parallel business frontend framework inside EVO/App Platform.

Host bootstrap, transport, authentication and outer shell are allowed host responsibilities. Product interaction semantics remain Eidos-owned.

## 4. App Host constitution

Eidos App Host is the canonical product container.

It discovers effective Experience Contributions and provides:

- bootstrap;
- route/navigation hosting;
- page loading;
- Eidos rendering;
- ActionHost/data adapter boundaries;
- refresh after lifecycle changes.

Installed Apps do not each create their own shell.

The growth model is:

```text
App Platform lifecycle changes
→ effective Experience Contributions change
→ App Host refresh
→ navigation/routes/pages change
```

## 5. Installation-first validation

An installable plugin is not end-to-end validated by opening an already-installed page.

Required product journey:

```text
Plugin Store / Catalog
→ install plan
→ dependency/capability resolution
→ Package installation
→ Feature activation
→ effective Contributions
→ App Host discovery
→ Eidos-rendered Experience
→ representative business action
→ authoritative runtime result
```

Direct API/component tests remain useful but must be labeled as component evidence.

## 6. Reuse before replacement

Before creating a new implementation, inspect:

- current mainline;
- active branches;
- historical branches;
- prior architecture documents;
- existing public contracts/capabilities.

Historical implementation is project capital.

Use:

```text
Discover
→ Reuse / Adapt
→ Converge to main
→ Deprecate superseded path
```

rather than repeatedly creating new demos.

## 7. CI as project memory

Every accepted capability must be protected by deterministic CI appropriate to its owner repository.

At minimum, meaningful changes should leave:

- build/typecheck evidence;
- unit/contract tests;
- architecture/invariant validation where available;
- integration/E2E evidence for the accepted boundary;
- current documentation/status pointers.

A future LLM should be able to continue without the conversation that created the capability.

## 8. MVP interpretation

MVP limits horizontal breadth, not depth inside an accepted boundary.

When a representative full dataset exists, use it. For Ledger Runtime Configurator, the 912-rule corpus remains a full in-boundary acceptance/stress dataset rather than optional later scope.

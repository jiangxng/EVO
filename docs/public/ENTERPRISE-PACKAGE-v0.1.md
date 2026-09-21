# EVO Enterprise Package Contract v0.1

Status: EXPERIMENTAL / EVO-OWNED  
3EC request: CRCP-EC-EVO-004  
Owner: EVO

## Purpose

An Enterprise Package is a portable, versioned definition of **how an enterprise is configured to operate in EVO**. It is not a second runtime model and it is not a container for actual commercial history.

The package projects EVO-owned definition semantics. Runtime execution remains:

`Command -> BusinessData -> PostingInput -> PostingRule/Condition -> LedgerEntry -> Balance -> Cost/Valuation`

Replay/recalculation continues to rebuild derived state from preserved business history with pinned definitions/rules.

## Package object model

v0.1 recognizes these definition categories as the canonical vocabulary available to a package implementation:

- Enterprise metadata
- Domain
- Transaction Type
- Application Definition
- Field Group
- Field Definition
- Command Definition
- Capability Definition
- Flow Definition
- SOP Definition
- Metric Definition
- Dimension Definition
- Ledger Definition
- Posting Rule, including condition/effect definitions and explicit dimension mapping
- Cost / Valuation Policy
- portable authorization / role templates where supported

A package object MUST map to an EVO-owned definition contract. Package consumers MUST NOT create a parallel EC/Eidos/3EC definition model inside EVO.

## Application and field semantics

Applications are executable business applications built from semantic fields and field groups. Fields retain business meaning and may describe form editing, read-only rendering, list rendering/editing, filtering, data source, data type/control and validation constraints.

Command input contracts are EVO-owned. A Command Definition may project its admissible input from published field semantics; an external proposal cannot override the Command schema.

## Ledger semantics

A Ledger Definition declares what is measured. Accounting/analytical dimensions declare how entries may be attributed and analyzed. Posting rules explicitly map BusinessData to ledger effects and dimensions; fields present on BusinessData do not implicitly propagate into ledger dimensions.

Posting conditions are versioned definition semantics. Ledger entries are derived, append-only records. Balances are derived from ledger entries and are not portable definition data.

## Definition-only boundary

`DEFINITION_ONLY` export MUST exclude actual runtime/commercial state, including at least:

- BusinessData history
- PostingInput runtime records
- LedgerEntry
- Balance/projection rows
- CostResult / CostRun runtime results
- WorkItem/runtime queues
- CommandExecution history
- outbox/delivery state
- replay runtime state
- credentials, secrets, tokens and live grants

Instance-local identifiers and bindings may be represented only through explicitly documented portable references/placeholders.

## Public operations

The first public capability surface is:

1. `GetEnterprisePackageCapabilities()` — discover supported package versions, runtime compatibility and supported object kinds.
2. `GetEnterprisePackageSchema(version)` — obtain the authoritative machine-readable package schema.
3. `ValidateEnterprisePackage(package)` — side-effect-free structural and semantic validation.
4. `PlanEnterprisePackageDeployment(scope, package, expectedBaseVersion?)` — side-effect-free dependency/change/compatibility plan. This is EVO-owned preflight behavior; it does not grant deployment authority.
5. `DeployEnterprisePackage(scope, package, expectedBaseVersion?, idempotencyKey)` — authorized, governed publication of definitions.
6. `ExportEnterprisePackage(scope, mode=DEFINITION_ONLY)` — authorized projection of portable enterprise definitions.

Validation or a package supplied by EC/3EC/Eidos MUST NOT imply authorization to deploy. EVO reevaluates authorization at mutation time.

## Versioning and determinism

- `packageSchemaVersion` is explicit and pinned.
- Package dependencies and referenced definition versions are explicit.
- Unsupported versions fail closed; consumers do not assume `latest`.
- Breaking package semantics require a new package schema version and compatibility/migration evidence.
- Deployment is idempotent for the same scope/package identity/version/idempotency key.
- Existing published definitions are not silently mutated in place where their EVO contract requires versioned publication.

## Round-trip property

For supported portable definition categories:

`Export(DEFINITION_ONLY, Enterprise A) -> Validate -> Deploy(clean compatible EVO)`

MUST recreate a semantically equivalent governed enterprise operating definition, modulo documented instance-local identities, bindings and secrets. Byte equality is not required.

## Relationship to 3EC

3EC governs the cross-project request, compatibility and certification. EVO owns this package contract and its implementation. EC compiles to EVO-published schemas; Eidos may consume relevant published definitions for experience realization; neither may redefine EVO operational truth.

Any new cross-project semantic requirement discovered while implementing this contract must be proposed in 3EC before another project's contract is changed.

# metadata module

## Purpose

Own versioned enterprise/application metadata and effective-definition resolution.

## Responsibilities

- Enterprise metadata
- Domain / Transaction Type
- ApplicationDefinition
- ApplicationDefinitionVersion
- FieldGroup / FieldDefinition
- ApplicationInstance
- EnterpriseApplicationOverlay
- CommandDefinition metadata
- PostingRule metadata
- LedgerDefinition metadata
- ValuationPolicy metadata
- EffectiveDefinitionResolver

## Non-responsibilities

- Execute Commands
- Create BusinessData
- Execute Posting
- Persist LedgerEntry
- Calculate Cost
- Execute Replay

## Owned data

See `architecture.manifest.json` and migration `202609090010_m1_metadata_kernel.sql`.

## Public interfaces

- `MetadataReader`
- `MetadataWriter`
- `EffectiveDefinitionResolver`
- `MetadataService`

See `docs/interfaces/metadata-kernel.md`.

## Critical invariants

See:

- `docs/invariants/core.md`
- `docs/invariants/metadata.md`

## Dependency direction

Metadata may depend on platform primitives and identity abstractions.

Downstream modules may consume metadata public API.

No downstream module may import `metadata/infrastructure`.

## Transaction boundaries

- Effective resolution: read-only
- Create application skeleton: one transaction
- Publish version: one transaction

## Failure behavior

No partial publication is allowed.

Overlay/base version mismatch is explicit and must not be auto-corrected.

## Performance

Metadata paths must stay bounded and indexed.

Do not introduce runtime BusinessData/Ledger scans into metadata resolution.

## Replay behavior

Metadata is version identity consumed by replay.
Replay may select versions but must not mutate metadata.

## Observability

M1 relies on caller/runtime structured error handling. Module-level trace instrumentation is added when API endpoints are introduced.

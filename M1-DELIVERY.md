# EVO M1 — Metadata Kernel Delivery

## Delivered

M1 turns EVO-01/EVO-08 metadata concepts into executable storage and interfaces.

Implemented:

- Enterprise
- DomainDefinition
- TransactionType
- ApplicationDefinition
- ApplicationDefinitionVersion
- FieldGroupDefinition
- FieldDefinition
- ApplicationInstance
- EnterpriseApplicationOverlay
- CommandDefinition
- PostingRule
- LedgerDefinition
- ValuationPolicy
- MetadataReader
- MetadataWriter
- MetadataService
- EffectiveDefinitionResolver
- PostgreSQL repository
- metadata invariants
- interface contract
- ADR
- unit tests
- M1 demo seed

## Important locked behavior

```text
EffectiveConfig
=
Base Definition Config
+ ApplicationInstance Config
+ Published Enterprise Overlay
```

Published overlay must target the selected base definition version.

EVO M1 does **not** guess or silently rebase stale overlays.

## Valuation policy default

M1 locks initial negative inventory policy to:

```text
DISALLOW_NEGATIVE
```

Additional policies require a later explicit design change.

## Next

M2 — Command + BusinessData.

M2 will introduce:

- AuthContext/Actor execution context
- Command catalog/lookup
- CommandExecution
- idempotency
- BusinessData
- PostingInput
- enterprise posting sequence allocation
- outbox
- command transaction
- first Sales Order command path
- retroactive/backdated posting detection state foundation

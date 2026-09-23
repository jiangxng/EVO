# Metadata Kernel Interface

**Owner:** `modules/metadata`  
**Status:** M1 v0.1

## Purpose

Provide stable metadata lookup and controlled metadata mutation without exposing PostgreSQL persistence details. Application metadata may be versioned; PostingRule lifecycle/version governance is not a Core responsibility.

## Primary read interface

`MetadataReader`

### Guarantees

- Enterprise-scoped ApplicationInstance lookup requires `enterpriseId`.
- Published definition lookup returns at most one currently published version.
- Field, Command and PostingRule collections are returned in deterministic order.
- Callers do not receive Kysely/database row types.
- MetadataReader performs no business runtime mutation.

## Primary write interface

`MetadataWriter`

M1 supports:

- create Enterprise
- create Domain/TransactionType/Application skeleton
- create DRAFT ApplicationDefinitionVersion
- publish ApplicationDefinitionVersion

Publishing is transactional.

At most one definition version for an ApplicationDefinition is `PUBLISHED`.

The prior published version is moved to `RETIRED`.

## EffectiveDefinitionResolver

### Input

```text
enterpriseId
applicationInstanceId
```

### Output

`EffectiveApplicationDefinition`

### Resolution order

```text
Published / pinned ApplicationDefinitionVersion.baseConfig
↓
ApplicationInstance.config
↓
Published EnterpriseApplicationOverlay.patch
```

### Overlay semantics in M1

- object keys merge recursively
- scalar values replace
- arrays replace
- `null` is an explicit value
- structural field-level merge and three-way rebase are intentionally deferred

### Preconditions

- ApplicationInstance belongs to Enterprise.
- ApplicationInstance is ACTIVE.
- Selected definition version exists and is PUBLISHED.
- Published overlay, when present, targets the selected base version.

### Errors

- `APPLICATION_INSTANCE_NOT_FOUND`
- `APPLICATION_INSTANCE_NOT_ACTIVE`
- `PUBLISHED_APPLICATION_DEFINITION_NOT_FOUND`
- `OVERLAY_BASE_VERSION_MISMATCH`

## Transaction boundary

Effective-definition resolution is read-only.

Publishing a definition version is one database transaction.

## Performance

Resolution uses bounded indexed lookups plus parallel reads for:

```text
fields
commands
posting rules
```

No runtime BusinessData or Ledger scan is permitted.

## Versioning

Metadata schema version starts at `1`.

Database schema after M1 is `2`.


## PostingRule lifecycle boundary

PostingRule execution belongs to EVO Posting Core, but PostingRule **version lifecycle** does not.

Normative target:

```text
Rule-owning plugin/package
→ chooses/manages rule drafts, versions, effective dates, rollback, approvals
→ supplies current/governed rule set
→ EVO Core evaluates supplied rules
```

Core MUST NOT require a PostingRule version registry.

The current alpha implementation still retrieves PostingRules through `ApplicationDefinitionVersion`. That is an implementation coupling to be removed in a later bounded refactor; it is not the target architecture.

`ruleSchemaVersion` is a rule-document/schema compatibility field, not a PostingRule business-version lifecycle.

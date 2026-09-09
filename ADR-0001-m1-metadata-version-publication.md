# ADR-0001 — Metadata Version Publication

**Status:** ACCEPTED  
**Milestone:** M1

## Context

EVO requires versioned application metadata and enterprise customization while preserving replay/explanation identity.

## Decision

- `ApplicationDefinition` has immutable version records.
- Editing occurs through `DRAFT` versions.
- One version may be `PUBLISHED`.
- Publishing retires the previously published version in the same database transaction.
- Runtime resolution accepts only PUBLISHED versions.
- Published Enterprise overlay records the base definition version it targets.
- Resolver rejects overlay/base version mismatch instead of guessing how to rebase it.

## Consequences

This creates an explicit upgrade point.

Future three-way overlay merge can be introduced through a new ADR without changing M1's meaning.

## Compatibility

No external API exists yet.

## Migration

Created by `202609090010_m1_metadata_kernel.sql`.

## Roll-forward / rollback

Before production data exists the migration may be reverted manually during development.
Once metadata exists, structural changes should use forward migrations rather than rewriting this migration.

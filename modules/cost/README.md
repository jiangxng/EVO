# cost module

## Purpose

Valuation policies and deterministic cost calculation.

## Owns

`cost state/results`

## Rules

- Public entry points belong under `api/`.
- Domain/application code must not expose persistence records as contracts.
- Another module may not write this module's owned data directly.
- Cross-module dependencies must be declared in `architecture.manifest.json`.
- Importing another module's `infrastructure/` is prohibited.
- Material interface or invariant changes require documentation and tests.

## Status

M0 placeholder. Concrete contracts are introduced by the milestone that implements this module.

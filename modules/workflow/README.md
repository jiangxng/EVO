# workflow module

## Purpose

Process, WorkItem, Plan and Trigger runtime.

## Owns

`workflow runtime`

## Rules

- Public entry points belong under `api/`.
- Domain/application code must not expose persistence records as contracts.
- Another module may not write this module's owned data directly.
- Cross-module dependencies must be declared in `architecture.manifest.json`.
- Importing another module's `infrastructure/` is prohibited.
- Material interface or invariant changes require documentation and tests.

## Status

Work projection is implemented and generation-scoped for CURRENT, Candidate, and
Full-Replay Oracle reference flows. Default reads and refreshes now resolve the
CURRENT generation after activation and no longer create new legacy-null work
rows. Broader workflow/process runtime remains incremental.

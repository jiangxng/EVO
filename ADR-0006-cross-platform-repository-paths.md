# ADR-0006 — Cross-Platform Repository Paths

**Status:** ACCEPTED  
**Milestone:** M3

## Context

EVO is expected to be developed on Windows and Linux.

Case-sensitive development environments can accidentally create paths that collide on default Windows filesystems.

## Decision

Repository paths must be unique after:

```text
Unicode NFKC normalization
+ path separator normalization
+ lowercase normalization
```

Windows-invalid/reserved filenames are prohibited.

Normal source/document paths use lowercase `kebab-case`.

Special conventional root files may retain canonical uppercase names, e.g.:

```text
README.md
ARCHITECTURE.md
LICENSE
```

CI enforces the rule with `repository-paths.test.ts`.

`.gitattributes` normalizes text line endings.

## Migration in M3

Renamed:

```text
docs/invariants/core.md
→ docs/invariants/core.md

docs/invariants/metadata.md
→ docs/invariants/metadata.md

docs/invariants/command-business-data.md
→ docs/invariants/command-business-data.md
```

# Apply EVO M3 Change Set

**Base:** EVO M2 — Command + BusinessData v0.1  
**Target:** EVO M3 — Posting + Ledger v0.1

This package is a change set, not a full repository snapshot.

## Delete / rename first

Delete these old paths:

```text
docs/invariants/core.md
docs/invariants/metadata.md
docs/invariants/command-business-data.md
```

Their lowercase replacements are included:

```text
docs/invariants/core.md
docs/invariants/metadata.md
docs/invariants/command-business-data.md
```

On Windows, prefer `git mv` through a temporary name when Git does not notice case-only renames. Example:

```text
git mv docs/invariants/core.md docs/invariants/core.tmp
git mv docs/invariants/core.tmp docs/invariants/core.md
```

Repeat for the other two files.

## Apply

Copy the included files over the EVO repository root.

Then run:

```text
npm install
npm run migrate
npm run typecheck
npm run test
```

Commit the generated/updated `package-lock.json` after dependency installation.

## Recommended commit

```text
feat(posting): implement deterministic posting and ledger kernel
```

## Important

Do not modify already-applied migration files from M0–M2.
M3 adds a new migration:

```text
202609090030_m3_posting_ledger.sql
```

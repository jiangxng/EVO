# Repository Branch Hygiene

Status: Active  
Authority: EVO engineering workflow

`main` is the repository authority.

Feature, fix, architecture, certification and recovery branches are temporary checkpoints. After a same-repository pull request is merged into `main`, its head branch is deleted automatically.

Cleanup is fail-safe:

- delete only branches backed by a merged PR whose base is `main`;
- never delete `main`;
- never infer deletion from branch naming alone;
- preserve open, closed-but-unmerged and otherwise uncertain branches for explicit reconciliation.

Interrupted LLM work must inspect repository state before continuing and must reuse existing durable checkpoints rather than recreate completed work.

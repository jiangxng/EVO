# EVO GitHub Copilot Instructions

Read `/AGENTS.md`, then `/LLM.md`, then use `/context.manifest.json` to select one
task-specific read profile. Do not scan all historical documents by default.

EVO preserves immutable BusinessData history, deterministic posting and replay,
explicit version/policy/reference-data pins, module ownership, and auditable
evidence. A code change must not weaken these invariants for convenience.

Before editing, identify the owner module, affected public contracts and
invariants, migration and compatibility effects, replay/determinism effects, and
required validation. Treat code/migrations/tests/verified CI as current runtime
reality and current ADRs/Invariants/contracts as normative intent. A conflict is
document drift and must be reported, not silently resolved.

Use Node 24.20.x and PostgreSQL 18. The standard validation order is:

```text
npm install
npm run validate:docs
npm run migrate
npm run typecheck
npm run build
npm test
npm run seed:demo
npm run validate:demo
```

State whether evidence is design-only, implemented, unit verified, database E2E
verified, or certified. Never call local static checks a database certification.

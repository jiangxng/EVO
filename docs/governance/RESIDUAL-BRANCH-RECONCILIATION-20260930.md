# Residual Branch Reconciliation — 2026-09-30

Status: complete candidate  
Authority: `branch.topology.json` + live GitHub compare evidence  
Canonical branch: `main`

## Decision

After merged-PR cleanup, fourteen historical refs remained. Each was compared against current `main` and checked against EVO's machine-readable branch topology and current `project.status.json`.

No residual branch remains active work.

## Assets migrated before retirement

Three historical branches contained durable architecture content that was still useful but should not be wholesale-merged from stale bases:

- `architecture/prc-accounting-guidance-convergence` — PRC Accounting Standards Application Guide provenance/template-pack/EOG guidance mapping was selectively migrated onto current mainline documents.
- `docs/project-continuous-integration-constitution` — founder-confirmed cross-project accumulation, Eidos frontend boundary, canonical App Host and installation-first acceptance rules were migrated onto current mainline.
- `evo/plugin-oriented-development-model-v0.1` — accepted plugin-oriented development ADR was copied into the current architecture decision set.

Their old refs are retired after migration.

## Superseded implementation/history

- `eog/runtime-observation-public-api-v0.1` — superseded by current runtime-observation contract/service/PostgreSQL reader and public API route.
- `evo/core-boundary-audit-v0.1` — historical migration audit superseded by the current minimal EVO Ledger Runtime boundary and current Core boundary/code-planning authority.
- `evo/eel-c01-final-certification-v0.1` — fully contained historical certification ancestor.
- `evo/eel-c01-full-replay-equality-v0.1` — abandoned predecessor superseded by merged v0.2.
- `evo/eel-c01-settlement-allocation-v0.1` — abandoned predecessor superseded by merged v0.2.
- `evo/effective-capability-discovery-v0.1` — superseded compatibility experiment; current architecture places broad capability ownership in Host/App Platform while main retains compatibility behavior where required.
- `evo/enterprise-package-v0.1` — ancestor milestone absorbed by later certified integration work.
- `evo/post-fai-07-finance-gap-alignment-v0.1` — superseded by the minimal EVO Ledger Runtime boundary; do not restore broader Finance ownership into mandatory Core.
- `evo/recovery-full-template-build` — ancestor milestone fully absorbed.
- `convergence/upstream-readiness-v0.2.1` — diverged historical convergence evidence; no wholesale merge.
- `v0.3.0-apm-runtime` — early diverged APM integration experiment; later public-boundary work supersedes the branch.

## Topology rule

Physical Git refs are not long-term architecture memory. `branch.topology.json`, PR history, CI evidence, current mainline code and durable architecture documents are the authority.

A retired branch must not be revived or wholesale merged. Any future reuse starts from current `main` and selectively reintroduces only still-valid intent under current contracts, invariants and tests.

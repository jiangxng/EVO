# EVO CI Foundation v0.1

Status: Active  
Authority: repository CI contract

## Purpose

EVO CI protects deterministic runtime behavior, replay/accounting evidence, upgrade safety and production artifact viability. CI coverage is declared as repository data rather than duplicated workflow prose.

## Authority

- `ci/certification-manifest.json` is the machine-readable validation inventory.
- `.github/workflows/ci.yml` executes that inventory.
- `package-lock.json` pins the npm dependency graph.
- `CI / gate` is the single stable merge-gate status produced only after every required lane succeeds.

## Required lanes

1. **plan** — validates that every governed `validate:*` npm script is assigned exactly once to the certification manifest.
2. **quality** — documentation/context validation, migration, typecheck, build, tests, demo seed and baseline business/runtime certifications.
3. **certification** — isolated PostgreSQL certification matrix for replay, EEL, FAI and public capability behavior.
4. **migration-upgrade** — constructs the immediately previous schema state, preserves representative enterprise data, runs the production migrator to current, verifies checksums/data preservation, and reruns migration to prove idempotence.
5. **production-artifact** — builds the real production Docker image, migrates/seeds through that image, starts the API and Worker, and proves liveness/readiness.
6. **gate** — fails unless every required lane succeeded.

## Execution policy

- Pull-request runs use concurrency cancellation so superseded commits stop consuming CI capacity.
- Main-branch runs are never cancelled by newer main runs.
- Every job has an explicit timeout.
- Ordinary CI has `contents: read` only.
- Each database certification receives an isolated PostgreSQL 18 service.
- Existing business certifications are not reduced when the workflow is refactored.

## Dependency determinism

Node is pinned to 24.20.0 in CI and the production image. npm installs use `npm ci`; dependency resolution is governed by `package-lock.json`.

## Merge protection

The stable required check is:

`CI / gate`

Repository branch protection/rulesets should require this check before changes enter `main`. This setting lives in GitHub repository administration rather than repository source, so the repository can verify the contract but cannot self-authorize that administrative setting.

## Change rule

Adding, renaming or removing a `validate:*` npm script requires updating `ci/certification-manifest.json`. CI fails when the package scripts and manifest diverge.

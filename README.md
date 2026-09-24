# EVO — Product Knowledge Repository + EVO Ledger Runtime

Current implementation baseline: **v1.0.0-alpha.2**  
Target component: **EVO Ledger Runtime**  
中文产品别名：**EVO 账本引擎**

This repository intentionally has **two scopes**:

1. **EVO broader product/knowledge scope** — product positioning, enterprise-system requirements, historical architecture, reference business loops, plugin ideas and future capabilities.
2. **EVO Ledger Runtime** — the small deterministic calculation component currently being simplified in this repository.

Broader EVO requirements are real and must be preserved, but they do not automatically belong inside the Ledger Runtime.

Target runtime spine:

```text
BusinessData submission(applicationId)
→ ApplicationAnchor(applicationId)
→ current PostingRules(applicationId)
→ LedgerEntry
→ LedgerBalance
```

The EVO Ledger Runtime also owns generic recalculation, runtime-data clear, full runtime export, and result/status query.

The EVO Ledger Runtime owns a minimal ApplicationAnchor/applicationId used to route BusinessData to current PostingRules. EVO does **not** target ownership of identity, users/roles/permissions, rich Enterprise/Application definitions or lifecycle, Package/Feature lifecycle, capability discovery, PostingRule version governance, UI/Agent orchestration, statutory accounting, financial statements, workflow/SOP/metrics, or audit/archive policy. Those belong to the Host/App Platform or installable plugins.

The current repository contains broader implementation assets from earlier stages. They remain useful and tested, but repository location does not make them part of the target EVO Ledger Runtime.

The authoritative boundary is:

`docs/architecture/decisions/2026-09-24-evo-minimal-runtime-plugin-boundary-v0.1.md`

Refined application-routing boundary:

`docs/architecture/decisions/2026-09-24-minimal-application-routing-anchor-v0.1.md`

AI/coding agents start with `AGENTS.md`, then `LLM.md`, and use `context.manifest.json` to select a bounded read profile.

## Repository scope rule

Do not delete or relocate broader EVO requirement/positioning documents merely because they are outside the Ledger Runtime.

Use this distinction:

```text
EVO repository requirement
≠
EVO Ledger Runtime responsibility
```

A broader requirement enters the Ledger Runtime only through an explicit ownership/architecture decision.

Repository-scope authority:

`docs/architecture/decisions/2026-09-24-evo-repository-vs-ledger-runtime-scope-v0.1.md`

The repository may be split later if release, deployment, ownership, dependency or LLM-context pressures justify it. No split is required now.

## Current compatibility demo

The existing alpha runtime still demonstrates a broader end-to-end reference flow:

```text
Sales Order
→ BusinessData
→ Posting
→ Ledger
→ Cost / Valuation
→ accounting/reporting projections
→ Replay
```

Those higher-order engines are now treated as plugin/extraction candidates rather than mandatory EVO Ledger Runtime.

## Run current alpha compatibility runtime

```bash
cp .env.example .env
docker compose up -d --build
```

Open `http://localhost:3000/`.

Validate:

```bash
docker compose exec api node dist/scripts/validate-demo.js
```

See `DEPLOY.md` for the current compatibility deployment.

## Convergence rule

Do not rewrite the repository wholesale.

Converge incrementally:

```text
freeze minimal contracts
→ keep current compatibility behavior working
→ introduce generic BusinessData submission
→ move Host/platform concerns outward
→ extract higher-order engines into plugins
→ retire compatibility paths only after replacement proofs pass
```

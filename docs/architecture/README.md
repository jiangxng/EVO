# EVO Architecture Documents

This directory contains the versioned conceptual architecture series.

Canonical implementation entry point: [`/ARCHITECTURE.md`](../../ARCHITECTURE.md)

## AI/LLM navigation

The numbered architecture series below is a genealogy, not a mandatory reading
sequence for every task. AI agents should start at `/AGENTS.md`, then use
`/context.manifest.json` to select a task-specific profile and current pointers.

Current platform / application / APQC pointers:

- `EVO-00-Core-Architecture-v0.1.md` — platform is a composition view; App is the primary business implementation boundary.
- `EVO-13-Enterprise-Operating-Model-Convergence-v0.2.md` — APQC Process/Capability maps explicitly to EVO Capability, Apps, Events, Ledgers, Work and KPIs.
- `../product/EVO-BUSINESS-REQUIREMENT-BASELINE-v0.1.md` — product / implementation / APQC three-view business baseline.

Current business-finance architecture pointers:

- `EVO-00-Core-Architecture-v0.1.md` — EVO is an enterprise operating foundation, not a finance-first platform.
- `EVO-03-Ledger-Conditional-Posting-Model-v0.1.md` — operational/economic ledgers vs governed double-entry General Ledger.
- `EVO-13-Enterprise-Operating-Model-Convergence-v0.2.md` — business/finance capabilities grow through installable applications/packages/plugins.
- `../product/EVO-BUSINESS-REQUIREMENT-BASELINE-v0.1.md` — authoritative business intent for 业财一体.
- `status/EVO-FINANCIAL-ACCOUNTING-INTEGRITY-AUDIT-2026-09-22-v0.1.md` — double-entry readiness gate.
- `status/EVO-PRC-ACCOUNTING-REGULATORY-BASELINE-2026-09-22-v0.1.md` — PRC accounting regulatory baseline.

Current cross-model documentation rules:

- `continuity/EVO-LLM-DOCUMENTATION-OPERATING-STANDARD-v0.1.md`
- `continuity/EVO-CROSS-CHAT-CONTEXT-PROTOCOL-v0.2.md`

Documents under `legacy/` are historical evidence and are not default bootstrap
material.

Recurring repository-level analysis (project intent, plan, progress, risk) and
its analysis methodology:

- `reviews/EVO-REPOSITORY-ANALYSIS-2026-09-20-v0.1.md`

## Architecture series

1. `EVO-00-Core-Architecture-v0.1.md`
2. `EVO-01-Enterprise-Metadata-Model-v0.1.md`
3. `EVO-02-Business-Data-Posting-Sequence-Model-v0.1.md`
4. `EVO-03-Ledger-Conditional-Posting-Model-v0.1.md`
5. `EVO-04-Cost-Valuation-Model-v0.1.md`
6. `EVO-05-Replay-Recalculation-Model-v0.1.md`
7. `EVO-06-Command-Process-Work-Model-v0.1.md`
8. `EVO-07-AI-Native-Architecture-v0.1.md`
9. `EVO-08-Architecture-Convergence-v0.2.md`
10. `EVO-09-Physical-Data-Model-Runtime-Storage-Architecture-v0.1.md`
11. `EVO-10-Service-Boundaries-Runtime-Components-v0.1.md`
12. `EVO-11-API-Command-Contracts-v0.1.md`
13. `EVO-12-Repository-Structure-Implementation-Roadmap-v0.1.md`
14. `EVO-13-Enterprise-Operating-Model-Convergence-v0.2.md`

`EVO-08` is the canonical conceptual convergence baseline. Later documents refine physical/runtime/API/repository implementation decisions.

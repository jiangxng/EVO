# EVO Philosophy — Canonical

Status: Authoritative  
Context Version: 1.1

## Product Definition

**EVO** is the broader product/knowledge space retained in this repository.

The small deterministic component inside it is the **EVO Ledger Runtime**.

> EVO Ledger Runtime（EVO 账本引擎）：接收业务数据。按规则计算。形成账本与余额。可重算、可清空、可导出。

The EVO Ledger Runtime itself is not the complete Enterprise Operating System. Broader EVO product requirements may describe that larger system and remain valid repository knowledge.

The broader enterprise system is composed from multiple installable capabilities:

```text
App Platform / Host
+ Eidos
+ Enterprise Agent
+ business applications
+ rule plugins
+ finance / governance / audit plugins
+ EVO Ledger Runtime
= composable Enterprise Operating System
```

The EVO Ledger Runtime stays deliberately small so it can be installed, replaced, embedded and depended on like any other plugin.

## Repository Scope Principle

The repository is intentionally broader than the Ledger Runtime.

Broader requirements, product positioning and historical architecture are preserved as durable product memory. They must not be deleted merely because their implementation owner is another plugin, App Platform, Eidos, Agent, or a future repository.

```text
valid EVO requirement
≠
automatic EVO Ledger Runtime responsibility
```

Ownership must be decided explicitly.

## Runtime Truth Model

1. A business Application may own its own source/domain data.
2. BusinessData submitted into EVO becomes EVO's current runtime input dataset.
3. BusinessData is immutable while present; explicit Clear Cache may remove the selected runtime dataset.
4. Every BusinessData item carries applicationId. EVO owns a minimal ApplicationAnchor/applicationId and uses it to select the current PostingRules for that application before evaluating conditions.
5. PostingRules are current executable Core configuration supplied by plugins/Host. EVO executes/stores the current rules but does not own their lifecycle/version governance.
6. Posting derives generic LedgerEntry; LedgerBalance is a rebuildable projection.
7. EVO may recalculate retained BusinessData, clear runtime data, export runtime data and expose generic runtime results/status.
8. Long-term audit/archive retention is optional plugin/customer policy, not hidden Core behavior.
9. Identity, permissions, rich Application/Package/Feature lifecycle, capability discovery, workflow and business authorization are outside EVO. Only ApplicationAnchor/applicationId routing stays in Core.
10. Cost, valuation, statutory accounting, financial statements, workflow, SOP, metrics, audit and jurisdiction capabilities default to separate plugins.
11. AI is not part of authoritative EVO runtime calculation.

## Core Boundary Rule

Before adding anything to EVO Ledger Runtime, ask:

> Can generic applicationId → BusinessData → current PostingRules → LedgerEntry → LedgerBalance work correctly if this capability is outside EVO?

If yes, keep it outside Core by default.

Repository location does not determine Core ownership. Historical/broader modules in this repository may remain valuable implementation assets while their target ownership moves to Host or plugins.

## Engineering Philosophy

EVO must remain understandable by humans and by different LLMs without depending on a private conversation history.

The repository is the authoritative long-term engineering context. Architecture, concepts, invariants, public interfaces, ADRs, schemas, migrations, tests and runtime evidence outrank recollection.

A design is not safely captured until it is represented by the appropriate combination of documentation, machine-readable contract and executable verification.

## Concept Introduction Rule

Do not add a new Core conceptual object merely because an implementation is inconvenient.

Prefer the smallest generic runtime primitives. Domain semantics, lifecycle governance and policy belong in plugins unless the generic runtime cannot function without them.

## Change Rule

Architecture and contract change follows:

Requirement Change → Architecture/ADR → Interface Impact → Data Impact → Migration Plan → Tests → Release Plan.

Breaking public runtime contract changes require explicit compatibility/migration handling. Plugin-owned policy/version semantics must not be pulled into EVO Ledger Runtime merely to simplify implementation.


## Human + LLM Operability

EVO-family software must be understandable by capable LLMs and by business users, including novice users.

The operating model does not assume human developers. Approximately 99.9% of software engineering work is intended to be performed by LLMs; humans focus on business intent, judgment, authorization and acceptance. Normal business configuration must not require SQL, source-code changes, hidden APIs or implementation knowledge.

Business-readable configuration is the source-facing form. Machine AST/IDs/hashes/compiled templates may exist behind it, but must not become the only understandable representation.

The same declared semantics must serve humans, LLMs and runtime execution.

Authority: `docs/architecture/principles/HUMAN-LLM-OPERABILITY-v0.1.md`.

# EVO Philosophy — Canonical

Status: Authoritative  
Context Version: 1.1

## Product Definition

EVO is a **lightweight deterministic enterprise-data runtime plugin**.

> 接收业务数据。按规则计算。形成账本与余额。可重算、可清空、可导出。

EVO itself is not the complete Enterprise Operating System.

The broader enterprise system is composed from multiple installable capabilities:

```text
App Platform / Host
+ Eidos
+ Enterprise Agent
+ business applications
+ rule plugins
+ finance / governance / audit plugins
+ EVO Runtime Plugin
= composable Enterprise Operating System
```

EVO stays deliberately small so it can be installed, replaced, embedded and depended on like any other runtime plugin.

## Runtime Truth Model

1. A business Application may own its own source/domain data.
2. BusinessData submitted into EVO becomes EVO's current runtime input dataset.
3. BusinessData is immutable while present; explicit Clear Cache may remove the selected runtime dataset.
4. PostingRules are supplied by plugins/Host. EVO executes them deterministically but does not own their lifecycle/version governance.
5. Posting derives generic LedgerEntry; LedgerBalance is a rebuildable projection.
6. EVO may recalculate retained BusinessData, clear runtime data, export runtime data and expose generic runtime results/status.
7. Long-term audit/archive retention is optional plugin/customer policy, not hidden Core behavior.
8. Identity, permissions, Application/Package/Feature lifecycle, capability discovery, workflow and business authorization are outside EVO.
9. Cost, valuation, statutory accounting, financial statements, workflow, SOP, metrics, audit and jurisdiction capabilities default to separate plugins.
10. AI is not part of authoritative EVO runtime calculation.

## Core Boundary Rule

Before adding anything to EVO Core, ask:

> Can generic BusinessData → supplied PostingRules → LedgerEntry → LedgerBalance work correctly if this capability is outside EVO?

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

Breaking public runtime contract changes require explicit compatibility/migration handling. Plugin-owned policy/version semantics must not be pulled into EVO Core merely to simplify implementation.

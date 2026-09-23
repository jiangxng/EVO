# EVO Architecture Manifest

**Status:** Authoritative repository map  
**Baseline:** EVO-08 through EVO-13 v0.2 + v1.0.0-alpha.2 change set
**Implementation milestone:** v1.0.0-alpha.2 — Dimensions + Valuation Posting  
**Rule:** If implementation conflicts with an accepted architecture decision or invariant, the conflict must be resolved explicitly; do not silently reinterpret the architecture.

## Target Product Boundary — EVO Runtime Plugin

EVO is a lightweight runtime plugin, not the enterprise platform.

```text
Host / App Platform
├─ identity + permissions
├─ Package / Feature / Application lifecycle
├─ capability discovery
├─ rule plugins + rule governance
├─ audit/compliance/archive plugins
├─ UI / Agent / integrations
└─ EVO Runtime Plugin
   ├─ accept BusinessData
   ├─ execute supplied PostingRules
   ├─ LedgerEntry / LedgerBalance
   ├─ runtime recalculation
   ├─ clear runtime data
   ├─ export runtime data
   └─ observe posting/result status
```

The current repository is broader than this target boundary. Existing broader modules are implementation assets and plugin/host extraction candidates; repository presence does not make them Core.

Canonical target runtime flow:

```text
Host / Application
      ↓
BusinessData submission
      ↓
EVO Runtime Plugin
      ↓
supplied PostingRules
      ↓
LedgerEntry
      ↓
LedgerBalance
```

Cost, valuation, statutory accounting, financial statements, workflow, SOP, metrics, audit/archive and jurisdiction logic default to separate plugins/packages.

## Current implementation flow

**Boundary rule:** EVO Runtime Plugin is not the application/identity/governance platform. The Host and plugins supply business data and rules; EVO provides deterministic runtime posting/ledger/balance mechanics.


```text
Human / AI / Automation / External System
                    ↓
                 Command
                    ↓
              BusinessData
                    ↓
              PostingInput
                    ↓
         Conditional Posting
                    ↓
               LedgerEntry
                    ↓
              LedgerBalance
                    ↓
            Cost / State / Work
                    ↓
               Next Command
```

## Foundational invariants

1. BusinessData is immutable while present in the active runtime dataset; explicit Clear Cache may remove the selected runtime dataset.
2. While a runtime dataset exists, business change is represented through additional BusinessData rather than in-place rewrite.
3. Commands create BusinessData; Posting creates Ledger results.
4. Posting order is deterministic.
5. Derived Ledger/Balance/Cost state is rebuildable.
6. Replay does not re-execute historical Commands.
7. Cost valuation is separate from posting-rule evaluation.
8. Actor/capability/permission handling is outside EVO Core; all callers reach EVO through the Host's trusted adapter.
9. Current repository modules must respect ownership while extraction toward the minimal plugin boundary proceeds.
10. Chat memory is not an authoritative architecture store.
11. Generic EVO Ledger is not statutory General Ledger; formal accounting is a Finance plugin built on/alongside EVO runtime.
12. Application, finance, governance and management capabilities are plugins/packages. EVO Core stays limited to generic runtime primitives.
13. Clear Cache clears EVO runtime data only. Rules/application/permission configuration live outside Core and therefore are not cache contents.
14. PostingRules may be changed by their owning plugin/package. Core does not own rule version/effective-date/rollback lifecycle; rule change is never modeled as cache clearing.
15. EVO provides complete export of its own runtime dataset; long-term accounting/audit retention is optional plugin/customer policy.

See `docs/invariants/core.md`.

## Target Core Components

| Target component | Owns | Notes |
| --- | --- | --- |
| business-data runtime | accepted BusinessData in current runtime dataset | Host/Application source data remains external |
| posting runtime | deterministic evaluation of supplied PostingRules, ordering, status/failure | no rule lifecycle/version management |
| ledger runtime | generic LedgerEntry + LedgerBalance | no statutory accounting semantics |
| recalculation/runtime-control | recalculate retained BusinessData, clear runtime data | no application lifecycle |
| export/query | generic current runtime results + complete EVO runtime export | no audit retention policy |

## Current Repository Assets Outside Target Core

The repository currently also contains `identity`, `metadata`, `application`, `capability`, `command`, `workflow`, `cost`, `valuation`, `accounting`, reporting and other modules. They remain useful implementation assets, but target ownership is Host/plugin/compatibility-layer by default.

Machine-readable current-module ownership remains in `architecture.manifest.json`; its `targetBoundary` section is authoritative for Core classification.

## Dependency direction

```text
Host / plugin adapters
   ↓
business-data runtime
   ↓
posting runtime
   ↓
ledger runtime

rule plugins → posting runtime
optional derived plugins → EVO runtime query/events
Host → runtime-control / export
```

## Implementation baseline

- Node.js 24 LTS
- TypeScript
- Fastify
- PostgreSQL
- SQL-first + Kysely
- Vitest
- modular monolith
- API + Worker processes from one repository
- no mandatory message broker in v0.x

## Change rule

Material changes flow through:

```text
Requirement Change
→ Impact Analysis
→ ADR / Design Change
→ Contract/Data Compatibility
→ Migration
→ Tests
→ Gray Release
→ Observe
→ Complete / Roll-forward
```

See `docs/change/README.md`.

## Scale path

```text
Vertical tuning
→ Horizontal API/Worker
→ Table partitioning
→ Enterprise sharding
→ Message broker
→ Compute-heavy extraction
→ Consistency Domain partitioning
→ Distributed EVO
```

## Where to look

- Architecture docs: `docs/architecture/`
- Interface contracts: `docs/interfaces/`
- Invariants: `docs/invariants/`
- ADRs: `docs/adr/`
- Change records: `docs/change/`
- Performance: `docs/performance/`
- Operations: `docs/operations/`


## M1 implementation status

Implemented metadata kernel:

```text
Enterprise
Domain
TransactionType
ApplicationDefinition
ApplicationDefinitionVersion
FieldGroupDefinition
FieldDefinition
ApplicationInstance
EnterpriseApplicationOverlay
CommandDefinition
PostingRule
LedgerDefinition
ValuationPolicy
EffectiveDefinitionResolver
```

Key decision: resolver never guesses how to rebase an overlay onto a different base definition version. A mismatch fails explicitly until a governed upgrade/rebase process is introduced.


## M2 implementation status

Implemented controlled write foundation:

```text
Actor-aware Command
→ CommandExecution
→ BusinessData
→ PostingInput
→ OutboxEvent
```

Atomic in one PostgreSQL transaction.

Initial posting sequence allocation is serialized per Enterprise.

Canonical order remains:

```text
effective_at
+ posting_priority
+ posting_sequence
```

Retroactive inputs do not live-post out of order. They set `replay_required` and remain blocked for Replay.


## M3 implementation status

Implemented deterministic posting and generic ledger foundation:

```text
PostingInput
→ Controlled Posting AST
→ PostingRun
→ LedgerEntry
→ LedgerBalance
→ Authoritative High-Water
```

Normal posting is serialized by initial Enterprise consistency domain and stops while Replay is required.

Ledger effects and high-water advancement are atomic.

Authoritative decimal arithmetic uses decimal strings + `decimal.js`; PostgreSQL persists `numeric(38,12)`.

Cross-platform repository path safety is now an executable architecture invariant.


## v0.9 integrated candidate

The staged roadmap after M3 has been collapsed into one integrated validation candidate.

Implemented runtime loop:

```text
Human / AI / Automation
→ Command
→ BusinessData
→ PostingInput
→ Posting Rules
→ LedgerEntry / LedgerBalance
→ WorkItem
→ Query / Next Command
```

Cross-cutting runtime foundations now include:

```text
Permission
Cost
Replay
AI Capability Catalog
Outbox
Feature Flags
Docker Deployment
```

v0.9 is a validation candidate, not a claim of production maturity.
v1.0 is gated by real workload, failure, upgrade and operational evidence.


## v1.0.0-alpha.1 convergence

The v0.9 runtime validation baseline is preserved, but the semantic reference is upgraded.

```text
Enterprise Model
  Capability · Domain · Flow · Item · SOP · Metric
        ↓
Application / Tool
        ↓
Command
        ↓
BusinessData + explicit Lineage
        ↓
Posting → Ledger → Cost → Work
        ↓
Replay / Metrics / Management Intelligence
```

Reference business chain:

```text
Sales Order (explicit Item)
→ Production Demand
→ Production Completion
→ Finished Goods Inventory
→ Sales Shipment
→ CostResult
→ [Valuation Posting boundary]
→ Inventory Value / COGS
```

Alpha.1 deliberately does not pretend that generic `inventory.received` explains business cause. The reference path uses `production.completed` as the explicit cause of finished-goods receipt and `sales_shipment.created` as the explicit order-linked shipment fact.

Business object linkage and Flow Trace are persisted; causation/fulfillment must not be inferred from equal quantities.

Repository context determinism is now a first-class architecture constraint. See `LLM.md` and `context.manifest.json`.

## v1.0.0-alpha.2 convergence

The runtime spine is extended without changing the business write boundary:

`Command -> BusinessData -> Posting -> Ledger(quantity/operational amount) -> Cost -> Valuation Posting -> Ledger(value/COGS) -> Work -> Replay`

Dimensions are cross-cutting governed semantics, not an independent fact system. Normal Posting and Valuation Posting share LedgerEntry/LedgerBalance but have different source provenance (`POSTING` vs `VALUATION`).

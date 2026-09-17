# EVO Architecture Manifest

**Status:** Authoritative repository map  
**Baseline:** EVO-08 through EVO-13 v0.2 + v1.0.0-alpha.2 change set
**Implementation milestone:** v1.0.0-alpha.2 — Dimensions + Valuation Posting  
**Rule:** If implementation conflicts with an accepted architecture decision or invariant, the conflict must be resolved explicitly; do not silently reinterpret the architecture.

## Canonical runtime flow

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

1. Business history is preserved.
2. Business change is represented through additional BusinessData.
3. Commands create BusinessData; Posting creates Ledger results.
4. Posting order is deterministic.
5. Derived Ledger/Balance/Cost state is rebuildable.
6. Replay does not re-execute historical Commands.
7. Cost valuation is separate from posting-rule evaluation.
8. AI uses the same capability/Command boundary as other actors.
9. Cross-module writes must respect module ownership.
10. Chat memory is not an authoritative architecture store.

See `docs/invariants/core.md`.

## Modules

| Module | Owns | Public direction |
| --- | --- | --- |
| identity | actor/auth primitives | used by command/query |
| metadata | definitions, versions, overlays | foundational |
| application | effective application runtime | uses metadata |
| command | controlled business writes | creates BusinessData |
| business-data | durable business history | consumed by posting/query |
| posting | ordered PostingInput execution | emits ledger effects |
| dimensions | DimensionDefinition / ledger dimension policies | validates analytical dimensions |
| ledger | LedgerEntry / LedgerBalance | consumed by cost/query |
| cost | deterministic cost calculation / CostResult | consumes business history and valuation policy |
| valuation | ValuationRule / ValuationPostingRun / ValuationPosition | CostResult → Ledger value effects |
| capability | enterprise capability definitions | metadata-aligned classification |
| flow | FlowDefinition / FlowInstance / FlowTrace / business links | explicit cross-domain lineage |
| metrics | governed MetricDefinition semantics | read/semantic layer |
| sop | versioned SOP knowledge | enterprise knowledge layer |
| replay | rebuild orchestration | orchestrates posting/ledger/cost |
| workflow | process/work/plan | invokes commands |
| ai | AI gateway | query + commands only |
| integration | external adapters/outbox | enters via commands |
| query | composed read models | read-only across modules |

Machine-readable ownership: `architecture.manifest.json`.

## Dependency direction

```text
identity
   ↓
metadata
   ↓
application
   ↓
command
   ↓
business-data
   ↓
posting
   ↓
ledger
   ↓
cost
   ↓
valuation
   ↓
ledger (value effects)

workflow → command/query
replay → posting/ledger/cost
ai → metadata/query/command
integration → command/outbox
query → read interfaces only
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

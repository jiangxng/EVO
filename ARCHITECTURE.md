# EVO Architecture Manifest

**Status:** Authoritative repository map  
**Baseline:** EVO-08 through EVO-12  
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

See `docs/invariants/CORE.md`.

## Modules

| Module | Owns | Public direction |
| --- | --- | --- |
| identity | actor/auth primitives | used by command/query |
| metadata | definitions, versions, overlays | foundational |
| application | effective application runtime | uses metadata |
| command | controlled business writes | creates BusinessData |
| business-data | durable business history | consumed by posting/query |
| posting | ordered PostingInput execution | emits ledger effects |
| ledger | LedgerEntry / LedgerBalance | consumed by cost/query |
| cost | valuation results | consumes ledger |
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

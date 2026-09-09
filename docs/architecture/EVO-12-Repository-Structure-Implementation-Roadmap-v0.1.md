# EVO-12 --- Repository Structure & Implementation Roadmap

**Version:** 0.1\
**Status:** Implementation Baseline\
**Project:** EVO --- Enterprise Operating System\
**Depends on:** EVO-08 / EVO-09 / EVO-10 / EVO-11\
**Purpose:** End architecture-planning phase and establish the
implementation operating system for an LLM-led, long-lived, evolvable
EVO codebase.

------------------------------------------------------------------------

# 1. Executive Decision

EVO now moves from architecture into implementation.

The implementation baseline is:

``` text
Architecture:
    Modular Monolith first

Primary Database:
    PostgreSQL

Backend:
    TypeScript + Node.js

Framework:
    Fastify

Database Access:
    SQL-first repository layer
    + Kysely for typed query construction
    + explicit migrations

Contracts:
    TypeScript types
    JSON Schema
    OpenAPI

Testing:
    Vitest
    PostgreSQL integration tests
    contract tests
    architecture tests
    deterministic replay tests
    performance benchmarks

Runtime:
    API process
    Worker process
    same repository / same modules

Initial Infrastructure:
    PostgreSQL only as mandatory state infrastructure

Optional Later:
    Redis
    Kafka/NATS/RabbitMQ
    Search
    Vector database
    Analytical database
```

The most important engineering decision is not the language.

It is:

> **The repository, rather than human memory or LLM conversation memory,
> is the authoritative engineering context of EVO.**

------------------------------------------------------------------------

# 2. EVO Engineering Philosophy

EVO is expected to be developed heavily with LLM assistance.

Therefore its engineering system must explicitly compensate for both
human and LLM weaknesses.

We do not assume that a future developer or LLM remembers:

``` text
Why a decision was made
Which invariant must not change
Which module owns a table
Which interface is stable
Which migration is incomplete
Which feature is being gray-released
Which version is compatible
```

These facts must exist in the repository.

Canonical principle:

> **Do not trust memory. Trust explicit architecture, contracts, version
> history, tests, migrations, observability and reproducible system
> facts.**

------------------------------------------------------------------------

# 3. LLM-Native Engineering Architecture

LLM-friendly architecture does not mean generating more code.

It means minimizing the amount of context required to safely change
code.

A task should normally require:

``` text
System Map
+
Target Module README
+
Relevant Interface Contract
+
Relevant Invariants
+
Target Code
+
Target Tests
```

---not the entire repository and not historical chat transcripts.

This is called:

> **Bounded Context Loading for Engineering**

------------------------------------------------------------------------

# 4. Context Locality

Every module must maximize context locality.

A developer or LLM modifying FIFO should primarily need:

``` text
ARCHITECTURE.md
modules/cost/README.md
docs/interfaces/ledger-cost.md
modules/cost/api/
modules/cost/domain/
modules/cost/application/
modules/cost/tests/
```

It should not need to understand UI, AI orchestration, sales workflow
and integration internals.

This is a hard architectural quality goal.

------------------------------------------------------------------------

# 5. Interface-First Programming

Module implementations are replaceable.

Interfaces and invariants are long-lived assets.

Canonical principle:

> **Internal code is comparatively cheap to replace. Stable interfaces,
> semantics and invariants are expensive to break.**

Cross-module behavior must therefore pass through explicit interfaces.

Forbidden:

``` text
Cost module directly updates ledger tables
Replay imports Posting repository internals
AI imports BusinessData ORM objects
Workflow directly mutates application tables
```

Preferred:

``` text
Cost → LedgerReader
Replay → PostingReplayPort
AI → CommandService / QueryService
Workflow → CommandService
```

------------------------------------------------------------------------

# 6. Interface Documentation Standard

Every important cross-module interface must document:

``` text
Purpose
Owner
Callers
Inputs
Outputs
Preconditions
Postconditions
Invariants
Transaction boundary
Ordering guarantee
Idempotency
Consistency model
Error contract
Versioning
Performance expectation
Security expectation
Examples
```

An interface signature alone is insufficient.

------------------------------------------------------------------------

# 7. Repository as Authoritative Context

The repository root contains an architecture map:

``` text
ARCHITECTURE.md
```

This document must remain concise.

Its job is navigation, not detailed design.

It answers:

``` text
What is EVO?
What is the canonical data flow?
What modules exist?
Who owns what?
What are the critical invariants?
Where are interface contracts?
Where are architecture decisions?
Where are migrations?
Where are active architectural changes?
```

------------------------------------------------------------------------

# 8. Repository Structure

Recommended initial repository:

``` text
EVO/
├── ARCHITECTURE.md
├── README.md
├── package.json
├── tsconfig.json
│
├── apps/
│   ├── api/
│   │   ├── src/
│   │   └── tests/
│   └── worker/
│       ├── src/
│       └── tests/
│
├── modules/
│   ├── identity/
│   ├── metadata/
│   ├── application/
│   ├── command/
│   ├── business-data/
│   ├── posting/
│   ├── ledger/
│   ├── cost/
│   ├── replay/
│   ├── workflow/
│   ├── ai/
│   ├── integration/
│   └── query/
│
├── platform/
│   ├── database/
│   ├── contracts/
│   ├── observability/
│   ├── security/
│   ├── runtime/
│   └── testing/
│
├── docs/
│   ├── architecture/
│   ├── modules/
│   ├── interfaces/
│   ├── invariants/
│   ├── adr/
│   ├── change/
│   │   ├── requirements/
│   │   ├── design/
│   │   ├── migrations/
│   │   ├── compatibility/
│   │   └── releases/
│   ├── performance/
│   └── operations/
│
├── migrations/
│   ├── schema/
│   └── data/
│
├── benchmarks/
├── scripts/
└── .github/
    └── workflows/
```

------------------------------------------------------------------------

# 9. Module Structure

Each module should follow a predictable structure:

``` text
modules/posting/
├── README.md
├── api/
│   ├── contracts.ts
│   ├── errors.ts
│   └── index.ts
├── domain/
├── application/
├── infrastructure/
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── contract/
│   └── scenarios/
└── index.ts
```

The same shape across modules reduces context-switching cost for humans
and LLMs.

------------------------------------------------------------------------

# 10. Module README Contract

Every module README must contain:

``` text
Purpose
Responsibilities
Non-responsibilities
Owned data
Public interfaces
Dependencies
Consumers
Critical invariants
Transaction boundaries
Failure behavior
Performance characteristics
Replay behavior
Observability
Change notes / ADR links
```

This file is the first document an LLM should read before modifying a
module.

------------------------------------------------------------------------

# 11. Technology Choice --- TypeScript

Initial backend language:

``` text
TypeScript
```

Reasons:

``` text
Strong LLM code-generation quality
Excellent JSON / API ergonomics
Strong static type ecosystem
Fast development
Good OpenAPI/JSON Schema integration
Good testing ecosystem
Readable code
Low ceremony
Easy shared contract definitions
Good suitability for metadata-driven systems
```

EVO's main early complexity is semantic and transactional---not
CPU-bound numerical computing.

Performance-critical components can later be extracted or rewritten
without changing contracts.

------------------------------------------------------------------------

# 12. Runtime --- Node.js

Use a current supported Node.js LTS release.

Node provides:

``` text
Mature PostgreSQL drivers
Good async I/O
Strong API performance
Simple worker processes
Large ecosystem
Good observability support
```

CPU-heavy future workloads should not block the event loop.

Heavy computation can later move to:

``` text
Worker Threads
Dedicated calculation process
Native module
Rust/Go service
Distributed Cost/Replay workers
```

behind existing interfaces.

------------------------------------------------------------------------

# 13. HTTP Framework --- Fastify

Use:

``` text
Fastify
```

instead of a highly magical application framework.

Reasons:

``` text
Low overhead
Explicit lifecycle
Good schema support
Good TypeScript support
Easy testing
Limited framework magic
Good performance
```

EVO should own its module architecture rather than letting the web
framework define it.

------------------------------------------------------------------------

# 14. Database Access Strategy

Use:

``` text
SQL-first
+
Kysely typed query builder
```

Do not make a large Active Record ORM the core architecture.

Reasons:

``` text
Ledger/cost queries need SQL clarity
Posting requires explicit transactions/locks
Replay requires bulk operations
Performance work requires query visibility
PostgreSQL features matter
LLMs debug explicit SQL more reliably than hidden ORM behavior
```

Kysely provides useful typing without hiding SQL semantics.

Raw SQL is allowed when it is the clearest implementation.

------------------------------------------------------------------------

# 15. ORM Boundary

Database rows are not domain objects.

Do not pass persistence records across modules as public contracts.

Keep distinct:

``` text
Database Row
Domain Type
Module DTO
Public API DTO
```

Mapping code is acceptable.

The small amount of explicit mapping buys long-term decoupling.

------------------------------------------------------------------------

# 16. Database Migrations

All schema changes are migration-driven.

Migration categories:

``` text
Schema Migration
Data Migration
Metadata Migration
```

Rules:

``` text
Never manually patch production schema as normal procedure
Never depend on one developer remembering migration order
Every migration is version controlled
Every migration has forward validation
Risky migrations have rollback or roll-forward strategy
```

------------------------------------------------------------------------

# 17. Migration Naming

Recommended:

``` text
YYYYMMDDHHMM_<description>.sql
```

Examples:

``` text
202609101000_create_enterprise.sql
202609101010_create_business_data.sql
202609101020_create_posting_input.sql
```

For application-managed migrations, equivalent deterministic numbering
is acceptable.

------------------------------------------------------------------------

# 18. Change Management Is Architecture

Requirements will change.

Design will change.

EVO must expect both.

Canonical lifecycle:

``` text
Requirement Change
↓
Impact Analysis
↓
Architecture / ADR Decision
↓
Interface Impact
↓
Data Impact
↓
Compatibility Plan
↓
Migration Plan
↓
Implementation
↓
Contract / Invariant Tests
↓
Gray Release
↓
Observe
↓
Expand or Roll Back / Roll Forward
↓
Close Change Record
```

------------------------------------------------------------------------

# 19. Requirement Change Record

Material requirement changes should create a file under:

``` text
docs/change/requirements/
```

Suggested structure:

``` text
ID
Date
Problem
Current behavior
Requested behavior
Business reason
Affected modules
Affected interfaces
Affected data
Compatibility concerns
Performance concerns
Security concerns
Decision
Implementation references
Release state
```

------------------------------------------------------------------------

# 20. Architecture Decision Records

Architectural changes use ADRs.

Location:

``` text
docs/adr/
```

Suggested ADR states:

``` text
PROPOSED
ACCEPTED
SUPERSEDED
REJECTED
```

An ADR should state:

``` text
Context
Decision
Alternatives
Consequences
Compatibility
Migration
Rollback / roll-forward
References
```

Never silently rewrite history by editing an old ADR to make the past
look cleaner.

Supersede it with a new ADR.

------------------------------------------------------------------------

# 21. Architecture Change Principle

EVO architecture is stable but not frozen forever.

Allowed:

``` text
Refine module boundaries
Replace implementation
Introduce new optimized projections
Add message broker
Shard databases
Split services
Add consistency domains
Change internal algorithms
```

But changes to core invariants require explicit architectural review.

Examples:

``` text
Command → BusinessData
BusinessData → Posting
Posting → Ledger
Ledger → Cost

Business history preserved
Posting deterministic
Derived state rebuildable
Replay does not re-execute historical Commands
```

These cannot change accidentally.

------------------------------------------------------------------------

# 22. Compatibility Architecture

Compatibility must be explicit across:

``` text
API version
Event version
Database schema version
Metadata version
Application definition version
Posting rule-set version
Valuation policy version
Worker/runtime version
```

Do not assume all components upgrade at the same instant.

------------------------------------------------------------------------

# 23. Compatibility Matrix

Maintain a machine-readable compatibility manifest.

Recommended:

``` text
compatibility.yaml
```

Conceptual example:

``` yaml
evo_core: 0.4
api:
  supported: [v1]
db_schema:
  min: 18
  max: 20
metadata_schema:
  supported: [5, 6]
posting_rule_schema:
  supported: [3]
cost_policy_schema:
  supported: [2]
```

This allows startup checks and deployment validation.

------------------------------------------------------------------------

# 24. Feature Flags

Feature flags are first-class rollout controls.

They may scope by:

``` text
Global
Environment
Enterprise
Application
Actor
Percentage cohort
```

Examples:

``` text
posting_engine_v2
new_cost_pool_resolver
ai_auto_execute_level_3
new_sales_order_ui
```

Feature flags are not permanent substitutes for proper versioning.

Temporary flags must have:

``` text
Owner
Created date
Rollout plan
Removal condition
```

------------------------------------------------------------------------

# 25. Gray / Canary Upgrade

Recommended release path for risky behavior:

``` text
Development
↓
Automated tests
↓
Internal environment
↓
Test Enterprise
↓
Canary Enterprises
↓
5%
↓
25%
↓
50%
↓
100%
↓
Remove old path after compatibility window
```

Percentage values are operational examples, not hard-coded architecture.

------------------------------------------------------------------------

# 26. Gray Upgrade by Enterprise

Because EVO is enterprise-scoped, Enterprise is the natural first
gray-release boundary.

Example:

``` text
Enterprise A → Posting Engine v2
Enterprise B → Posting Engine v1
Enterprise C → Posting Engine v1
```

The execution/run record must make the selected version traceable.

------------------------------------------------------------------------

# 27. Expand--Migrate--Contract

Breaking schema/interface changes should normally use:

``` text
EXPAND
    Add new field/table/interface while old remains valid

MIGRATE
    Dual-read/write where required
    Backfill
    Move callers
    Verify

CONTRACT
    Remove obsolete behavior after compatibility window
```

Avoid:

``` text
Deploy code
+
rename/drop critical column
+
hope all instances upgrade simultaneously
```

------------------------------------------------------------------------

# 28. Dual Read / Dual Write

Dual-write is dangerous and must be temporary.

When required, document:

``` text
Source of truth
Conflict resolution
Backfill direction
Verification query
Exit condition
```

Never allow two representations to become permanently ambiguous
authorities.

------------------------------------------------------------------------

# 29. Rollback and Roll-Forward

Every risky release asks two different questions:

``` text
Can code be rolled back?
Can data be rolled back?
```

These are not equivalent.

For irreversible data changes, prefer:

``` text
Roll-forward repair
```

over unsafe reverse migrations.

Release documentation must state the strategy explicitly.

------------------------------------------------------------------------

# 30. Versioned Runtime Behavior

Runs should retain enough version identity to explain their behavior.

Examples:

``` text
PostingRun:
    rule-set version/hash
    runtime version

CostRun:
    valuation-policy version
    cost-engine version

ReplayRun:
    metadata selection
    posting rule-set
    cost policy
    runtime build
```

This becomes critical during gray upgrades.

------------------------------------------------------------------------

# 31. LLM Change Protocol

When an LLM is asked to change EVO code, the expected workflow is:

``` text
1. Read ARCHITECTURE.md
2. Read target module README
3. Read relevant interface documents
4. Read relevant invariants
5. Read active ADR/change records
6. Inspect target code/tests
7. State impact surface internally
8. Modify smallest viable scope
9. Run module tests
10. Run contract/invariant tests
11. Run relevant integration tests
12. Run benchmark if performance-sensitive
13. Update documentation when contract/behavior changed
```

Chat history is optional context, not required context.

------------------------------------------------------------------------

# 32. LLM Task Context Files

For recurring complex modules, maintain concise context documents.

Possible:

``` text
modules/posting/CONTEXT.md
modules/cost/CONTEXT.md
```

They should summarize only high-value working context:

``` text
Current design
Important invariants
Common traps
Key interfaces
Test commands
Performance-sensitive paths
```

Do not duplicate entire architecture documents.

------------------------------------------------------------------------

# 33. Code Style for LLM Reliability

Prefer:

``` text
Explicit names
Small functions
Small files
Shallow inheritance
Composition
Pure functions for rules
Typed inputs/outputs
Explicit transaction scope
Explicit error types
Predictable directory layout
```

Avoid:

``` text
Deep class hierarchies
Runtime monkey patching
Magic decorators controlling business semantics
Implicit global state
Metaprogramming
Reflection-heavy frameworks
Hidden transaction behavior
Clever one-liners in critical accounting code
```

------------------------------------------------------------------------

# 34. File Size Guidance

No absolute limit is architecturally required, but code should be split
before a file becomes difficult to reason about locally.

Practical target:

``` text
Most source files:
    < 300–500 lines

Critical domain algorithms:
    Prefer much smaller cohesive units
```

A 1,500-line posting engine should be treated as a design smell.

------------------------------------------------------------------------

# 35. Function Design

Critical functions should make side effects obvious.

Prefer:

``` ts
const effects = evaluatePostingRules(input, rules, context)
await ledgerWriter.commitEffects(effects)
```

over one giant function that:

``` text
loads metadata
changes state
calls network
writes DB
calculates cost
sends webhook
```

without visible boundaries.

------------------------------------------------------------------------

# 36. Error Design

Errors are structured data.

Every operationally important error should expose:

``` text
error_code
module
operation
enterprise_id
correlation_id
relevant object IDs
retryable
safe diagnostic context
```

Posting errors should additionally expose:

``` text
posting_input_id
posting_sequence
rule identity/version
```

Cost errors:

``` text
cost_run_id
cost_pool identity
ledger_entry_id
valuation policy
```

Never depend on stack traces alone.

------------------------------------------------------------------------

# 37. Logging

Use structured JSON logs.

Required common fields:

``` text
timestamp
level
service
module
environment
request_id
correlation_id
enterprise_id
actor_type
actor_id
operation
```

Additional lineage IDs are attached where relevant.

Logs should be useful to both operators and LLM debugging workflows.

------------------------------------------------------------------------

# 38. Debug Bundle

For difficult production failures, EVO should eventually support
generation of a sanitized debug bundle containing:

``` text
Runtime/build version
Relevant configuration hashes
CommandExecution
BusinessData identity
PostingInput
PostingRule identity
Ledger lineage
Cost lineage
Replay state
Structured errors
Relevant logs
```

Sensitive payload fields must be redacted.

This lets an LLM debug from a bounded reproducible context instead of an
entire production database.

------------------------------------------------------------------------

# 39. Testing Pyramid

EVO testing is not merely unit testing.

Required layers:

``` text
Unit Tests
Contract Tests
Invariant Tests
Integration Tests
Scenario Tests
Replay Determinism Tests
Migration Tests
Performance Benchmarks
End-to-End Vertical Slice Tests
```

------------------------------------------------------------------------

# 40. Unit Tests

Use unit tests for:

``` text
Expression evaluation
Posting rule evaluation
Dimension canonicalization
Cost algorithms
Permission predicates
Version selection
```

Prefer deterministic pure-function tests where possible.

------------------------------------------------------------------------

# 41. Contract Tests

Every cross-module interface should have tests verifying:

``` text
Input acceptance
Output shape
Error behavior
Idempotency
Ordering
Version compatibility
```

This allows internal implementations to be rewritten safely.

------------------------------------------------------------------------

# 42. Architecture Tests

Automated tests should enforce dependency rules where practical.

Examples:

``` text
cost cannot import posting.infrastructure
workflow cannot import ledger.infrastructure
ai cannot import database repositories
query cannot perform business writes
```

This prevents architectural erosion.

------------------------------------------------------------------------

# 43. Invariant Tests

Critical system invariants should be executable.

Examples:

``` text
One PostingInput cannot produce two authoritative posting results
Failed posting leaves no partial LedgerEntry set
LedgerBalance equals aggregate of active LedgerEntries
Replay of identical inputs/rules reproduces identical ledger results
FIFO layer consumption preserves quantity
Cost cannot create quantity
AI cannot bypass Command permission
```

------------------------------------------------------------------------

# 44. Scenario Tests

Scenario tests are executable business architecture.

Example:

``` text
Given:
    Sales Order for self-made product, qty 100

When:
    Approve Sales Order

Then:
    BusinessData exists
    PostingInput exists
    待生产 +100
    待出库 +100
    WorkItem may be derived
```

These tests are especially valuable for future LLM maintenance because
they communicate intent better than isolated implementation tests.

------------------------------------------------------------------------

# 45. Replay Determinism Tests

Replay is a first-class test target.

Test:

``` text
Create business history
Post normally
Capture Ledger/Cost results
Clear derived state
Replay
Compare canonical results
```

Expected:

``` text
same inputs
+
same versions
=
same derived result
```

within defined precision rules.

------------------------------------------------------------------------

# 46. Migration Tests

CI should be able to:

``` text
Create empty database
Apply all migrations
Seed required metadata
Run smoke tests
```

For important upgrades:

``` text
Start from previous schema/data fixture
Apply upgrade
Validate compatibility
```

------------------------------------------------------------------------

# 47. Performance Engineering Is System-Level

Performance is not a final optimization phase.

EVO tracks the entire flow:

``` text
Command
↓
BusinessData
↓
PostingInput
↓
Posting
↓
Ledger
↓
Balance
↓
Cost
↓
Work / Query
```

Optimizing one layer while creating backlog in another is not success.

------------------------------------------------------------------------

# 48. Performance Budgets

Initial benchmark dimensions should include:

``` text
Command latency p50/p95/p99
BusinessData write throughput
Posting inputs/sec
Posting queue age
Ledger entries/sec
Balance update latency
Cost entries/sec
CostPool lock contention
Replay rows/sec
Replay ETA
Outbox backlog
Work queue query latency
Ledger query p95/p99
```

Exact production targets will be set after realistic workload
characterization.

------------------------------------------------------------------------

# 49. Performance Test Data

Benchmarks must include realistic data shapes:

``` text
Many Enterprises
One very large Enterprise
Large BusinessData payload
High ledger-entry fan-out
Large dimension cardinality
Large CostPools
Backdated inputs
Replay of long history
```

Do not benchmark only toy records.

------------------------------------------------------------------------

# 50. Query Performance Rules

Critical query paths require:

``` text
EXPLAIN ANALYZE review
Index rationale
Bounded result sets
No accidental N+1 queries
No unbounded JSON scans
```

Performance-sensitive SQL should be easy to find and benchmark.

------------------------------------------------------------------------

# 51. N+1 Prevention

Repository/query APIs should expose batch reads.

Prefer:

``` text
getApplicationsByIds(ids)
```

over calling:

``` text
getApplication(id)
```

inside large loops.

This is especially important because generated code can accidentally
create structurally clean but inefficient repeated queries.

------------------------------------------------------------------------

# 52. Batch-Oriented Engines

Posting/Replay/Cost should support controlled batching where semantics
allow it.

Batching must never violate deterministic ordering.

Example:

``` text
Read 1,000 ordered PostingInputs
Process sequentially / safely partitioned
Commit in controlled units
```

Replay should not load entire enterprise history into memory.

------------------------------------------------------------------------

# 53. Memory Boundaries

Large-data paths must be streaming/batched.

Forbidden:

``` text
SELECT entire ledger history
→ load into application memory
→ process
```

Preferred:

``` text
Cursor / keyset iteration
→ bounded batch
→ process
→ release
```

------------------------------------------------------------------------

# 54. Scale Evolution Architecture

EVO's intended scaling path is:

``` text
Stage 1
Modular Monolith + PostgreSQL

Stage 2
Horizontal API / Worker replicas

Stage 3
Database query/index optimization

Stage 4
Large-table partitioning

Stage 5
Enterprise sharding

Stage 6
Message broker adoption

Stage 7
Compute-heavy service extraction

Stage 8
Consistency-domain partitioning

Stage 9
Distributed EVO
```

This path is evolutionary, not a future rewrite plan.

------------------------------------------------------------------------

# 55. Scale-Compatible Decisions from Day One

The following exist specifically to preserve the upgrade path:

``` text
enterprise_id
UUIDv7 identity
Outbox
Idempotency
Correlation IDs
Posting sequence
Run IDs
Dataset IDs
Module ownership
Transport-neutral contracts
Versioned events
Consistency-domain reservation
```

------------------------------------------------------------------------

# 56. Message Broker Upgrade

Initial:

``` text
DB transaction
↓
outbox_event
↓
Outbox Worker
```

Future:

``` text
DB transaction
↓
outbox_event
↓
Publisher
↓
Kafka / NATS / RabbitMQ
↓
Consumers
```

Business transactions do not need redesign.

------------------------------------------------------------------------

# 57. Enterprise Sharding

Enterprise is the first natural sharding boundary.

Future:

``` text
Enterprise Router
├── Shard 1
├── Shard 2
└── Shard 3
```

Clients address:

``` text
enterprise_id
```

---not shard identity.

Routing remains infrastructure.

------------------------------------------------------------------------

# 58. Consistency Domain

Initial:

``` text
ConsistencyDomain = Enterprise
```

Future large enterprises may define safe partitions:

``` text
Enterprise
├── inventory:HK
├── inventory:SG
├── finance:entity-A
└── project:P001
```

Only proven independent domains may post concurrently.

A Consistency Domain is a correctness boundary before it is a
performance feature.

------------------------------------------------------------------------

# 59. Service Extraction

Likely first extraction candidates:

``` text
AI Gateway
Integration
Search / Vector
Replay computation
Heavy Cost calculation
Analytics
```

Keep strongly transactional core together longer:

``` text
Command
BusinessData
Posting
Ledger
```

until evidence justifies separation.

------------------------------------------------------------------------

# 60. CI Pipeline

Every pull request should run, progressively:

``` text
Format / lint
Type check
Unit tests
Architecture tests
Contract tests
Integration tests
Migration tests
Core scenario tests
```

Performance benchmarks may run:

``` text
on relevant PRs
nightly
before major release
```

rather than blocking every trivial change.

------------------------------------------------------------------------

# 61. Code Review Checklist

Whether review is human or LLM-assisted, check:

``` text
Does this cross a module boundary?
Did an interface change?
Did an invariant change?
Is a new dependency introduced?
Is a migration required?
Is compatibility preserved?
Is a feature flag needed?
Can it be gray-released?
Is rollback/roll-forward understood?
Are errors observable?
Could this create N+1 or unbounded queries?
Does replay remain deterministic?
Are tests sufficient?
Is documentation updated?
```

------------------------------------------------------------------------

# 62. Commit Strategy

Prefer small coherent commits.

Examples:

``` text
feat(posting): add posting input allocator
feat(ledger): persist ledger entries
test(replay): verify deterministic rebuild
docs(adr): define backdated posting policy
```

Avoid mixing:

``` text
database redesign
+
API rewrite
+
cost algorithm
+
UI changes
```

into one opaque commit.

------------------------------------------------------------------------

# 63. Definition of Done

A change is not done merely because code compiles.

For material changes, Definition of Done includes applicable items:

``` text
Implementation complete
Tests pass
Interface documentation updated
Architecture/invariant docs updated
Migration included
Compatibility considered
Feature flag / rollout plan included if needed
Observability included
Performance impact checked
Rollback/roll-forward considered
Change record updated
```

------------------------------------------------------------------------

# 64. Initial Implementation Milestones

## M0 --- Engineering Foundation

Build:

``` text
Repository skeleton
TypeScript config
Fastify API
Worker process
PostgreSQL connection
Migration runner
Logging
Error model
Test infrastructure
CI
ARCHITECTURE.md
```

No business complexity yet.

------------------------------------------------------------------------

# 65. M1 --- Metadata Kernel

Implement:

``` text
Enterprise
TransactionType
ApplicationDefinition
ApplicationDefinitionVersion
ApplicationInstance
FieldDefinition
EffectiveDefinitionResolver
CommandDefinition
PostingRule
LedgerDefinition
ValuationPolicy
```

Goal:

``` text
Install and query one effective application definition.
```

------------------------------------------------------------------------

# 66. M2 --- Command + BusinessData

Implement:

``` text
CommandService
Permission hook
Precondition hook
CommandExecution
BusinessData
PostingInput
Idempotency
```

Goal:

``` text
Execute one Command and durably create BusinessData + PostingInput atomically.
```

------------------------------------------------------------------------

# 67. M3 --- Posting + Ledger

Implement:

``` text
Posting sequence allocator
Posting worker
Expression AST
Conditional Posting
LedgerEntry
LedgerBalance
Posting errors
```

Goal:

``` text
Sales Order approval creates deterministic business ledger effects.
```

------------------------------------------------------------------------

# 68. M4 --- Work Loop

Implement:

``` text
WorkItem
Basic Trigger
Command-backed Work execution
```

Goal:

``` text
Ledger/business state can generate actionable work.
```

------------------------------------------------------------------------

# 69. M5 --- Cost Engine

Implement:

``` text
CostPool
CostLayer
CostMatch
CostResult

FIFO
Moving Average
LIFO
Specific Identification
```

Goal:

``` text
Inventory movement produces explainable deterministic cost.
```

Implementation order inside M5:

``` text
FIFO
→ Moving Average
→ LIFO
→ Specific Identification
```

------------------------------------------------------------------------

# 70. M6 --- Replay

Implement:

``` text
ReplayRun
Replay Lock
Input Boundary
Pause Posting
Clear Derived State
Posting Replay
Balance Rebuild
Cost Rebuild
Validation
Resume
```

Goal:

``` text
Delete Ledger/Cost derived results and reproduce them from BusinessData.
```

This milestone proves EVO's most important architectural property.

------------------------------------------------------------------------

# 71. M7 --- AI Gateway

Implement only after deterministic business kernel works.

Initial AI capabilities:

``` text
Metadata discovery
Command discovery
Permission-aware query
Command preparation
Command execution under policy
Ledger explanation
Cost explanation
Work queue query
```

AI should consume stable business interfaces rather than compensate for
unfinished core semantics.

------------------------------------------------------------------------

# 72. M8 --- Integration / Outbox

Implement:

``` text
Outbox
Webhook publisher
Inbound idempotency
External Command adapter
```

Goal:

``` text
External integration without direct database coupling.
```

------------------------------------------------------------------------

# 73. First Vertical Slice

The first complete business slice should be deliberately small:

``` text
Application:
    Sales Order

Command:
    Approve Sales Order

BusinessData:
    sales_order_approved

Conditional Posting:
    self-made product
        → 待生产 +quantity
        → 待出库 +quantity
        → 待收款 +amount

Ledger:
    Entries + Balances

Work:
    Production / shipment work

Replay:
    Full rebuild produces identical ledger result
```

Then extend into inventory receipt/shipment and cost.

------------------------------------------------------------------------

# 74. First Performance Scenario

Once M3 works, create a synthetic benchmark:

``` text
100 Enterprises
10,000 BusinessData records each
1–5 LedgerEntries per PostingInput
```

Measure:

``` text
Command write throughput
Posting throughput
Queue age
Ledger growth
Balance latency
```

Later benchmark one large Enterprise separately.

This creates a performance baseline before optimization begins.

------------------------------------------------------------------------

# 75. First Gray-Upgrade Scenario

Before declaring the engineering foundation mature, prove one controlled
gray change.

Example:

``` text
Posting Rule Evaluator v1
→ Posting Rule Evaluator v2
```

Enable v2 only for a test Enterprise.

Verify:

``` text
version traceability
feature flag
metrics
rollback
replay compatibility
```

This tests the upgrade architecture early rather than years later.

------------------------------------------------------------------------

# 76. First Architecture-Change Exercise

Also intentionally perform one small ADR-driven design change during
early development.

The objective is to verify the process:

``` text
Requirement
→ ADR
→ Interface impact
→ implementation
→ migration if needed
→ tests
→ release
```

A change-management system that has never been exercised should not be
trusted.

------------------------------------------------------------------------

# 77. Documentation Hierarchy

When documents conflict, authority should be clear.

Recommended hierarchy:

``` text
Current accepted ADR / Architecture Baseline
↓
ARCHITECTURE.md
↓
Current module/interface/invariant documents
↓
Current executable contracts and migrations
↓
Implementation
↓
Historical superseded documents
```

Historical architecture documents remain valuable context but must
clearly show when superseded.

------------------------------------------------------------------------

# 78. Documentation Drift Control

CI cannot prove all prose is correct, but it can detect some drift.

Examples:

``` text
Broken doc links
Missing module README
Public interface without interface document
Migration without version update
OpenAPI mismatch
Compatibility manifest mismatch
Expired feature flags
```

Automate what is practical.

------------------------------------------------------------------------

# 79. Architecture Manifest

`ARCHITECTURE.md` should include a machine-friendly module table:

``` text
Module | Owner | Public Contract | Owned Data | Depends On
```

It should also list:

``` text
Critical invariants
Active architectural changes
Current schema/API versions
Links to EVO-08 through EVO-12
```

This is the primary cold-start context for future LLM sessions.

------------------------------------------------------------------------

# 80. Performance Manifest

Maintain:

``` text
docs/performance/BASELINE.md
```

It records:

``` text
Benchmark dataset
Hardware/runtime
Build version
Database version
Key metrics
Known bottlenecks
Next threshold for scaling action
```

Performance claims must be reproducible.

------------------------------------------------------------------------

# 81. Scaling Triggers

Infrastructure upgrades should be evidence-driven.

Examples:

``` text
Add table partitioning when index/table behavior proves necessary.
Add message broker when DB-backed queue/outbox throughput or isolation becomes limiting.
Shard Enterprises when one PostgreSQL deployment cannot meet capacity/availability targets.
Extract Cost when CPU/lock workload needs independent scale.
Introduce analytical store when operational queries are harmed by analytical workloads.
```

Do not add infrastructure because it is fashionable.

------------------------------------------------------------------------

# 82. Security and LLM Development

LLM-friendly debugging must not leak secrets.

Never place into debug context by default:

``` text
Passwords
API secrets
Access tokens
Private keys
Unredacted sensitive business fields
```

Structured diagnostics must support redaction.

------------------------------------------------------------------------

# 83. Generated Code Policy

Generated code is treated exactly like human-written code.

It must satisfy:

``` text
Type checks
Tests
Architecture rules
Security rules
Performance expectations
Documentation requirements
Review
```

"Generated by AI" is neither an exemption nor a guarantee of
correctness.

------------------------------------------------------------------------

# 84. LLM Refactoring Policy

LLMs may aggressively refactor internals when:

``` text
Public contracts remain compatible
Invariants remain true
Contract tests pass
Scenario tests pass
Performance does not regress materially
```

Interface changes require higher scrutiny and change documentation.

------------------------------------------------------------------------

# 85. Architecture Freeze Ends Here

EVO-08 froze the conceptual baseline.

EVO-09 defined physical persistence.

EVO-10 defined runtime module boundaries.

EVO-11 defined contracts.

EVO-12 defines the implementation operating system.

From this point:

> **Architecture becomes a governed, versioned, evolvable system rather
> than a pre-coding discussion phase.**

New requirements do not require reopening everything.

They enter through the Change Management process.

------------------------------------------------------------------------

# 86. Implementation Start Decision

After EVO-12 v0.1 is committed, implementation should begin with:

``` text
M0 — Engineering Foundation
```

The first code objective is not Sales Order.

It is a trustworthy development substrate:

``` text
Repository
Architecture Manifest
API boot
Worker boot
PostgreSQL
Migrations
Structured logging
Errors
Testing
CI
Module dependency rules
```

Then M1 begins.

------------------------------------------------------------------------

# 87. Locked EVO-12 Decisions

1.  Repository is authoritative engineering context; chat memory is not.
2.  EVO is explicitly LLM-native in engineering design.
3.  Interface-first and low coupling are mandatory.
4.  Every module has a predictable structure and README contract.
5.  TypeScript + Node.js is the initial backend stack.
6.  Fastify is the initial HTTP framework.
7.  PostgreSQL remains the primary database.
8.  SQL-first + Kysely is the initial database-access strategy.
9.  Persistence rows are not public domain contracts.
10. Vitest plus real PostgreSQL integration testing is the default test
    stack.
11. Architecture, contract, invariant, replay and performance tests are
    first-class.
12. Requirements/design changes are governed and versioned.
13. ADRs preserve decision history rather than rewriting it.
14. Compatibility is explicit and machine-readable.
15. Feature flags and enterprise-scoped gray rollout are first-class.
16. Breaking changes use Expand--Migrate--Contract where appropriate.
17. Rollback and roll-forward are both considered before risky release.
18. Runtime runs retain behavior/version identity.
19. Structured observability is designed for bounded human/LLM
    debugging.
20. Performance is measured end-to-end, not optimized locally in
    isolation.
21. Scale evolution is planned from monolith to distributed EVO without
    forcing an early distributed architecture.
22. Enterprise is the first sharding/gray-release boundary.
23. Consistency Domain is the future correctness boundary for
    intra-enterprise parallelism.
24. Message broker adoption is an evolutionary step, not a rewrite.
25. Implementation starts after EVO-12 with M0.

------------------------------------------------------------------------

# 88. Immediate Next Action

Create the repository engineering foundation:

``` text
ARCHITECTURE.md
package.json
tsconfig.json
apps/api
apps/worker
modules/*
platform/*
docs/*
migrations/*
tests / CI
```

Then implement:

``` text
M0
→ M1 Metadata Kernel
→ M2 Command + BusinessData
→ M3 Posting + Ledger
→ M4 Work
→ M5 Cost
→ M6 Replay
→ M7 AI
→ M8 Integration
```

The next artifact after this document should no longer be another broad
architecture document.

It should be the **actual EVO repository foundation and executable
code**.

------------------------------------------------------------------------

**End of EVO-12 v0.1**

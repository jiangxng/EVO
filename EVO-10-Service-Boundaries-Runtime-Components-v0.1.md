# EVO-10 — Service Boundaries & Runtime Components

**Version:** 0.1  
**Status:** Draft / Implementation Architecture  
**Project:** EVO — Enterprise Operating System  
**Depends on:** EVO-09 — Physical Data Model & Runtime Storage Architecture v0.1

---

## 1. Purpose

EVO-10 defines the runtime component boundaries used to implement EVO.

The primary decision is:

> **EVO v0.x starts as a Modular Monolith with strong internal module boundaries, one primary PostgreSQL database, and asynchronous workers where needed.**

EVO should not begin as a distributed microservice system.

The goal is:

```text
Strong conceptual separation
+ Simple deployment
+ Clear transaction ownership
+ Deterministic execution
+ Easy local development
+ Future service extraction path
```

---

## 2. Why Modular Monolith First

The architecture contains multiple domains:

```text
Metadata
Application Runtime
Commands
Business Data
Posting
Ledger
Cost
Replay
Process / Work
AI
Integration
```

These are real module boundaries.

But they do not need to become network service boundaries immediately.

Premature microservices would introduce:

```text
Distributed transactions
Eventual consistency
Message ordering complexity
Network failure handling
Deployment overhead
Cross-service versioning
Tracing complexity
Duplicate retry behavior
Replay coordination complexity
```

before EVO has proven its domain behavior.

Initial principle:

> **Separate by code ownership and transaction ownership first; separate by network only when scale or deployment needs justify it.**

---

## 3. Runtime Topology

Initial runtime topology:

```text
┌──────────────────────────────┐
│          EVO App             │
│                              │
│  Modular Monolith Runtime    │
│                              │
│  Metadata Module             │
│  Application Module          │
│  Command Module              │
│  Business Data Module        │
│  Posting Module              │
│  Ledger Module               │
│  Cost Module                 │
│  Replay Module               │
│  Process / Work Module       │
│  AI Module                   │
│  Integration Module          │
└──────────────┬───────────────┘
               ↓
        PostgreSQL
               ↓
       Outbox / Workers
```

Optional separate worker process may run the same codebase:

```text
EVO API Process
EVO Worker Process
```

This is deployment separation, not service decomposition.

---

## 4. Canonical Runtime Modules

EVO v0.x defines these modules:

```text
1. Identity / Access Module
2. Metadata Module
3. Application Runtime Module
4. Command Module
5. Business Data Module
6. Posting Module
7. Ledger Module
8. Cost / Valuation Module
9. Replay Module
10. Process / Work Module
11. AI Gateway Module
12. Integration Module
13. Query / Read Model Module
```

Each module owns:

```text
Domain logic
Application services
Persistence interfaces
Internal events
Public module APIs
```

---

## 5. Module Dependency Principle

Dependencies should point toward stable business abstractions.

Avoid cyclic module ownership.

Preferred direction:

```text
Identity / Access
        ↓
Metadata
        ↓
Application Runtime
        ↓
Command
        ↓
Business Data
        ↓
Posting
        ↓
Ledger
        ↓
Cost

Process / Work
    reads state and invokes Commands

Replay
    coordinates Posting + Ledger + Cost

AI
    reads through Query APIs
    writes through Command APIs

Integration
    enters through Commands
    exits through Outbox
```

---

## 6. Identity / Access Module

Responsibilities:

```text
Actor identity
Human identity
AI identity
Automation identity
External-system identity

Authentication context
Enterprise membership
Role assignment
Data-scope resolution
Permission evaluation support
```

It does not own business approval logic.

It provides identity and authorization primitives.

Canonical actor types:

```text
HUMAN
AI
AUTOMATION
EXTERNAL_SYSTEM
```

---

## 7. Metadata Module

Owns:

```text
Enterprise metadata
Domain
TransactionType
Model
Template
ApplicationDefinition
ApplicationDefinitionVersion
ApplicationInstance
EnterpriseOverlay
FieldGroup
Field
CommandDefinition
ProcessDefinition
PostingRule
LedgerDefinition
ValuationPolicy
PermissionDefinition
ApprovalPolicy
TriggerDefinition
ViewDefinition
AICapabilityDefinition
```

Responsibilities:

```text
Definition lifecycle
Version publishing
Effective-definition resolution
Template installation
Overlay resolution
Metadata query
Metadata validation
```

The Metadata Module must not execute business Commands.

---

## 8. Effective Definition Resolver

A key Metadata subcomponent:

```text
EffectiveDefinitionResolver
```

Input:

```text
ApplicationInstance
Base ApplicationDefinitionVersion
EnterpriseOverlay
```

Output:

```text
Effective Application Definition
```

This effective definition is consumed by:

```text
Command Module
Application Runtime
Posting Module
Process Module
AI Module
UI / Query layers
```

Cache may be added later.

---

## 9. Application Runtime Module

Responsibilities:

```text
Interpret application metadata
Validate BusinessData schema
Resolve field behavior
Resolve references/snapshots
Run application-specific deterministic business logic
Expose application capabilities
```

It acts as the runtime bridge between Metadata and Command execution.

It should not own Ledger logic.

---

## 10. Command Module

The Command Module is the primary controlled write boundary.

Responsibilities:

```text
Receive Command request
Resolve CommandDefinition
Resolve actor
Check permission
Check preconditions
Check approval policy
Execute application operation
Create CommandExecution record
Create BusinessData
Create PostingInput
Return CommandResult
```

Canonical rule:

> **Human, AI, Automation and External Systems use the same Command execution infrastructure.**

---

## 11. Command Transaction Ownership

The Command Module owns the business-write transaction.

Preferred transaction:

```text
BEGIN

Create CommandExecution
Validate actor / permission
Validate preconditions
Execute application logic
Create BusinessData
Create PostingInput
Insert Outbox events if required

COMMIT
```

If the Command fails before commit:

```text
No partial BusinessData
No orphan PostingInput
```

---

## 12. Approval Handling

Approval is not a separate hidden execution path.

When approval is required:

```text
Command requested
↓
ApprovalPolicy evaluated
↓
Create Approval WorkItem
↓
Command remains pending / prepared
```

After approval:

```text
Approval Command
↓
Original business capability may proceed
```

Exact approval state model can evolve, but approval remains inside controlled Command / Work flows.

---

## 13. Business Data Module

Owns:

```text
BusinessData persistence
Business history
Business-object grouping
BusinessData retrieval
BusinessData validation support
Posting relevance registration
```

It does not interpret Ledger corrections.

Business changes remain new BusinessData rows.

---

## 14. Business Data API Boundary

Internal API examples:

```text
createBusinessData(...)
getBusinessData(id)
queryBusinessHistory(objectKey)
queryApplicationData(...)
```

Direct table access from unrelated modules should be minimized.

Posting Module consumes BusinessData through explicit interfaces/repositories.

---

## 15. Posting Module

Responsibilities:

```text
PostingInput queue
Posting sequence
Rule resolution
Conditional Posting
Expression evaluation
Ledger effect generation
Posting failure handling
Posting worker
```

It owns deterministic ordered posting execution.

It does not own final cost valuation.

---

## 16. Posting Worker

Initial architecture:

```text
PostingWorker
```

Behavior:

```text
Select next QUEUED PostingInput
for Enterprise
in canonical sequence
↓
Lock
↓
Evaluate PostingRules
↓
Generate LedgerEntries
↓
Update LedgerBalance
↓
Mark POSTED
```

Canonical order:

```text
effective_at
posting_priority
posting_sequence
```

---

## 17. Posting Concurrency

Initial rule:

> **One authoritative posting stream per Enterprise.**

Parallelism:

```text
Enterprise A → worker
Enterprise B → worker
Enterprise C → worker
```

Within Enterprise A:

```text
Input 100
then 101
then 102
```

Do not process 102 before 101 merely because another worker is idle.

---

## 18. Posting Expression Engine

The Posting Module contains:

```text
ExpressionEngine
ConditionEvaluator
DimensionMapper
```

Inputs are controlled metadata ASTs.

No arbitrary:

```text
SQL
JavaScript
Python
Shell
```

execution is allowed in posting rules.

This is critical for:

```text
Determinism
Security
Replayability
Auditability
```

---

## 19. Ledger Module

Responsibilities:

```text
LedgerDefinition resolution
LedgerEntry creation interface
LedgerBalance projection
Ledger query
Ledger dimensions
Ledger validation
```

The Posting Module determines effects using PostingRules.

The Ledger Module persists and aggregates those effects.

---

## 20. Ledger Transaction Ownership

For normal posting, Posting + Ledger participate in one local database transaction.

Logical ownership:

```text
Posting Module
    orchestrates

Ledger Module
    validates/persists ledger effects
```

Transaction:

```text
PostingInput
+ LedgerEntries
+ LedgerBalance update
+ Posting status
```

commit atomically.

This is a major benefit of the modular-monolith design.

---

## 21. Ledger Query Boundary

The Ledger Module exposes internal query services:

```text
getBalance(...)
queryEntries(...)
traceBalance(...)
queryLedgerByDimensions(...)
```

Other modules should avoid duplicating Ledger aggregation logic.

---

## 22. Cost / Valuation Module

Responsibilities:

```text
ValuationPolicy resolution
CostPool management
FIFO
LIFO
Moving Average
Specific Identification
CostLayer
CostMatch
CostResult
CostRun
```

Canonical input:

```text
cost-bearing LedgerEntry
```

Canonical output:

```text
CostResult
```

---

## 23. Cost Execution Mode

Initial design supports:

```text
Synchronous incremental costing
or
Ordered asynchronous costing
```

Recommendation for first implementation:

> **Costing should run immediately after successful posting when the relevant ledger movement is cost-bearing, but remain a separate module and transaction phase where operationally safer.**

The precise behavior can vary by ledger family.

For inventory-sensitive valuation, ordering must remain deterministic.

---

## 24. Cost Pool Serialization

Sequence-sensitive methods require serialized state per CostPool.

Examples:

```text
FIFO
LIFO
MOVING_AVERAGE
```

Parallelism may happen across independent pools:

```text
HK / Product-A
SG / Product-B
```

but not within one pool if it changes result ordering.

---

## 25. Replay Module

Replay Module is an orchestrator, not a second Posting implementation.

Responsibilities:

```text
Acquire Replay Lock
Pause authoritative posting
Capture input boundary
Create ReplayRun
Clear / initialize derived datasets
Invoke Posting Module
Invoke Ledger rebuild
Invoke Cost Module
Run validation
Publish / activate
Resume posting
```

Replay must reuse the same deterministic engines used for normal runtime.

---

## 26. Replay Rule

Canonical:

> **Replay reuses Posting and Cost engines; it does not maintain alternate business logic.**

This prevents:

```text
normal result ≠ replay result
```

due to duplicated implementations.

---

## 27. Replay State Machine

Recommended:

```text
PENDING
PREPARING
POSTING
BALANCING
COSTING
VALIDATING
PUBLISHING
COMPLETED
FAILED
```

The Replay Module owns transitions.

---

## 28. Replay Locking

Initial coordination uses PostgreSQL advisory lock per Enterprise.

The Replay Module additionally signals the Posting Worker:

```text
posting paused for enterprise
```

The exact in-process representation may be:

```text
DB state
ReplayRun status
in-memory cache
```

but database state remains authoritative.

---

## 29. Process / Work Module

Responsibilities:

```text
ProcessDefinition execution
ProcessInstance
ProcessStepInstance
WorkItem
Plan
Trigger
Approval Work
Assignments
Due dates
Human / AI work queues
```

It must not bypass Commands for business mutations.

---

## 30. Work Execution Rule

WorkItem points toward an executable capability.

Example:

```text
WorkItem:
    Approve Purchase Request

Command:
    Approve Purchase Request
```

Completing WorkItem normally invokes the Command Module.

Correct:

```text
WorkItem
↓
Command
↓
BusinessData
```

Not:

```text
WorkItem
↓
Direct database mutation
```

---

## 31. Trigger Engine

Trigger evaluation may run:

```text
synchronously after transaction
or
asynchronously through internal/outbox events
```

Initial recommendation:

```text
Do not run complex trigger chains inside the core business transaction.
```

Prefer:

```text
Business commit
↓
Internal / Outbox event
↓
Trigger worker
↓
Create Work / invoke permitted Command
```

This reduces transaction complexity.

---

## 32. AI Gateway Module

The AI Gateway is the controlled bridge between AI models and EVO.

Responsibilities:

```text
Semantic metadata retrieval
Permission-aware context construction
Capability discovery
Command schema exposure
AI actor identity
Command invocation
Approval handoff
AI audit
Explanation / trace requests
```

AI Gateway does not own business rules.

---

## 33. AI Read Path

Canonical:

```text
AI Intent
↓
AI Gateway
↓
Query / Metadata APIs
↓
Permission filtering
↓
Structured enterprise context
↓
AI
```

AI must not query the database directly as the normal architecture.

---

## 34. AI Write Path

Canonical:

```text
AI
↓
AI Gateway
↓
Command Module
↓
Permission / Approval
↓
BusinessData
```

AI Gateway may prepare or submit Commands depending on actor policy.

---

## 35. AI Explanation Path

Example:

```text
Why is 待生产 = 70?
```

Path:

```text
AI Gateway
↓
Ledger Query
↓
LedgerBalance
↓
LedgerEntries
↓
PostingRule
↓
BusinessData
```

Cost explanation similarly traverses CostMatch/CostLayer lineage.

---

## 36. Integration Module

Responsibilities:

```text
External API adapters
Webhooks
Inbound message normalization
Outbound message publishing
Outbox worker
Inbox / deduplication
Connector-specific mapping
```

External systems should normally enter EVO via:

```text
Command Module
```

not direct BusinessData or Ledger writes.

---

## 37. Outbox Worker

Outbox Worker:

```text
Read unpublished outbox_event
↓
Publish
↓
Mark published
```

Delivery may be at-least-once.

Consumers must use idempotency.

Do not assume exactly-once messaging.

---

## 38. Query / Read Model Module

A dedicated query layer is useful even in a monolith.

Responsibilities:

```text
Dashboard queries
Application lists
Ledger views
Cost views
Work queues
AI semantic queries
Cross-module read composition
```

This module can combine read-only data from multiple modules without owning writes.

---

## 39. CQRS Position

EVO does not require full CQRS infrastructure initially.

Use a pragmatic distinction:

```text
Write paths:
    Command / Posting / Cost / Replay

Read paths:
    Query services / projections
```

Do not introduce separate databases or event sourcing solely to claim CQRS.

---

## 40. Internal Events

Modules may publish internal domain/runtime events.

Examples:

```text
BusinessDataCreated
PostingCompleted
LedgerBalanceChanged
CostCalculated
WorkItemCreated
ReplayCompleted
```

Initial implementation options:

```text
In-process event bus after commit
Outbox for durable asynchronous events
```

Events should not become an alternative source of business truth.

---

## 41. After-Commit Rule

Side effects that do not need to participate in the authoritative transaction should occur after commit.

Examples:

```text
Notification
Search indexing
AI embedding
Webhook delivery
Email
Analytics
Trigger evaluation
```

Preferred:

```text
Commit authoritative transaction
↓
Outbox / after-commit event
↓
Async work
```

---

## 42. Transaction Boundary Summary

### Command Transaction

```text
CommandExecution
BusinessData
PostingInput
Outbox
```

### Posting Transaction

```text
PostingInput state
LedgerEntry
LedgerBalance
```

### Cost Transaction

```text
CostPool
CostLayer
CostMatch
CostResult
```

### Replay Coordination

Multiple transactions under ReplayRun + ReplayLock.

Do not try to hold one giant DB transaction for full replay.

---

## 43. Failure Isolation

Failure should be isolated by module.

Examples:

```text
Command failure:
    no BusinessData commit

Posting failure:
    BusinessData exists
    PostingInput = FAILED

Cost failure:
    Ledger may be valid
    Cost status = FAILED / pending repair

Integration failure:
    business commit remains valid
    Outbox retries
```

This separation is important operationally.

---

## 44. Posting Failure State

When posting fails:

```text
BusinessData remains durable
PostingInput records FAILED
No partial LedgerEntries committed
```

Operator / AI may inspect:

```text
failure_code
failure_detail
rule version
posting sequence
```

After correction of rules/data/system issue, replay or retry may occur.

---

## 45. Cost Failure State

Cost failure should not silently corrupt Ledger state.

Possible:

```text
LedgerEntry = valid
CostResult = missing/failed
```

Downstream functions requiring cost must detect incomplete cost state.

This is safer than rolling back historical business posting because cost calculation failed.

---

## 46. Dependency Direction Rules

Hard rules:

1. Metadata must not depend on Posting.
2. BusinessData must not depend on Ledger.
3. Ledger must not depend on Process.
4. Cost depends on Ledger, not the reverse.
5. Replay depends on Posting/Ledger/Cost as orchestrator.
6. AI depends on public module APIs, not persistence internals.
7. Integration invokes Commands, not direct Ledger writes.
8. Query Module may read across modules but should not own business writes.

---

## 47. No Shared Mutable Domain Objects

Avoid modules passing rich mutable internal ORM entities between boundaries.

Prefer:

```text
IDs
Commands
DTOs
Value Objects
Read Models
Immutable result structures
```

This preserves module isolation inside one process.

---

## 48. Persistence Ownership

Each module owns its tables conceptually.

Example:

```text
Metadata Module:
    application_definition
    field_definition
    posting_rule definitions

Command Module:
    command_execution

Business Data Module:
    business_data

Posting Module:
    posting_input
    posting_run

Ledger Module:
    ledger_entry
    ledger_balance
    ledger_dataset

Cost Module:
    cost_*

Replay Module:
    replay_run
```

Other modules should not write tables they do not own.

---

## 49. Database Schema Choice

Initial physical database may use one PostgreSQL schema:

```text
public
```

but code-level ownership is mandatory.

Optional later improvement:

```text
meta.*
runtime.*
ledger.*
cost.*
workflow.*
```

PostgreSQL schemas are not required in v0.x.

Avoid adding database-schema complexity unless it clearly improves maintainability.

---

## 50. Repository Architecture

Recommended repository style:

```text
EVO/
├── apps/
│   ├── api/
│   └── worker/
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
│   ├── messaging/
│   ├── security/
│   ├── observability/
│   └── common/
│
└── migrations/
```

Exact programming language/framework is still deferred.

---

## 51. Module Internal Structure

Recommended structure per module:

```text
module/
├── domain/
├── application/
├── infrastructure/
└── api/
```

### domain

```text
business concepts
value objects
domain rules
```

### application

```text
use cases
orchestration
transactions
```

### infrastructure

```text
repositories
database adapters
external adapters
```

### api

```text
internal/public contracts
DTOs
```

---

## 52. Avoid Overusing DDD Ceremony

EVO may use DDD concepts where useful, but should not force:

```text
Aggregate
Domain Service
Repository
Value Object
Factory
Specification
```

onto every table.

Architecture should remain understandable and practical.

Use domain abstractions where they protect real invariants.

---

## 53. Worker Model

Initial workers:

```text
Posting Worker
Cost Worker
Outbox Worker
Trigger Worker
Replay Worker / Coordinator
```

They may run:

```text
inside one worker process
```

with separate queues/loops.

No need for Kubernetes microservice-per-worker architecture initially.

---

## 54. Scheduling

Background worker scheduling can initially use database polling plus locks.

Example:

```text
SELECT queued work
FOR UPDATE SKIP LOCKED
```

This is acceptable for early EVO.

A dedicated message broker may be added when measured throughput justifies it.

---

## 55. Message Broker Decision

Initial decision:

> **A message broker is not mandatory for EVO v0.x.**

PostgreSQL tables + Outbox + Workers are sufficient for initial deterministic runtime.

Future options:

```text
Kafka
RabbitMQ
NATS
Redis Streams
Cloud queue
```

should only be introduced for proven needs.

---

## 56. Cache Decision

Caching is optional and derived.

Likely candidates:

```text
Effective Application Definition
Published metadata
Permission resolution
Reference dictionaries
```

Preferred initial cache:

```text
in-process cache
```

Redis is not required initially.

Cache must never become authoritative state.

---

## 57. Search / Vector Services

These remain optional derived services.

Canonical:

```text
EVO PostgreSQL
↓
Outbox / Index Worker
↓
Search / Vector Store
```

AI Gateway may query them for discovery, then resolve authoritative state through EVO APIs.

---

## 58. Observability

Every major execution should have correlation identity.

Important IDs:

```text
request_id
command_execution_id
business_data_id
posting_input_id
posting_run_id
ledger_dataset_id
cost_run_id
replay_run_id
```

Logging should allow tracing:

```text
Command
→ BusinessData
→ PostingInput
→ LedgerEntry
→ CostResult
```

---

## 59. Metrics

Initial operational metrics:

```text
Command success/failure rate
Posting queue depth
Oldest unposted sequence age
Posting failures
Posting throughput
Cost failures
Cost queue age
Replay duration
Replay failures
Outbox backlog
WorkItem backlog
```

These are more useful initially than complex distributed tracing infrastructure.

---

## 60. Health States

System health should expose subsystem status:

```text
Database
Posting
Cost
Replay
Outbox
AI provider
External integrations
```

Per-enterprise posting/replay state may also be visible.

---

## 61. Deployment Topology v0.x

Recommended first deployment:

```text
┌──────────────────┐
│ Reverse Proxy     │
└────────┬─────────┘
         ↓
┌──────────────────┐
│ EVO API           │
│ 1..N replicas     │
└────────┬─────────┘
         ↓
┌──────────────────┐
│ PostgreSQL        │
└────────┬─────────┘
         ↑
┌──────────────────┐
│ EVO Worker        │
│ 1..N replicas     │
└──────────────────┘
```

Optional:

```text
Object Storage
Search / Vector service
External AI provider
```

---

## 62. API Scale-Out

API processes may scale horizontally because authoritative state lives in PostgreSQL.

Workers may also scale horizontally using database locking.

Per-enterprise ordering constraints remain enforced at the database/worker coordination level.

---

## 63. Future Extraction Candidates

If EVO later becomes distributed, likely extraction order:

```text
1. AI Gateway
2. Integration / Webhooks
3. Search / Semantic Index
4. Long-running Replay / Calculation Workers
5. Heavy Cost Engine
```

Core transactional modules:

```text
Command
BusinessData
Posting
Ledger
```

should remain together until strong evidence supports separation.

---

## 64. Microservice Extraction Rule

A module should become an independent service only if at least one strong reason exists:

```text
Independent scale
Independent deployment cadence
Isolation requirement
Different infrastructure needs
Security boundary
Long-running workload
Team ownership boundary
```

“Because it is a module” is not sufficient.

---

## 65. Service Contract Stability

Even inside the monolith, module APIs should be treated as service contracts.

Example:

```text
CommandService.execute(...)
LedgerQuery.getBalance(...)
CostQuery.getResult(...)
ReplayService.start(...)
```

Do not let UI/controllers import repositories from arbitrary modules.

This creates a clean future extraction path.

---

## 66. Controller / Transport Layer

HTTP/API controllers are adapters.

They should:

```text
Parse request
Authenticate
Map DTO
Call module application service
Return response
```

They should not contain business rules.

The same application service can later be invoked through:

```text
HTTP
CLI
Worker
AI Gateway
Integration adapter
```

---

## 67. UI Boundary

UI should consume:

```text
Metadata
View definitions
Query APIs
Command schemas
Work queues
```

UI must not encode the authoritative posting or process logic.

A button is simply one client representation of a Command capability.

---

## 68. Security Rule

No module may trust actor-supplied:

```text
enterprise_id
role
permission
approval authority
```

without resolving it from authenticated context.

AI actor requests follow the same rule.

---

## 69. Replay Availability Behavior

During Replay for Enterprise A:

```text
Posting A = paused
Posting B = normal
Posting C = normal
```

This confirms replay locking scope is Enterprise, not entire platform.

Business Command acceptance for A may continue if configured to queue PostingInputs beyond boundary.

---

## 70. Read Behavior During Replay

Initial behavior:

```text
Metadata reads = available
BusinessData reads = available
BusinessData writes = available
Posting-derived state = last active/known state or explicitly marked rebuilding
```

UI and AI should be able to detect:

```text
replay_in_progress = true
```

so stale derived state is not mistaken for newly rebuilt state.

---

## 71. Consistency Labels

Read models should distinguish state quality when useful:

```text
CURRENT
POSTING_PENDING
REPLAYING
COST_PENDING
FAILED
```

This is especially valuable for AI.

AI should know whether a displayed balance/cost is current or pending rebuild.

---

## 72. End-to-End Runtime Example

### Approve Sales Order

```text
UI / AI
↓
Command Module
↓
Permission
↓
Application Runtime
↓
BusinessData created
↓
PostingInput queued
↓
COMMIT
```

Posting Worker:

```text
PostingInput
↓
Resolve PostingRules
↓
Generate:
    待出库 +100
    待收款 +amount
↓
LedgerEntry
↓
LedgerBalance update
↓
POSTED
```

Process / Work:

```text
待出库 balance/state
↓
WorkItem:
    Prepare Shipment
```

---

## 73. End-to-End Cost Example

### Sales Shipment

```text
Ship Command
↓
BusinessData
↓
PostingInput
↓
库存数量 -20
↓
LedgerEntry
↓
Cost Module
↓
FIFO CostLayers
↓
CostMatch
↓
CostResult
```

AI may later trace the full lineage.

---

## 74. End-to-End Replay Example

```text
Admin changes PostingRule version
↓
Request Replay
↓
Replay Module acquires Enterprise lock
↓
Pause Posting Worker
↓
Capture input boundary
↓
Clear derived data
↓
Replay invokes Posting Module
↓
Ledger rebuild
↓
Cost rebuild
↓
Validation
↓
Activate
↓
Process waiting PostingInputs
↓
Resume
```

No historical Command is re-executed.

---

## 75. Runtime Component Decision Summary

Locked for v0.1:

1. EVO begins as a Modular Monolith.
2. PostgreSQL remains the authoritative shared transaction store.
3. API and Worker may be separate processes from the same codebase.
4. Module boundaries are code/ownership boundaries before network boundaries.
5. Command Module owns controlled business writes.
6. BusinessData and PostingInput are created atomically.
7. Posting is authoritative and serialized per Enterprise.
8. Posting and Ledger commit atomically for one PostingInput.
9. Cost remains a separate module.
10. Replay orchestrates existing engines rather than duplicating them.
11. Process / Work invokes Commands for business mutation.
12. AI reads through semantic/query APIs and writes through Commands.
13. Integration enters through Commands and exits through Outbox.
14. PostgreSQL-based workers are sufficient initially.
15. A message broker is not required in v0.x.
16. Cache/search/vector systems are derived optional infrastructure.
17. Module table ownership is explicit.
18. Direct cross-module repository writes are prohibited.
19. API contracts should remain clean enough for future extraction.
20. Microservices are deferred until justified by real operational needs.

---

## 76. Next Stage

The next document is:

**EVO-11 — API & Command Contracts v0.1**

It should define:

```text
API conventions
Command execution request/response
Metadata discovery APIs
Application APIs
BusinessData query APIs
Ledger APIs
Cost APIs
Replay APIs
Work APIs
AI capability discovery
Error model
Idempotency
Pagination
Versioning
Authentication context
Async operation responses
```

After EVO-11:

**EVO-12 — Repository Structure & Implementation Roadmap**

Then implementation should begin.

---

**End of EVO-10 v0.1**

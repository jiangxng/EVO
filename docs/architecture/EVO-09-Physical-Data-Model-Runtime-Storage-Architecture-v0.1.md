# EVO-09 — Physical Data Model & Runtime Storage Architecture

**Version:** 0.1  
**Status:** Draft / Implementation Architecture  
**Project:** EVO — Enterprise Operating System  
**Depends on:** EVO-08 — Architecture Convergence v0.2

---

## 1. Purpose

EVO-09 translates the converged conceptual architecture into a physical persistence model suitable for implementation.

This document defines:

```text
Primary database strategy
Enterprise isolation
Identity strategy
Metadata storage
BusinessData storage
Posting queue storage
Ledger storage
Balance projection
Cost storage
Replay storage
Versioning
JSON vs relational boundaries
Indexes
Transaction boundaries
Concurrency rules
Partitioning direction
```

The goal is not to prematurely optimize every subsystem.

The goal is:

> **Choose one coherent physical model that faithfully implements EVO's conceptual architecture and can evolve without forcing a redesign of the business model.**

---

## 2. Primary Database Decision

Initial implementation should use:

```text
PostgreSQL
```

as the primary transactional database.

Reasons:

```text
Strong ACID transactions
Excellent relational integrity
JSONB support
Expression / partial indexes
Window functions
CTE support
Mature locking semantics
Good partitioning support
Reliable decimal/numeric handling
Good fit for metadata + transactional + ledger workloads
```

EVO should not begin with multiple specialized databases unless required by measured scale.

Initial principle:

> **One authoritative PostgreSQL system first; specialized stores later only when a specific workload proves the need.**

---

## 3. Physical Storage Philosophy

EVO uses a hybrid relational model.

### Use relational columns for:

```text
Identity
Ownership
Versioning
Lifecycle status
Foreign keys
Ordering
High-value searchable dimensions
Amounts / quantities
Timestamps
Control flags
Runtime relationships
```

### Use JSONB for:

```text
Application-specific dynamic field values
Configurable metadata properties
Rule expressions
Overlay payloads
Extensible policies
Low-frequency optional attributes
```

Avoid two extremes:

```text
Everything as rigid columns
```

and:

```text
Everything as opaque JSON
```

Canonical rule:

> **Stable system semantics are relational. Variable enterprise/application semantics are JSONB-backed but metadata-defined.**

---

## 4. Enterprise Isolation

Every enterprise-owned runtime row must carry:

```text
enterprise_id
```

Core enterprise isolation is logical row-level isolation inside shared tables.

Initial architecture:

```text
Shared Database
Shared Schema
enterprise_id on owned rows
```

Do not create one database or schema per enterprise in the initial version.

Reasons:

```text
Simpler deployment
Simpler migrations
Simpler cross-enterprise template management
Lower operational overhead
Easier development
```

Enterprise-specific data access must always be scoped by `enterprise_id`.

Future large-enterprise physical isolation remains possible.

---

## 5. Identity Strategy

Use globally unique, sortable identifiers.

Recommended:

```text
UUIDv7
```

for primary object IDs.

Benefits:

```text
Globally unique
Time-ordered enough for index locality
No central sequence dependency
Good for distributed generation later
No business meaning embedded in ID
```

Do not use auto-increment IDs as business ordering semantics.

Database-local surrogate sequences may still exist for internal optimization, but canonical object identity is UUIDv7.

---

## 6. Naming Conventions

Recommended physical naming:

```text
snake_case
plural table names optional, but use one convention consistently
```

This document uses singular semantic table names for clarity.

Examples:

```text
enterprise
application_definition
business_data
posting_input
ledger_entry
cost_result
replay_run
```

Primary keys:

```text
id
```

Enterprise foreign key:

```text
enterprise_id
```

Definition version references:

```text
*_version_id
```

---

## 7. Time Columns

Use timezone-aware timestamps:

```text
timestamptz
```

Common runtime timestamps:

```text
created_at
effective_at
updated_at
completed_at
```

Business posting order uses:

```text
effective_at
posting_priority
posting_sequence
```

`created_at` must not be used as the sole posting order.

---

## 8. Numeric Types

Use exact decimal arithmetic.

Recommended:

```text
numeric(38, 12)
```

for generic quantities and monetary calculation values where wide precision is useful.

Specific domains may narrow precision later.

Never use floating-point types for authoritative accounting/cost values.

Canonical runtime columns:

```text
quantity numeric
amount numeric
unit_cost numeric
```

Currency amounts must retain explicit currency identity.

---

## 9. Metadata Schema

Core metadata tables:

```text
enterprise
domain
transaction_type
model_definition
template
template_version
application_definition
application_definition_version
application_instance
enterprise_overlay

field_group_definition
field_definition
field_definition_version

command_definition
process_definition
process_step_definition
posting_rule
ledger_definition
valuation_policy
permission_definition
approval_policy
trigger_definition
view_definition
ai_capability_definition
```

Not all tables need independent version tables immediately.

The rule is:

> Version entities whose published state must remain historically resolvable.

---

## 10. Enterprise Table

Conceptually:

```sql
enterprise
---------
id uuid primary key
code text
name text
status text
default_currency text
timezone text
created_at timestamptz
```

`code` should be unique within the platform if externally referenced.

---

## 11. Domain

```sql
domain
------
id uuid primary key
enterprise_id uuid nullable
code text
name text
description text
source_type text
metadata jsonb
```

`enterprise_id` may be null for platform/template-owned definitions.

This pattern can be reused for metadata supporting both global/template scope and enterprise scope.

---

## 12. Transaction Type

```sql
transaction_type
----------------
id uuid primary key
code text
name text
description text
metadata jsonb
```

TransactionType is semantic classification, not runtime transaction data.

---

## 13. Application Definition

Recommended split:

```text
application_definition
application_definition_version
```

Stable identity:

```sql
application_definition
----------------------
id uuid primary key
transaction_type_id uuid
code text
name text
status text
```

Published version:

```sql
application_definition_version
------------------------------
id uuid primary key
application_definition_id uuid
version_no integer
status text
definition jsonb
published_at timestamptz
```

The `definition` JSONB may contain:

```text
field groups
field references
command references
process references
posting-rule references
view references
AI capability references
```

but high-value objects should still have relational identity tables.

---

## 14. Application Instance

An enterprise-installed application:

```sql
application_instance
--------------------
id uuid primary key
enterprise_id uuid
application_definition_id uuid
base_version_id uuid
status text
name text
created_at timestamptz
```

Effective behavior is:

```text
Base Version
+
Enterprise Overlay
```

---

## 15. Enterprise Overlay

```sql
enterprise_overlay
------------------
id uuid primary key
enterprise_id uuid
application_instance_id uuid
base_version_id uuid
overlay_version integer
overlay jsonb
status text
created_at timestamptz
```

The initial implementation does not need automated three-way merge.

But the overlay must retain its base version.

---

## 16. Field Definition

Fields are metadata, not physical columns in every application table.

Recommended:

```sql
field_definition
----------------
id uuid primary key
code text
name text
business_type text
technical_type text
description text
metadata jsonb
```

Possible metadata:

```text
reference_target
snapshot_policy
unit
precision
validation
data_source
AI description
sensitivity
```

---

## 17. BusinessData Storage Decision

Use a generic runtime table:

```text
business_data
```

rather than one hard-coded table per application as the core conceptual model.

Recommended structure:

```sql
business_data
-------------
id uuid primary key
enterprise_id uuid not null
application_instance_id uuid not null
application_definition_version_id uuid not null

business_object_type text
business_object_key text nullable

operation_type text
effective_at timestamptz not null

payload jsonb not null

created_by_actor_type text
created_by_actor_id uuid nullable
command_execution_id uuid nullable

created_at timestamptz not null
```

`payload` contains application-defined field values.

---

## 18. BusinessData Payload

Example:

```json
{
  "customer": {
    "reference_id": "...",
    "snapshot": {
      "name": "ABC Ltd"
    }
  },
  "warehouse_id": "...",
  "items": [
    {
      "product_id": "...",
      "quantity": 100,
      "unit_price": 12.5
    }
  ]
}
```

Payload structure must be governed by metadata, not arbitrary uncontrolled JSON.

---

## 19. Business Object Identity

`business_object_key` provides logical grouping when multiple BusinessData rows belong to one evolving business object.

Example:

```text
SO-2026-00001
```

or an internal UUID.

This is not a correction graph.

It simply allows business-layer grouping.

Example:

```text
Sales Order Created
Sales Order Approved
Sales Order Adjusted
Sales Order Cancelled
```

may share one business object identity.

The Ledger Engine does not interpret semantic correction relationships.

---

## 20. Posting Input Physical Model

Recommended explicit table:

```sql
posting_input
-------------
id uuid primary key
enterprise_id uuid not null
business_data_id uuid not null

effective_at timestamptz not null
posting_priority integer not null default 0
posting_sequence bigint not null

metadata_version_ref uuid nullable

status text not null
failure_code text nullable
failure_detail jsonb nullable

created_at timestamptz not null
posted_at timestamptz nullable
```

Unique constraint:

```text
(enterprise_id, posting_sequence)
```

---

## 21. Posting Sequence Generation

Posting sequence must be stable and monotonic per Enterprise.

Recommended first implementation:

```text
enterprise-specific sequence allocator
```

Physical options:

```text
Dedicated sequence table
PostgreSQL sequence mapped by enterprise
Transactional allocator row
```

Recommended simplicity:

```text
posting_sequence_allocator
```

```sql
posting_sequence_allocator
--------------------------
enterprise_id uuid primary key
next_value bigint not null
```

Allocation occurs transactionally.

Sequence is not the only order key; canonical order remains:

```text
effective_at
posting_priority
posting_sequence
```

---

## 22. Posting Queue

`posting_input.status` provides the initial posting queue.

Statuses:

```text
QUEUED
PROCESSING
POSTED
FAILED
```

Initial worker query should use row locking:

```sql
FOR UPDATE SKIP LOCKED
```

but logical result must remain deterministic.

For one Enterprise/cost-sensitive stream, the engine should not process entries out of sequence merely because workers are available.

Initial recommendation:

> **Serialize authoritative posting per Enterprise.**

Parallelism can later occur across Enterprises.

---

## 23. Posting Rule Physical Model

```sql
posting_rule
------------
id uuid primary key
application_definition_version_id uuid
version_no integer
priority integer

trigger_selector jsonb
condition_expression jsonb

ledger_definition_id uuid
direction smallint

quantity_expression jsonb
amount_expression jsonb
dimension_mapping jsonb

status text
published_at timestamptz
```

Expression JSON must use a controlled EVO expression language/AST, not arbitrary executable code.

---

## 24. Expression Storage

Use JSON-based AST.

Example:

```json
{
  "op": "multiply",
  "args": [
    {"field": "quantity"},
    {"field": "unit_price"}
  ]
}
```

Conditions:

```json
{
  "op": "eq",
  "left": {"field": "product.type"},
  "right": {"const": "SELF_MADE"}
}
```

Do not store arbitrary SQL or application-language expressions as authoritative business rules.

---

## 25. Ledger Definition

```sql
ledger_definition
-----------------
id uuid primary key
code text
name text
ledger_family text
measure_policy jsonb
dimension_policy jsonb
cost_policy jsonb
metadata jsonb
```

`ledger_family` examples:

```text
OPERATIONAL
INVENTORY
FINANCIAL
WORK
CUSTOM
```

---

## 26. Ledger Entry

Recommended:

```sql
ledger_entry
------------
id uuid primary key
enterprise_id uuid not null

posting_run_id uuid not null
ledger_dataset_id uuid not null

posting_input_id uuid not null
business_data_id uuid not null
posting_rule_id uuid not null
ledger_definition_id uuid not null

effective_at timestamptz not null
posting_sequence bigint not null
rule_sequence integer not null

direction smallint not null

quantity numeric(38,12) nullable
amount numeric(38,12) nullable
unit_code text nullable
currency_code text nullable

dimensions jsonb not null

created_at timestamptz not null
```

---

## 27. Ledger Dimensions Physical Strategy

Initial version stores dimensions in:

```text
dimensions jsonb
```

Example:

```json
{
  "warehouse_id": "...",
  "product_id": "...",
  "project_id": "..."
}
```

But high-volume dimensions should additionally be denormalized into columns later if profiling proves necessary.

Initial useful generated/indexed dimensions may include:

```text
warehouse_id
product_id
customer_id
supplier_id
project_id
currency_code
```

Do not prematurely create hundreds of sparse columns.

---

## 28. Ledger Entry Indexes

Minimum useful indexes:

```text
enterprise_id + posting_sequence
enterprise_id + ledger_definition_id + effective_at
enterprise_id + ledger_definition_id + posting_sequence
business_data_id
posting_input_id
ledger_dataset_id
```

For JSON dimensions, create targeted expression indexes only for dimensions used frequently.

Example:

```sql
CREATE INDEX ...
ON ledger_entry (
  enterprise_id,
  ledger_definition_id,
  (dimensions->>'product_id')
);
```

---

## 29. Ledger Balance Projection

Recommended materialized table:

```sql
ledger_balance
--------------
enterprise_id uuid
ledger_definition_id uuid
dimension_hash text
dimensions jsonb

quantity numeric(38,12)
amount numeric(38,12)

last_posting_sequence bigint
updated_at timestamptz

primary key (
  enterprise_id,
  ledger_definition_id,
  dimension_hash
)
```

`dimension_hash` is a canonical hash of normalized dimension values.

Balance is replaceable projection state.

---

## 30. Balance Update

Normal posting:

```text
Insert LedgerEntry
↓
Update LedgerBalance
```

within the same authoritative posting transaction when practical.

Replay:

```text
Clear Balance
↓
Rebuild from LedgerEntry
```

Balance is never the only historical source.

---

## 31. Posting Run

```sql
posting_run
-----------
id uuid primary key
enterprise_id uuid
replay_run_id uuid nullable

input_boundary bigint
metadata_version_ref uuid
status text

started_at timestamptz
completed_at timestamptz
```

Real-time posting may use a long-lived/current posting run or periodic runs.

Replay uses explicit isolated PostingRun records.

Exact lifecycle can be refined during service design.

---

## 32. Ledger Dataset

```sql
ledger_dataset
--------------
id uuid primary key
enterprise_id uuid
posting_run_id uuid
input_boundary bigint
rule_set_hash text
status text
is_active boolean
created_at timestamptz
```

Initial implementation may maintain one active dataset.

`ledger_dataset_id` remains useful even if clear-and-rebuild is used.

This avoids a later schema rewrite when candidate datasets are introduced.

---

## 33. Cost Policy Physical Model

```sql
valuation_policy
----------------
id uuid primary key
enterprise_id uuid nullable
code text
name text
method text

dimension_definition jsonb
rounding_policy jsonb
negative_inventory_policy jsonb
currency_policy jsonb

version_no integer
status text
```

Methods:

```text
FIFO
LIFO
MOVING_AVERAGE
SPECIFIC_IDENTIFICATION
```

---

## 34. Cost Pool

```sql
cost_pool
---------
id uuid primary key
enterprise_id uuid
cost_run_id uuid
valuation_policy_id uuid

dimension_hash text
dimensions jsonb

quantity numeric(38,12)
amount numeric(38,12)
average_unit_cost numeric(38,12) nullable
```

Unique:

```text
cost_run_id + valuation_policy_id + dimension_hash
```

---

## 35. Cost Layer

```sql
cost_layer
----------
id uuid primary key
enterprise_id uuid
cost_run_id uuid
cost_pool_id uuid

source_ledger_entry_id uuid

effective_at timestamptz
posting_sequence bigint

original_quantity numeric(38,12)
remaining_quantity numeric(38,12)

original_amount numeric(38,12)
remaining_amount numeric(38,12)

unit_cost numeric(38,12)
status text
```

FIFO/LIFO consume these layers in deterministic order.

---

## 36. Cost Match

```sql
cost_match
----------
id uuid primary key
enterprise_id uuid
cost_run_id uuid

outbound_ledger_entry_id uuid
inbound_cost_layer_id uuid

matched_quantity numeric(38,12)
matched_amount numeric(38,12)
unit_cost numeric(38,12)
```

Indexes:

```text
outbound_ledger_entry_id
inbound_cost_layer_id
cost_run_id
```

---

## 37. Cost Result

```sql
cost_result
-----------
id uuid primary key
enterprise_id uuid
cost_run_id uuid
ledger_entry_id uuid
valuation_policy_id uuid

quantity numeric(38,12)
cost_amount numeric(38,12)
unit_cost numeric(38,12)
currency_code text

created_at timestamptz
```

Unique:

```text
cost_run_id + ledger_entry_id
```

unless one movement legitimately produces multiple cost-result components later.

If that need emerges, add `component_type`.

---

## 38. Cost Run

```sql
cost_run
--------
id uuid primary key
enterprise_id uuid
replay_run_id uuid nullable
ledger_dataset_id uuid
valuation_policy_id uuid
status text

started_at timestamptz
completed_at timestamptz
```

---

## 39. Cost Dataset

```sql
cost_dataset
------------
id uuid primary key
enterprise_id uuid
cost_run_id uuid
ledger_dataset_id uuid
valuation_policy_id uuid

status text
is_active boolean
created_at timestamptz
```

---

## 40. Replay Run

```sql
replay_run
----------
id uuid primary key
enterprise_id uuid

input_boundary bigint

metadata_snapshot_ref uuid nullable
posting_rule_set_hash text
valuation_policy_set_hash text

status text
phase text

started_at timestamptz
completed_at timestamptz

failure_detail jsonb
validation_result jsonb
```

---

## 41. Replay Lock

Initial implementation can use PostgreSQL advisory locks.

Preferred:

```text
pg_advisory_lock(hash(enterprise_id))
```

for replay exclusivity.

This avoids a complex durable lock table initially.

Still retain ReplayRun for audit.

If cluster/runtime requirements later demand durable distributed locking outside PostgreSQL, revisit then.

---

## 42. Replay Input Boundary

The physical replay boundary is:

```text
maximum posting_sequence included in replay
```

At replay start:

```text
boundary = current highest committed posting_sequence
```

Replay processes:

```text
posting_sequence <= boundary
```

New inputs receive higher sequence values and wait.

This makes replay input deterministic.

---

## 43. Replay Clear-and-Rebuild

Initial implementation:

```text
Acquire Enterprise Replay Lock
Pause posting worker for Enterprise
Capture boundary
Delete derived data for Enterprise
Rebuild posting through boundary
Rebuild balances
Rebuild costs
Validate
Mark datasets active
Process waiting inputs
Resume posting
```

Deletes should be scoped by:

```text
enterprise_id
```

and optionally dataset/run identity.

---

## 44. Candidate Dataset Compatibility

Even though first implementation may clear tables, every derived row should retain:

```text
posting_run_id / cost_run_id
ledger_dataset_id / cost_dataset_id
```

This is deliberate.

It allows future migration to:

```text
Build Candidate
Validate
Atomic Switch
```

without changing core data relationships.

---

## 45. Command Definition

```sql
command_definition
------------------
id uuid primary key
application_definition_version_id uuid
code text
name text

input_schema jsonb
preconditions jsonb
permission_policy jsonb
approval_policy jsonb
execution_policy jsonb

status text
```

---

## 46. Command Execution

```sql
command_execution
-----------------
id uuid primary key
enterprise_id uuid
application_instance_id uuid
command_definition_id uuid

actor_type text
actor_id uuid nullable

idempotency_key text nullable
input jsonb
status text
result jsonb
error jsonb

created_at timestamptz
completed_at timestamptz
```

Unique when present:

```text
enterprise_id + idempotency_key
```

---

## 47. Process Tables

Initial process model:

```sql
process_definition
process_step_definition
process_instance
process_step_instance
```

Runtime:

```sql
process_instance
----------------
id uuid
enterprise_id uuid
process_definition_id uuid
business_context jsonb
status text
started_at timestamptz
completed_at timestamptz
```

```sql
process_step_instance
---------------------
id uuid
process_instance_id uuid
step_definition_id uuid
status text
context jsonb
started_at timestamptz
completed_at timestamptz
```

Do not implement a full BPMN persistence model initially.

---

## 48. Work Item

```sql
work_item
---------
id uuid primary key
enterprise_id uuid

application_instance_id uuid nullable
command_definition_id uuid nullable
process_instance_id uuid nullable

business_context jsonb
assigned_actor_type text nullable
assigned_actor_id uuid nullable

priority integer
due_at timestamptz nullable
status text

created_at timestamptz
completed_at timestamptz
```

---

## 49. Plan

Initial Plan storage can be generic:

```sql
plan
----
id uuid primary key
enterprise_id uuid
plan_type text
source_context jsonb
target_context jsonb
payload jsonb
status text
created_at timestamptz
```

Domain-specific planning engines can later add optimized tables.

---

## 50. Actor Identity

EVO should not overload user tables with all actor types.

Conceptual actor reference:

```text
actor_type
actor_id
```

Actor types:

```text
HUMAN
AI
AUTOMATION
EXTERNAL_SYSTEM
```

Human identity may reference an IAM/user subsystem.

AI actors and automation actors should have their own registered identities and policy scope.

---

## 51. Audit Fields

Core mutable/runtime tables should include as appropriate:

```text
created_at
created_by
updated_at
updated_by
```

But audit should not rely only on mutable row metadata.

Important operations retain execution records:

```text
CommandExecution
ReplayRun
PostingRun
CostRun
AI action audit
```

---

## 52. Soft Delete

Do not make soft delete a universal rule.

For metadata:

```text
status = ACTIVE / INACTIVE / RETIRED
```

is usually preferable.

For BusinessData:

do not physically delete business history in normal operation unless required by retention/privacy rules.

Business cancellation is represented by new BusinessData, not a database delete.

---

## 53. Metadata Version Resolution

Every BusinessData row should retain:

```text
application_definition_version_id
```

so the original semantic contract remains identifiable.

Posting may also resolve/retain:

```text
posting_rule_id
```

on each LedgerEntry.

Cost retains:

```text
valuation_policy_id
```

on CostRun/CostResult.

This creates explicit lineage.

---

## 54. Rule Set Hash

Replay reproducibility benefits from a normalized hash of active rule versions.

Example:

```text
posting_rule_set_hash
valuation_policy_set_hash
```

The hash is not a replacement for relational version references.

It is a reproducibility/audit fingerprint.

---

## 55. JSON Canonicalization

Whenever JSON contributes to:

```text
hashing
dimension identity
rule identity
dataset identity
```

it must be canonicalized.

Canonicalization must define:

```text
key ordering
numeric formatting
null treatment
array ordering semantics
text normalization
```

Without this, hashes are not deterministic.

---

## 56. Dimension Hash

`dimension_hash` should be calculated from normalized dimensions.

Example input:

```json
{
  "warehouse_id": "W1",
  "product_id": "P1"
}
```

Canonical serialized form is hashed using a stable algorithm such as:

```text
SHA-256
```

This supports balance/cost-pool keys.

The original JSON dimensions must still be stored for readability.

---

## 57. Transaction Boundaries — Command

Command transaction:

```text
Validate permission
Validate preconditions
Create CommandExecution
Create BusinessData
Create PostingInput
Commit
```

These should normally be one database transaction.

This ensures:

```text
BusinessData exists
iff
its PostingInput exists
```

for posting-relevant commands.

---

## 58. Transaction Boundaries — Posting

One authoritative PostingInput should normally post atomically:

```text
Lock next input
Evaluate rules
Insert LedgerEntries
Update LedgerBalance
Mark PostingInput POSTED
Commit
```

If posting fails:

```text
Rollback ledger effects
Record failure state
```

Failure-state persistence may require a follow-up transaction after rollback.

---

## 59. Transaction Boundaries — Cost

Cost calculation for one movement should preserve consistent pool/layer state.

For FIFO/LIFO:

```text
Lock CostPool / candidate CostLayers
Consume layers
Insert CostMatch
Insert CostResult
Update remaining layer quantities
Commit
```

Initial implementation should serialize valuation per CostPool when necessary.

---

## 60. Concurrency Model

Initial concurrency strategy:

```text
Across Enterprises:
    Parallel

Within one Enterprise Posting Stream:
    Serialized authoritative sequence

Across independent Cost Pools:
    Potentially parallel later

Within one Cost Pool:
    Serialized when algorithm is sequence-sensitive
```

Do not optimize parallelism before deterministic behavior is proven.

---

## 61. Isolation Level

Default PostgreSQL:

```text
READ COMMITTED
```

is acceptable for much of runtime operation if explicit row locks are used correctly.

For replay boundary capture and publication, stricter coordination may be used.

Do not globally enable SERIALIZABLE unless evidence requires it.

---

## 62. Outbox Pattern

EVO will eventually integrate with external services.

Recommended transactional integration pattern:

```text
business transaction
+
outbox_event insert
=
same DB transaction
```

Then asynchronous publishers deliver external events.

Initial table:

```sql
outbox_event
------------
id uuid
enterprise_id uuid
event_type text
aggregate_type text
aggregate_id uuid
payload jsonb
status text
created_at timestamptz
published_at timestamptz
```

This prevents business commit / message publish inconsistency.

---

## 63. Inbox / Idempotency for External Commands

For external integrations:

```text
external message id
↓
deduplication
↓
Command
```

Use:

```text
idempotency_key
```

or an inbox table when needed.

Do not rely on “exactly once delivery” from external messaging systems.

---

## 64. Partitioning Strategy

Do not partition everything initially.

Likely future large tables:

```text
business_data
posting_input
ledger_entry
cost_result
cost_match
```

Potential first partition key:

```text
enterprise_id hash partition
```

or:

```text
time range
```

But initial recommendation:

> **Start unpartitioned unless expected data volume already demands partitioning.**

Build indexes and measure first.

---

## 65. Data Retention

Conceptual categories:

```text
Metadata:
    long-lived / versioned

BusinessData:
    durable enterprise history

LedgerEntry:
    rebuildable but usually retained while active

LedgerBalance:
    disposable projection

CostLayer / CostMatch / CostResult:
    rebuildable derived data

Run / Audit records:
    retained for operational traceability
```

Retention policies can differ by enterprise and regulation.

---

## 66. Read Models

Operational UIs and AI should not always query base tables directly.

Create query/read services over:

```text
Application effective metadata
BusinessData
LedgerBalance
LedgerEntry history
CostResult
WorkItem
Process state
```

Physical materialized views may be introduced selectively.

---

## 67. Search

Full-text / semantic search is not part of the authoritative transaction store.

Initial:

```text
PostgreSQL text search
```

may be sufficient.

Future:

```text
Search index
Vector index
Knowledge index
```

can be derived asynchronously from authoritative EVO data.

These indexes are projections and can be rebuilt.

---

## 68. AI Retrieval Storage Principle

AI-specific embeddings or semantic indexes must never become the authoritative source of business state.

Correct:

```text
PostgreSQL authoritative data
↓
Derived semantic/vector index
↓
AI retrieval
```

Not the reverse.

---

## 69. Security Boundaries

At minimum:

```text
enterprise_id scoping
application permission
command permission
data scope
field sensitivity
```

PostgreSQL Row Level Security may later provide defense-in-depth.

Initial application services must enforce enterprise scope explicitly even if RLS is used.

---

## 70. Schema Migration Strategy

Use version-controlled migrations.

Recommended tools can be selected during implementation stack design.

Rule:

```text
Every physical schema change
=
versioned migration
```

Do not manage production schema through manual SQL edits.

Metadata content migrations must also be reproducible.

---

## 71. Seed Metadata

System-level metadata/templates should be seeded through version-controlled packages.

Avoid large opaque SQL snapshot dumps as the long-term primary configuration mechanism.

Preferred:

```text
Versioned metadata package
↓
Installer / migration
↓
Database definitions
```

This preserves a lesson from the legacy Asloop approach while keeping EVO cleaner.

---

## 72. Avoided Physical Anti-Patterns

EVO should not:

1. Create one bespoke table for every application as the only runtime model.
2. Store all system semantics inside JSON with no relational identity.
3. Use database insertion order as business posting order.
4. Make LedgerBalance the source of history.
5. Permanently bake calculated inventory cost into source BusinessData.
6. Allow posting rules to execute arbitrary SQL.
7. Allow AI to write arbitrary database rows.
8. Run replay concurrently with authoritative real-time posting in v1.
9. Design distributed microservices before transaction boundaries are understood.
10. Partition every table before measuring workload.

---

## 73. Initial Physical Core

The minimal physical core for the first executable EVO should include:

```text
enterprise

application_definition
application_definition_version
application_instance
field_definition
enterprise_overlay

command_definition
command_execution

business_data
posting_input
posting_sequence_allocator

posting_rule
ledger_definition
ledger_entry
ledger_balance

valuation_policy
cost_pool
cost_layer
cost_match
cost_result

posting_run
ledger_dataset
cost_run
cost_dataset
replay_run

process_definition
process_step_definition
process_instance
process_step_instance
work_item

outbox_event
```

This is enough to implement one end-to-end vertical slice.

---

## 74. First Vertical Slice

Recommended first functional scenario:

```text
Sales Order
↓
Approve
↓
BusinessData
↓
PostingInput
↓
Conditional Posting
↓
待出库 / 待收款
↓
LedgerBalance
↓
WorkItem
```

Then add inventory:

```text
Purchase Receipt
Sales Shipment
↓
Inventory Ledger
↓
FIFO / Moving Average Cost
```

Then replay:

```text
Change Posting Rule
↓
Full Replay
↓
Ledger Rebuild
↓
Cost Rebuild
```

This validates the architecture with real runtime behavior.

---

## 75. Physical Architecture Decision Summary

Locked for v0.1 implementation:

1. PostgreSQL is the authoritative primary database.
2. Shared database/shared schema with `enterprise_id`.
3. UUIDv7 for canonical object IDs.
4. Stable system semantics use relational columns.
5. Dynamic application semantics use metadata-governed JSONB.
6. BusinessData uses a generic runtime table.
7. PostingInput is explicit.
8. Posting order is `effective_at + priority + sequence`.
9. Posting sequence is monotonic per Enterprise.
10. Posting is serialized per Enterprise initially.
11. LedgerEntry is append-style derived data.
12. LedgerBalance is a materialized projection.
13. Ledger dimensions begin as JSONB with targeted indexes.
14. Cost is stored separately from LedgerEntry.
15. FIFO/LIFO use CostLayer + CostMatch.
16. Moving Average uses CostPool running state.
17. Replay uses an explicit input boundary.
18. Replay exclusivity initially uses PostgreSQL advisory locks.
19. Derived rows retain run/dataset identity from day one.
20. Candidate dataset switching remains compatible but deferred.
21. Commands create BusinessData and PostingInput atomically.
22. External integration uses an Outbox pattern.
23. Financial/accounting decimals use exact numeric types.
24. No premature microservice/database specialization.

---

## 76. Next Stage

The next document is:

**EVO-10 — Service Boundaries & Runtime Components v0.1**

It will define physical runtime modules such as:

```text
Metadata Service
Application Runtime
Command Service
Business Data Service
Posting Engine
Ledger Service
Cost Engine
Replay Coordinator
Process / Work Service
AI Gateway
Integration / Outbox Worker
```

and decide:

```text
Modular Monolith vs Microservices
Module ownership
Transaction ownership
Internal APIs
Async boundaries
Worker model
Dependency direction
Deployment topology
```

Recommended direction entering EVO-10:

> **Start EVO as a modular monolith with strong internal module boundaries, not as microservices.**

The next document will formalize that decision.

---

**End of EVO-09 v0.1**

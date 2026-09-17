# EVO-11 — API & Command Contracts

**Version:** 0.1  
**Status:** Draft / Implementation Architecture  
**Project:** EVO — Enterprise Operating System  
**Depends on:** EVO-10 — Service Boundaries & Runtime Components v0.1

---

## 1. Purpose

EVO-11 defines the external and internal service contracts used by:

```text
Human UI
AI
Automation
External Systems
Internal Modules
Future Remote Services
Future Message Consumers
```

The main architectural requirement is:

> **Contracts must work inside the Modular Monolith today and remain suitable for remote-service and message-driven execution later.**

The contract model should therefore avoid being coupled to:

```text
ORM entities
HTTP-only assumptions
Process-local object references
Database transactions crossing module boundaries
```

---

## 2. Contract Design Principles

All EVO contracts should be:

```text
Explicit
Versionable
Idempotent where necessary
Enterprise-scoped
Actor-aware
Machine-readable
Serializable
Transport-neutral where practical
Deterministic
Traceable
```

Transport adapters may include:

```text
HTTP / JSON
In-process method call
Worker invocation
Message broker
CLI
AI tool invocation
```

The business contract should remain conceptually the same.

---

## 3. Transport-Neutral Contract Model

Example canonical request:

```json
{
  "request_id": "...",
  "enterprise_id": "...",
  "actor": {
    "type": "HUMAN",
    "id": "..."
  },
  "command": "sales_order.approve",
  "application_instance_id": "...",
  "idempotency_key": "...",
  "input": {},
  "context": {}
}
```

This may be delivered through:

```text
HTTP
In-process call
Queue message
```

without changing its business meaning.

---

## 4. API Style Decision

Initial external API style:

```text
JSON over HTTP
```

Recommended API convention:

```text
REST-style resource reads
+
Command-oriented business writes
```

Do not force every business operation into generic CRUD.

Preferred:

```text
GET /applications/{id}
GET /ledger/balances
POST /commands/{commandCode}/execute
POST /replays
```

instead of hiding business meaning behind:

```text
PATCH /records/123
```

---

## 5. API Versioning

Initial API prefix:

```text
/api/v1
```

Example:

```text
/api/v1/commands/...
```

API version and metadata/application version are different concepts.

```text
API Version
≠
Application Definition Version
≠
Posting Rule Version
```

---

## 6. Standard Request Envelope

For command/action APIs:

```json
{
  "request_id": "uuid",
  "idempotency_key": "optional-string",
  "application_instance_id": "uuid",
  "input": {},
  "context": {}
}
```

`enterprise_id` should normally be resolved from authenticated context rather than trusted directly from client input.

For future service-to-service messages, `enterprise_id` becomes explicit in the trusted envelope.

---

## 7. Authentication Context

Conceptual authenticated context:

```text
AuthContext
    actor_type
    actor_id
    enterprise_id
    organization_scope
    roles
    permission_context
    session / credential identity
```

Clients must not be allowed to self-assert authoritative roles.

---

## 8. Correlation Context

Every important execution should carry:

```text
request_id
correlation_id
causation_id
```

Definitions:

### request_id

One client/API request.

### correlation_id

Groups a larger business flow.

### causation_id

Identifies the immediate operation/event that caused the current one.

This becomes especially useful after future message-broker adoption.

---

## 9. Command Contract

Canonical Command request:

```json
{
  "command_code": "sales_order.approve",
  "application_instance_id": "uuid",
  "business_object": {
    "type": "sales_order",
    "key": "SO-2026-00001"
  },
  "input": {
    "approval_note": "..."
  },
  "idempotency_key": "client-generated-key"
}
```

---

## 10. Command Response

Canonical success response:

```json
{
  "command_execution_id": "uuid",
  "status": "COMPLETED",
  "business_data": [
    {
      "id": "uuid",
      "type": "sales_order_approved"
    }
  ],
  "posting": {
    "status": "QUEUED",
    "posting_input_ids": ["uuid"]
  },
  "work": [],
  "links": {}
}
```

The Command response does not have to wait for posting/cost if those are asynchronous.

---

## 11. Command Status

Recommended statuses:

```text
RECEIVED
PENDING_APPROVAL
PROCESSING
COMPLETED
REJECTED
FAILED
```

`COMPLETED` means the business command transaction committed.

It does not necessarily mean:

```text
Posting completed
Cost completed
External integration completed
```

Those have independent statuses.

---

## 12. Idempotency

Commands that may produce duplicate business effects must support:

```text
Idempotency-Key
```

HTTP option:

```text
Idempotency-Key: <client-generated-key>
```

Logical uniqueness:

```text
enterprise_id
+
command scope
+
idempotency_key
```

Repeated requests should return the original execution result where possible.

---

## 13. Idempotency Scope

Avoid one global namespace for every command.

Recommended conceptual key:

```text
enterprise_id
actor / client identity
command_code
idempotency_key
```

Exact physical unique index can be adjusted based on client behavior.

---

## 14. Command Schema Discovery

Applications expose machine-readable Command definitions.

Example:

```text
GET /api/v1/applications/{applicationInstanceId}/commands
```

Response:

```json
{
  "commands": [
    {
      "code": "sales_order.approve",
      "name": "Approve Sales Order",
      "description": "...",
      "input_schema": {},
      "preconditions": [],
      "approval": {},
      "risk_level": "MEDIUM"
    }
  ]
}
```

This API is equally important for UI and AI.

---

## 15. JSON Schema

Command inputs should use a standard machine-readable schema representation.

Recommended:

```text
JSON Schema
```

for input shape and basic validation.

Business-semantic validation still belongs to application/precondition logic.

JSON Schema should describe:

```text
types
required properties
basic constraints
enumerations
nested structures
```

---

## 16. Metadata Discovery APIs

Recommended:

```text
GET /api/v1/metadata/domains
GET /api/v1/metadata/transaction-types
GET /api/v1/applications
GET /api/v1/applications/{id}
GET /api/v1/applications/{id}/fields
GET /api/v1/applications/{id}/commands
GET /api/v1/applications/{id}/processes
```

Responses should describe the effective enterprise definition, not only the base template.

---

## 17. Effective Metadata Response

Useful fields:

```json
{
  "application_instance_id": "...",
  "application_definition_id": "...",
  "base_version": 3,
  "overlay_version": 2,
  "effective_definition_hash": "...",
  "name": "...",
  "transaction_type": {},
  "fields": [],
  "commands": []
}
```

This supports caching and AI context traceability.

---

## 18. BusinessData Write Boundary

There should not normally be a public generic endpoint:

```text
POST /business-data
```

for unrestricted use.

BusinessData is normally created through Commands.

Administrative/import interfaces may exist, but they still require explicit controlled capability definitions.

---

## 19. BusinessData Query APIs

Read APIs may include:

```text
GET /api/v1/business-data/{id}
GET /api/v1/business-objects/{type}/{key}/history
GET /api/v1/applications/{id}/data
```

Business history response should preserve sequence/time semantics.

---

## 20. Business History Response

Example:

```json
{
  "business_object": {
    "type": "sales_order",
    "key": "SO-2026-00001"
  },
  "records": [
    {
      "id": "...",
      "operation_type": "CREATED",
      "effective_at": "...",
      "payload": {}
    },
    {
      "id": "...",
      "operation_type": "APPROVED",
      "effective_at": "...",
      "payload": {}
    }
  ]
}
```

This is business-layer history, not a generic correction graph.

---

## 21. Posting Status API

Recommended:

```text
GET /api/v1/posting/inputs/{id}
```

Response:

```json
{
  "id": "...",
  "status": "POSTED",
  "effective_at": "...",
  "posting_priority": 0,
  "posting_sequence": 12345,
  "posting_run_id": "...",
  "failure": null
}
```

---

## 22. Posting State Endpoint

Per Enterprise:

```text
GET /api/v1/posting/state
```

Example:

```json
{
  "state": "NORMAL",
  "queue_depth": 125,
  "last_posted_sequence": 123456,
  "oldest_queued_effective_at": "...",
  "replay_in_progress": false
}
```

This is valuable for operations and AI.

---

## 23. Ledger Balance API

Recommended:

```text
GET /api/v1/ledgers/{ledgerCode}/balances
```

Query parameters may include dimensions:

```text
product_id
warehouse_id
project_id
customer_id
currency
```

Example response:

```json
{
  "ledger": "pending_production",
  "as_of_sequence": 123456,
  "state_quality": "CURRENT",
  "items": [
    {
      "dimensions": {
        "product_id": "P1",
        "warehouse_id": "HK"
      },
      "quantity": "70.000000000000",
      "amount": null
    }
  ]
}
```

Numbers should be serialized as strings when necessary to preserve decimal precision.

---

## 24. Ledger Entry API

Recommended:

```text
GET /api/v1/ledgers/{ledgerCode}/entries
```

Supports filters:

```text
from_effective_at
to_effective_at
from_sequence
to_sequence
business_data_id
dimensions
```

Response should expose lineage:

```text
posting_input_id
business_data_id
posting_rule_id
posting_sequence
```

---

## 25. Ledger Explain API

Useful AI/human endpoint:

```text
GET /api/v1/ledger-balances/explain
```

Conceptually input:

```text
ledger
dimensions
```

Output:

```text
balance
contributing entries
posting rules
business data lineage
```

This can initially be implemented through query composition rather than a dedicated engine.

---

## 26. Cost Result API

Recommended:

```text
GET /api/v1/cost/results
```

Filters:

```text
ledger_entry_id
product_id
warehouse_id
cost_run_id
valuation_method
```

Response:

```json
{
  "ledger_entry_id": "...",
  "valuation_method": "FIFO",
  "quantity": "120",
  "cost_amount": "1240",
  "unit_cost": "10.333333333333",
  "currency": "USD"
}
```

---

## 27. Cost Explain API

Recommended:

```text
GET /api/v1/cost/results/{id}/explain
```

FIFO example:

```json
{
  "result": {},
  "matches": [
    {
      "source_ledger_entry_id": "...",
      "matched_quantity": "100",
      "unit_cost": "10"
    },
    {
      "source_ledger_entry_id": "...",
      "matched_quantity": "20",
      "unit_cost": "12"
    }
  ]
}
```

This endpoint is especially useful for AI explainability.

---

## 28. Work APIs

Recommended:

```text
GET  /api/v1/work-items
GET  /api/v1/work-items/{id}
POST /api/v1/work-items/{id}/claim
POST /api/v1/work-items/{id}/execute
POST /api/v1/work-items/{id}/release
```

`execute` should normally invoke the associated Command rather than mutate business state directly.

---

## 29. Work Queue Filters

Examples:

```text
status
assigned_to_me
actor_type
application
priority
due_before
process
organization
```

AI may query the same work queue under its own identity and permissions.

---

## 30. Process APIs

Initial APIs:

```text
GET  /api/v1/processes/{id}
GET  /api/v1/process-instances/{id}
GET  /api/v1/process-instances/{id}/steps
POST /api/v1/process-instances/{id}/commands/{commandCode}
```

Avoid exposing arbitrary process-state mutation endpoints.

---

## 31. Replay API

Start full replay:

```text
POST /api/v1/replays
```

Request:

```json
{
  "mode": "FULL",
  "reason": "Posting rule version update"
}
```

Response:

```json
{
  "replay_run_id": "...",
  "status": "PENDING"
}
```

Replay is naturally asynchronous.

---

## 32. Replay Status

```text
GET /api/v1/replays/{id}
```

Response:

```json
{
  "id": "...",
  "status": "POSTING",
  "phase": "POSTING",
  "input_boundary": 123456,
  "progress": {
    "processed": 100000,
    "total": 123456
  },
  "failure": null
}
```

Progress is operational metadata, not authoritative business state.

---

## 33. Replay Validation Result

After completion:

```json
{
  "status": "COMPLETED",
  "validation": {
    "posting_failures": 0,
    "ledger_reconciled": true,
    "cost_reconciled": true
  },
  "ledger_dataset_id": "...",
  "cost_dataset_id": "..."
}
```

---

## 34. Async Operation Pattern

Long-running operations return:

```text
202 Accepted
```

plus operation identity.

Canonical:

```json
{
  "operation_id": "...",
  "status": "PENDING",
  "status_url": "/api/v1/operations/..."
}
```

Possible operations:

```text
Replay
Large import
Large export
Long AI coordination
Bulk planning
```

---

## 35. Standard Error Model

Canonical error:

```json
{
  "error": {
    "code": "COMMAND_PRECONDITION_FAILED",
    "message": "Inventory is insufficient.",
    "details": {},
    "retryable": false,
    "correlation_id": "..."
  }
}
```

Do not make clients parse free-text messages to determine behavior.

---

## 36. Error Categories

Recommended categories:

```text
AUTHENTICATION_REQUIRED
PERMISSION_DENIED
RESOURCE_NOT_FOUND
VALIDATION_FAILED
COMMAND_PRECONDITION_FAILED
APPROVAL_REQUIRED
IDEMPOTENCY_CONFLICT
POSTING_PAUSED
POSTING_FAILED
COST_PENDING
COST_FAILED
REPLAY_IN_PROGRESS
REPLAY_FAILED
CONCURRENCY_CONFLICT
RATE_LIMITED
INTERNAL_ERROR
```

---

## 37. Retryability

Error responses should expose:

```text
retryable: true / false
```

Examples:

```text
Temporary integration failure → true
Posting paused due to replay → true
Permission denied → false
Validation failed → false
```

AI and automation can use this safely.

---

## 38. HTTP Status Mapping

Recommended:

```text
200 OK
201 Created
202 Accepted
204 No Content

400 Validation
401 Authentication
403 Permission
404 Not Found
409 Conflict / Idempotency / Concurrency
422 Business precondition
429 Rate limit
500 Internal
503 Temporarily unavailable
```

Business-specific error code remains authoritative.

---

## 39. Pagination

Use cursor-based pagination for large runtime datasets.

Preferred:

```text
limit
cursor
```

Avoid deep OFFSET pagination for:

```text
BusinessData
LedgerEntry
WorkItem
CostResult
```

Cursor should encode a stable sort key.

---

## 40. Stable Pagination Order

For LedgerEntry:

```text
posting_sequence
rule_sequence
id
```

For BusinessData:

```text
effective_at
id
```

For WorkItem:

```text
priority
due_at
id
```

Sort must be deterministic.

---

## 41. Filtering

Use explicit typed query parameters for common dimensions.

For dynamic fields/dimensions, support a structured filter object rather than arbitrary SQL-like query strings.

Example:

```json
{
  "field": "product_id",
  "op": "eq",
  "value": "P1"
}
```

---

## 42. Bulk Commands

Initial API may support:

```text
POST /api/v1/commands/{code}/bulk
```

but semantics must be explicit:

```text
Atomic batch
or
Independent item execution
```

Recommended default:

> **Bulk commands execute items independently unless the Command explicitly defines atomic-batch semantics.**

This prevents giant transactions.

---

## 43. Import API

Imports should convert external rows into Commands or controlled BusinessData creation capabilities.

Preferred:

```text
Import
↓
Validate
↓
Command executions
↓
BusinessData
```

Not:

```text
CSV
↓
Direct insert into ledger tables
```

---

## 44. Export API

Exports are read operations.

Large exports should be asynchronous:

```text
POST /exports
↓
202
↓
Export job
↓
Download artifact
```

Exact file infrastructure is implementation detail.

---

## 45. Webhook Contract

Outbound webhook envelope:

```json
{
  "event_id": "uuid",
  "event_type": "posting.completed",
  "enterprise_id": "uuid",
  "occurred_at": "...",
  "correlation_id": "...",
  "data": {}
}
```

Consumers must deduplicate by `event_id`.

---

## 46. Event Contract Design

Internal/outbound event contracts should include:

```text
event_id
event_type
event_version
enterprise_id
occurred_at
correlation_id
causation_id
payload
```

This allows later migration to Kafka/NATS/RabbitMQ without redesigning event identity.

---

## 47. Event Versioning

Event types should be versionable.

Example:

```text
business_data.created.v1
posting.completed.v1
cost.calculated.v1
work_item.created.v1
```

or separate:

```text
event_type
event_version
```

Do not silently change event payload semantics.

---

## 48. At-Least-Once Delivery Contract

Future message delivery should assume:

```text
At least once
```

Therefore consumers must support:

```text
deduplication
idempotent processing
```

No business invariant should depend on perfect exactly-once transport.

---

## 49. Distributed Posting Compatibility

If Posting becomes a remote service later, the contract must retain:

```text
enterprise_id
posting_input_id
effective_at
posting_priority
posting_sequence
metadata/rule version identity
```

Message arrival order is not business order.

Posting service must process by canonical sequence.

---

## 50. Consistency Domain — Forward Compatibility

To support very large Enterprises, EVO introduces a reserved future field:

```text
consistency_domain
```

Conceptually:

```text
Enterprise
    ↓
Consistency Domain
    ↓
Deterministic Posting Sequence
```

Initial v0.x:

```text
consistency_domain = enterprise
```

Future examples:

```text
inventory:HK
inventory:SG
finance:legal-entity-A
project:P001
```

Only domains proven independent may execute in parallel.

---

## 51. Consistency Domain Contract

Future PostingInput envelope may include:

```json
{
  "enterprise_id": "...",
  "consistency_domain": "inventory:HK",
  "posting_sequence": 12345
}
```

This field is reserved in contract design even if the initial physical table does not require it.

---

## 52. Partition-Aware Idempotency

Future distributed systems may retry Commands or messages across shards.

Therefore identity should remain globally unique:

```text
UUIDv7
```

and idempotency keys should not depend on one database node.

---

## 53. Enterprise Routing Compatibility

Future service gateway may resolve:

```text
enterprise_id
↓
shard / region / service partition
```

API contracts must not expose physical shard IDs as business semantics.

Clients address the Enterprise, not its current storage location.

---

## 54. Remote Module Compatibility

Internal module APIs should map naturally to remote contracts.

Today:

```text
LedgerQuery.getBalance(query)
```

Future:

```text
GET /ledger/balances
```

Today:

```text
CommandService.execute(command)
```

Future:

```text
POST /commands/{code}/execute
```

Avoid returning process-local entities that cannot serialize cleanly.

---

## 55. AI Capability API

Recommended:

```text
GET /api/v1/ai/capabilities
```

or application scoped:

```text
GET /api/v1/applications/{id}/ai-capabilities
```

Response:

```json
{
  "capabilities": [
    {
      "code": "purchase-planner",
      "description": "...",
      "autonomy_level": 2,
      "allowed_commands": [],
      "required_context": []
    }
  ]
}
```

---

## 56. AI Context API

AI Gateway may use internal endpoints/services like:

```text
resolveApplicationContext
resolveBusinessObjectContext
resolveLedgerContext
resolveWorkContext
```

External raw access should remain permission controlled.

The contract should support context references:

```json
{
  "context_ref": "uuid",
  "effective_definition_hash": "...",
  "as_of_sequence": 123456
}
```

for auditability.

---

## 57. AI Command Invocation

AI submits the exact same Command contract as Human/Automation.

Additional audit metadata may include:

```json
{
  "actor": {
    "type": "AI",
    "id": "..."
  },
  "ai_context_ref": "...",
  "autonomy_level": 2
}
```

Authorization service determines whether execution is allowed.

---

## 58. State Quality

Read responses for derived data may include:

```text
CURRENT
POSTING_PENDING
COST_PENDING
REPLAYING
FAILED
```

Example:

```json
{
  "state_quality": "REPLAYING",
  "as_of_sequence": 123000,
  "replay_run_id": "..."
}
```

This prevents UI/AI from treating stale results as current.

---

## 59. Optimistic Concurrency

Some business commands should support expected-version semantics.

Example:

```json
{
  "expected_business_version": 7
}
```

If current version differs:

```text
409 CONCURRENCY_CONFLICT
```

This is application-level concurrency, separate from posting sequence.

---

## 60. ETag / Metadata Caching

Effective metadata responses may expose:

```text
ETag
effective_definition_hash
```

Clients can use conditional requests.

This reduces repeated large metadata downloads.

---

## 61. Rate Limits

Rate limiting should be actor/client aware.

Possible scopes:

```text
API credential
Human user
AI actor
Enterprise
Command code
```

Critical business Commands should not be protected only by generic global request throttling; permissions and idempotency remain primary.

---

## 62. Audit API

Initial administrative query:

```text
GET /api/v1/audit/command-executions
```

Filters:

```text
actor
command
business_object
date
status
correlation_id
```

AI actions should be visible through the same audit model.

---

## 63. Trace API

Useful internal/admin endpoint:

```text
GET /api/v1/trace/business-data/{id}
```

May return:

```text
CommandExecution
BusinessData
PostingInput
LedgerEntries
CostResults
Processes / Work
```

This becomes a powerful debugging and AI explanation capability.

---

## 64. Contract Security

Never expose internal rule execution payloads or sensitive fields by default.

Field-level metadata can classify:

```text
PUBLIC
INTERNAL
CONFIDENTIAL
RESTRICTED
```

Response shaping must respect actor permission.

---

## 65. PII / Sensitive Fields

Sensitive application fields should be declared in metadata.

APIs must support:

```text
redaction
omission
masked representation
```

AI context construction must apply the same policy.

---

## 66. Internal API Stability

Internal module APIs can evolve faster than public HTTP APIs, but they should still use explicit DTO contracts.

Recommended categories:

```text
Public API DTO
Internal Module DTO
Persistence Model
```

Do not use one ORM class for all three.

---

## 67. Contract Testing

Every important API/event contract should have automated compatibility tests.

Especially:

```text
Command input schemas
Error codes
Webhook envelopes
Posting messages
Replay APIs
AI command schemas
```

Future service extraction depends on these contracts being stable.

---

## 68. OpenAPI

HTTP APIs should generate or maintain:

```text
OpenAPI 3.x
```

This supports:

```text
SDK generation
UI development
External integration
AI tool schema generation
Contract testing
```

---

## 69. AI Tool Schema Generation

CommandDefinition + JSON Schema can be transformed into AI-callable tool contracts.

Conceptually:

```text
CommandDefinition
↓
Tool Schema Adapter
↓
AI Tool
```

The tool is not a separate business API.

It is an adapter over the same Command contract.

---

## 70. SDK Strategy

Do not hand-maintain many language SDKs initially.

Start with:

```text
OpenAPI-generated client
```

for one or two primary languages.

Stable API contracts matter more than SDK sophistication.

---

## 71. Large Data Query Strategy

APIs must assume large result sets.

Rules:

```text
No unbounded list endpoints
Cursor pagination
Explicit date/sequence ranges
Server-side filters
Streaming/export for large extraction
Summary endpoints for dashboards
```

Ledger history APIs especially must never default to returning entire history.

---

## 72. Analytical Query Separation

Operational APIs should not become arbitrary BI query engines.

For heavy analysis:

```text
Operational PostgreSQL
↓
CDC / Outbox / batch projection
↓
Analytical store
```

may be introduced later.

The external business API remains stable.

---

## 73. Large-Scale Evolution Path

The contract architecture explicitly supports:

```text
Phase 1
Modular Monolith + PostgreSQL

Phase 2
Horizontal API/Worker scale

Phase 3
Table partitioning

Phase 4
Enterprise sharding

Phase 5
Message broker

Phase 6
Compute-heavy service extraction

Phase 7
Consistency-domain posting partition

Phase 8
Distributed EVO
```

The business contract remains based on:

```text
enterprise identity
global object identity
idempotency
deterministic sequence
versioned metadata/rules
correlation
```

---

## 74. API Anti-Patterns

EVO should not:

1. Expose direct ledger mutation APIs.
2. Let AI use a privileged bypass API for ordinary business actions.
3. Use PATCH/CRUD as the only business-write abstraction.
4. Return ORM entities directly.
5. Trust client-provided enterprise permission context.
6. Use unversioned event payloads.
7. Assume message arrival order equals posting order.
8. Assume exactly-once transport.
9. Return unbounded ledger/business history.
10. Expose physical shard/service topology as business semantics.

---

## 75. Initial v1 API Surface

Minimal first implementation:

```text
Authentication Context

Metadata:
    GET applications
    GET application
    GET fields
    GET commands

Commands:
    POST execute
    GET execution status

Business Data:
    GET by id
    GET object history

Posting:
    GET input status
    GET posting state

Ledger:
    GET balance
    GET entries

Cost:
    GET cost result
    GET cost explanation

Work:
    GET work items
    GET work item
    POST execute

Replay:
    POST replay
    GET replay status

System:
    GET health
```

This is enough for the first vertical slice.

---

## 76. Contract Decisions Locked by EVO-11

1. External v1 APIs use JSON over HTTP.
2. Reads are resource-oriented; business writes are Command-oriented.
3. Contracts are designed to be transport-neutral.
4. API versioning is distinct from business metadata versioning.
5. Authentication context determines Enterprise and actor identity.
6. Commands support idempotency where duplicate effects are dangerous.
7. Command completion is distinct from posting/cost completion.
8. Command schemas are machine-readable.
9. BusinessData is normally written only through Commands.
10. Ledger and Cost expose lineage-friendly read APIs.
11. Long-running work uses asynchronous operation contracts.
12. Errors have stable machine-readable codes.
13. Large datasets use cursor pagination.
14. Events are globally identified and versioned.
15. Future messaging assumes at-least-once delivery.
16. Message arrival order never replaces deterministic Posting Sequence.
17. Contracts retain Enterprise scope, correlation and version identity.
18. Consistency Domain is reserved as the future intra-enterprise parallelism boundary.
19. AI uses the same Command contract as other actors.
20. OpenAPI is the canonical HTTP contract description.
21. Contracts must remain suitable for future service extraction and enterprise sharding.

---

## 77. Next Stage

The next document is:

**EVO-12 — Repository Structure & Implementation Roadmap v0.1**

It will make the final pre-coding decisions:

```text
Programming language
Backend framework
ORM / SQL approach
Migration tooling
Repository structure
Module package layout
Testing strategy
Local development stack
CI
First milestones
First vertical slice
Implementation sequence
Definition of Done
```

EVO-12 should end architecture planning and begin implementation.

---

**End of EVO-11 v0.1**

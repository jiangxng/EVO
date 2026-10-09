# EVO Public API Contract

Status: Authoritative Contract Overview
Version: 1.0-alpha.2

## Current vs target interpretation

This document contains both:

1. **target EVO Ledger Runtime public contracts**; and
2. **current compatibility/Host-composition APIs** retained while convergence is in progress.

Repository presence or current endpoint availability does not make a capability part of the target EVO Core boundary.

When classification conflicts or looks ambiguous, authority order is:

```text
project.status.json targetCoreBoundary
→ ARCHITECTURE.md Target Product Boundary
→ current architecture decisions
→ this document's explicit target/compatibility labels
→ current implementation endpoints
```

In particular, identity, authorization, rich Application lifecycle, capability discovery and generic Command orchestration remain outside target EVO Ledger Runtime even where compatibility endpoints still expose them today.

## Boundary Philosophy

The target EVO Ledger Runtime write boundary is generic BusinessData submission. It does not expose direct writes to LedgerEntry, LedgerBalance, CostResult, WorkItem or Replay internals.

Human/UI/Agent/domain Commands belong to the Host/Application layer and may remain available through compatibility adapters while convergence is in progress. A compatibility Command adapter may translate governed product actions into the generic BusinessData submission contract; Command orchestration is not target EVO Core ownership.

## Application-Scoped API Principle

EVO Core does not imply that every enterprise has every domain application.

The effective public API of an enterprise is composed from:

1. stable EVO Core APIs;
2. APIs contributed by effectively installed and ACTIVE application instances;
3. actor/permission filtering.

Sales Order, Customer Receipt, Supplier Payment, Purchase Order, Production and similar domain APIs are application capabilities, not unconditional EVO Core guarantees.

If the corresponding application is not effectively installed and active for the enterprise, EVO MUST NOT advertise or accept its domain capabilities as currently available.

Application deactivation or uninstall removes current capability exposure but does not itself clear runtime data. A separate governed Clear Cache may remove BusinessData and derived runtime state.

The detailed normative contract is:

- `docs/public-api/capability-and-application-contract-v0.1.md`

## Contract Requirements

Every public Command request must define:

- enterprise scope
- application/capability target
- command code
- actor identity and permission scope
- idempotency key
- correlation id
- effective business time
- business object key
- schema-versioned input

Public responses expose stable execution identifiers and status. Internal implementation classes, SQL schema and worker details are not public API.

## Automatic Posting Semantics

For an accepted business fact, the public business/Command API owns the posting lifecycle automatically.

Canonical caller contract:

```text
Application
→ submit governed business fact/Command
→ EVO accepts
→ EVO automatically begins/continues posting
```

The caller MUST NOT need to invoke a second "start posting" API for the posting of that accepted fact.

Posting completion semantics are independent from posting ownership:

### Synchronous result

EVO may complete posting before returning:

```text
COMPLETED / POSTED
```

### Asynchronous result

EVO may return after acceptance while posting continues:

```text
ACCEPTED / QUEUED / RUNNING
+ durable posting identity/status
```

In this case, `QUEUED` means EVO has already accepted responsibility for continuing the posting lifecycle. It does **not** mean the caller must trigger posting.

For asynchronous execution, the public contract must provide a governed way to observe the terminal result:

```text
POSTED / COMPLETED
or
FAILED
```

through status query, event, callback/webhook, or an equivalent stable mechanism.

External Applications submit business facts. They do not submit LedgerEntry instructions and do not control worker/queue internals. The PostingRules supplied to Core determine the derived ledger effects; Core does not manage PostingRule versions.

### PostingRule lifecycle is outside Core

EVO Core executes the PostingRules supplied by the rule-owning plugin/package.

Core does not own:

- PostingRule draft/publish workflow;
- PostingRule business versions;
- effective-date/version selection;
- rollback history;
- rule approval history.

A plugin/package may provide all of those capabilities and then supply the selected/current rule set to Core.

Core may record a stable rule code/hash for diagnostics and reproducibility, but this is not a Core-managed version lifecycle.

### Explicit Posting API

EVO retains an explicit Posting / PostingRun API model for platform-level operations such as:

- re-posting;
- Replay;
- bulk/batch posting;
- retry/recovery;
- repair/rebuild;
- governed administrative posting runs.

Such APIs may return asynchronously by design. They are **not** required for the posting of a newly accepted business fact.

Normative decision:

- `docs/architecture/decisions/2026-09-23-automatic-initial-posting-and-async-results-v0.1.md`

## Runtime Cache Control

EVO defines a governed runtime-cache control boundary for rebuilding current runtime state without coupling that operation to Application-specific business semantics.

Target Core endpoint:

```text
POST /api/v1/runtime-cache/clear
```

This endpoint is a privileged platform/runtime-control API, not an ordinary business Command.

A cache-clear request MUST declare enterprise scope and a bounded target scope such as an Application. The operation may complete synchronously or asynchronously and MUST expose a durable result identity when asynchronous.

Clear Cache is intentionally destructive for the selected business-runtime scope. It may delete BusinessData, Posting state, Ledger entries/balances, Cost/Valuation results, WorkItems, General Ledger/accounting projections, and other derived runtime state.

Clear Cache MUST preserve the definitions needed to rebuild the runtime, especially PostingRules, Ledger definitions, cost/valuation rules, chart/accounting policies, installed Application metadata, Packages/Features, permissions and other system configuration.

Core does not silently retain a private historical/audit copy after Clear Cache. Long-term audit/accounting retention is optional policy supplied by plugins/packages or by retaining exported datasets.

Application-driven rebuild pattern:

```text
clear application runtime cache
→ Application resubmits data through ordinary APIs
→ EVO validates normally
→ EVO automatically Posts/derives normally
```

EVO does not care that the Application calls this workflow "recalculation".

Normative decision:

- `docs/architecture/decisions/2026-09-24-recalculation-perspectives-and-runtime-cache-v0.1.md`

## Full Data Export

EVO Core SHALL expose a governed complete-data export boundary.

Target API:

```text
POST /api/v1/data-exports
GET  /api/v1/data-exports/{exportId}
```

A full export is versioned/self-describing and is intended to contain enough current EVO state for backup, migration or optional long-term archive, including BusinessData, runtime/derived state, system/configuration metadata, installed application state, rule/version identities and integrity manifests.

Whether that export is retained for accounting/audit purposes is a user/plugin policy decision, not a mandatory Core responsibility.

## Target Minimal EVO Runtime API

The target EVO Core API is plugin-runtime oriented, not enterprise-platform oriented.

Logical Core operations:

```text
submit BusinessData(applicationId required)
query generic Ledger/Balance/runtime result
observe posting/result status
request recalculation over retained BusinessData
clear EVO runtime data
export EVO runtime data
```

### BusinessData submission transport

The generic target runtime write transport is now:

```text
POST /api/v1/business-data
```

Request v0.1:

```json
{
  "contractVersion": "0.1.0",
  "scopeKey": "<opaque EVO runtime scope id>",
  "applicationId": "<registered ApplicationAnchor>",
  "businessDataType": "<type>",
  "businessObjectKey": "<object key>",
  "effectiveAt": "2026-10-03T02:00:00.000Z",
  "payload": {},
  "correlationId": "<correlation id>",
  "idempotencyKey": "<idempotency key>",
  "causationId": "<optional business-data/source id>",
  "relation": {
    "fromBusinessDataId": "<optional existing BusinessData id>",
    "relationType": "CAUSES | FULFILLS | ALLOCATES_TO | DERIVES_FROM | REFERENCES"
  },
  "expectedBusinessVersion": "<optional non-negative integer string>",
  "postingPriority": 0
}
```

The v0.1 HTTP adapter interprets `scopeKey` only as the exact opaque EVO runtime scope identifier currently persisted as `enterprise.id`. This is a compatibility storage adapter; it does not make rich Enterprise lifecycle an EVO Core responsibility.

`applicationId` MUST already exist in the minimal ApplicationAnchor registry. Unknown application IDs fail explicitly.

Accepted submissions return HTTP `202` with durable BusinessData/PostingInput identity and status. BigInt values are serialized as decimal strings.

The endpoint does not accept actor/permission/capability metadata and does not create `CommandExecution`, `ApplicationInstance` or legacy metadata-version provenance.

The optional `relation` writes one immutable `business_object_link` from an
existing BusinessData fact to the newly submitted fact in the same database
transaction. The source fact MUST belong to the same resolved runtime scope.
Changing the relation changes the idempotency request digest.

This relation is deliberately **not** Command `FlowTrace` metadata. Direct
BusinessData submission does not synthesize a CommandExecution or require a
FlowDefinition UUID merely to express facts such as
`Purchase Order --FULFILLS--> Goods Receipt`.

Compatibility endpoint `POST /api/v1/commands` remains available separately and is not the target Core write model.

### Runtime observation revision boundary

EVO exposes a lightweight Host-facing revision cursor for cache invalidation and realtime bridging:

```text
GET /api/v1/enterprises/:enterpriseCode/runtime-revision
```

The response summarizes only the version-bearing control state needed to determine whether Host-visible runtime observations may have changed. It covers:

- posting/runtime high-water state;
- FlowTrace count and latest trace time;
- FlowInstance count/status distribution and latest start/completion time.

The endpoint does **not** return business payloads, ledger rows or flow trace contents. It supports `ETag / If-None-Match`; unchanged state returns `304 Not Modified` with no response body.

This boundary exists so one Host-side bridge can observe EVO efficiently. Browser/mobile clients should subscribe to the Host event lane rather than polling EVO independently.

### Runtime observation read boundary

EVO exposes a generic Host-facing read boundary for time-scoped operational observation:

```text
POST /api/v1/runtime-observations/query
```

The v0.1 target is deliberately narrow and canonical.

Supported targets:

- `LEDGER_DEFINITION`, identified by stable LedgerDefinition code;
- `APPLICATION_ANCHOR`, identified only by stable `applicationId`.

All queries use an explicit `startAt/endAt` time window and metric allow-list. Historical Ledger balance is reconstructed from immutable LedgerEntry data as of `endAt`.

LedgerDefinition metrics:

- `event.count`;
- `event.frequency` in events/hour;
- `flow.net_quantity`;
- `flow.net_amount`;
- `balance.quantity`;
- `balance.amount`.

ApplicationAnchor metrics:

- `event.count`;
- `event.frequency` in events/hour.

Application observation counts accepted BusinessData for the exact ApplicationAnchor inside the requested window. The storage reader queries BusinessData by the exact public `applicationId`; it does not resolve or require EVO-private `application_instance_id`.

This API does not expose database rows, EOG node IDs, renderer state, SOP interpretation or bottleneck judgments. Those remain Host/Provider concerns.


The exact paths are intentionally not frozen yet.

The following current alpha endpoints are **Host/compatibility composition**, not target EVO Core responsibilities:

```text
GET  /api/v1/enterprises/:enterpriseCode
GET  /api/v1/apps
GET  /api/v1/capabilities
POST /api/v1/commands
```

They remain useful for current Proof C compatibility but should migrate toward Host/App Platform adapters.

EVO Core owns only a minimal ApplicationAnchor/applicationId for PostingRule routing.

EVO Core does not own:

- rich enterprise/application definitions or application lifecycle;
- users/roles/permissions;
- capability discovery;
- Command authorization/orchestration;
- PostingRule lifecycle/version selection.

A Host may translate its own Command/action/capability model into generic EVO BusinessData submissions.

### Application routing contract

Every target BusinessData submission MUST include:

```text
scopeKey
applicationId
businessDataType
businessObjectKey
effectiveAt
payload
correlation/idempotency identity
```

Every executable PostingRule MUST include the same routing key:

```text
ruleId
applicationId
priority
conditionAst
effectAst
ruleSchemaVersion
```

Posting selection is:

```text
applicationId
→ candidate PostingRules for that applicationId
→ deterministic order
→ condition evaluation
→ effects
```

An unknown applicationId fails explicitly. The Host may maintain a much richer Application object, but EVO only requires the stable routing anchor.

## Current v1.0-alpha.2 Public Capability Endpoints

The following Core-facing endpoints are implemented for the current alpha boundary:

```text
GET  /api/v1/enterprises/:enterpriseCode
GET  /api/v1/apps?enterprise_id=<id>
GET  /api/v1/capabilities?enterprise_id=<id>
GET  /api/v1/work-items?enterprise_id=<id>[&actor_type=<type>&actor_id=<id>&limit=<1..100>]
POST /api/v1/commands
```

`GET /api/v1/enterprises/:enterpriseCode` resolves stable enterprise scope without exposing storage details. `GET /api/v1/apps` and `GET /api/v1/capabilities` expose only effective ACTIVE application instances and their current command capabilities.

For this alpha slice, command capabilities are derived from:

```text
ACTIVE ApplicationInstance
+ effective PUBLISHED ApplicationDefinitionVersion
+ CommandDefinition
```

and are explicitly identified as `COMMAND_DEFINITION_BOOTSTRAP`. This is a replaceable bootstrap source, not a permanent storage-model commitment.

`POST /api/v1/commands` accepts a public `capabilityCode`; callers do not provide EVO-private application instance IDs. EVO resolves the effective provider internally, validates the command input through the existing governed Command boundary, and applies the authorization policy declared by command metadata. Missing authorization metadata fails closed.

The endpoint creates authoritative Command/BusinessData/PostingInput state. When it returns `postingStatus: QUEUED`, EVO has already taken ownership of the posting lifecycle; the caller does not invoke a separate posting-start API. The EVO posting runtime/worker continues processing asynchronously and must eventually expose a governed terminal result.

## Current v1.0-alpha.2 Reference Endpoints

The `/api/v1/demo/*` endpoints are validation/reference endpoints and are not yet general production API commitments.

Reference business chain:

1. `POST /api/v1/demo/sales-orders/approve`
2. `POST /api/v1/demo/production/complete`
3. `POST /api/v1/demo/shipments/create`
4. `POST /api/v1/demo/cost/recalculate`
5. `POST /api/v1/demo/replay`
6. `GET /api/v1/demo/dashboard`

These demo routes MUST NOT be interpreted as proof that EVO Core permanently owns those domain capabilities.

Legacy generic inventory receipt/shipment endpoints from v0.9 are implementation-validation endpoints and must not be used as the semantic model for v1.0.

## Error Contract

Errors use the stable envelope:

```json
{
  "error": {
    "code": "STABLE_MACHINE_CODE",
    "message": "human readable message",
    "retryable": false,
    "details": {},
    "correlation_id": "..."
  }
}
```

## Idempotency

A repeated Command with the same idempotency scope/key returns the prior completed result. It must not create a second BusinessData record.

## Versioning

Additive changes are preferred. Breaking behavior or schema changes require an explicit version transition and compatibility policy. Historical Replay must not depend on whatever definition happens to be latest at replay time.

## v1.0.0-alpha.2 additions

### Dimension contracts
- `DimensionDefinition`: governed analytical key.
- `LedgerDefinition.dimension_schema`: `{ required?: string[], optional?: string[], forbidden?: string[] }`.
- Posting effects continue to use `dimensions`, but are now validated against published DimensionDefinitions and the target Ledger policy.

### Valuation Posting
`ValuationPostingService.postCostResult(costResultId)` converts a pinned CostResult into Inventory Value / COGS LedgerEntries. Reposting an identical target is `NO_CHANGE`; a changed target posts only the delta.

### Cost recalculation
`CostEngine.recalculate(enterpriseId, method, pins?)` supports explicit replay pins for ValuationPolicy and ValuationRule versions.

### Replay
`prepareFullReplay()` returns the preserved cost method and cost pins needed to reconstruct the pre-replay valuation semantics.


## Public WorkItem Read Boundary

`GET /api/v1/work-items` exposes the current open operational WorkItem projection through a governed public read contract.

Rules:

- `enterprise_id` is required.
- `actor_type` and `actor_id` are optional but must be supplied together.
- `limit` defaults to 50 and is bounded to 1..100.
- only CURRENT open/in-progress WorkItems are returned through the workflow module's `WorkProjection.listOpen()` boundary.
- assignment filtering is exact; the API does not infer roles or ownership.
- the response uses `Cache-Control: private, max-age=0, must-revalidate` and an ETag validator.
- this endpoint is the product-facing read boundary. `/api/v1/demo/dashboard` remains reference/demo-only and MUST NOT be used by Host/App Platform production features.

Response contract v0.1.0:

```json
{
  "contractVersion": "0.1.0",
  "enterpriseId": "enterprise-id",
  "items": [
    {
      "id": "work-item-id",
      "workType": "PRODUCE",
      "title": "待生产",
      "status": "OPEN",
      "priority": 30,
      "sourceLedgerCode": "pending_production",
      "dimensions": {},
      "quantity": "10",
      "amount": "0",
      "assignedActorType": null,
      "assignedActorId": null,
      "createdAt": "2026-09-29T00:00:00.000Z",
      "updatedAt": "2026-09-29T00:00:00.000Z"
    }
  ]
}
```

The public read contract does not imply a generic "complete WorkItem" command. A WorkItem is a derived operational projection; completion remains the result of the authoritative business Command/Ledger transition that closes its source condition.

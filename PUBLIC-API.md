# EVO Public API Contract

Status: Authoritative Contract Overview
Version: 1.0-alpha.2

## Boundary Philosophy

Public write APIs represent business Commands. They do not expose direct writes to BusinessData, LedgerEntry, LedgerBalance, CostResult, WorkItem or Replay internals.

A client may be a human UI, mobile tool, scanner, AI agent, automation, portal or external integration. Actor type does not bypass the Command boundary.

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

External Applications submit business facts. They do not submit LedgerEntry instructions and do not control worker/queue internals. Effective PostingRules determine the derived ledger effects.

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

## Current v1.0-alpha.2 Public Capability Endpoints

The following Core-facing endpoints are implemented for the current alpha boundary:

```text
GET  /api/v1/enterprises/:enterpriseCode
GET  /api/v1/apps?enterprise_id=<id>
GET  /api/v1/capabilities?enterprise_id=<id>
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

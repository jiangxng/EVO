# EVO Public API Capability & Application Contract

**Status:** DESIGN CONTRACT / v0.1  
**Applies to:** EVO Core, Application runtime, Capability runtime, Command boundary, Query boundary  
**Related authoritative documents:** `PUBLIC-API.md`, `INVARIANTS.md`, `architecture.manifest.json`, `docs/interfaces/metadata-kernel.md`

## 1. Purpose

This document defines how EVO exposes APIs when enterprise applications are installable and removable.

EVO Core is an enterprise runtime foundation. It MUST NOT imply that every EVO enterprise has Sales Order, Receipt, Payment, Purchase Order, Production Order or any other domain application installed.

The public API visible to a caller is therefore the composition of:

1. stable EVO Core APIs;
2. APIs contributed by application definitions that are effectively installed and active for the target Enterprise;
3. actor/permission filtered access to those APIs.

In short:

```text
Effective Enterprise API
= EVO Core API
+ Effective Installed Application APIs
- APIs unavailable to the current actor
```

## 2. Architectural Rule

A domain API exists for an Enterprise only when all required runtime conditions are satisfied.

At minimum:

- the ApplicationDefinition exists;
- the Enterprise has an ApplicationInstance for it;
- the ApplicationInstance is ACTIVE;
- the selected ApplicationDefinitionVersion is PUBLISHED and effective;
- its declared capability/API contract is valid;
- dependency requirements are satisfied;
- the current actor is authorized when actor-filtered discovery is requested.

Application installation/uninstallation is therefore a capability lifecycle event, not merely a UI/menu change.

## 3. API Layers

### 3.1 Core API

Core APIs are platform-level contracts and are not dependent on a Sales, Purchase, Receipt or Payment application.

Examples of Core API concerns:

- enterprise identity/scope;
- authentication and actor context;
- installed application discovery;
- effective capability discovery;
- metadata/schema discovery;
- generic governed Command invocation;
- generic governed Query invocation;
- API/OpenAPI contract discovery;
- API version/lifecycle metadata.

Core APIs MUST remain domain-neutral.

### 3.2 Installed Application API

An installed Application MAY contribute public business APIs.

Examples:

- Sales Order application MAY contribute:
  - create sales order;
  - submit sales order;
  - approve sales order;
  - query sales orders.

- Customer Receipt application MAY contribute:
  - record customer receipt;
  - query receipt;
  - inspect settlement state.

- Supplier Payment application MAY contribute:
  - record supplier payment;
  - query supplier payment.

These names are examples only. They are NOT Core guarantees.

### 3.3 Enterprise Effective API

The Enterprise Effective API is the authoritative current public surface for one enterprise scope.

Two enterprises running the same EVO Core MAY expose different domain APIs because their installed applications, versions, overlays, permissions or lifecycle states differ.

## 4. Capability Manifest

Each public-capable application version SHOULD declare a machine-readable capability manifest.

Illustrative shape:

```json
{
  "application_code": "sales-order",
  "application_version": "1.4.0",
  "capabilities": [
    {
      "code": "sales-order.create",
      "kind": "COMMAND",
      "contract_version": "1",
      "command_code": "sales_order.create"
    },
    {
      "code": "sales-order.approve",
      "kind": "COMMAND",
      "contract_version": "1",
      "command_code": "sales_order.approve"
    },
    {
      "code": "sales-order.read",
      "kind": "QUERY",
      "contract_version": "1",
      "query_code": "sales_order.read"
    }
  ]
}
```

The concrete storage schema may evolve, but the semantics above are normative.

## 5. Capability Discovery

EVO SHOULD provide a stable discovery flow before domain invocation.

Recommended logical Core endpoints:

```text
GET /api/v1/apps
GET /api/v1/capabilities
GET /api/v1/openapi
```

These paths are target public contracts, not a claim that the current alpha runtime already implements all of them.

### 5.1 GET /api/v1/apps

Returns effective application installation state for the enterprise.

Example:

```json
{
  "enterprise_id": "ent_001",
  "applications": [
    {
      "application_code": "sales-order",
      "instance_id": "appinst_001",
      "status": "ACTIVE",
      "effective_version": "1.4.0"
    },
    {
      "application_code": "customer-receipt",
      "instance_id": "appinst_002",
      "status": "ACTIVE",
      "effective_version": "1.2.0"
    }
  ]
}
```

### 5.2 GET /api/v1/capabilities

Returns machine-readable effective capabilities.

Example:

```json
{
  "enterprise_id": "ent_001",
  "capability_set_version": "capset_019af...",
  "capabilities": [
    {
      "code": "sales-order.create",
      "kind": "COMMAND",
      "application_code": "sales-order",
      "application_version": "1.4.0",
      "contract_version": "1"
    },
    {
      "code": "customer-receipt.create",
      "kind": "COMMAND",
      "application_code": "customer-receipt",
      "application_version": "1.2.0",
      "contract_version": "1"
    }
  ]
}
```

A capability that is not effective MUST NOT be returned as currently callable.

Discovery MAY support two views:

- enterprise view: all effective enterprise capabilities;
- actor view: only capabilities executable/readable by the current actor.

The response MUST make the chosen view unambiguous.

### 5.3 GET /api/v1/openapi

Returns an OpenAPI description generated from the effective enterprise API surface.

It MUST NOT describe inactive or uninstalled application APIs as currently callable.

It SHOULD identify the application/version that contributed each domain operation.

## 6. Command Boundary

All public business writes remain governed Commands.

Installing an application MAY make a Command capability available; it does not bypass the existing Command architecture.

A public write MUST continue to satisfy the EVO Command contract, including:

- enterprise scope;
- application/capability target;
- command code;
- actor identity and permission scope;
- idempotency key;
- correlation id;
- effective business time;
- business object key where applicable;
- schema-versioned input.

A domain-specific REST route, if provided, is an adapter over the governed Command contract, not an independent write path.

Example:

```text
POST /api/v1/sales-orders
        ↓
resolve effective sales-order.create capability
        ↓
CommandExecutor
        ↓
BusinessData / PostingInput / governed runtime
```

## 7. Query Boundary

Application APIs MAY expose domain-specific reads.

Public reads MUST NOT expose persistence tables as contracts.

Domain-specific read APIs SHOULD resolve through stable query contracts and may compose BusinessData, Ledger, Cost, Valuation or projection state through the Query boundary.

Application uninstall/deactivation MUST remove the domain read capability from the effective API surface even when historical data remains retained.

Historical data retention is distinct from current application capability exposure.

## 8. Installation Lifecycle

### 8.1 Install

When an ApplicationInstance becomes effectively ACTIVE:

1. resolve effective definition/version;
2. validate dependencies;
3. validate public capability declarations;
4. register/derive effective capabilities;
5. make permitted capabilities discoverable;
6. include applicable operations in the effective OpenAPI surface.

### 8.2 Upgrade

Application upgrade MUST use explicit version semantics.

Breaking API changes require:

- new contract/API version;
- compatibility statement;
- migration path;
- tests.

Historical reconstruction MUST continue to use pinned historical semantics where required.

### 8.3 Deactivate / Uninstall

When an application is no longer effective:

- its domain capabilities MUST NOT appear as currently available;
- new Commands targeting those capabilities MUST fail with a stable machine-readable error;
- its domain routes, if materialized as routes, MUST no longer be advertised as callable;
- historical BusinessData and derived accounting history MUST NOT be silently deleted;
- Replay/history semantics MUST remain reconstructable under their pinned definitions.

Uninstall means “remove current capability,” not “erase history.”

## 9. Error Semantics

The standard EVO error envelope remains authoritative.

Recommended capability lifecycle error codes include:

```text
CAPABILITY_NOT_AVAILABLE
APPLICATION_NOT_INSTALLED
APPLICATION_INSTANCE_NOT_ACTIVE
APPLICATION_VERSION_NOT_EFFECTIVE
CAPABILITY_CONTRACT_VERSION_UNSUPPORTED
CAPABILITY_DEPENDENCY_UNSATISFIED
ACTOR_NOT_AUTHORIZED
```

Example:

```json
{
  "error": {
    "code": "CAPABILITY_NOT_AVAILABLE",
    "message": "Capability sales-order.approve is not available for this enterprise.",
    "retryable": false,
    "details": {
      "capability": "sales-order.approve"
    },
    "correlation_id": "corr_..."
  }
}
```

Clients MUST NOT interpret an absent application capability as a generic EVO server failure.

## 10. LLM / Agent Consumption Contract

LLMs and agents SHOULD use a discover-first interaction pattern:

```text
1. identify enterprise scope
2. discover applications/capabilities
3. retrieve current schema/OpenAPI contract
4. select an available capability
5. validate input against the declared contract
6. invoke Command or Query
7. consume structured result/error
```

LLMs MUST NOT assume that a capability exists because another EVO enterprise, demo environment, old conversation, documentation example or prior session exposed it.

Repository documentation describes what EVO can host. Runtime discovery describes what this enterprise can currently do.

## 11. Documentation Rules

EVO documentation MUST distinguish these statements:

Incorrect:

> EVO provides Sales Order APIs.

Correct:

> EVO can host applications that contribute Sales Order APIs. An enterprise exposes those APIs only when the corresponding application/version is effectively installed and active.

For each application API document, include at least:

- application code;
- capability code;
- capability kind;
- owning application version;
- API/contract version;
- Command or Query mapping;
- request schema;
- response schema;
- permissions;
- idempotency rule for writes;
- lifecycle/deprecation state;
- errors;
- examples;
- dependencies.

## 12. Public API Catalog Structure

Recommended repository structure:

```text
docs/
  public-api/
    README.md
    capability-and-application-contract-v0.1.md
    core-api.md
    capability-discovery.md
    versioning-and-lifecycle.md

applications or application definitions
  <application>/
    manifest
    api-contract
```

The physical implementation directory is not mandated by this document; the ownership and semantics are.

## 13. Core vs Application Capability Examples

| API / capability | Core guarantee | Requires installed application |
|---|---|---|
| discover installed apps | Yes | No |
| discover effective capabilities | Yes | No |
| retrieve effective API schema | Yes | No |
| generic governed Command execution | Yes | No |
| create sales order | No | Yes |
| approve sales order | No | Yes |
| record customer receipt | No | Yes |
| record supplier payment | No | Yes |
| create purchase order | No | Yes |
| complete production | No | Yes |

The table describes architectural ownership, not current implementation completeness.

## 14. Compatibility with Current Alpha Reference Endpoints

Current `/api/v1/demo/*` endpoints remain validation/reference endpoints.

They MUST NOT be interpreted as evidence that EVO Core permanently owns the corresponding business capabilities.

When production application APIs are introduced, demo routes SHOULD either:

- delegate to installed application capabilities; or
- remain explicitly isolated validation tools.

They MUST NOT become a second authoritative domain write model.

## 15. Required Tests

At minimum, future implementation of this contract should prove:

1. enterprise with Sales Order installed exposes Sales Order capabilities;
2. enterprise without Sales Order installed does not expose them;
3. deactivating Sales Order removes those capabilities without deleting historical BusinessData;
4. command invocation for an unavailable capability returns stable error;
5. two enterprises with different installed application sets expose different effective API descriptions;
6. OpenAPI/discovery output is deterministic for the same effective configuration;
7. actor-filtered capability discovery does not grant authority by discovery alone;
8. application upgrade obeys API version compatibility rules;
9. Replay remains valid after current application lifecycle changes.

## 16. Non-Goals

This contract does NOT require:

- one REST route per capability;
- REST as the only transport;
- every application to expose a public API;
- deleting history on uninstall;
- duplicating Command logic in application adapters;
- exposing database tables;
- dynamically generating arbitrary business semantics at runtime.

It defines capability ownership, exposure and lifecycle boundaries.

## 17. Summary Rule

**EVO Core provides the mechanism to discover and execute governed capabilities. Domain applications provide domain capabilities. The API actually exposed by an enterprise MUST reflect its effective installed application set and MUST never imply capabilities that the enterprise does not currently possess.**

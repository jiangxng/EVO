# ADR — EVO Minimal Runtime Plugin Boundary v0.1

**Status: ACCEPTED**  
**Date: 2026-09-24**

---

## 1. Decision

EVO is not the enterprise platform.

EVO is a lightweight installable runtime plugin that provides a deterministic business-data → posting → ledger runtime.

The host/platform owns application and governance concerns around EVO.

Canonical topology:

```text
Enterprise Host / App Platform
├─ identity / permissions
├─ Package / Feature / Application lifecycle
├─ capability discovery
├─ PostingRule plugins and rule governance
├─ audit / archive plugins
├─ UI / Agent / integration adapters
└─ EVO Runtime Plugin
   ├─ accept BusinessData
   ├─ execute supplied PostingRules
   ├─ persist runtime BusinessData
   ├─ derive LedgerEntry
   ├─ project LedgerBalance
   ├─ recalculate current runtime data
   ├─ clear runtime data
   └─ export current EVO dataset
```

EVO must be usable as one small plugin among other plugins.

---

## 2. Minimal EVO runtime responsibilities

The target minimal EVO runtime owns only generic deterministic runtime responsibilities.

### 2.1 BusinessData ingestion

EVO accepts generic business data through a stable runtime contract.

Illustrative logical input:

```text
scopeKey
businessDataType
businessObjectKey
effectiveAt
payload
correlation/idempotency identity
```

`scopeKey` is an opaque host-provided isolation key. EVO Core does not own Enterprise/Application definitions in order to interpret it.

### 2.2 Posting execution

EVO evaluates the PostingRules supplied to it.

Core owns:

- deterministic rule evaluation;
- deterministic posting order;
- posting status;
- failure semantics;
- derived Ledger effects.

Core does not own:

- rule editing;
- rule version history;
- rule approval;
- effective-date governance;
- rollback policy.

### 2.3 Generic Ledger and Balance

EVO owns the generic runtime LedgerEntry and LedgerBalance mechanism used by supplied rules.

Ledger definitions/configuration may be supplied by plugins/host configuration. Their business meaning is not hard-coded into Core.

### 2.4 Recalculation

EVO may recalculate current retained BusinessData using the currently supplied runtime rules/configuration.

### 2.5 Clear Cache

EVO may clear the selected business runtime dataset:

```text
BusinessData
+ posting runtime state
+ LedgerEntry / LedgerBalance
+ derived runtime calculation state
```

Rule/plugin/application/permission definitions are outside EVO runtime data and are therefore not Clear Cache targets.

### 2.6 Full Data Export

EVO provides complete export of its current runtime dataset.

Long-term archive/retention is not a Core responsibility.

---

## 3. Explicit non-responsibilities

The following are **not EVO Core**:

- user identity;
- role/permission configuration;
- authorization policy management;
- Enterprise definition/configuration;
- ApplicationDefinition / ApplicationInstance;
- Package / Feature lifecycle;
- capability catalog/discovery;
- UI/navigation;
- Agent orchestration;
- PostingRule lifecycle/version management;
- statutory audit archive/retention;
- compliance/fraud judgement;
- business-domain application semantics;
- General Ledger/statutory accounting policy;
- financial statements;
- workflow/SOP/management process definitions.

These may be implemented by other plugins/packages and may use EVO as a runtime dependency.

---

## 4. Command is not the Core fact boundary

The current repository uses:

```text
Command
→ BusinessData
→ Posting
```

as its historical public/write architecture.

The target minimal boundary is:

```text
Host / Application Adapter
→ BusinessData submission contract
→ EVO Runtime
→ automatic Posting
```

A Command layer may still exist in the host/platform or an application plugin for:

- authorization;
- workflow;
- approval;
- user intent;
- idempotency policy;
- capability routing.

But EVO Core does not require the enterprise platform to model a Command object merely to submit BusinessData.

Therefore the current `command` module is an implementation asset/compatibility adapter, not part of the target minimal Core boundary.

---

## 5. Permission boundary

EVO Core assumes that the caller reaching its trusted runtime contract has already passed whatever authorization the host requires.

Core may still enforce technical safety such as:

- valid scope;
- valid payload/schema shape required by the supplied rule runtime;
- deterministic ordering;
- duplicate/idempotency constraints where part of data integrity;
- resource/runtime limits.

It does not own users, roles, permissions or business authorization policy.

---

## 6. Application boundary

EVO Core does not know whether BusinessData came from:

- Trading Lite;
- Sales App;
- Purchase App;
- Manufacturing App;
- Finance App;
- an Agent;
- an external integration;
- another plugin.

It only processes the submitted generic BusinessData under supplied runtime rules.

Application identity may appear as an opaque source/provenance attribute, but Core does not own the application's lifecycle or definition.

---

## 7. Rule boundary

The rule-owning plugin/package supplies the rule set to EVO.

```text
Rule Plugin
→ selected/current rule set
→ EVO Runtime
→ deterministic execution
```

EVO may retain a stable rule identifier/hash as execution lineage.

It does not infer or manage rule versions.

Clear Cache never clears the rule source because the rule source is outside the runtime dataset.

---

## 8. EVO as a plugin

In the surrounding App Platform, EVO should be modeled like a lightweight runtime plugin/package.

Illustrative package shape:

```text
Package: evo.runtime
Feature: evo.runtime
Provides:
- evo.business-data.submit
- evo.posting
- evo.ledger
- evo.balance
- evo.runtime.recalculate
- evo.runtime.clear
- evo.runtime.export
```

This is a capability surface, not a statement that each capability is a separately installable Feature.

Applications may depend on the capabilities they need without knowing EVO internals.

---

## 9. Derived engines are plugins by default

To keep EVO minimal, higher-order/domain-specific engines should default to separate plugins unless they are proven to be unavoidable runtime primitives.

Examples that should be treated as plugins/packages rather than mandatory EVO Core by default:

- cost calculation methods;
- valuation policies;
- General Ledger accounting;
- accounting recognition;
- financial statements;
- workflow/work-item projections;
- SOP/metrics;
- audit/archive;
- regulatory/jurisdiction packs.

These plugins may consume BusinessData/Ledger state and may contribute PostingRules or other runtime definitions.

Existing implementations remain valuable assets; this decision changes their target ownership, not their usefulness.

---

## 10. Current implementation drift

The current EVO repository contains modules that exceed this minimal boundary:

```text
identity
metadata
application
capability
command
workflow
accounting
financial statement projection
cost / valuation
...
```

They are not to be deleted blindly.

They are classified as:

- reusable implementation assets;
- candidate plugins;
- host/platform responsibilities;
- compatibility adapters;
- migration evidence.

Future work should extract boundaries incrementally rather than perform a repository rewrite.

---

## 11. Public API direction

The current endpoints:

```text
GET  /api/v1/enterprises/:enterpriseCode
GET  /api/v1/apps
GET  /api/v1/capabilities
POST /api/v1/commands
```

are host/platform or compatibility-layer APIs in the target architecture.

The minimal EVO runtime API should converge toward generic runtime operations such as:

```text
submit BusinessData
query generic runtime results
request recalculation
clear runtime data
export runtime data
observe asynchronous posting/result status
```

Exact endpoint paths are not frozen by this ADR.

---

## 12. Core test

A capability belongs in EVO Core only if the following question is answered **yes**:

> Can EVO still perform its generic BusinessData → PostingRule → Ledger → Balance function correctly without moving this capability outside?

If yes, keep evaluating whether it is truly necessary.

If no, the capability is not Core.

Default decision under uncertainty:

> move it outside Core.

---

## 13. Consequence

The target mental model is:

```text
EVO = small deterministic enterprise-data calculation plugin
```

not:

```text
EVO = enterprise platform / application platform / identity platform / governance platform
```

The surrounding platform composes EVO with other plugins to form a full enterprise system.

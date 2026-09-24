# Enterprise Platform Boundary for EVO Ledger Runtime v0.1

**Status:** Architecture boundary  
**Date:** 2026-09-24  
**Authority:** EVO Runtime scope rule

## 1. Purpose

EVO ultimately serves enterprise software, but EVO Ledger Runtime is not the whole enterprise platform.

Its responsibility remains the deterministic business-fact / posting / ledger path.

Enterprise platform services such as identity, authentication, authorization, enterprise organization, localization and LLM access belong outside Ledger Runtime behind stable public contracts and provider plugins.

## 2. Runtime boundary

EVO Ledger Runtime owns:

```text
ApplicationAnchor
BusinessData
current executable PostingRules
Posting
LedgerEntry
LedgerBalance
recalculation / replay / export / query
```

EVO Ledger Runtime does not own:

```text
user directory
authentication/login
session management
authorization policy
roles/permissions
enterprise directory
organization hierarchy
membership
LLM provider/model integration
localization/language resources
plugin/package lifecycle
Eidos/App Host UI
```

## 3. Enterprise context crossing the boundary

When enterprise platform context is required for routing, audit or policy evidence, EVO receives stable normalized values through public contracts.

Examples:

```text
actor / principal id
actor type
enterprise id
company id
workspace id
correlation id
application id
effective timestamp
```

EVO MUST NOT depend on:

- Google/Microsoft/WeCom/DingTalk/Feishu-specific login payloads;
- provider-specific user/session database tables;
- App Platform private implementation;
- enterprise organization table layout;
- concrete LLM SDKs;
- localization resource implementation.

## 4. Authentication vs authorization

Authentication and authorization remain outside Ledger Runtime.

EVO may persist actor/scope references required for traceability, but it does not decide:

- whether credentials are valid;
- which login provider is authoritative;
- whether the actor may perform an operation;
- which enterprise membership/role grants permission.

Those decisions must be completed by platform/provider contracts before the request reaches the runtime boundary.

## 5. Provider plugin compatibility

The surrounding App Platform is expected to support replaceable Provider plugins for:

```text
identity.*
authorization.*
enterprise.*
localization.*
llm.*
audit.*
secrets.*
```

EVO consumes only the stable normalized context that survives provider replacement.

## 6. Enterprise-first without runtime monolith

Enterprise-first means EVO-family architecture is designed around enterprise needs.

It does NOT mean every enterprise concern belongs in the Ledger Runtime.

The intended composition is:

```text
Enterprise Users / Agents
        ↓
Eidos App Host
        ↓
EVO App Platform
  Package / Feature / Provider lifecycle
        ↓
Identity / Authorization / Enterprise / LLM / Localization plugins
        ↓
Business Apps
        ↓
EVO Ledger Runtime
  deterministic facts / posting / ledger
```

This separation allows the platform to grow into a large enterprise system while keeping Ledger Runtime deterministic, replaceable and testable.

## 7. Admission test

Before adding a new capability to EVO Ledger Runtime, ask:

1. Is it required for generic BusinessData → PostingRule → Ledger → Balance execution?
2. Must replay/determinism own it?
3. Would provider replacement change Ledger Runtime semantics?
4. Can App Platform or another plugin provide it through a stable contract?

If the capability is primarily identity, policy, organization, UI, integration, LLM or localization, it remains outside Ledger Runtime.

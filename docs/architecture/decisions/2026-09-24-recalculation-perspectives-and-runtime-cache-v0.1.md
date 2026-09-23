# ADR — Recalculation Perspectives and EVO Runtime Cache v0.1

**Status: ACCEPTED**  
**Date: 2026-09-24**

---

## 1. Problem

The word "recalculation" is used from two different perspectives:

1. EVO recalculates derived runtime state from data already held by EVO;
2. a business Application decides to recalculate its own domain state and resubmits data to EVO.

These are not the same operation and EVO must not couple them.

The architecture also needs an explicit way to discard EVO's current business runtime dataset while keeping rules/configuration intact. Long-term audit retention is a separate optional policy.

---

## 2. Decision — two perspectives

### 2.1 EVO perspective

EVO recalculation means:

```text
current EVO cached/runtime input state
→ governed recalculation/reposting/replay
→ rebuilt derived state
```

EVO may reuse accepted BusinessData/runtime input already present in the current governed dataset and rebuild Posting, Ledger, Cost, Work, accounting projections, or other derived state according to the selected rules/version scope.

No business Application resubmission is required for this EVO-internal recalculation path.

### 2.2 Business Application perspective

A business Application may call an operation in its own UI "recalculate".

From EVO's perspective this has no special meaning.

The Application simply submits data again through the ordinary governed public API:

```text
Application-specific "recalculate"
→ ordinary EVO API submissions
→ normal validation / idempotency / Command semantics
→ automatic EVO posting lifecycle
```

EVO MUST NOT require or interpret a special `recalculate=true` business flag merely because the caller describes its own operation as recalculation.

If the caller reuses the same idempotency identity, normal EVO idempotency semantics apply. If the caller intentionally submits a new business fact/version, it must use the normal identity/version semantics for that new submission.

---

## 3. EVO Runtime Cache

For this decision, **EVO Runtime Cache** means the current rebuildable runtime working set used to calculate and expose enterprise state.

It is the clearable business runtime dataset, including BusinessData and derived runtime state.

The cache boundary may include current imported/accepted runtime working data and derived materializations whose active view can be reconstructed, replaced, or repopulated under governed rules.

The following distinction is mandatory:

```text
runtime business data/results
≠
system definitions/rules
```

Clear Cache MAY destructively remove the former and MUST preserve the latter. PostingRules are never a cache-clear target.

Long-term audit/history retention is not mandatory Core behavior. If required, it is provided by export retention or an installed audit/archive package.

---

## 4. Clear Cache API

EVO SHALL expose a governed **Clear Cache API**.

Logical contract:

```text
POST /api/v1/runtime-cache/clear
```

The API is a platform/runtime-control API, not a normal business Command.

It MUST support an explicit scope. Initial target scopes SHOULD include:

- enterprise;
- application;
- optionally a narrower governed dataset scope in later versions.

Illustrative request:

```json
{
  "enterpriseId": "ent_001",
  "scope": {
    "type": "APPLICATION",
    "applicationCode": "trading-lite"
  },
  "idempotencyKey": "clear-trading-lite-2026-09-24",
  "reason": "application-requested-full-rebuild"
}
```

Illustrative result:

```json
{
  "cacheResetId": "cr_...",
  "status": "COMPLETED",
  "previousGenerationId": "gen_...",
  "currentGenerationId": "gen_..."
}
```

The operation MAY be asynchronous for large scopes:

```text
ACCEPTED / RUNNING
→ COMPLETED or FAILED
```

with a durable status identity.

---

## 5. Application rebuild pattern

If an Application wants to rebuild EVO's current view from its own source data, the intended pattern is:

```text
Application
→ request governed cache clear for its scope
→ resubmit its data through normal EVO APIs
→ EVO treats each submission normally
→ EVO automatically posts/derives state
```

EVO does not care that the Application calls this workflow "recalculation", "refresh", "rebuild", "resync", or "reimport".

EVO only cares about:

- cache-clear authorization and scope;
- ordinary public API validity;
- idempotency/identity;
- deterministic posting and derivation.

---

## 6. EVO internal recalculation pattern

When EVO itself recalculates from its retained current runtime data, the Application is not involved:

```text
EVO current runtime data
→ Reposting / Replay / Cost recalculation / projection rebuild
→ new derived generation
→ verification
→ governed activation
```

This path may reuse existing Posting/Replay/Materialization machinery.

---

## 7. Relationship to automatic posting

This ADR supersedes the wording "first posting" as a canonical concept and is further refined by `2026-09-24-core-runtime-data-retention-export-boundary-v0.1.md`.

The canonical rule is now:

> Any BusinessData accepted by EVO automatically enters its applicable Posting lifecycle. Posting may complete synchronously or asynchronously.

There is no architectural concept called "first posting" that a caller must reason about.

Explicit Posting/Reposting/Replay APIs remain valid platform controls for rebuilding existing EVO state.

---

## 8. Safety

Cache clear is privileged and potentially high-impact.

It MUST:

- be explicitly authorized;
- be scope-bounded;
- be idempotent or safely retryable;
- produce a minimal operational reset record;
- prevent mixed old/new active generations;
- preserve PostingRules and other system/configuration definitions;
- define interaction with concurrent submissions;
- fail closed when a safe cutover cannot be guaranteed.

---

## 9. Consequences

This model creates a clean separation:

```text
Business Application owns:
its own meaning of "recalculate"
its own source data
when/what it resubmits

EVO owns:
runtime cache lifecycle
automatic Posting
internal recalculation/replay
derived state
deterministic activation
```

The same business Application can therefore be simple or sophisticated without changing EVO's core semantics.

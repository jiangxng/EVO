# ADR — Automatic Initial Posting and Asynchronous Posting Result Semantics v0.1

**Status: ACCEPTED**  
**Date: 2026-09-23**

---

## 1. Problem

External Applications submit business facts to EVO through governed public business/Command APIs.

The architecture must distinguish two different concerns:

1. who is responsible for starting the first posting of an accepted business fact;
2. whether the caller receives the final posting result synchronously or asynchronously.

Conflating these concerns would create an incorrect client contract in which an Application submits BusinessData and must then separately tell EVO to begin posting.

That model is rejected.

---

## 2. Decision

Once EVO accepts a business fact through a governed public business/Command API, EVO owns the initial posting lifecycle automatically.

Canonical model:

```text
External Application
→ governed EVO business/Command API
→ validation + authorization
→ authoritative BusinessData
→ automatic posting lifecycle
→ LedgerEntry
→ LedgerBalance
```

The caller does not issue a second "start posting" command for the first posting of that accepted fact.

Automatic ownership does **not** require the HTTP request to block until posting completes.

EVO may return either:

```text
COMPLETED / POSTED
```

when posting completes within the request boundary, or:

```text
ACCEPTED / QUEUED / RUNNING
+ durable posting identity/status
```

when posting continues asynchronously.

In the asynchronous case, `QUEUED` means:

> EVO has already accepted responsibility for continuing the posting lifecycle.

It never means:

> the caller must invoke another API to start posting.

---

## 3. Caller contract

An ordinary business Application submits the business fact and receives one of two classes of result:

### Synchronous completion

```text
business fact accepted
→ posting completed
→ stable success response
```

### Asynchronous completion

```text
business fact accepted
→ posting automatically scheduled/started
→ stable accepted/running response
→ caller can observe terminal POSTED or FAILED result
```

For asynchronous execution EVO must expose a durable correlation/status identity and a deterministic way to obtain the terminal result through query, event, callback/webhook, or an equivalent governed mechanism.

The Application must not need EVO-private worker, queue, PostingInput, LedgerEntry, or database knowledge.

---

## 4. Posting API remains valid

EVO retains an explicit Posting API / PostingRun model.

Its primary purpose is platform-level control such as:

- re-posting under a governed rule/version selection;
- historical replay support;
- bulk/batch posting;
- failure recovery and retry;
- operational repair;
- controlled rebuilds;
- administrative posting runs.

Such Posting APIs may be asynchronous by default and return a durable PostingRun identity immediately.

They are not the normal trigger for the **first posting** of a newly accepted business fact.

---

## 5. Business fact vs posting instruction

External Applications submit facts, not ledger instructions.

For example, an Application may submit:

```text
sales order
customer = ACME
product = P-100
quantity = 3
amount = 300
```

The Application must not be required to specify:

```text
pending_production +3
pending_shipment +3
receivable +300
```

EVO resolves the currently effective governed posting rules and derives those ledger effects itself.

This preserves the separation:

```text
Business Fact
≠
Posting Rule
≠
Ledger Effect
```

and preserves future deterministic re-posting/replay under explicitly selected rules.

---

## 6. Failure semantics

If EVO rejects the business fact before acceptance, the public API returns a stable error and no accepted business fact exists.

If EVO accepts the business fact and posting executes asynchronously, a later posting failure is a governed terminal state that must remain visible and recoverable.

The system must not silently lose, abandon, or require the caller to rediscover an accepted fact that is waiting for posting.

---

## 7. Compatibility

The current alpha path:

```text
POST /api/v1/commands
→ BusinessData
→ PostingInput
→ postingStatus = QUEUED
→ EVO worker
→ Posting
```

is compatible with this decision **only when** the worker automatically owns continuation after acceptance.

No caller-side posting trigger is required.

A future synchronous fast path is also compatible, provided it preserves the same governed Command → BusinessData → Posting semantics.

---

## 8. Consequences

- business Applications have a simpler contract: submit facts, not posting orchestration;
- synchronous and asynchronous implementations can coexist behind one semantic model;
- EVO retains explicit PostingRun APIs for reprocessing/platform control;
- worker/queue topology remains an implementation detail;
- public status semantics must distinguish accepted/running/posted/failed clearly;
- future API work should expose durable posting status/result retrieval without exposing private tables or worker internals.

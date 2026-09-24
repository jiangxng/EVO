# ADR — EVO Repository Scope vs EVO Ledger Runtime Scope v0.1

**Status: ACCEPTED**  
**Date: 2026-09-24**

---

## 1. Decision

The **EVO repository** and the **EVO Ledger Runtime** are not the same scope.

The repository remains the long-term knowledge and implementation home for:

- EVO product vision;
- business requirements;
- management-system positioning;
- historical architecture;
- reference business loops;
- finance/accounting experiments;
- plugin candidates;
- integration evidence;
- the minimal deterministic ledger runtime.

The minimal runtime component inside the repository is named:

> **EVO Ledger Runtime**

Historical documents may call it EVO Core, EVO Runtime Plugin, or similar. New architecture work should prefer **EVO Ledger Runtime** when referring to the minimal calculation component.

The repository itself remains named **EVO**.

---

## 2. Why the distinction is required

Many existing EVO documents describe valid broader product needs such as:

- enterprise operating-system positioning;
- full business-process coverage;
- finance/accounting capabilities;
- workflow/SOP/management concepts;
- AI/Agent interaction;
- application platform concepts;
- reporting/management intelligence;
- audit/regulatory ideas;
- industry reference systems.

Those requirements are real and must be preserved.

But a valid EVO product requirement does **not** automatically become a responsibility of the EVO Ledger Runtime.

```text
EVO product requirement
≠
EVO Ledger Runtime responsibility
```

A requirement enters the Ledger Runtime only when an explicit scope/architecture decision maps it there.

---

## 3. EVO Ledger Runtime target

The current minimal component boundary is:

```text
ApplicationAnchor(applicationId)
+ BusinessData
+ current PostingRules(applicationId)
+ Posting
+ LedgerEntry
+ LedgerBalance
+ recalculation
+ runtime-data clear
+ runtime-data export
+ generic result/status query
```

Its responsibility is deterministic business-ledger runtime processing: facts + current posting rules → ledger entries and balances.

Preferred mental model:

```text
input facts
+ current executable rules
→ deterministic ledger/balance results
```

---

## 4. What remains valid but outside the Ledger Runtime

Examples include:

- broader Enterprise Operating System vision;
- identity and permissions;
- App Platform / Package / Feature lifecycle;
- rich Application definitions;
- UI/Eidos composition;
- Enterprise Agent;
- workflow / SOP / metrics;
- cost and valuation engines when implemented as plugins;
- General Ledger/statutory accounting;
- financial statements;
- audit/archive/compliance;
- jurisdiction packs;
- management dashboards and intelligence;
- industry templates/reference systems.

These may later live in:

- other plugins/packages;
- App Platform;
- Eidos;
- Enterprise Agent;
- separate repositories;
- retained product/architecture documentation.

The decision is intentionally deferred until a concrete implementation/splitting need exists.

---

## 5. Repository retention rule

Do **not** delete, rewrite away, or relocate broader EVO requirement/positioning documents merely because they are outside the Ledger Runtime boundary.

They are valuable product memory.

Existing documents should be treated according to scope:

```text
BROADER_EVO_PRODUCT
LEDGER_RUNTIME_CORE
PLUGIN_CANDIDATE
HOST_PLATFORM
HISTORICAL_EVIDENCE
```

A document may contain more than one scope; use explicit mapping instead of destructive cleanup.

---

## 6. No repository split now

Do not split the repository merely to make the folder tree match the architecture.

Current strategy:

```text
keep one EVO repository
→ preserve all product knowledge
→ simplify Ledger Runtime implementation in place
→ classify boundaries explicitly
→ split code/docs only when a concrete ownership/deployment/release need justifies it
```

This avoids losing context while the architecture is still converging.

---

## 7. Future split criteria

A future extraction of the EVO Ledger Runtime into another package/repository may be considered when at least one of these is true:

- independent release/version cadence is required;
- independent deployment is required;
- dependency direction becomes clearer through extraction;
- repository size materially harms LLM/human work;
- other products need to consume the Ledger Runtime independently;
- security/ownership boundaries require separation.

If extraction occurs, preserve provenance and requirement links rather than treating the new repository as a clean-slate rewrite.

---

## 8. Requirement interpretation rule

When reading a requirement in the EVO repository, future humans/LLMs must ask:

1. Is this a broader EVO product requirement or specifically a Ledger Runtime requirement?
2. Which component/plugin/host should own it?
3. Is there an accepted ADR mapping it into the Ledger Runtime?
4. Does the minimal calculation engine actually need it?

Default:

> preserve the requirement document, but keep the requirement outside the Ledger Runtime until ownership is explicitly decided.

---

## 9. Naming rule

Preferred terminology going forward:

- **EVO** — repository / broader product knowledge space;
- **EVO Ledger Runtime** — minimal deterministic business-ledger runtime component;
- **EVO 账本引擎** — Chinese product alias for EVO Ledger Runtime;
- **EVO Core / EVO Runtime Plugin / EVO Compute Plugin** — historical aliases, avoid for new boundary decisions when ambiguity matters.

This naming change does not require immediate code/package/repository renames.

---

## 10. Consequence

The EVO repository may remain broader than the EVO Ledger Runtime by design.

That is not architecture drift.

Architecture drift occurs only when broader requirements are silently implemented inside the Ledger Runtime without an explicit ownership decision.

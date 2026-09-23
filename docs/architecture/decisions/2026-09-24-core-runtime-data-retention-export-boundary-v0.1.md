# ADR — Core Runtime Data Lifecycle, Destructive Cache Clear, Export, and Optional Audit Retention v0.1

**Status: ACCEPTED**  
**Date: 2026-09-24**  
**Supersedes:** retention assumptions in `2026-09-24-recalculation-perspectives-and-runtime-cache-v0.1.md`

---

## 1. Decision summary

EVO Core is a runtime and calculation engine. It is not, by default, a permanent audit archive.

A governed Clear Cache operation is allowed to remove the current business runtime dataset for its scope, including BusinessData and all runtime/derived results that depend on it.

Core SHALL provide a complete data-export capability.

Long-term retention of historical accounting vouchers, prior runtime datasets, audit snapshots, statutory archives, or other evidence is optional policy and SHALL be implemented by installable plugins/packages or by customer-operated export retention.

---

## 2. What Clear Cache means

Clear Cache is intentionally destructive for the selected runtime-data scope.

For an Enterprise/Application scope it clears the current business runtime state needed to obtain a truly empty rebuild target.

This includes, where applicable:

- CommandExecution / idempotency runtime state for the cleared scope;
- BusinessData;
- PostingInput;
- PostingRun and posting failures/status state;
- LedgerEntry;
- LedgerBalance;
- CostRun / CostResult;
- valuation posting results;
- WorkItem / workflow projections derived from the cleared data;
- General Ledger journals and journal lines derived from the cleared data;
- trial-balance / financial-statement projections derived from the cleared data;
- replay/materialization runtime generations and checkpoints tied to the cleared dataset;
- other derived balances, projections, indexes and caches owned by the runtime dataset.

The exact physical tables are not the public contract. The semantic rule is:

> after Clear Cache completes, the selected business-data scope behaves as an empty runtime dataset ready to be repopulated.

---

## 3. What Clear Cache does not clear

Clear Cache is not an uninstall or factory reset.

Unless the request explicitly targets a broader administrative reset contract, it retains system/configuration definitions such as:

- Enterprise identity/configuration;
- installed Packages / Features;
- ApplicationDefinition / effective application metadata;
- field/schema definitions;
- PostingRules and other calculation-rule definitions (**MUST be preserved by Clear Cache**);
- Ledger definitions;
- cost/valuation policies;
- chart-of-accounts and accounting policy definitions;
- permissions / identities / actor configuration;
- SOP/Metric/other configuration metadata that is not business runtime data.

PostingRules are explicitly outside the cache-clear deletion set. Clearing BusinessData without preserving the effective PostingRules would make a clean rebuild non-deterministic and is therefore forbidden.

This allows:

```text
clear runtime data
→ keep the same installed applications and rules
→ resubmit data
→ recalculate from a clean state
```

---

## 4. BusinessData lifetime rule

BusinessData is immutable while it exists in the current runtime dataset:

```text
accepted BusinessData
→ never rewritten in place
```

But BusinessData is not required to be retained forever by EVO Core.

A deliberate, authorized Clear Cache may delete the BusinessData in scope together with all dependent runtime results.

Therefore:

```text
append-only within a runtime dataset
≠
permanent archival retention by Core
```

---

## 5. Recalculation perspectives

### EVO-side recalculation

When the current runtime dataset remains present:

```text
BusinessData already in EVO
→ Reposting / Replay / Cost recalculation / projection rebuild
→ regenerated derived state
```

No Application resubmission is required.

### Application-side recalculation

An Application may choose:

```text
Clear Cache for its scope
→ resubmit its own source data through normal EVO APIs
→ EVO processes each submission normally
→ automatic Posting and derivation
```

EVO does not care whether the Application calls this "recalculation", "rebuild", "refresh", "resync", or "reimport".

---

## 6. Full Data Export is a Core capability

EVO Core SHALL expose a governed export of the complete current EVO dataset.

Target API model:

```text
POST /api/v1/data-exports
GET  /api/v1/data-exports/{exportId}
```

The export may execute asynchronously.

A `FULL_ENTERPRISE` export SHOULD include enough information to preserve or externally archive the enterprise's current EVO state, including:

- system/configuration metadata;
- installed application/package state;
- BusinessData;
- posting/runtime state;
- Ledger data and balances;
- cost/valuation data;
- accounting journals/projections;
- relevant rule/version identities;
- lineage and correlation identifiers;
- export manifest;
- schema/contract versions;
- integrity hashes/checksums.

The export contract should be versioned and self-describing.

Core guarantees the ability to export. Core does not require the customer to retain the export.

---

## 7. No hidden retention after Clear Cache

If a user clears runtime data without exporting it and without an audit/archive plugin installed, Core is allowed to remove that data permanently.

EVO Core MUST NOT secretly preserve a private audit copy merely because the deleted runtime data previously contained accounting or business history.

This keeps retention policy outside the mandatory Core.

---

## 8. Audit / accounting archive is a plugin concern

Long-term audit retention may be provided by installable packages such as:

```text
Audit Archive Package
Accounting Voucher Archive Package
Jurisdictional Statutory Archive Package
```

Such a package may:

- subscribe to business/accounting outputs;
- retain immutable accounting vouchers;
- retain periodic/full EVO exports;
- apply jurisdiction-specific retention periods;
- produce audit evidence indexes;
- archive externally/object storage/WORM storage;
- prevent purge according to configured policy;
- export evidence for accountants/auditors.

Retention requirements therefore become deployable policy rather than universal Core behavior.

---

## 9. Financial accounting consequence

General Ledger journals and accounting vouchers may exist in Core as current derived accounting state.

Permanent archival retention of those vouchers is not a prerequisite for the Core accounting engine.

If a jurisdiction/customer requires multi-year immutable accounting evidence, install/configure the appropriate archive plugin or external export-retention policy.

---

## 10. Clear Cache safety

Because Clear Cache is destructive, the API MUST:

- require explicit authorization;
- require explicit Enterprise/Application scope;
- expose a dry-run/impact summary before execution or an equivalent explicit confirmation contract;
- serialize against concurrent writes for the selected scope;
- be idempotent or safely retryable;
- produce a small non-business operational audit record of the reset action itself;
- report exactly which runtime-data families were cleared;
- return a durable reset operation id/status when asynchronous.

The reset-operation record is platform operational metadata; it must not contain a hidden copy of the deleted BusinessData.

---

## 11. Relationship to uninstall

Uninstall/deactivation and Clear Cache are separate operations.

```text
uninstall Application
→ removes current capability exposure
→ does not automatically clear business runtime data

Clear Cache
→ clears selected business runtime data
→ does not uninstall the Application or remove its definitions
```

A product workflow may offer both together, but Core keeps the contracts separate.

---

## 12. Consequences

The model becomes:

```text
EVO Core
= runtime facts + calculations + current derived state + export

Optional plugin
= long-term audit/archive/retention policy
```

This avoids forcing every EVO installation to pay the complexity/storage cost of permanent accounting archives while still allowing regulated enterprises to install exactly the retention policy they need.

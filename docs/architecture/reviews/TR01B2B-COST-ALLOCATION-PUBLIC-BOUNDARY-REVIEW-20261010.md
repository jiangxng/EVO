# TR-01B2B — Cost / Valuation / Settlement public-boundary review

**Date:** 2026-10-10  
**Status:** REVIEW PROPOSAL — NOT AN ACCEPTED CONTRACT OR A SHIPPED API  
**Owner context:** EVO deterministic Ledger Runtime + future installable Cost/Valuation and Allocation plugins; App Platform owns authorization/Package/Feature/Agent/Human orchestration.  
**Related App Platform evidence:** [PR #578](https://github.com/jiangxng/EVO-App-Platform/pull/578), [real EVO PostgreSQL run #38015494916](https://github.com/jiangxng/EVO-App-Platform/actions/runs/38015494916).

## 1. Scope and current facts

An actual Counterparty CUSTOMER + Item + Warehouse-originated App Platform Sales Order → Production → Shipment → Cash receipt was submitted over the **public BusinessData boundary**, not a demo API. After fulfillment, the existing quantity-only Shipment rule yielded inventory quantity=0, raw amount=125.

The bounded cross-repo test then invoked **EVO's existing owner CostEngine and ValuationPostingService inside a disposable PostgreSQL CI runner only**, explicitly pinning:

- published `inventory_fifo` valuation policy by ID + version 1;
- published `inventory_fifo` allocation policy by ID + version 1;
- published `shipment-inventory-to-cogs` valuation rule by ID + version 1.

It observed authoritative Inventory qty=0, amount=0, COGS=125. An EVO FULL replay restored those same balances, Receivable=0, Cash=1000, while both the canonical economic runtime digest and immutable replay input digest matched; replay run validation_status=MATCH. The result marker is `TR01B2B_EVO_PINNED_COST_COGS_REPLAY_PROOF` with status PASS.

**Crucial boundary:** this proves the *current in-repository compatibility implementation* can compute pinned FIFO cost correctly; it does **not** make existing private CostEngine functions or `/api/v1/demo/cost/recalculate` a permitted product/Agent integration. The target minimal EVO Core explicitly excludes cost/valuation engines **by default** (`project.status.json.targetCoreBoundary.notCore` and accepted ADR 2026-09-24). New Cost/Valuation should default to an installable plugin or contract provided by its owner, not expanded Core business semantics.

## 2. A candidate Host-mediated Cost/Valuation capability

The Application/Host controls user and Agent intent, Enterprise Context, feature activation, operation exposure, and authorization. The cost/valuation plugin controls business costing policies and their approved versions. EVO deterministic runtime executes the selected pinned interpretation over the retained immutable BusinessData.

Candidate **logical** operation (name provisional; not asserting any route exists):

```text
trading-reference.cost.recalculate.request
  context: authenticated Enterprise Context, authorized principal
  scope: explicit Enterprise→EVO runtime binding, never global-demo fallback
  target: bounded Inventory/Order/Item/Warehouse or declared runtime boundary
  method: FIFO/LIFO/MOVING_AVERAGE/etc, admitted by effective Cost Plugin
  valuationPolicyPin: { id, version }
  allocationPolicyPin: { id, version } when required
  valuationRulePins: { businessDataType: { id, version } }
  runtimeBoundary: posting sequence / dataset / effective-at contract
  idempotencyKey, correlationId, reason, optional approval
  result: immutable cost run identity, pinned policy lineage, state, affected
          Inventory/COGS positions and replay-proof reference
```

**Acceptance protections:** no unpinned default policy/version; no ambiguity between CURRENT and candidate datasets; no writes to private LedgerEntry/Balance by Agent or App Host; method permission/operation availability is feature-gated; tenant and item/warehouse reference checks happen before execution; authorization obligations are enforced or fail closed; duplicate request idempotency; audit and failure/retry/error contract; concurrency and replay-boundary protection; published policy/rule referential integrity. The Cost plugin's internal computation may still use EVO's `ValuationPostingService`, but only its owner is allowed to post the resulting derived valuation legs.

Any generic Core recalculation primitive should stay semantic-neutral and accept **supplied** versioned runtime interpretation; it must not become a hard-coded `inventory-shipment-cogs` API.

## 3. A separate candidate formal settlement-allocation capability

A `cash.received` BusinessData can reduce scoped Receivable and increase Cash Ledger without proving which individual open invoice/position has been consumed. The canonical history `cash.received --REFERENCES--> sales_order.approved` is **not an AllocationInstruction**.

EVO EEL-C01.3 already proves the in-repo `AllocationInstruction`, `AllocationRelation`, explicit published `fx_settlement_explicit` Allocation Policy, accepted valuation request replay and (for its named case) realized FX in PostgreSQL. That proof has **not** demonstrated App Platform's receipt flowed through a scoped, publicly admitted Host operation.

A distinct **allocation/settlement plugin** should expose a logical authorized operation with:
- explicit `consumerBusinessDataId` of `cash.received` and `sourceSelector` resolving the permitted Sales Order/Receivable Position;
- `allocationPolicyPin: {id, version}`, mode, currency/measurement, effective-at, idempotency key, actor provenance;
- explicit reconciliation of source/consumer amount/currency, over/under/partial allocation, duplicate allocation and settlement reversal;
- a versioned **read/query** of recorded Instruction→Run→Relation and actual consumed amounts;
- replay-equality certification for immutable allocation intent and derived relations.

Avoid automatically converting every historical REFERENCES relation into financial allocation. Do not invent a Bank Account master-data record simply to attach the receipt.

## 4. Dependency order and required executable evidence

1. **Owner/protocol review (design only):** confirm whether Cost/Valuation and Allocation remain co-hosted compatibility modules or transition to installable plugins; pin separate ownership and public capability contracts, preserving minimal EVO Core. No abrupt extraction needed.
2. **Narrow Contract Adapter:** add admitted, permission-gated operation(s) outside Core rather than bypass authorization through compatibility `/demo/*` paths. Host owns Principal/Enterprise Context authorization, plugin owns pins and execution, EVO owns deterministic runtime datasets and replay.
3. **True E2E:** use the same App Platform-source immutable Sales→Production→Shipment→Cash facts. Assert unauthorized/mismatched customer/order/item/warehouse denied; historical policy pins, COGS=125, valued inventory=0, instruction/relation source/consumer IDs and balances, no over-allocation, full replay canonical equality.
4. **Human/Agent/Workbench:** only after public read/write boundaries and risk controls are certified, surface contextual view and restricted action via the same governed Host capability machinery; no special Agent privilege.
5. **Finance-account master-data decision:** after real bank/payment-channel identity, currency, ownership, approvals, settlement-provider clearing and reconciliation use cases are observed, decide whether `financial-account` is a new Foundation Object. Existing cash Ledger, statutory account codes and Counterparty banking facets are **different concepts**.

## 5. Explicit non-goals

This REVIEW does not implement or authorize a new `POST /api/v1/cost/*` route, `POST /api/v1/allocations/*` route, direct DB mutation, a sales ERP, a bank/cash-account object, an FX engine rewrite, or a premature status update to EVO's active `CORE-MIN-02` packet. It does not modify `project.status.json`, core migrations, in-flight App Platform Agent/Designer branches or Eidos. Acceptance requires a separate, correctly owned implementation plus live PostgreSQL and protected CI.

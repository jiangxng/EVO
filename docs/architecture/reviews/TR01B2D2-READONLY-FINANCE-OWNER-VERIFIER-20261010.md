# TR-01B2D2 — EVO-owned read-only Trading Finance Fact / Policy Pin verifier

**Date:** 2026-10-10  
**Status:** BOUNDED READ-ONLY IMPLEMENTATION CANDIDATE, not an admitted public authenticated finance API.  
**Owner:** Cost/Valuation and Allocation plugin-compatible infrastructure inside EVO's compatibility implementation. No change to target minimal EVO Ledger Core.

## Objective

Host already has a deny-by-default finance intent admission guard ([App Platform PR #585](https://github.com/jiangxng/EVO-App-Platform/pull/585)). It checks a selected Enterprise Context, explicit Host→EVO scope mapping, and *separate* permissions for order/customer/item/warehouse/shipment or source/receipt BusinessData. It cannot independently determine whether the underlying immutable finance facts and specific pinned policy IDs are real.

The new `PostgresTradingFinanceFactVerifierV010` provides **read-only** verification of a *bounded single Sales Order* on the authoritative EVO PostgreSQL source. It has **no HTTP route, no public command, no Host tool, no actor/permission assertion and no mutation**. Only an in-process EVO owner plugin or disposable certification harness may invoke it. A trusted authenticated Host-to-owner delegation protocol and registration are a **separate** gate, not provided by an in-process method accepting an `evoEnterpriseId` string.

### Common checks

- Exact EVO enterprise ID and immutable `sales_order.approved` for the declared order number; **exactly one** order for this bounded reference.
- `orderNo`, `customer`, `productId`, `warehouse` in original order match explicit Host request refs. No Tenant A source IDs can be accepted in Tenant B.
- Runtime is `NORMAL`, not requiring replay. Missing pins or malformed basic references always fail closed.

### Cost verification

- `sales_shipment.created` BusinessData ID is in this enterprise, matches order/customer/product/warehouse and has `movementType=SHIP`.
- Exactly one `POSTED` Shipment input at/before the explicit posting boundary; boundary must not exceed current runtime sequence.
- Published/active policy IDs + exact versions for declared cost method, corresponding FIFO/LIFO/specific allocation ordering, and published shipment valuation rule `sales_shipment.created`. No default-latest or name-only pin.

### Cash allocation verification

- The original `sales_order.approved` source ID matches exact primary key. The `cash.received` consumer ID exists in the same enterprise with exact order + customer. Item and Warehouse are authorized/verified on original sales order, not silently invented as attributes of a Cash Receipt.
- Settlement must be `EXPLICIT_FULL`, same currency on order local carrying, order currency, receipt settlement and cash measurements. Positive money with up to two decimal places must equal both original invoice/carried amount and receipt amounts. This intentionally rejects partial, overpayment and FX for this single-reference contract.
- Source order and receipt have `POSTED` input; the allocation policy is published, source/consumer eligible, with `EXPLICIT_ONLY` ordering.

### Return

Successful result is `verified:true, verificationKind:'OWNER_DATABASE_READ_ONLY', executionAllowed:false`. It is **not** an execution token and does not itself authorize any cost or AllocationInstruction mutation. Recheck at actual execution time after a trusted delegation is admitted; posting concurrency can invalidate a preflight.

## Certification and next steps

- EVO unit tests check malformed context/idempotency/version failures before any SQL.
- Separate App Platform pinned EVO/PostgreSQL cross-project workflow will verify this owner code using the already immutable **actual** Sales→Production→Shipment→Cash sample and the published cost and settlement policies; includes negative cross-tenant, wrong source/consumer/customer/item/warehouse, stale pin, settlement amount, wrong boundary, no-state-mutation evidence.
- Later B2D3 must add trusted Host authentication/delegation and an installable authorized owner plugin boundary with execution-phase revalidation, idempotency, audit/replay before any actual finance write is surfaced.
- No `/api/v1/demo/*`, `POST /api/v1/commands` as a forgery-resistant finance permission boundary, private LedgerEntry write, bank account object, Agent tool or Sales UI.

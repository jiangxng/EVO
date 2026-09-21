# EEL-C01 — Order-to-Cash Settlement Reference Loop v0.1

**Status: CERTIFIED / CLOSED — REFERENCE BOUNDARY**  
**Date: 2026-09-22**  
**Stage: E — Enterprise Economic Loops**  
**Authority scope: first certified end-to-end enterprise business loop after Production-Safe Incremental Replay**

## 1. Why this packet exists

Stage D proved that EVO can safely rebuild, compare, activate, read, serialize and recover enterprise economic state.

The next question is no longer “Can the runtime replay safely?” It is:

> Can a real enterprise business loop use that runtime from business intent through operational fulfillment, receivable settlement, cash state, valuation and replay without inventing a second truth model?

The first bounded loop is customer collection inside Order-to-Cash.

## 2. Current repository reality

The repository already contains substantial O2C assets:

- approve-sales-order → sales_order.approved;
- ship-sales-order → sales_shipment.created;
- sales order posting into pending_shipment and receivable;
- shipment posting reducing inventory and pending shipment;
- FIFO costing and Inventory→COGS valuation posting;
- record-customer-payment → compatibility runtime type customer_payment.received;
- explicit FX settlement AllocationInstruction;
- realized settlement valuation;
- Enterprise Template v1 Cash Receipt with business type cash.received;
- reference cash and receivable ledgers.

The important gap is that the current demo runtime does not yet turn the customer receipt into a complete official ledger settlement:

    customer receipt
      → receivable decrease   MISSING in current demo runtime
      → cash increase         MISSING in current demo runtime

There is also a semantic convergence gap:

    runtime compatibility type: customer_payment.received
    template v1 target type:    cash.received

A future LLM must not pick one arbitrarily or rewrite historical BusinessData.

## 3. Semantic decision

### 3.1 Canonical semantic role

The canonical business role is CUSTOMER_CASH_RECEIPT.

This semantic role is more important than one physical historical BusinessData type name.

### 3.2 Reference v1 target BusinessData type

For new reference-template execution, the target type is cash.received because cash receipt belongs to the Cash domain and can carry an explicit customer dimension without making Cash a subtype of Sales.

### 3.3 Historical compatibility

Existing customer_payment.received BusinessData MUST NOT be rewritten.

During convergence:

- customer_payment.received remains readable/replayable as a compatibility type;
- cash.received is the v1 reference target;
- settlement/position adapters must map both explicitly to the same CUSTOMER_CASH_RECEIPT semantic role where required;
- no code may infer equivalence merely because fields or amounts match.

Retirement condition for the compatibility type:

1. no active v1 reference command definition emits customer_payment.received;
2. old BusinessData of that type still replay correctly;
3. explicit compatibility tests exist;
4. migration/certification evidence proves no semantic loss.

## 4. Measurement separation

A customer receipt may contain two different monetary measurements.

Reference FX example:

    receivable settlement: USD 1000
    actual cash received:  CNY 7300

They MUST NOT be collapsed into one generic amount.

The reference loop must preserve:

- settled receivable foreign amount + currency;
- actual cash local amount + currency;
- carrying basis;
- realized FX delta.

Expected ledger semantics:

    Receivable  -1000 USD
    Cash        +7300 CNY

Realized FX remains a derived valuation result:

    actual cash 7300 CNY
    - remaining carrying basis 7200 CNY
    = realized FX +100 CNY

Period-end revaluation remains a distinct operation.

## 5. Explicit settlement identity

The receipt must not close a receivable because customer, amount or timestamps happen to match.

Reference settlement requires explicit AllocationInstruction / source selection:

    Cash Receipt BusinessData
          ↓ explicit settlement instruction
    Sales Order / Receivable source
          ↓
    AllocationRelation

Business causality and settlement allocation remain different lineage graphs.

## 6. Reference business loop

The first certified Stage E reference scenario is intentionally bounded:

    Sales Order Approved
        ↓
    Pending Production / Pending Shipment / Receivable
        ↓
    Production Completed
        ↓
    Inventory
        ↓
    Sales Shipment
        ↓
    Pending Shipment closes / Inventory decreases / COGS valued
        ↓
    Customer Cash Receipt
        ↓
    Explicit Receivable Settlement
        ↓
    Receivable closes / Cash increases
        ↓
    FX Realized Settlement when currencies differ
        ↓
    Work state closes
        ↓
    Full Replay
        ↓
    same official economic state

The scenario should use full quantity/payment closure so open operational and receivable positions can be asserted exactly.

## 7. Required implementation outcomes

### EEL-C01.1 — Receipt semantic convergence

- reference command/application path emits cash.received;
- historical customer_payment.received remains replay-compatible;
- semantic compatibility is explicit and testable.

### EEL-C01.2 — Cash and Receivable posting

Add/activate governed posting semantics so a customer receipt:

- increases cash by actual cash amount/currency;
- decreases receivable by explicitly settled foreign amount/currency;
- preserves dimensions needed for audit and official query.

### EEL-C01.3 — Explicit settlement allocation

- receipt settlement points to the intended source through AllocationInstruction;
- generated AllocationRelation is derived/rebuildable;
- no quantity/amount coincidence inference is allowed.

### EEL-C01.4 — Work closure

After full settlement:

- receivable WorkItem is no longer open;
- operational shipment/production work for the fully completed order is closed;
- cash is a financial position, not a WorkItem substitute.

### EEL-C01.5 — Replay equality

Delete/rebuild derived state through the existing Full Replay path and prove:

    preReplayOfficialStateDigest == postReplayOfficialStateDigest

The loop must remain compatible with the B4.4B generation/CURRENT rules.

## 8. Acceptance assertions

For the reference full-closure scenario, database E2E must prove at minimum:

- pending production = 0;
- pending shipment = 0;
- receivable for the settled order = 0 in the receivable currency;
- cash increased by the actual receipt amount in the cash currency;
- inventory quantity/value and COGS agree with the pinned reference cost policy;
- explicit settlement AllocationInstruction exists;
- derived AllocationRelation closes the selected source amount;
- realized FX result is correct when applicable;
- no open receivable WorkItem remains for the settled order;
- Full Replay produces the same normalized official economic state;
- BusinessData history is unchanged by replay.

## 9. Non-goals

This packet does not certify:

- invoice/tax/subledger legal-document semantics;
- revenue-recognition policy;
- partial payment / overpayment / unapplied cash;
- payment fees, chargebacks or refunds;
- bank reconciliation;
- credit limits or collections workflow;
- LIFO/MWA/Specific-ID production activation parity;
- UI/report productization.

## 10. Evidence target

Target evidence level:

CERTIFIED — EEL-C01 Order-to-Cash Settlement Reference Loop

Minimum pipeline:

    validate:docs
    migrate
    typecheck
    build
    unit tests
    seed:demo
    O2C database E2E
    Full Replay equality

No certification may be claimed from template declarations alone.

## 11. First implementation slice

Start with the smallest executable convergence:

1. introduce/seed the reference cash ledger if missing;
2. make receipt posting represent two explicit measurements;
3. add compatibility mapping for legacy customer_payment.received;
4. update the reference payment/receipt command toward cash.received;
5. add a dedicated O2C full-closure database validation;
6. only then decide whether further runtime abstraction is required.

Do not create a new generalized settlement framework unless the existing Allocation/Position/Valuation contracts prove insufficient.


---

## 12. 2026-09-22 Implementation Evidence — EEL-C01.1 / EEL-C01.2

**Evidence level: DATABASE E2E VERIFIED**

First executable receipt-ledger convergence is now proven on PostgreSQL 18.

Verified behavior:

- new reference runtime path emits `cash.received`;
- historical `record-customer-payment -> customer_payment.received` remains unchanged;
- one customer receipt preserves two independent monetary measurements:
  - receivable settlement: `-1000 USD`;
  - actual cash receipt: `+7300 CNY`;
- Receivable settlement identity uses the same order/customer settlement dimensions on both increase and decrease, so the reference receivable closes to zero;
- Cash balance increases to CNY 7300;
- existing Replay, Worker/Activation concurrency, crash/retry, and activation failure-matrix validations remain green.

Evidence:

- implementation head: `1d44ee11af3ed847cfc4a4629210f5ee07f245fb`
- GitHub Actions: `35661639605 — SUCCESS`
- PostgreSQL: 18
- DB schema: 22 (unchanged)
- validator: `npm run validate:eel-c01-receipt-posting`

This does **not** close EEL-C01. Explicit settlement AllocationRelation convergence, full Work closure, full-loop replay equality, and final certification remain open.

### Additional bounded observation

`ledger_entry` preserves currency, while current `ledger_balance` identity is ledger + dimension hash rather than currency-aware identity. This does not block the reference EEL-C01 scenario because USD Receivable and CNY Cash are different ledgers. Same-ledger multi-currency balance identity requires a separate bounded architecture packet if/when needed; it is not silently expanded inside EEL-C01.


---

## 13. 2026-09-22 Implementation Evidence — EEL-C01.3

**Evidence level: DATABASE E2E VERIFIED**

The canonical customer-cash-receipt path now participates in explicit settlement allocation and realized FX using the existing Allocation/Position/Valuation runtime.

Verified reference scenario:

```text
Receivable source       = 1000 USD
Carrying basis          = 7200 CNY
Actual cash receipt     = 7300 CNY
Explicit allocation     = consume 1000 USD
Realized FX             = +100 CNY
Operational receivable  = 0
```

Evidence:

- PR: `#15`
- implementation head: `36d8de14c746b94f7ecc9b195aa9e75214200656`
- GitHub Actions: `35663507253 — SUCCESS`
- PostgreSQL: 18
- validator: `npm run validate:eel-c01-settlement-allocation`

The implementation reuses the existing settlement engine. No generic payment framework, partial-payment model, bank-reconciliation model, or other deferred scope was introduced.

PR #13 is retained only as superseded historical evidence because its shared-database validator made two invalid assumptions: exact global replay request count and exact decimal string formatting.

EEL-C01 remains open for Work closure, Full Replay equality, legacy compatibility replay certification, and final certification.


---

## 14. 2026-09-22 Implementation Evidence — EEL-C01.4

**Evidence level: DATABASE E2E VERIFIED**

The full-closure reference order now proves Work lifecycle behavior without adding
a second workflow state model.

Verified lifecycle:

- Sales Order creates OPEN PRODUCE / SHIP / COLLECT Work;
- full Production closes PRODUCE;
- full Shipment closes SHIP while COLLECT remains OPEN;
- full Customer Cash Receipt closes COLLECT;
- no reference-order O2C Work remains OPEN after full closure;
- Cash is not projected as Work.

Evidence:

- PR: `#16`
- implementation head: `1063f825bf331ac1b28c55b027da57b6af51137c`
- GitHub Actions: `35664093669 — SUCCESS`
- PostgreSQL: 18
- validator: `npm run validate:eel-c01-work-closure`

### Anti-overdesign result

The existing balance-derived `PostgresWorkProjection` was sufficient. No new
workflow engine, workflow state table, or generic collections runtime was added.

This is an explicit example of the Human–LLM alignment rule:

```text
confirmed business need
→ test existing smallest mechanism
→ mechanism is sufficient
→ do not generalize further
```

EEL-C01 remains open for Full Replay equality, legacy receipt compatibility replay,
and final database certification.


---

## 13. 2026-09-22 Legacy Receipt Compatibility Evidence

**Evidence level: DATABASE E2E VERIFIED**

Historical `customer_payment.received` remains an explicit compatibility input after
`cash.received` becomes the canonical new receipt path.

The isolated PostgreSQL 18 proof verifies:

- old BusinessData type and measurements are unchanged;
- explicit source-selection intent survives;
- settlement allocation and realized FX rebuild identically;
- Full Replay preserves canonical input and economic-runtime digests;
- old payment facts receive no retroactive Cash/Receivable posting.

Evidence:
- PR #21
- CI `35667578606 — SUCCESS`
- validator: `npm run validate:eel-c01-legacy-receipt-compat`

This closes the final functional compatibility gate. EEL-C01 now awaits only the
formal certification packet and completed-loop Human–LLM requirement alignment review.


---

## 15. 2026-09-22 Final Certification and Requirement Alignment

**Final status: CERTIFIED — EEL-C01 ORDER-TO-CASH SETTLEMENT REFERENCE LOOP**

All accepted EEL-C01 business outcomes are now evidenced.

Certification:

`docs/architecture/certification/EEL-C01-ORDER-TO-CASH-SETTLEMENT-CERTIFICATION-v0.1.md`

Completed-loop Human–LLM requirement review:

`docs/architecture/status/EVO-REQUIREMENT-ALIGNMENT-REVIEW-2026-09-22-EEL-C01-v0.1.md`

Business conclusion:

> EVO now has one complete reference Order-to-Cash loop that can execute, close, explain, and Full-Replay its official economic state without rewriting canonical business history.

Scope conclusion:

> Do not extend EEL-C01 with partial payment, banking, generic settlement, collections, or UI work unless a new confirmed business requirement creates a new bounded packet.

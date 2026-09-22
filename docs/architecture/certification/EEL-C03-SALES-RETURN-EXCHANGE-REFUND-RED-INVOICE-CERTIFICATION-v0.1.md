# EEL-C03 — Sales Return / Exchange / Refund / Red Invoice Reference Loop Certification v0.1

**Status:** CERTIFIED  
**Date:** 2026-09-22  
**Stage:** Stage E — Enterprise Economic Loops  
**Packet:** EEL-C03  
**Evidence Environment:** PostgreSQL 18  
**Full Replay Evidence:** GitHub Actions CI #626 / run 35686286743 — SUCCESS  
**Proof boundary:** one customer-side reverse economic reference loop; this is not certification of a complete RMA, tax-control, statutory accounting, credit-memo, or customer-service platform.

## 1. Certified Business Outcome

EVO can now express and reconstruct one complete customer-side reverse business loop without mutating original business history:

```text
Sales Order
→ Production
→ Shipment
→ Customer Receipt
→ Blue Invoice
→ Sales Return
→ Sales Exchange
→ Customer Refund
→ Red Invoice
→ Reverse Work Closure
→ Full Replay Equality
```

The reverse events are new canonical BusinessData facts.

Original sale, shipment, receipt and invoice facts remain unchanged.

## 2. Certified Reference Semantics

### Sales Return

```text
sales_return.received
→ Inventory increase
→ explicit REFERENCES source shipment
```

Certified result:

- returned quantity/value are appended through posting rules;
- original Sales Order / Shipment remain unchanged.

### Sales Exchange

```text
sales_exchange.created
→ replacement Inventory decrease
→ explicit REFERENCES return
```

Certified result:

- exchange is a simple event;
- no RMA Runtime is required;
- original Sale / Shipment / Return remain unchanged.

### Customer Refund

```text
cash.refunded
→ Cash decrease
→ explicit REFERENCES original cash.received
```

Certified rule:

> Refund does not automatically recreate Receivable.

Whether Receivable, Revenue, Tax or GL are affected is a separate business/accounting-rule decision.

### Red Invoice

```text
sales_invoice.issued
→ sales_invoice_amount increase

sales_red_invoice.issued
→ sales_invoice_amount decrease
→ explicit REFERENCES original blue invoice
```

Certified rule:

> Invoice business events are not automatically revenue recognition or statutory General Ledger entries.

The reference path therefore does not hard-code Revenue, Tax, Receivable or GL effects.

## 3. Balance-driven Reverse Work

C03.5 proves that reverse business completion is not inferred from event existence.

Sales return can conditionally open:

```text
pending_exchange
pending_refund
pending_red_invoice
```

Subsequent events reduce them:

```text
sales_exchange.created
→ pending_exchange decrease

cash.refunded
→ pending_refund decrease

sales_red_invoice.issued
→ pending_red_invoice decrease
```

The existing generic WorkProjection applies:

```text
balance > 0 → Work OPEN
balance = 0 → Work DONE
```

Partial-processing evidence:

```text
Exchange:   4 → 3 → 0
Refund:     400 → 300 → 0
Red Invoice 400 → 250 → 0
```

No after-sales-specific Work Runtime was required.

## 4. Full Replay Certification

The isolated reference Full Replay creates exactly one canonical fact of each major reference type:

```text
sales_order.approved
production.completed
sales_shipment.created
cash.received
sales_invoice.issued
sales_return.received
sales_exchange.created
cash.refunded
sales_red_invoice.issued
```

Before and after Full Replay, the certified business state remains:

```text
pending_production   = 0
pending_shipment     = 0
receivable           = 0
cash                 = 600
inventory quantity   = 0
sales_invoice_amount = 600

pending_exchange     = 0
pending_refund       = 0
pending_red_invoice  = 0

EXCHANGE Work        = DONE
REFUND Work          = DONE
RED_INVOICE Work     = DONE
```

Full Replay also proves:

- canonical replay-input digest unchanged;
- economic-runtime digest unchanged;
- BusinessData unchanged;
- explicit BusinessObjectLink relationships unchanged;
- Work is deleted and rebuilt from reconstructed balances;
- replay run records MATCH.

## 5. Evidence Chain

### C03.1 — Sales Return Economic Recognition

- PR #29
- CI #600 — SUCCESS
- canonical `sales_return.received`
- Inventory +4 / +40 in the reference slice
- explicit source REFERENCES relation
- original forward BusinessData unchanged

### C03.2 — Sales Exchange

- PR #30
- CI #602 — SUCCESS
- canonical `sales_exchange.created`
- replacement Inventory movement
- explicit relation to return
- no Exchange/RMA Runtime

### C03.3 — Customer Refund

- PR #32
- CI #614 — SUCCESS
- canonical `cash.refunded`
- Cash decreases
- original `cash.received` unchanged
- refund does not implicitly restore Receivable

### C03.4 — Red Invoice

- PR #33
- CI #620 — SUCCESS
- canonical `sales_red_invoice.issued`
- explicit reference to blue invoice
- sales invoice business balance decreases
- no hard-coded revenue recognition / tax-control / GL effect

### C03.5 — Work / Balance Closure

- PR #34
- CI #623 — SUCCESS
- `pending_exchange`, `pending_refund`, `pending_red_invoice`
- partial processing remains OPEN
- zero balance closes Work
- generic WorkProjection reused

### C03.6 — Full Replay Equality

- PR #35
- CI #626 / run 35686286743 — SUCCESS
- complete reverse-flow PostgreSQL 18 proof
- canonical facts preserved
- explicit links preserved
- Ledger/Balance/Work rebuilt identically
- economic digest MATCH

## 6. Architecture Conclusions

EEL-C03 provides direct evidence for these EVO principles:

### 6.1 Reverse business does not require mutable history

Corrections, reversals and after-sales changes can be expressed as new facts.

### 6.2 Complex enterprise behavior can emerge from simple primitives

The certified loop uses:

```text
BusinessData
+ explicit relationships
+ conditional Posting Rules
+ Ledger balances
+ WorkProjection
+ Full Replay
```

No generic Reversal Engine, RMA Runtime, Refund Runtime or Tax Platform was required.

### 6.3 Platform capabilities can remain composable

Return, Exchange, Refund and Red Invoice are independent application/event capabilities that can be composed into a larger after-sales experience without becoming one monolithic runtime module.

### 6.4 Business event and accounting recognition remain separate

A refund or red invoice can be canonical business truth without automatically implying a particular statutory accounting journal.

Accounting recognition remains a governed projection under installed accounting policies/packages.

## 7. Explicitly Not Certified

EEL-C03 does not certify:

- RMA / after-sales approval platform;
- repair workflow;
- return freight;
- restocking fees;
- refund approval hierarchy;
- chargebacks;
- multi-order refund allocation;
- cross-currency refund;
- full tax-control integration;
- statutory VAT/tax calculation;
- credit-memo product platform;
- customer-service ticketing;
- statutory General Ledger;
- Trial Balance;
- Financial Statements.

These require separate business requirements and certification boundaries.

## 8. Final Certification Decision

**EEL-C03 — Sales Return / Exchange / Refund / Red Invoice Reference Loop: CERTIFIED.**

EVO now has database-proven reference evidence for:

```text
forward customer business loop
+
supplier-side procure-to-pay loop
+
customer-side reverse business loop
```

The Stage E business-mainline can now select its next bounded enterprise capability from business requirements rather than continuing C03 implementation momentum.

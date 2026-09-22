# EEL-C02 Procure-to-Pay Reference Loop Certification v0.1

**Status:** CERTIFIED  
**Date:** 2026-09-22  
**Stage:** Stage E — Enterprise Economic Loops  
**Packet:** EEL-C02  
**Replay Evidence:** GitHub Actions CI #584 / run 35679110487 — SUCCESS  
**Final Certification CI:** GitHub Actions CI #587 / run 35679264071 — SUCCESS  
**Evidence Environment:** PostgreSQL 18

## 1. Certified Business Outcome

EVO can now execute and reconstruct one complete supplier-side Procure-to-Pay economic loop:

```text
Purchase Order
→ Pending Purchase
→ Payable
→ Multiple Goods Receipts
→ Inventory
→ Multiple Supplier Payments
→ Cash decrease
→ Pending Purchase closure
→ Payable closure
→ RECEIVE/PAY Work closure
→ Full Replay equality
```

## 2. Certified Reference Scenario

### Purchase commitment

```text
Purchase Order
quantity = 100
amount   = 1250 CNY
```

Creates:

```text
Pending Purchase +100
Payable          +1250
RECEIVE           OPEN
PAY               OPEN
```

### Cumulative goods receipt

```text
Receipt 1: 30
Receipt 2: 20
Receipt 3: 50
```

Certified balance evolution:

```text
Pending Purchase:
100 → 70 → 50 → 0

Inventory quantity:
0 → 30 → 50 → 100

Inventory amount:
0 → 375 → 625 → 1250
```

Each goods receipt is a new immutable `goods_receipt.received` BusinessData fact.

Each receipt is explicitly connected to the Purchase Order through `FULFILLS`.

When Pending Purchase reaches zero:

```text
RECEIVE = DONE
```

### Cumulative supplier payment

```text
Payment 1: 300
Payment 2: 400
Payment 3: 550
```

Certified balance evolution:

```text
Payable:
1250 → 950 → 550 → 0

Cash:
0 → -300 → -700 → -1250
```

Each payment is a new immutable `cash.paid` BusinessData fact.

Each payment records explicit settlement intent using:

- `AllocationInstruction`
- `BusinessObjectLink relation_type = ALLOCATES_TO`

When Payable reaches zero:

```text
PAY = DONE
```

## 3. Certified Invariants

The following behavior is certified:

1. Historical Purchase Order BusinessData is never mutated by receipt or payment.
2. Goods receipts append facts; they do not rewrite the Purchase Order.
3. Supplier payments append facts; they do not rewrite the Payable source.
4. Pending Purchase state is derived from cumulative ledger balance.
5. Payable state is derived from cumulative ledger balance.
6. RECEIVE/PAY Work states are balance-driven.
7. Settlement/fulfillment is explicit; EVO does not infer relationships only because numbers match.
8. Multiple receipts and multiple payments use the same core runtime path as one receipt/payment.
9. Ledger dimension policy remains enforced.
10. Retroactive facts remain protected by replay-required behavior.
11. Full Replay does not execute Commands again.
12. Canonical BusinessData survives Full Replay unchanged.
13. AllocationInstruction survives Full Replay unchanged.
14. Derived ledger/work state can be reconstructed deterministically.

## 4. Full Replay Certification

The isolated PostgreSQL 18 replay evidence constructs:

```text
1 purchase_order.approved
3 goods_receipt.received
3 cash.paid
```

Total canonical P2P BusinessData:

```text
7
```

Before and after Full Replay:

```text
Pending Purchase = 0
Payable          = 0
Inventory Qty    = 100
Inventory Amount = 1250
Cash             = -1250
RECEIVE           DONE
PAY               DONE
```

Replay requires:

- canonical BusinessData unchanged;
- explicit AP AllocationInstructions unchanged;
- official balances unchanged;
- Work state unchanged;
- economic runtime digest MATCH.

## 5. Architecture Conclusion

EEL-C02 provides evidence for the Stage E principle:

> **Complex business behavior does not automatically require complex core runtime.**

Partial/multiple receipts and payments were implemented through:

```text
BusinessData
+ Posting Rules
+ Ledger Entries / Balances
+ BusinessObjectLink
+ AllocationInstruction
+ WorkProjection
+ Replay
```

No procurement-specific core runtime, partial-receipt engine, or partial-payment engine was required.

The certification scenario therefore supports the architectural rule:

> **认证场景可以简单，但基础实现不得为简单场景特化。**

## 6. Important Engineering Evidence

During certification, EVO correctly rejected or protected several invalid situations:

- incompatible ledger dimensions were rejected with `LEDGER_DIMENSION_NOT_ALLOWED`;
- different dimension keys did not incorrectly net into one balance;
- retroactive posting was blocked with replay-required behavior;
- Full Replay evidence required isolated database state to prevent unrelated cost-run contamination.

These are treated as positive evidence that the existing safety boundaries are active.

## 7. Explicitly Not Certified as Product Workflows

EEL-C02 does not certify productized workflows for:

- supplier invoice / three-way match;
- tax / VAT recovery;
- landed cost / freight allocation;
- purchase return;
- supplier credit note;
- prepayment;
- payment approval hierarchy;
- payment batch;
- bank reconciliation;
- cross-currency supplier settlement.

Partial and multiple receipt/payment combinations are **runtime-capability evidence**, not separate product workflow certification.

## 8. Certification Evidence

Repository branch:

```text
evo/eel-c02-procure-to-pay-packet-v0.1
```

Pull request:

```text
PR #26
```

Primary validators:

```text
validate:eel-c02-purchase-recognition
validate:eel-c02-goods-receipt
validate:eel-c02-supplier-payment
validate:eel-c02-full-replay
```

Certified CI:

```text
Replay evidence: GitHub Actions CI #584 / run 35679110487 / success
Final certification: GitHub Actions CI #587 / run 35679264071 / success
Merge commit: 43c23050b74819caf311535598808bdf5339d237
```

## 9. Final Certification Decision

**EEL-C02 — Procure-to-Pay Reference Loop: CERTIFIED.**

The supplier-side enterprise economic loop is proven on the current EVO runtime and may be merged into the authoritative main branch.

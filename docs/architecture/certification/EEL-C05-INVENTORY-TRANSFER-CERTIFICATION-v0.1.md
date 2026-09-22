# EEL-C05 — Inventory Transfer & Warehouse Rebalancing Certification v0.1

**Status:** CERTIFIED  
**Date:** 2026-09-22  
**Stage:** Stage E — Enterprise Economic Loops  
**Packet:** EEL-C05  
**Reference policy:** destination-receipt inventory recognition

## 1. Certified Business Boundary

EEL-C05 proves one bounded intra-enterprise warehouse transfer loop:

```text
Inventory in Warehouse A
→ Transfer Created
→ Transfer Issued
→ Partial Receipt 15
→ Final Receipt 25
→ Warehouse B
→ Full Replay Equality
```

This is an internal asset-location change, not a sale or purchase.

## 2. Reference Result

Initial state:

```text
Warehouse A = 100 units / CNY 1,000
Warehouse B =   0 units / CNY 0
```

Transfer request:

```text
40 units A → B
```

Partial receipt:

```text
Receive 15
A = 85 / 850
B = 15 / 150
pending_transfer = 25
TRANSFER Work = OPEN
```

Final receipt:

```text
Receive 25
A = 60 / 600
B = 40 / 400
pending_transfer = 0
TRANSFER Work = DONE
```

Enterprise-wide invariants:

```text
Total Quantity = 100
Total Inventory Value = CNY 1,000
```

## 3. Cost / Valuation Semantics

Destination inventory value is not supplied as an arbitrary command amount.

The reference uses:

```text
Source warehouse FIFO cost basis
→ inventory_transfer.received CostResult
→ dual-leg Valuation
→ Inventory(source dimensions) decrease
→ Inventory(target dimensions) increase
```

Reference FIFO transfer costs:

```text
15 units → CNY 150
25 units → CNY 250
```

The ValuationRule contract supports a backward-compatible dual dimension mapping:

```text
source dimensions
target dimensions
```

Existing single-mapping valuation rules remain unchanged.

## 4. Recognition Policy

EEL-C05 v0.1 uses destination-receipt recognition for official warehouse Inventory.

```text
transfer.issued
→ canonical dispatch fact only

transfer.received
→ official source/destination Inventory migration
```

This prevents mainline Inventory from entering a quantity/value half-state while in transit.

Alternative in-transit ownership policies are explicitly deferred.

## 5. Forbidden Side Effects

A pure intra-enterprise transfer must not create:

- Revenue;
- COGS;
- Operating Expense;
- Receivable;
- Payable;
- Cash movement.

The reference validator explicitly checks these ledgers.

## 6. Explicit Lineage

The reference requires:

```text
Transfer Created
→ REFERENCES
→ Transfer Issued

Transfer Issued
→ FULFILLS
→ Receipt 15

Transfer Issued
→ FULFILLS
→ Receipt 25
```

Lineage is not inferred from matching quantity or timestamp.

## 7. Full Replay Certification Target

Full Replay must prove:

- canonical transfer BusinessData unchanged;
- explicit BusinessObjectLink relationships unchanged;
- source warehouse returns to 60 / 600;
- destination warehouse returns to 40 / 400;
- total enterprise inventory remains 100 / 1,000;
- FIFO transfer costs rebuild to 150 + 250;
- pending_transfer rebuilds to zero;
- TRANSFER Work rebuilds as DONE;
- canonical replay-input digest unchanged;
- economic-runtime digest unchanged;
- replay_run persists COMPLETED / MATCH.

## 8. Evidence Chain

### Transfer Conservation Bundle

- PR #43
- CI #649 — SUCCESS
- merge commit `c57ac5716aff743470e8d6b2ab98bc5e87a6aec7`
- PostgreSQL 18 transfer quantity/value conservation proven.

### Full Replay + Final Certification

- current branch: `evo/eel-c05-full-replay-final-certification-v0.1`
- CI #653 / workflow run 35711266390 — SUCCESS.

## 9. Explicitly Not Certified

EEL-C05 does not certify:

- WMS platform;
- TMS;
- bins/location optimization;
- wave/pick/pack;
- carrier execution;
- cross-legal-entity transfer;
- transfer pricing;
- customs/bonded stock;
- advanced lot/serial productization;
- cycle-count platform;
- in-transit ownership accounting variants.

## 10. Final Decision

**EEL-C05 — Inventory Transfer & Warehouse Rebalancing Reference Loop: CERTIFIED.**

Final evidence:

- PR #44;
- CI #653 / workflow run 35711266390 — SUCCESS;
- canonical transfer facts and explicit relationships preserved;
- source/destination Inventory quantity and value rebuilt identically;
- FIFO transfer CostResults rebuilt identically;
- pending_transfer rebuilt to zero;
- TRANSFER Work rebuilt as DONE;
- canonical replay-input digest unchanged;
- economic-runtime digest unchanged;
- replay_run persisted COMPLETED / MATCH.

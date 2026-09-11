# EVO v1.0.0-alpha.1 Validation

## Clean validation database

For disposable local validation only:

```powershell
docker compose down -v
docker compose up -d --build
```

Do not use `down -v` on a database containing data you need.

## Automated baseline

```powershell
docker compose exec api node dist/scripts/validate-demo.js
```

Expected: `status = PASS`, `replayDeterministic = true`.

## Manual semantic reference flow

Open `http://localhost:3000/` and execute in order.

### 1. Approve Sales Order

Default values:

- SO-1001
- Demo Customer
- P-100
- quantity 10
- unit price 100
- total amount 1000 USD

Expected derived state:

- pending_production P-100 / SO-1001 = +10
- pending_shipment P-100 / SO-1001 = +10
- receivable SO-1001 = +1000
- FlowTrace step `sales-order-approved`

### 2. Complete Production

- P-100
- warehouse HK
- quantity 10
- total cost 100

Expected:

- BusinessData `production.completed`
- pending_production 10 → 0
- inventory HK/P-100 quantity +10, amount +100
- PRODUCE WorkItem becomes DONE
- explicit BusinessObjectLink to the sales-order BusinessData
- FlowTrace step `production-completed`

### 3. Ship 2

- SHIP-1001
- order SO-1001
- P-100
- HK
- quantity 2

Expected:

- BusinessData `sales_shipment.created`
- inventory 10 → 8
- pending_shipment 10 → 8
- SHIP WorkItem quantity 10 → 8
- FlowTrace step `shipment-created`

### 4. FIFO Cost

Expected CostResult:

- pool HK:P-100
- quantity 2
- unit_cost 10
- total_cost 20

Dashboard now exposes `costResults` directly.

Known alpha boundary: valuation posting is not yet connected, so inventory ledger amount remains 100 until the explicit valuation-posting stage is implemented. This is intentionally visible; CostResult must not silently mutate LedgerBalance.

### 5. Full Replay

Expected:

- deterministic = true
- before_digest and after_digest are both SHA-256 values
- ReplayRun.before_snapshot contains the optional snapshot
- ReplayRun.validation_status = MATCH
- balances after Replay equal balances before Replay

## Context Determinism Check

A fresh coding agent should begin with `LLM.md` and `context.manifest.json`, explain the runtime spine and invariants, then inspect only the target module context for bounded changes.

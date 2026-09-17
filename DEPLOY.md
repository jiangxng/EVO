# EVO v1.0.0-alpha.2 — Simplest Deployment

## Requirement

Install **Docker Desktop**.

No local Node.js or PostgreSQL installation is required.

## Windows

Open PowerShell in the EVO directory:

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy.ps1
```

Or simply:

```powershell
docker compose up -d --build
```

Then open:

```text
http://localhost:3000
```

## macOS / Linux

```bash
docker compose up -d --build
```

Then open:

```text
http://localhost:3000
```

## What Docker starts

```text
PostgreSQL 18
    ↓
automatic migration
    ↓
automatic demo metadata seed
    ↓
EVO API
    +
EVO Worker
```

## Stop

```bash
docker compose down
```

## Completely reset validation data

```bash
docker compose down -v
docker compose up -d --build
```

`-v` deletes the local EVO PostgreSQL volume.

## Health

```text
http://localhost:3000/health/live
http://localhost:3000/health/ready
```

## Validation Console

```text
http://localhost:3000
```

Recommended validation sequence:

1. Approve a sales order.
2. Inspect `pending_production`, `pending_shipment`, `receivable`.
3. Inspect generated WorkItems.
4. Switch Actor from Human to AI and approve another order.
5. Receive inventory.
6. Ship inventory.
7. Recalculate FIFO / LIFO / Moving Average cost.
8. Run Full Replay.
9. Verify the page reports `Replay deterministic ✓`.

## Command-line deterministic validation

Inside the running API container:

```bash
docker compose exec api node dist/scripts/validate-demo.js
```

Expected:

```json
{
  "status": "PASS",
  "replayDeterministic": true
}
```

## Logs

```bash
docker compose logs -f api worker
```

## Updating

For this validation candidate, preserve the PostgreSQL volume unless a migration explicitly says otherwise.

For a clean evaluation of a new candidate:

```bash
docker compose down -v
docker compose up -d --build
```

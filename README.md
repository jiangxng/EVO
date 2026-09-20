# EVO — Enterprise Operating System

Current baseline: **v1.0.0-alpha.2**

EVO models the enterprise, runs the enterprise, and helps the enterprise improve itself.

AI/coding agents start with `AGENTS.md`, then `LLM.md`, and use
`context.manifest.json` to select a bounded read profile. Do not read all
historical documents by default. Humans and models should treat
`PHILOSOPHY.md`, `CONCEPTS.md`, `INVARIANTS.md`, `ARCHITECTURE.md`,
`PUBLIC-API.md`, `architecture.manifest.json` and `context.manifest.json` as
canonical project context within their stated authority scopes.

## Reference Flow

Sales Order → Production Completion → Inventory → Shipment → Cost → Valuation Posting → Replay

The alpha.2 reference keeps the explicit Production Completion → Finished Goods Inventory semantics from alpha.1 and adds governed analytical dimensions plus formal valuation posting from CostResult into Inventory Value and COGS.

## Run

```bash
cp .env.example .env
docker compose up -d --build
```

Open `http://localhost:3000/`.

Validate:

```bash
docker compose exec api node dist/scripts/validate-demo.js
```

See `DEPLOY.md`, `docs/change/EVO-v0.9-to-v1.0-alpha.1.md`, and `docs/change/EVO-v1.0.0-alpha.1-to-alpha.2.md`.

## v1.0.0-alpha.2 candidate

This candidate adds explicit accounting/analytical dimensions and formal CostResult -> Valuation Posting -> LedgerEntry behavior. The reference O2C flow now values a shipment so that producing 10 units for total cost 100 and shipping 2 units under FIFO yields Inventory quantity 8, Inventory value 80, and COGS 20. Replay preserves the cost/valuation versions used by the historical derived state.

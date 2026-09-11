# EVO — Enterprise Operating System

Current baseline: **v1.0.0-alpha.1**

EVO models the enterprise, runs the enterprise, and helps the enterprise improve itself.

Start with `LLM.md` if you are an AI/coding agent. Humans and models should treat `PHILOSOPHY.md`, `CONCEPTS.md`, `INVARIANTS.md`, `ARCHITECTURE.md`, `PUBLIC-API.md`, `architecture.manifest.json` and `context.manifest.json` as authoritative project context.

## Reference Flow

Sales Order → Production Completion → Inventory → Shipment → Cost → Replay

The alpha.1 reference intentionally removes the ambiguous generic inventory receipt from the main demo. Production completion is the explicit business cause of finished-goods inventory increase.

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

See `DEPLOY.md` and `docs/change/EVO-v0.9-to-v1.0-alpha.1.md`.

# EVO

EVO is an AI-native Enterprise Operating System.

This repository is designed so that **the repository itself is the authoritative engineering context**. Human memory and LLM chat memory are not architecture dependencies.

## M0 status

This scaffold establishes:

- TypeScript / Node.js runtime
- Fastify API process
- Worker process
- PostgreSQL + Kysely foundation
- SQL migration runner
- structured logging
- structured errors
- architecture manifest
- module ownership map
- architecture dependency test
- Vitest foundation
- CI
- change/compatibility/performance documentation structure

## Requirements

- Node.js 24 LTS
- PostgreSQL 18 for local development
- npm

## Start locally

```bash
cp .env.example .env
docker compose up -d
npm install
npm run migrate
npm run dev:api
```

In another terminal:

```bash
npm run dev:worker
```

Checks:

```bash
npm run check
```

## Cold-start rule for humans and LLMs

Before changing code:

1. Read `ARCHITECTURE.md`.
2. Read the target module `README.md`.
3. Read relevant files under `docs/interfaces/`.
4. Read relevant files under `docs/invariants/`.
5. Read active ADR/change records.
6. Inspect only the target implementation and tests unless broader context is required.

Do not use old chat history as the only source for an architectural decision.


## Architecture history

Versioned architecture documents are stored under `docs/architecture/`.
Start with root `ARCHITECTURE.md` for the current implementation context.

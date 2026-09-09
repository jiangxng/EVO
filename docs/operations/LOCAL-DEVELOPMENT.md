# Local Development

```bash
cp .env.example .env
docker compose up -d
npm install
npm run migrate
npm run check
npm run dev:api
```

Worker:

```bash
npm run dev:worker
```

Liveness:

```text
GET http://localhost:3000/health/live
```

Readiness:

```text
GET http://localhost:3000/health/ready
```

Readiness must not report success if PostgreSQL cannot be reached.

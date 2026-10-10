# B2D3 — Dedicated isolated EVO Finance Owner read-only process

**2026-10-11.** Increment stacked onto [EVO Finance Owner Draft #108](https://github.com/jiangxng/EVO/pull/108). This is an implementation + bounded CI improvement, **not** deployment signoff.

## Why

The previous [distinct database LOGIN CI](https://github.com/jiangxng/EVO-App-Platform/pull/609) used separate runtime/operator PostgreSQL credentials but ran a **full EVO API executable** on that runtime connection. While the restricted DB credential denied unsafe SQL, public `/api/v1/demo/*` and command routes still existed in that listener. A least-privilege database login is not equivalent to an endpoint-isolated finance service.

## Dedicated entrypoint

- `apps/api/src/finance-owner-readonly-app.ts`: exclusively registers `GET /health/live`, `GET /health/ready` and the existing plugin-owned `POST /api/v1/plugins/trading-finance/readonly-verifications` endpoint.
- Does **not** call `buildApp()` and does **not** register general Command, BusinessData submission, admin, Demo, Cost, Allocation or mutations.
- `apps/api/src/finance-owner-readonly-main.ts` requires explicit `EVO_FINANCE_OWNER_ISOLATED_READONLY=true`, `EVO_FINANCE_TRUST_AUTHORITY=POSTGRES`, supplied `DATABASE_URL`, explicit `HOST`/`PORT` and no startup trust JSON. Missing requirements fail closed before listening.
- `npm run start:finance-owner-readonly` launches only that service.
- Reuses **exactly the same** signed Postgres-trust/nonce owner plugin route and narrow `SECURITY DEFINER` key-lock routine as Draft #108. Does not add new finance logic to minimal EVO Core.
- Unit negative controls verify all common general/mutating routes return 404; malformed untrusted assertion fails with `executionAllowed:false`.

## Live PostgreSQL proof requested

[App Platform B2D3 Draft #594](https://github.com/jiangxng/EVO-App-Platform/pull/594) companion stacked CI should run the dedicated executable with the **already independently authenticated restricted runtime login** and verify:

1. Valid original Sales→Shipment pinned-cost read-only assertion succeeds via live HTTP, including `executionAllowed:false`.
2. Direct HTTP attempts to general `/api/v1/commands`, `/api/v1/demo/*` and `/api/v1/configurator/business-data` return 404, never authenticate and never mutate business facts.
3. Restricted runtime still cannot SELECT/UPDATE trusted-key table, grant/revoke, mutate audit or CostRun. Separate operator login can audit grant/revoke; revoked signature rejected with no restart.
4. Canonical economic/replay digests and CostRun/AllocationInstruction row counts remain unchanged.

## Deployment and ownership fences

- **Only** the dedicated *Finance Owner plugin service* is intended to have the narrow runtime credential. The normal EVO API + worker still need their independently governed credentials and their own isolated ingress.
- Production network isolation, real Host/OIDC enterprise auth, certificate chain, service-to-service network policy, private DNS, mTLS/ingress, secret manager, operator grant ceremony and deploy rollback remain **NOT CERTIFIED**.
- Health endpoints should be published to infrastructure-only probes; a launch flag is not a reverse-proxy access-control rule.
- `finance_lock_active_signing_key_v010` remains non-PUBLIC; only operator-issued DB GRANT EXECUTE to dedicated runtime. No application/business plugin gets direct ledger table write access.
- Keep B2D3 OPEN / parent PRs DRAFT and `executionAllowed:false`, and defer B2D4 write authority and B2E Eidos sales UX until independent admission.

## Evidence

Exact implementation head `8fa737ca97de8472f89f806f866b9fbf7c71985f`: [EVO #110 full CI #38067997945](https://github.com/jiangxng/EVO/actions/runs/38067997945) **SUCCESS**. Paired [App Platform #616 cross-project live original-sales PostgreSQL CI #38068088650](https://github.com/jiangxng/EVO-App-Platform/actions/runs/38068088650) **SUCCESS**; restricted runtime signed Owner read, restricted operator grant/revoke, 2 audits, raw trust table access denial, unchanged canonical financial facts, and **`financeOwnerProcessIsolatedFromCommandsAndDemo=true`** were checked on the dedicated 3002 process. Concurrent two-EVO unique nonce and revoke ordering remained PASS. App Platform Continuity #38068088601 PASS.

`financialExecutionAllowed=false`, `realProductionCredentials=NOT_CERTIFIED`, `productionTlsAndIdentity=NOT_CERTIFIED`; do not promote this to production certification. A new documentation head needs its own CI.

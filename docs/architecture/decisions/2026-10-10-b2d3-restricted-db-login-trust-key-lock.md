# B2D3 — restricted runtime database role and transactional trust-key lock

**2026-10-10.** Small security hardening stacked onto trusted finance owner [EVO Draft #108](https://github.com/jiangxng/EVO/pull/108). Owner remains the EVO finance plugin compatibility boundary, NOT the minimal deterministic EVO Ledger Core. Only read-only Host verification is exposed; no finance execution admission.

## Reproduced deployment defect

[App Platform Draft #609](https://github.com/jiangxng/EVO-App-Platform/pull/609) introduced actual separate PostgreSQL LOGIN roles (not `SET LOCAL ROLE`) and an additional live EVO HTTP process. The first isolated PostgreSQL CI run [#38061476431](https://github.com/jiangxng/EVO-App-Platform/actions/runs/38061476431) failed on the restricted runtime's `SELECT ... FOR SHARE` against `finance_trusted_signing_key`, as expected: PostgreSQL requires **UPDATE privilege on at least one column** for `FOR SHARE` in addition to SELECT. The prior successful superuser role-switch test never issued the active signing-key lock through an independently logged-in API process.

The unsafe shortcut of granting runtime `UPDATE` on the key table was rejected: key mutation and trust admission belong solely to the operator.

## Narrow resolution

The **additive migration** `202610100040_finance_runtime_key_lock_function.sql` creates `public.finance_lock_active_signing_key_v010(issuer, installation, key)` as `SECURITY DEFINER`, with static SQL, qualified trust table, fixed `search_path=pg_catalog`, and precisely one active-key `SELECT ... FOR SHARE`. Function EXECUTE is revoked from PUBLIC. An operator must separately provision `GRANT EXECUTE ... TO <isolated runtime role>`; the key table must not grant runtime `SELECT` or `UPDATE`.

The owner endpoint calls that function in the **same database transaction** as its signed assertion verification and nonce INSERT. Thus the row lock remains held until the nonce admission transaction commits, protecting against concurrent operator revocation without allowing the runtime credential to modify trust.

This is intentionally a small compatibility hardening of EVO's owner/plugin transport; it does not alter signed claim semantics, business facts, canonical replay, ledger balances, key grant/revoke governance triggers or external API shape.

## Validation and limits

- EVO TypeScript/unit CI should pass on the stacked branch.
- App Platform #609 must pin the exact new EVO commit and verify signed HTTP finance read through a **separately authenticated runtime LOGIN**, independent **operator LOGIN** grant/revoke, no direct key-table access from runtime, dual role denial, and unchanged CostRun, allocation and canonical economic/replay facts.
- Strong production privileges require explicit operator role grants, real secret management, a locked-down finance owner API process, production TLS/OIDC, key custody and a deployment audit. This bounded CI test **does not** certify deployed credentials, KMS, physical node separation or production finance writes.
- No state or project status promotion; B2D3 remains OPEN until its full admission gates pass. B2D4 and Agent/Human sales experience remain separate.

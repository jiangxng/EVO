-- B2D3: a least-privilege runtime cannot SELECT ... FOR SHARE directly:
-- PostgreSQL also requires table UPDATE privilege for that locking clause.
-- Runtime MUST NOT receive UPDATE on public.finance_trusted_signing_key.
-- Grant only this narrowly scoped, privilege-isolated row-lock function
-- to the installed finance-verifier runtime database role.
--
-- SECURITY DEFINER has a fixed, trusted search_path and no dynamic SQL.
-- The FOR SHARE lock survives until the caller's transaction commits, so
-- concurrently revoked keys cannot be re-admitted during nonce insertion.
create function public.finance_lock_active_signing_key_v010(
  p_issuer text,
  p_installation_id text,
  p_key_id text
)
returns table (
  "installationId" text,
  issuer text,
  "keyId" text,
  "publicKeyPem" text,
  "hostEnterpriseId" text,
  "contextId" text,
  "evoEnterpriseId" text
)
language sql
volatile
security definer
set search_path = pg_catalog
as $$
  select
    k.installation_id,
    k.issuer,
    k.key_id,
    k.public_key_pem,
    k.host_enterprise_id,
    k.context_id,
    k.evo_enterprise_id
  from public.finance_trusted_signing_key as k
  where k.issuer = p_issuer
    and k.installation_id = p_installation_id
    and k.key_id = p_key_id
    and k.status = 'ACTIVE'
  for share of k
$$;

-- Functions are PUBLIC-executable by default. Never expose this function
-- globally; the infrastructure operator must explicitly GRANT EXECUTE
-- to the isolated service login (and revoke it upon deprovision).
revoke all on function public.finance_lock_active_signing_key_v010(text,text,text) from public;

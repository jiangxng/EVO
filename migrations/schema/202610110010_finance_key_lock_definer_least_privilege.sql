-- TR01B2D3: operator-gated least-privilege SECURITY DEFINER owner.
-- Additive migration; never rewrite the already-applied 202610100040 migration.
-- This requires a privileged migration operator (CREATEROLE / role-switch
-- rights) and must NOT be run automatically against production without
-- an approved DB security change. The migration runner wraps this file
-- in one transaction, so temporary CREATE and final REVOKE are atomic.
--
-- Deliberately fail on a pre-existing role name instead of inheriting
-- unknown grants, membership or an unsafe existing owner's privileges.
create role evo_finance_key_lock_definer_v010
  nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;

-- SELECT columns needed by the static SQL verifier lookup. A FOR SHARE
-- locking read also needs UPDATE on at least one selected table column;
-- restrict this to status only. The definer cannot grant/revoke trust
-- because it owns neither key table nor operator/audit functions.
grant usage on schema public to evo_finance_key_lock_definer_v010;
grant select (
  issuer, installation_id, key_id, public_key_pem,
  host_enterprise_id, context_id, evo_enterprise_id, status
) on public.finance_trusted_signing_key
  to evo_finance_key_lock_definer_v010;
grant update (status) on public.finance_trusted_signing_key
  to evo_finance_key_lock_definer_v010;

-- PostgreSQL ALTER FUNCTION OWNER requires target owner CREATE on
-- the containing schema. Grant only for the transaction and then revoke.
grant create on schema public to evo_finance_key_lock_definer_v010;
alter function public.finance_lock_active_signing_key_v010(text,text,text)
  owner to evo_finance_key_lock_definer_v010;
revoke create on schema public from evo_finance_key_lock_definer_v010;

-- Namespace resolution never falls back to caller-supplied schemas.
-- The only table referenced by the function body is explicitly qualified.
alter function public.finance_lock_active_signing_key_v010(text,text,text)
  set search_path = pg_catalog, pg_temp;

-- Repeat revoke deliberately; safety must not depend on default ACLs.
revoke all on function public.finance_lock_active_signing_key_v010(text,text,text)
  from public;

-- Operator must independently GRANT EXECUTE solely to the installed
-- Finance Owner runtime login; the definer role is never a login identity.

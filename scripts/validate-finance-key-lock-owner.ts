/** B2D3 disposable DB-only post-migration owner verification.
 * Does not grant permissions, rotate keys, authorize finance writes or certify production.
 */
import assert from 'node:assert/strict';
import pg from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString || process.env.NODE_ENV !== 'test') {
  throw new Error('TR01B2D3_DISPOSABLE_DB_CI_ONLY');
}
const client = new pg.Client({ connectionString });
await client.connect();
try {
  const { rows } = await client.query(`
    select
      r.rolname as owner_name,
      r.rolcanlogin as owner_login,
      r.rolsuper as owner_superuser,
      r.rolinherit as owner_inherit,
      r.rolcreatedb as owner_createdb,
      r.rolcreaterole as owner_createrole,
      r.rolreplication as owner_replication,
      r.rolbypassrls as owner_bypassrls,
      p.prosecdef as security_definer,
      'search_path=pg_catalog, pg_temp'=any(p.proconfig) as fixed_search_path,
      has_schema_privilege(r.oid,'public','CREATE') as owner_schema_create,
      has_table_privilege(r.oid,'public.finance_trusted_signing_key','INSERT') as owner_key_insert,
      has_table_privilege(r.oid,'public.finance_trusted_signing_key','DELETE') as owner_key_delete,
      has_column_privilege(r.oid,'public.finance_trusted_signing_key','status','UPDATE') as owner_key_lock_update,
      has_column_privilege(r.oid,'public.finance_trusted_signing_key','issuer','SELECT') as owner_key_select,
      has_table_privilege(r.oid,'public.finance_trust_change_audit','INSERT') as owner_audit_insert,
      (select count(*)::int from pg_auth_members where member=r.oid) as owner_memberships,
      exists (select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl
        where acl.grantee=0 and acl.privilege_type='EXECUTE') as public_execute,
      pg_get_functiondef(p.oid) as function_ddl
    from pg_proc p
    join pg_roles r on r.oid=p.proowner
    where p.oid=to_regprocedure('public.finance_lock_active_signing_key_v010(text,text,text)')
  `);
  assert.equal(rows.length, 1);
  const [row] = rows;
  assert.equal(row.owner_name, 'evo_finance_key_lock_definer_v010');
  for (const key of [
    'owner_login','owner_superuser','owner_inherit','owner_createdb',
    'owner_createrole','owner_replication','owner_bypassrls',
    'owner_schema_create','owner_key_insert','owner_key_delete',
    'owner_audit_insert','public_execute'
  ]) assert.equal(row[key], false, key);
  for (const key of ['security_definer','fixed_search_path',
    'owner_key_lock_update','owner_key_select']) assert.equal(row[key], true, key);
  assert.equal(row.owner_memberships, 0);
  assert.match(row.function_ddl, /public\.finance_trusted_signing_key/u);
  assert.match(row.function_ddl, /for share/iu);
  console.log('TR01B2D3_LEAST_PRIVILEGE_DEFINER_OWNER_CI=' + JSON.stringify({
    status:'PASS', ownerNoLogin:true, ownerNonSuperuser:true,
    noSchemaCreateAtRest:true, noPublicExecute:true,
    noOwnerRoleMembership:true, lockedLookupOnly:true,
    productionCertification:'NOT_CERTIFIED', executionAllowed:false
  }));
} finally {
  await client.end();
}

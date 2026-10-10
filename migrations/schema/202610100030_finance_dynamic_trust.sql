-- TR01B2D3: explicit DB authority for trusted signing public keys.
-- No automatic grants, no user-facing management HTTP/API.
-- A revoked (issuer, installation, key-id) can NEVER be reinstated or modified.
create table finance_trusted_signing_key (
  issuer text not null,
  installation_id text not null,
  key_id text not null,
  public_key_pem text not null,
  host_enterprise_id text not null,
  context_id text not null,
  evo_enterprise_id text not null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','REVOKED')),
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key (issuer, installation_id, key_id),
  check ((status = 'REVOKED') = (revoked_at is not null))
);
create index finance_trusted_signing_key_tenant_idx
  on finance_trusted_signing_key (evo_enterprise_id, status);
create table finance_trust_change_audit (
  audit_id bigint generated always as identity primary key,
  issuer text not null,
  installation_id text not null,
  key_id text not null,
  action text not null check (action in ('GRANT','REVOKE')),
  operator_id text not null,
  reason text not null,
  occurred_at timestamptz not null default now()
);
create function finance_trust_key_governance_trigger()
returns trigger language plpgsql as $$
declare
  actor text := nullif(current_setting('evo.finance_trust_actor', true),'');
  reason text := nullif(current_setting('evo.finance_trust_reason', true),'');
begin
  if tg_op = 'DELETE' then
    raise exception 'FINANCE_TRUST_KEY_DELETE_FORBIDDEN';
  end if;
  if actor is null or reason is null or length(actor) > 256 or length(reason) > 1024 then
    raise exception 'FINANCE_TRUST_OPERATOR_AND_REASON_REQUIRED';
  end if;
  if tg_op = 'UPDATE' then
    if old.status != 'ACTIVE' or new.status != 'REVOKED'
      or new.issuer is distinct from old.issuer
      or new.installation_id is distinct from old.installation_id
      or new.key_id is distinct from old.key_id
      or new.public_key_pem is distinct from old.public_key_pem
      or new.host_enterprise_id is distinct from old.host_enterprise_id
      or new.context_id is distinct from old.context_id
      or new.evo_enterprise_id is distinct from old.evo_enterprise_id
      or new.created_at is distinct from old.created_at
      or new.revoked_at is null then
      raise exception 'FINANCE_TRUST_KEY_IMMUTABLE_REVOKE_ONLY';
    end if;
  end if;
  insert into finance_trust_change_audit
    (issuer,installation_id,key_id,action,operator_id,reason)
  values
    (new.issuer,new.installation_id,new.key_id,
      case when tg_op='INSERT' then 'GRANT' else 'REVOKE' end,actor,reason);
  return new;
end
$$;
create trigger finance_trust_key_governance
  before insert or update or delete on finance_trusted_signing_key
  for each row execute function finance_trust_key_governance_trigger();

create function finance_trust_audit_immutable_trigger()
returns trigger language plpgsql as $$
begin
  raise exception 'FINANCE_TRUST_AUDIT_IMMUTABLE';
end
$$;
create trigger finance_trust_audit_immutable
  before update or delete on finance_trust_change_audit
  for each row execute function finance_trust_audit_immutable_trigger();

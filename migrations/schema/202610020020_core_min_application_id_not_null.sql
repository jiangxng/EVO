-- CORE-MIN-02 — applicationId routing convergence, phase 2
--
-- PR #84 introduced additive application_id columns, backfilled historical rows,
-- and made the compatibility Command path dual-write application_id.
--
-- This migration is intentionally fail-closed: constraints are tightened only
-- if every persisted BusinessData / PostingInput row has the target routing key.

do $$
begin
  if exists (
    select 1
    from business_data
    where application_id is null
    limit 1
  ) then
    raise exception 'CORE_MIN_APPLICATION_ID_COVERAGE_INCOMPLETE:business_data';
  end if;

  if exists (
    select 1
    from posting_input
    where application_id is null
    limit 1
  ) then
    raise exception 'CORE_MIN_APPLICATION_ID_COVERAGE_INCOMPLETE:posting_input';
  end if;
end
$$;

alter table business_data
  alter column application_id set not null;

alter table posting_input
  alter column application_id set not null;

update evo_runtime_info
set db_schema_version = 28,
    updated_at = now()
where singleton = true;

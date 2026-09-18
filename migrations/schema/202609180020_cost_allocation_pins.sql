-- EVO Economic Runtime v0.1 — cost/allocation replay pins
-- Additive follow-up to 202609180010_economic_runtime_v01.sql.
-- Authoritative cost and replay runs must preserve the allocation policy
-- that generated source-consumption lineage.

alter table cost_run
  add column if not exists allocation_policy_id uuid,
  add column if not exists allocation_policy_version integer;

alter table cost_run
  drop constraint if exists cost_run_allocation_policy_fk;

alter table cost_run
  add constraint cost_run_allocation_policy_fk
  foreign key (allocation_policy_id, allocation_policy_version)
  references allocation_policy(id, version);

alter table cost_run
  add constraint cost_run_allocation_policy_pin_pair
  check (
    (allocation_policy_id is null and allocation_policy_version is null)
    or
    (allocation_policy_id is not null and allocation_policy_version is not null)
  );

alter table replay_run
  add column if not exists allocation_policy_id uuid,
  add column if not exists allocation_policy_version integer;

alter table replay_run
  drop constraint if exists replay_run_allocation_policy_fk;

alter table replay_run
  add constraint replay_run_allocation_policy_fk
  foreign key (allocation_policy_id, allocation_policy_version)
  references allocation_policy(id, version);

alter table replay_run
  add constraint replay_run_allocation_policy_pin_pair
  check (
    (allocation_policy_id is null and allocation_policy_version is null)
    or
    (allocation_policy_id is not null and allocation_policy_version is not null)
  );

update evo_runtime_info
set db_schema_version = 9,
    updated_at = now()
where singleton = true;

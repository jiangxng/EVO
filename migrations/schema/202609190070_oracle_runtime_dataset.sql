-- EVO Isolated Full Replay Oracle Dataset v0.1
-- Add an isolated ORACLE materialization generation so a complete updated-history
-- replay can be compared with an intact incremental CANDIDATE without touching CURRENT.

alter table economic_runtime_dataset
  drop constraint if exists economic_runtime_dataset_kind_check;

alter table economic_runtime_dataset
  add constraint economic_runtime_dataset_kind_check
  check (kind in ('CURRENT','CANDIDATE','ORACLE','ARCHIVED'));

alter table economic_runtime_dataset
  add column if not exists oracle_of_dataset_id uuid
  references economic_runtime_dataset(id);

create unique index if not exists ux_economic_runtime_dataset_oracle_live
  on economic_runtime_dataset(oracle_of_dataset_id)
  where kind = 'ORACLE'
    and status in ('BUILDING','VERIFIED');

create index if not exists ix_economic_runtime_dataset_oracle
  on economic_runtime_dataset(
    enterprise_id,
    consistency_domain,
    oracle_of_dataset_id,
    created_at desc
  )
  where kind = 'ORACLE';

update evo_runtime_info
set db_schema_version = 21,
    updated_at = now()
where singleton = true;

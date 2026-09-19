-- EVO Economic Runtime Dataset / Materialization Generation v0.1
-- Additive substrate for isolated candidate generations used by Incremental Replay.

create table if not exists economic_runtime_dataset (
  id uuid primary key default uuidv7(),
  enterprise_id uuid not null references enterprise(id),
  consistency_domain text not null,
  kind text not null
    check (kind in ('CURRENT','CANDIDATE','ARCHIVED')),
  status text not null
    check (status in ('BUILDING','ACTIVE','VERIFIED','FAILED','ARCHIVED')),
  parent_dataset_id uuid references economic_runtime_dataset(id),
  source_checkpoint_id uuid references replay_checkpoint(id),
  source_promotion_id uuid references replay_checkpoint_promotion(id),
  incremental_plan_digest char(64),
  start_sequence bigint check (start_sequence is null or start_sequence >= 0),
  boundary_sequence bigint check (boundary_sequence is null or boundary_sequence >= 0),
  semantic_digest char(64),
  failure_reason text,
  verified_at timestamptz,
  activated_at timestamptz,
  created_at timestamptz not null default now(),
  check (
    kind <> 'CANDIDATE'
    or (
      parent_dataset_id is not null
      and source_checkpoint_id is not null
      and source_promotion_id is not null
      and incremental_plan_digest is not null
      and start_sequence is not null
      and boundary_sequence is not null
    )
  ),
  check (
    start_sequence is null
    or boundary_sequence is null
    or start_sequence <= boundary_sequence
  )
);

create unique index if not exists ux_economic_runtime_dataset_active
  on economic_runtime_dataset(enterprise_id, consistency_domain)
  where status = 'ACTIVE';

create index if not exists ix_economic_runtime_dataset_history
  on economic_runtime_dataset(
    enterprise_id,
    consistency_domain,
    created_at desc
  );

create index if not exists ix_economic_runtime_dataset_candidate
  on economic_runtime_dataset(
    enterprise_id,
    consistency_domain,
    status,
    boundary_sequence
  )
  where kind = 'CANDIDATE';

update evo_runtime_info
set db_schema_version = 15,
    updated_at = now()
where singleton = true;

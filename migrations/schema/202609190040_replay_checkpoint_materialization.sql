-- EVO Replay Checkpoint Materialization v0.1
-- Persist immutable, digest-protected prefix state required to resume
-- incremental recomputation from a certified checkpoint.

create table if not exists replay_checkpoint_materialization (
  id uuid primary key default uuidv7(),
  enterprise_id uuid not null references enterprise(id),
  checkpoint_id uuid not null references replay_checkpoint(id),
  family text not null
    check (family in (
      'COST_POOL',
      'LEDGER_BALANCE',
      'VALUATION_POSITION',
      'POSITION_STATE'
    )),
  scope_key text not null,
  schema_version integer not null check (schema_version > 0),
  payload jsonb not null,
  semantic_digest char(64) not null,
  created_at timestamptz not null default now(),
  unique (
    checkpoint_id,
    family,
    scope_key,
    schema_version
  )
);

create index if not exists ix_replay_checkpoint_materialization_family
  on replay_checkpoint_materialization(
    enterprise_id,
    checkpoint_id,
    family,
    scope_key
  );

update evo_runtime_info
set db_schema_version = 18,
    updated_at = now()
where singleton = true;

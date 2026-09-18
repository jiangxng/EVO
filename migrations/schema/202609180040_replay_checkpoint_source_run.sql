-- EVO Economic Runtime v0.1 — replay checkpoint source-run identity
-- A verified full replay may produce at most one durable checkpoint.

alter table replay_checkpoint
  add column if not exists source_replay_run_id uuid references replay_run(id);

create unique index if not exists ux_replay_checkpoint_source_run
  on replay_checkpoint(source_replay_run_id)
  where source_replay_run_id is not null;

update evo_runtime_info
set db_schema_version = 11,
    updated_at = now()
where singleton = true;

-- EVO Replay Checkpoint Promotion v0.1
-- Explicit governance boundary between machine coverage certification and
-- authorization to use a checkpoint as an Incremental Replay starting point.

create table if not exists replay_checkpoint_promotion (
  id uuid primary key default uuidv7(),
  enterprise_id uuid not null references enterprise(id),
  checkpoint_id uuid not null references replay_checkpoint(id),
  certification_id uuid not null references replay_coverage_certification(id),
  certification_version integer not null check (certification_version > 0),
  certification_semantic_digest char(64) not null,
  status text not null default 'ACTIVE'
    check (status in ('ACTIVE','REVOKED')),
  promoted_by text not null,
  reason text not null,
  evidence jsonb not null default '{}'::jsonb,
  promotion_digest char(64) not null,
  promoted_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by text,
  revoke_reason text,
  created_at timestamptz not null default now(),
  unique (checkpoint_id, certification_id, certification_semantic_digest)
);

create unique index if not exists ux_replay_checkpoint_promotion_active
  on replay_checkpoint_promotion(checkpoint_id)
  where status = 'ACTIVE';

create index if not exists ix_replay_checkpoint_promotion_lookup
  on replay_checkpoint_promotion(
    enterprise_id,
    status,
    checkpoint_id,
    promoted_at desc
  );

update evo_runtime_info
set db_schema_version = 14,
    updated_at = now()
where singleton = true;

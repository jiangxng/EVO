-- EVO Governed Runtime Equivalence Certification v0.1
-- Immutable evidence binding one incremental Candidate to one isolated Full Replay
-- Oracle before atomically promoting that exact Candidate to production CURRENT.

create table if not exists runtime_equivalence_certification (
  id uuid primary key default uuidv7(),
  enterprise_id uuid not null references enterprise(id),
  consistency_domain text not null,
  candidate_dataset_id uuid not null references economic_runtime_dataset(id),
  oracle_dataset_id uuid not null references economic_runtime_dataset(id),
  parent_dataset_id uuid not null references economic_runtime_dataset(id),
  source_checkpoint_id uuid not null references replay_checkpoint(id),
  source_promotion_id uuid not null references replay_checkpoint_promotion(id),
  incremental_plan_digest char(64) not null,
  boundary_sequence bigint not null check (boundary_sequence > 0),
  candidate_semantic_digest char(64) not null,
  oracle_semantic_digest char(64) not null,
  status text not null check (status in ('CERTIFIED','REJECTED')),
  blockers jsonb not null default '[]'::jsonb,
  evidence jsonb not null default '{}'::jsonb,
  certification_digest char(64) not null,
  certified_by text not null,
  reason text not null,
  certified_at timestamptz not null default now(),
  activated_at timestamptz,
  created_at timestamptz not null default now(),
  unique (candidate_dataset_id),
  unique (oracle_dataset_id),
  unique (certification_digest),
  check (
    (status = 'CERTIFIED'
      and candidate_semantic_digest = oracle_semantic_digest
      and jsonb_array_length(blockers) = 0
      and activated_at is not null)
    or
    (status = 'REJECTED'
      and jsonb_array_length(blockers) > 0
      and activated_at is null)
  )
);

create index if not exists ix_runtime_equivalence_certification_scope
  on runtime_equivalence_certification(
    enterprise_id,
    consistency_domain,
    certified_at desc
  );

update evo_runtime_info
set db_schema_version = 22,
    updated_at = now()
where singleton = true;

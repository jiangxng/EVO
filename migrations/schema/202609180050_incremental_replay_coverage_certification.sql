-- EVO Incremental Replay Coverage Certification v0.1
-- Conservative machine-verifiable promotion gate for replay checkpoints.

create table if not exists replay_coverage_certification (
  id uuid primary key default uuidv7(),
  enterprise_id uuid not null references enterprise(id),
  consistency_domain text not null,
  runtime_semantic_version text not null,
  dependency_graph_version text not null,
  certification_version integer not null check (certification_version > 0),
  status text not null default 'DRAFT'
    check (status in ('DRAFT','CERTIFIED','REVOKED')),
  dependency_graph_complete boolean not null default false,
  materialization_digest_complete boolean not null default false,
  derived_runtime_replay_complete boolean not null default false,
  reference_dataset_pins_complete boolean not null default false,
  template_binding_complete boolean not null default false,
  evidence jsonb not null default '{}'::jsonb,
  semantic_digest char(64) not null,
  certified_by text,
  certified_at timestamptz,
  revoked_at timestamptz,
  revoke_reason text,
  created_at timestamptz not null default now(),
  unique (
    enterprise_id,
    consistency_domain,
    runtime_semantic_version,
    dependency_graph_version,
    certification_version
  )
);

create index if not exists ix_replay_coverage_certification_lookup
  on replay_coverage_certification(
    enterprise_id,
    consistency_domain,
    runtime_semantic_version,
    dependency_graph_version,
    status,
    certification_version desc
  );

update evo_runtime_info
set db_schema_version = 12,
    updated_at = now()
where singleton = true;

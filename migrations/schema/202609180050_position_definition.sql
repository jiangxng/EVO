-- EVO Economic Runtime v0.1 — versioned PositionDefinition semantics
-- PositionDefinition is template/reference semantics.
-- Position itself remains derived and is not persisted here as canonical truth.

create table if not exists position_definition (
  id uuid primary key default uuidv7(),
  enterprise_id uuid references enterprise(id),
  code text not null,
  name text not null,
  version integer not null check (version > 0),
  status text not null default 'DRAFT'
    check (status in ('DRAFT','PUBLISHED','RETIRED')),
  semantic_digest char(64) not null,
  dimensions jsonb not null default '[]'::jsonb,
  source_rules jsonb not null default '[]'::jsonb,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  unique nulls not distinct (enterprise_id, code, version),
  unique (id, version)
);

create index if not exists ix_position_definition_lookup
  on position_definition(enterprise_id, code, status, version desc);

update evo_runtime_info
set db_schema_version = 12,
    updated_at = now()
where singleton = true;

-- EVO M1 — Metadata Kernel
-- PostgreSQL 18 provides uuidv7(), which is used for canonical EVO identities.

create table if not exists enterprise (
  id uuid primary key default uuidv7(),
  code text not null unique,
  name text not null,
  status text not null default 'ACTIVE'
    check (status in ('ACTIVE', 'SUSPENDED', 'ARCHIVED')),
  default_timezone text not null default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists domain_definition (
  id uuid primary key default uuidv7(),
  code text not null unique,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists transaction_type (
  id uuid primary key default uuidv7(),
  domain_id uuid not null references domain_definition(id),
  code text not null unique,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists application_definition (
  id uuid primary key default uuidv7(),
  transaction_type_id uuid not null references transaction_type(id),
  code text not null unique,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists application_definition_version (
  id uuid primary key default uuidv7(),
  application_definition_id uuid not null references application_definition(id),
  version integer not null check (version > 0),
  status text not null
    check (status in ('DRAFT', 'PUBLISHED', 'RETIRED')),
  schema_version integer not null default 1 check (schema_version > 0),
  base_config jsonb not null default '{}'::jsonb,
  definition_hash text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (application_definition_id, version)
);

create unique index if not exists uq_application_definition_one_published
  on application_definition_version(application_definition_id)
  where status = 'PUBLISHED';

create table if not exists field_group_definition (
  id uuid primary key default uuidv7(),
  application_definition_version_id uuid not null
    references application_definition_version(id) on delete cascade,
  code text not null,
  label text not null,
  sort_order integer not null default 0,
  config jsonb not null default '{}'::jsonb,
  unique (application_definition_version_id, code)
);

create table if not exists field_definition (
  id uuid primary key default uuidv7(),
  application_definition_version_id uuid not null
    references application_definition_version(id) on delete cascade,
  field_group_id uuid references field_group_definition(id) on delete set null,
  code text not null,
  label text not null,
  data_type text not null,
  required boolean not null default false,
  reference_mode text
    check (reference_mode is null or reference_mode in ('REFERENCE', 'SNAPSHOT')),
  sort_order integer not null default 0,
  config jsonb not null default '{}'::jsonb,
  unique (application_definition_version_id, code)
);

create table if not exists application_instance (
  id uuid primary key default uuidv7(),
  enterprise_id uuid not null references enterprise(id),
  application_definition_id uuid not null references application_definition(id),
  code text not null,
  name text not null,
  pinned_definition_version integer,
  status text not null default 'ACTIVE'
    check (status in ('ACTIVE', 'DISABLED', 'ARCHIVED')),
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (enterprise_id, code)
);

create table if not exists enterprise_application_overlay (
  id uuid primary key default uuidv7(),
  enterprise_id uuid not null references enterprise(id),
  application_instance_id uuid not null references application_instance(id) on delete cascade,
  base_definition_version integer not null check (base_definition_version > 0),
  overlay_version integer not null check (overlay_version > 0),
  status text not null
    check (status in ('DRAFT', 'PUBLISHED', 'RETIRED')),
  patch jsonb not null default '{}'::jsonb,
  overlay_hash text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (application_instance_id, overlay_version)
);

create unique index if not exists uq_application_instance_one_published_overlay
  on enterprise_application_overlay(application_instance_id)
  where status = 'PUBLISHED';

create table if not exists command_definition (
  id uuid primary key default uuidv7(),
  application_definition_version_id uuid not null
    references application_definition_version(id) on delete cascade,
  code text not null,
  name text not null,
  input_schema jsonb not null default '{}'::jsonb,
  preconditions jsonb not null default '[]'::jsonb,
  execution_policy jsonb not null default '{}'::jsonb,
  resulting_business_data_type text not null,
  config jsonb not null default '{}'::jsonb,
  unique (application_definition_version_id, code)
);

create table if not exists ledger_definition (
  id uuid primary key default uuidv7(),
  code text not null unique,
  name text not null,
  quantity_semantics text,
  amount_semantics text,
  dimension_schema jsonb not null default '{}'::jsonb,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists posting_rule (
  id uuid primary key default uuidv7(),
  application_definition_version_id uuid not null
    references application_definition_version(id) on delete cascade,
  code text not null,
  priority integer not null default 0,
  condition_ast jsonb not null default '{"type":"literal","value":true}'::jsonb,
  effect_ast jsonb not null,
  rule_schema_version integer not null default 1,
  created_at timestamptz not null default now(),
  unique (application_definition_version_id, code)
);

create table if not exists valuation_policy (
  id uuid primary key default uuidv7(),
  enterprise_id uuid references enterprise(id),
  code text not null,
  name text not null,
  method text not null
    check (method in ('FIFO', 'LIFO', 'MOVING_AVERAGE', 'SPECIFIC_IDENTIFICATION')),
  negative_inventory_policy text not null default 'DISALLOW_NEGATIVE'
    check (negative_inventory_policy in ('DISALLOW_NEGATIVE')),
  pool_dimension_schema jsonb not null default '{}'::jsonb,
  config jsonb not null default '{}'::jsonb,
  version integer not null default 1 check (version > 0),
  status text not null default 'ACTIVE'
    check (status in ('ACTIVE', 'RETIRED')),
  created_at timestamptz not null default now(),
  unique (enterprise_id, code, version)
);

create index if not exists ix_application_instance_enterprise
  on application_instance(enterprise_id);

create index if not exists ix_field_definition_version
  on field_definition(application_definition_version_id);

create index if not exists ix_command_definition_version
  on command_definition(application_definition_version_id);

create index if not exists ix_posting_rule_version_priority
  on posting_rule(application_definition_version_id, priority, code);

update evo_runtime_info
set db_schema_version = 2,
    updated_at = now()
where singleton = true;

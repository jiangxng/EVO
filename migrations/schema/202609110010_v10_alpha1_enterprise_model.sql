-- EVO v1.0.0-alpha.1
-- Enterprise model foundation, explicit lineage and replay digest semantics.

alter table command_execution add column if not exists lineage jsonb;

create table if not exists item_definition (
  id uuid primary key default uuidv7(),
  enterprise_id uuid not null references enterprise(id),
  code text not null,
  name text not null,
  item_type text not null check (item_type in ('MATERIAL','SEMI_FINISHED','FINISHED_GOOD','MERCHANDISE','CONSUMABLE','SERVICE','ASSET_ITEM')),
  track_inventory boolean not null default true,
  default_fulfillment_mode text check (default_fulfillment_mode in ('MAKE','BUY','STOCK','SERVICE')),
  base_unit text not null,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (enterprise_id, code)
);

create table if not exists capability_definition (
  id uuid primary key default uuidv7(),
  enterprise_id uuid references enterprise(id),
  code text not null,
  name text not null,
  description text,
  version integer not null default 1,
  status text not null default 'PUBLISHED' check (status in ('DRAFT','PUBLISHED','RETIRED')),
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  unique nulls not distinct (enterprise_id, code, version)
);

create table if not exists flow_definition (
  id uuid primary key default uuidv7(),
  enterprise_id uuid references enterprise(id),
  code text not null,
  name text not null,
  description text,
  version integer not null default 1,
  status text not null default 'PUBLISHED' check (status in ('DRAFT','PUBLISHED','RETIRED')),
  definition jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  unique nulls not distinct (enterprise_id, code, version)
);

create table if not exists flow_instance (
  id uuid primary key default uuidv7(),
  enterprise_id uuid not null references enterprise(id),
  flow_definition_id uuid not null references flow_definition(id),
  instance_key text not null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','COMPLETED','CANCELLED')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (enterprise_id, flow_definition_id, instance_key)
);

create table if not exists business_object_link (
  id uuid primary key default uuidv7(),
  enterprise_id uuid not null references enterprise(id),
  from_business_data_id uuid not null references business_data(id),
  to_business_data_id uuid not null references business_data(id),
  relation_type text not null check (relation_type in ('CAUSES','FULFILLS','ALLOCATES_TO','DERIVES_FROM','REFERENCES')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (enterprise_id, from_business_data_id, to_business_data_id, relation_type)
);

create table if not exists flow_trace (
  id uuid primary key default uuidv7(),
  enterprise_id uuid not null references enterprise(id),
  flow_definition_id uuid not null references flow_definition(id),
  flow_instance_id uuid not null references flow_instance(id),
  command_execution_id uuid not null references command_execution(id),
  business_data_id uuid not null references business_data(id),
  step_code text not null,
  correlation_id text not null,
  causation_id text,
  created_at timestamptz not null default now(),
  unique (flow_instance_id, business_data_id, step_code)
);

create index if not exists ix_flow_trace_enterprise_instance
  on flow_trace(enterprise_id, flow_instance_id, created_at);

create table if not exists metric_definition (
  id uuid primary key default uuidv7(),
  enterprise_id uuid references enterprise(id),
  code text not null,
  name text not null,
  description text,
  version integer not null default 1,
  status text not null default 'PUBLISHED' check (status in ('DRAFT','PUBLISHED','RETIRED')),
  value_type text not null default 'DECIMAL',
  definition jsonb not null default '{}'::jsonb,
  lineage jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  unique nulls not distinct (enterprise_id, code, version)
);

create table if not exists sop_definition (
  id uuid primary key default uuidv7(),
  enterprise_id uuid references enterprise(id),
  code text not null,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  unique nulls not distinct (enterprise_id, code)
);

create table if not exists sop_version (
  id uuid primary key default uuidv7(),
  sop_definition_id uuid not null references sop_definition(id),
  version integer not null,
  status text not null check (status in ('DRAFT','PUBLISHED','RETIRED')),
  summary text,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  unique (sop_definition_id, version)
);

create table if not exists sop_step (
  id uuid primary key default uuidv7(),
  sop_version_id uuid not null references sop_version(id) on delete cascade,
  step_no integer not null,
  code text not null,
  title text not null,
  instruction text not null,
  evidence_requirement jsonb not null default '{}'::jsonb,
  control jsonb not null default '{}'::jsonb,
  unique (sop_version_id, step_no),
  unique (sop_version_id, code)
);

alter table replay_run add column if not exists before_snapshot jsonb;
alter table replay_run add column if not exists validation_status text
  check (validation_status in ('MATCH','MISMATCH','NOT_VALIDATED'));

update evo_runtime_info
set architecture_baseline = 'EVO-v1.0.0-alpha.1',
    db_schema_version = 6,
    updated_at = now()
where singleton = true;

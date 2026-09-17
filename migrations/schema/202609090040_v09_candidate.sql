-- EVO v0.9 Production Candidate
-- Workflow, replay, cost, feature flag, permission and validation runtime.

create table if not exists permission_grant (
  id uuid primary key default uuidv7(),
  enterprise_id uuid not null references enterprise(id),
  actor_type text not null
    check (actor_type in ('HUMAN','AI','AUTOMATION','EXTERNAL_SYSTEM')),
  actor_id text not null,
  permission_code text not null,
  resource_scope jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (enterprise_id, actor_type, actor_id, permission_code)
);

create table if not exists feature_flag (
  id uuid primary key default uuidv7(),
  code text not null,
  enterprise_id uuid references enterprise(id),
  enabled boolean not null default false,
  config jsonb not null default '{}'::jsonb,
  owner text not null,
  introduced_in text not null,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (code, enterprise_id)
);

create table if not exists work_item (
  id uuid primary key default uuidv7(),
  enterprise_id uuid not null references enterprise(id),
  work_type text not null,
  title text not null,
  status text not null default 'OPEN'
    check (status in ('OPEN','IN_PROGRESS','DONE','CANCELLED')),
  priority integer not null default 0,
  source_ledger_code text not null,
  source_dimension_hash char(64) not null,
  source_dimensions jsonb not null default '{}'::jsonb,
  source_quantity numeric(38,12) not null default 0,
  source_amount numeric(38,12) not null default 0,
  assigned_actor_type text,
  assigned_actor_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (enterprise_id, work_type, source_ledger_code, source_dimension_hash)
);

create index if not exists ix_work_item_open
  on work_item(enterprise_id, status, priority desc, created_at)
  where status in ('OPEN','IN_PROGRESS');

create table if not exists replay_run (
  id uuid primary key default uuidv7(),
  enterprise_id uuid not null references enterprise(id),
  consistency_domain text not null default 'enterprise',
  mode text not null default 'FULL'
    check (mode in ('FULL')),
  status text not null
    check (status in ('PREPARING','REBUILDING','VALIDATING','COMPLETED','FAILED')),
  boundary_sequence bigint,
  before_digest text,
  after_digest text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  error jsonb
);

create table if not exists cost_run (
  id uuid primary key default uuidv7(),
  enterprise_id uuid not null references enterprise(id),
  method text not null
    check (method in ('FIFO','LIFO','MOVING_AVERAGE','SPECIFIC_IDENTIFICATION')),
  status text not null
    check (status in ('PROCESSING','COMPLETED','FAILED')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  error jsonb
);

create table if not exists cost_result (
  id uuid primary key default uuidv7(),
  enterprise_id uuid not null references enterprise(id),
  cost_run_id uuid not null references cost_run(id) on delete cascade,
  business_data_id uuid not null references business_data(id),
  pool_key text not null,
  method text not null,
  quantity numeric(38,12) not null,
  unit_cost numeric(38,12),
  total_cost numeric(38,12),
  created_at timestamptz not null default now(),
  unique (cost_run_id, business_data_id)
);

create index if not exists ix_cost_result_business
  on cost_result(enterprise_id, business_data_id);

update evo_runtime_info
set architecture_baseline = 'EVO-v0.9',
    db_schema_version = 5,
    updated_at = now()
where singleton = true;

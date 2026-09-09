-- EVO M2 — Command + BusinessData
-- Command transaction:
-- CommandExecution + BusinessData + PostingInput + Outbox are committed atomically.

create table if not exists command_execution (
  id uuid primary key default uuidv7(),
  enterprise_id uuid not null references enterprise(id),
  application_instance_id uuid not null references application_instance(id),
  command_definition_id uuid not null references command_definition(id),
  actor_type text not null
    check (actor_type in ('HUMAN', 'AI', 'AUTOMATION', 'EXTERNAL_SYSTEM')),
  actor_id text not null,
  request_id text not null,
  correlation_id text not null,
  causation_id text,
  idempotency_scope text not null,
  idempotency_key text not null,
  input jsonb not null,
  status text not null
    check (status in ('RECEIVED', 'PENDING_APPROVAL', 'PROCESSING', 'COMPLETED', 'REJECTED', 'FAILED')),
  result jsonb,
  error jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (enterprise_id, idempotency_scope, idempotency_key)
);

create table if not exists business_data (
  id uuid primary key default uuidv7(),
  enterprise_id uuid not null references enterprise(id),
  application_instance_id uuid not null references application_instance(id),
  command_execution_id uuid not null references command_execution(id),
  business_data_type text not null,
  business_object_key text not null,
  business_object_version bigint not null check (business_object_version > 0),
  effective_at timestamptz not null,
  metadata_version integer not null check (metadata_version > 0),
  payload jsonb not null,
  created_at timestamptz not null default now(),
  unique (enterprise_id, application_instance_id, business_object_key, business_object_version)
);

create index if not exists ix_business_data_enterprise_effective
  on business_data(enterprise_id, effective_at, id);

create index if not exists ix_business_data_object_history
  on business_data(enterprise_id, application_instance_id, business_object_key, business_object_version);

create table if not exists enterprise_runtime_state (
  enterprise_id uuid primary key references enterprise(id),
  consistency_domain text not null default 'enterprise',
  posting_mode text not null default 'NORMAL'
    check (posting_mode in ('NORMAL', 'REPLAYING', 'FAILED')),
  replay_required boolean not null default false,
  next_posting_sequence bigint not null default 1 check (next_posting_sequence > 0),
  last_posted_effective_at timestamptz,
  last_posted_priority integer,
  last_posted_sequence bigint,
  active_replay_run_id uuid,
  updated_at timestamptz not null default now()
);

create table if not exists posting_input (
  id uuid primary key default uuidv7(),
  enterprise_id uuid not null references enterprise(id),
  consistency_domain text not null default 'enterprise',
  business_data_id uuid not null unique references business_data(id),
  application_instance_id uuid not null references application_instance(id),
  effective_at timestamptz not null,
  posting_priority integer not null default 0,
  posting_sequence bigint not null check (posting_sequence > 0),
  metadata_version integer not null check (metadata_version > 0),
  status text not null
    check (status in ('QUEUED', 'BLOCKED_REPLAY_REQUIRED', 'PROCESSING', 'POSTED', 'FAILED')),
  retroactive boolean not null default false,
  created_at timestamptz not null default now(),
  posted_at timestamptz,
  unique (enterprise_id, consistency_domain, posting_sequence)
);

create index if not exists ix_posting_input_queue
  on posting_input(
    enterprise_id,
    consistency_domain,
    status,
    effective_at,
    posting_priority,
    posting_sequence
  );

create table if not exists outbox_event (
  id uuid primary key default uuidv7(),
  enterprise_id uuid not null references enterprise(id),
  event_type text not null,
  event_version integer not null default 1 check (event_version > 0),
  aggregate_type text not null,
  aggregate_id uuid not null,
  correlation_id text not null,
  causation_id text,
  payload jsonb not null,
  status text not null default 'PENDING'
    check (status in ('PENDING', 'PUBLISHED', 'FAILED')),
  attempts integer not null default 0 check (attempts >= 0),
  available_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  published_at timestamptz
);

create index if not exists ix_outbox_pending
  on outbox_event(status, available_at, created_at)
  where status in ('PENDING', 'FAILED');

update evo_runtime_info
set db_schema_version = 3,
    updated_at = now()
where singleton = true;

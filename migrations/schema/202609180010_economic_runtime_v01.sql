-- EVO Economic Runtime v0.1 — additive persistence
-- Architecture: docs/architecture/decisions/2026-09-18-economic-runtime-architecture-freeze-v0.1.md
--
-- This migration does not replace BusinessData, ledger, cost, valuation or replay tables.
-- It adds persistence for explicit allocation intent, allocation results, governed rate
-- datasets, calculation dependency lineage and replay checkpoints.

create table if not exists allocation_policy (
  id uuid primary key default uuidv7(),
  enterprise_id uuid references enterprise(id),
  code text not null,
  name text not null,
  version integer not null check (version > 0),
  status text not null default 'DRAFT'
    check (status in ('DRAFT','PUBLISHED','RETIRED')),
  dimensions jsonb not null default '[]'::jsonb,
  eligibility jsonb not null default '{}'::jsonb,
  source_ordering text not null
    check (source_ordering in ('OLDEST_FIRST','NEWEST_FIRST','EXPLICIT_ONLY','POLICY_DEFINED')),
  allow_partial_allocation boolean not null default true,
  negative_position_policy text not null
    check (negative_position_policy in ('REJECT','ALLOW_PROVISIONAL','DEFER_VALUATION','POLICY_DEFINED')),
  precision_policy jsonb not null default '{}'::jsonb,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  unique nulls not distinct (enterprise_id, code, version),
  unique (id, version)
);

create index if not exists ix_allocation_policy_lookup
  on allocation_policy(enterprise_id, code, status, version desc);

create table if not exists allocation_instruction (
  id uuid primary key default uuidv7(),
  enterprise_id uuid not null references enterprise(id),
  consumer_business_data_id uuid not null references business_data(id),
  mode text not null
    check (mode in ('EXPLICIT','AUTOMATIC','EXPLICIT_THEN_AUTOMATIC')),
  source_selector jsonb not null,
  actor_type text not null
    check (actor_type in ('HUMAN','AI','AUTOMATION','EXTERNAL_SYSTEM')),
  actor_id text not null,
  effective_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  reason text,
  allocation_policy_id uuid not null,
  allocation_policy_version integer not null check (allocation_policy_version > 0),
  supersedes_instruction_id uuid references allocation_instruction(id),
  idempotency_key text not null,
  metadata jsonb not null default '{}'::jsonb,
  foreign key (allocation_policy_id, allocation_policy_version)
    references allocation_policy(id, version),
  unique (enterprise_id, consumer_business_data_id, idempotency_key)
);

create index if not exists ix_allocation_instruction_consumer
  on allocation_instruction(enterprise_id, consumer_business_data_id, effective_at, id);

create index if not exists ix_allocation_instruction_supersedes
  on allocation_instruction(supersedes_instruction_id)
  where supersedes_instruction_id is not null;

create table if not exists allocation_run (
  id uuid primary key default uuidv7(),
  enterprise_id uuid not null references enterprise(id),
  allocation_policy_id uuid not null,
  allocation_policy_version integer not null check (allocation_policy_version > 0),
  input_digest char(64) not null,
  status text not null
    check (status in ('PROCESSING','COMPLETED','FAILED')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  error jsonb,
  foreign key (allocation_policy_id, allocation_policy_version)
    references allocation_policy(id, version)
);

create index if not exists ix_allocation_run_enterprise
  on allocation_run(enterprise_id, started_at desc);

create table if not exists allocation_relation (
  id uuid primary key default uuidv7(),
  enterprise_id uuid not null references enterprise(id),
  allocation_run_id uuid not null references allocation_run(id) on delete cascade,
  source_business_data_id uuid references business_data(id),
  source_position_key text,
  consumer_business_data_id uuid not null references business_data(id),
  measurements jsonb not null default '[]'::jsonb,
  allocation_sequence integer not null check (allocation_sequence > 0),
  instruction_id uuid references allocation_instruction(id),
  allocation_policy_id uuid not null,
  allocation_policy_version integer not null check (allocation_policy_version > 0),
  lineage jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (allocation_policy_id, allocation_policy_version)
    references allocation_policy(id, version),
  check (source_business_data_id is not null or source_position_key is not null),
  unique (allocation_run_id, consumer_business_data_id, allocation_sequence)
);

create index if not exists ix_allocation_relation_source_business
  on allocation_relation(enterprise_id, source_business_data_id)
  where source_business_data_id is not null;

create index if not exists ix_allocation_relation_consumer
  on allocation_relation(enterprise_id, consumer_business_data_id);

create index if not exists ix_allocation_relation_instruction
  on allocation_relation(instruction_id)
  where instruction_id is not null;

create table if not exists rate_dataset (
  id uuid primary key default uuidv7(),
  enterprise_id uuid references enterprise(id),
  code text not null,
  version integer not null check (version > 0),
  status text not null default 'DRAFT'
    check (status in ('DRAFT','PUBLISHED','RETIRED')),
  provider text not null,
  semantic_digest char(64) not null,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  unique nulls not distinct (enterprise_id, code, version),
  unique (id, version)
);

create index if not exists ix_rate_dataset_lookup
  on rate_dataset(enterprise_id, code, status, version desc);

create table if not exists rate_observation (
  id uuid primary key default uuidv7(),
  enterprise_id uuid references enterprise(id),
  rate_dataset_id uuid not null,
  rate_dataset_version integer not null check (rate_dataset_version > 0),
  role text not null
    check (role in ('TRANSACTION_RECOGNITION','SETTLEMENT','PERIOD_END_VALUATION','REPORTING_CONVERSION')),
  source_unit text not null,
  target_unit text not null,
  convention text not null default 'TARGET_PER_SOURCE'
    check (convention in ('TARGET_PER_SOURCE')),
  rate numeric(38,18) not null check (rate > 0),
  effective_at timestamptz not null,
  provider text not null,
  precision integer not null check (precision >= 0 and precision <= 18),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (rate_dataset_id, rate_dataset_version)
    references rate_dataset(id, version),
  unique (
    rate_dataset_id,
    role,
    source_unit,
    target_unit,
    effective_at
  )
);

create index if not exists ix_rate_observation_lookup
  on rate_observation(
    rate_dataset_id,
    role,
    source_unit,
    target_unit,
    effective_at
  );

create table if not exists calculation_dependency_edge (
  id uuid primary key default uuidv7(),
  enterprise_id uuid not null references enterprise(id),
  graph_version text not null,
  from_kind text not null,
  from_id text not null,
  to_kind text not null,
  to_id text not null,
  edge_kind text not null
    check (edge_kind in ('ALLOCATION','VALUATION','PROJECTION','MATERIALIZATION','CALCULATION')),
  effective_from timestamptz,
  lineage jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (
    enterprise_id,
    graph_version,
    from_kind,
    from_id,
    to_kind,
    to_id,
    edge_kind
  )
);

create index if not exists ix_calculation_dependency_from
  on calculation_dependency_edge(enterprise_id, graph_version, from_kind, from_id);

create index if not exists ix_calculation_dependency_to
  on calculation_dependency_edge(enterprise_id, graph_version, to_kind, to_id);

create table if not exists replay_checkpoint (
  id uuid primary key default uuidv7(),
  enterprise_id uuid not null references enterprise(id),
  consistency_domain text not null default 'enterprise',
  boundary_sequence bigint not null check (boundary_sequence >= 0),
  ordered_input_digest char(64) not null,
  last_included_business_data_id uuid references business_data(id),
  template_version text not null,
  posting_policy_pins jsonb not null default '{}'::jsonb,
  allocation_policy_pins jsonb not null default '{}'::jsonb,
  valuation_policy_pins jsonb not null default '{}'::jsonb,
  reference_dataset_pins jsonb not null default '{}'::jsonb,
  runtime_semantic_version text not null,
  dependency_graph_version text not null,
  materialization_digest char(64) not null,
  validity jsonb not null default '{}'::jsonb,
  status text not null default 'ACTIVE'
    check (status in ('ACTIVE','INVALIDATED','ARCHIVED')),
  parent_checkpoint_id uuid references replay_checkpoint(id),
  invalidated_at timestamptz,
  invalidation_reason text,
  created_at timestamptz not null default now()
);

create index if not exists ix_replay_checkpoint_boundary
  on replay_checkpoint(
    enterprise_id,
    consistency_domain,
    status,
    boundary_sequence desc,
    created_at desc
  );

create index if not exists ix_replay_checkpoint_parent
  on replay_checkpoint(parent_checkpoint_id)
  where parent_checkpoint_id is not null;

update evo_runtime_info
set db_schema_version = 8,
    updated_at = now()
where singleton = true;

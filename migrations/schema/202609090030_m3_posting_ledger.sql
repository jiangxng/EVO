-- EVO M3 — Posting + Ledger

create table if not exists ledger_dataset (
  id uuid primary key default uuidv7(),
  enterprise_id uuid not null references enterprise(id),
  consistency_domain text not null default 'enterprise',
  kind text not null default 'CURRENT'
    check (kind in ('CURRENT', 'CANDIDATE', 'ARCHIVED')),
  status text not null default 'ACTIVE'
    check (status in ('BUILDING', 'ACTIVE', 'FAILED', 'ARCHIVED')),
  posting_boundary_sequence bigint,
  created_at timestamptz not null default now(),
  activated_at timestamptz
);

create unique index if not exists uq_ledger_dataset_active
  on ledger_dataset(enterprise_id, consistency_domain)
  where status = 'ACTIVE';

create table if not exists posting_run (
  id uuid primary key default uuidv7(),
  enterprise_id uuid not null references enterprise(id),
  consistency_domain text not null,
  posting_input_id uuid not null references posting_input(id),
  mode text not null default 'NORMAL'
    check (mode in ('NORMAL', 'REPLAY')),
  metadata_version integer not null,
  status text not null
    check (status in ('PROCESSING', 'COMPLETED', 'FAILED')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  error jsonb
);

create index if not exists ix_posting_run_input
  on posting_run(posting_input_id, started_at desc);

create table if not exists ledger_entry (
  id uuid primary key default uuidv7(),
  enterprise_id uuid not null references enterprise(id),
  consistency_domain text not null,
  ledger_dataset_id uuid not null references ledger_dataset(id),
  ledger_definition_id uuid not null references ledger_definition(id),
  posting_run_id uuid not null references posting_run(id),
  posting_input_id uuid not null references posting_input(id),
  business_data_id uuid not null references business_data(id),
  posting_rule_id uuid not null references posting_rule(id),
  posting_rule_schema_version integer not null,
  effect_index integer not null default 0 check (effect_index >= 0),
  quantity numeric(38,12),
  amount numeric(38,12),
  unit text,
  currency text,
  dimensions jsonb not null default '{}'::jsonb,
  dimension_hash char(64) not null,
  effective_at timestamptz not null,
  posting_priority integer not null,
  posting_sequence bigint not null,
  created_at timestamptz not null default now(),
  unique (ledger_dataset_id, posting_input_id, posting_rule_id, effect_index)
);

create index if not exists ix_ledger_entry_order
  on ledger_entry(
    enterprise_id,
    consistency_domain,
    effective_at,
    posting_priority,
    posting_sequence
  );

create index if not exists ix_ledger_entry_balance_key
  on ledger_entry(
    ledger_dataset_id,
    ledger_definition_id,
    dimension_hash
  );

create table if not exists ledger_balance (
  enterprise_id uuid not null references enterprise(id),
  consistency_domain text not null,
  ledger_dataset_id uuid not null references ledger_dataset(id),
  ledger_definition_id uuid not null references ledger_definition(id),
  dimension_hash char(64) not null,
  dimensions jsonb not null,
  quantity numeric(38,12) not null default 0,
  amount numeric(38,12) not null default 0,
  last_effective_at timestamptz not null,
  last_posting_priority integer not null,
  last_posting_sequence bigint not null,
  updated_at timestamptz not null default now(),
  primary key (
    ledger_dataset_id,
    ledger_definition_id,
    dimension_hash
  )
);

create index if not exists ix_ledger_balance_enterprise
  on ledger_balance(enterprise_id, consistency_domain, ledger_definition_id);

create table if not exists posting_failure (
  id uuid primary key default uuidv7(),
  enterprise_id uuid not null references enterprise(id),
  posting_input_id uuid not null references posting_input(id),
  error_code text not null,
  error_message text not null,
  error_context jsonb not null default '{}'::jsonb,
  retryable boolean not null default false,
  created_at timestamptz not null default now()
);

update evo_runtime_info
set db_schema_version = 4,
    updated_at = now()
where singleton = true;

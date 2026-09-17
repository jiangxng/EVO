-- EVO v1.0.0-alpha.2 — Accounting Dimensions + Valuation Posting

create table if not exists dimension_definition (
  id uuid primary key default uuidv7(),
  enterprise_id uuid references enterprise(id),
  code text not null,
  name text not null,
  data_type text not null default 'TEXT',
  version integer not null default 1 check (version > 0),
  status text not null default 'PUBLISHED'
    check (status in ('DRAFT','PUBLISHED','RETIRED')),
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  unique nulls not distinct (enterprise_id, code, version)
);

create index if not exists ix_dimension_definition_lookup
  on dimension_definition(code, status, version desc);

create table if not exists valuation_rule (
  id uuid primary key default uuidv7(),
  enterprise_id uuid references enterprise(id),
  code text not null,
  name text not null,
  source_business_data_type text not null,
  inventory_ledger_code text not null,
  cogs_ledger_code text not null,
  dimension_mapping jsonb not null default '{}'::jsonb,
  version integer not null check (version > 0),
  status text not null default 'PUBLISHED'
    check (status in ('DRAFT','PUBLISHED','RETIRED')),
  created_at timestamptz not null default now(),
  published_at timestamptz,
  unique nulls not distinct (enterprise_id, code, version)
);

alter table cost_run
  add column if not exists valuation_policy_id uuid references valuation_policy(id),
  add column if not exists valuation_policy_version integer,
  add column if not exists cost_engine_version text not null default '1';


alter table cost_result
  add column if not exists valuation_rule_id uuid references valuation_rule(id),
  add column if not exists valuation_rule_version integer;

create table if not exists valuation_posting_run (
  id uuid primary key default uuidv7(),
  enterprise_id uuid not null references enterprise(id),
  cost_run_id uuid not null references cost_run(id) on delete cascade,
  cost_result_id uuid not null references cost_result(id) on delete cascade,
  business_data_id uuid not null references business_data(id),
  valuation_rule_id uuid not null references valuation_rule(id),
  valuation_rule_version integer not null,
  previous_total_cost numeric(38,12) not null default 0,
  target_total_cost numeric(38,12) not null,
  delta_total_cost numeric(38,12) not null,
  status text not null check (status in ('PROCESSING','COMPLETED','FAILED','NO_CHANGE')),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  error jsonb,
  unique (cost_result_id, valuation_rule_id)
);

create table if not exists valuation_position (
  enterprise_id uuid not null references enterprise(id),
  business_data_id uuid not null references business_data(id),
  valuation_rule_id uuid not null references valuation_rule(id),
  valuation_rule_version integer not null,
  total_cost numeric(38,12) not null,
  last_cost_result_id uuid not null references cost_result(id),
  updated_at timestamptz not null default now(),
  primary key (enterprise_id, business_data_id, valuation_rule_id)
);

alter table ledger_entry
  alter column posting_run_id drop not null,
  alter column posting_input_id drop not null,
  alter column posting_rule_id drop not null,
  add column if not exists entry_source_kind text not null default 'POSTING'
    check (entry_source_kind in ('POSTING','VALUATION')),
  add column if not exists valuation_posting_run_id uuid references valuation_posting_run(id),
  add column if not exists cost_result_id uuid references cost_result(id),
  add column if not exists valuation_rule_id uuid references valuation_rule(id),
  add column if not exists valuation_rule_version integer;

create unique index if not exists uq_ledger_entry_valuation_effect
  on ledger_entry(ledger_dataset_id, valuation_posting_run_id, effect_index)
  where entry_source_kind = 'VALUATION';

create index if not exists ix_ledger_entry_cost_result
  on ledger_entry(cost_result_id)
  where cost_result_id is not null;


alter table replay_run
  add column if not exists cost_method text,
  add column if not exists valuation_policy_id uuid references valuation_policy(id),
  add column if not exists valuation_policy_version integer,
  add column if not exists valuation_rule_pins jsonb not null default '{}'::jsonb;

update evo_runtime_info
set architecture_baseline = 'EVO-v1.0.0-alpha.2',
    db_schema_version = 7,
    updated_at = now()
where singleton = true;

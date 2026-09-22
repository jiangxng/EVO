-- EVO Financial Accounting Integrity FAI-03..05
-- Accounting recognition rules, execution trace, Trial Balance support, and GL replay evidence.

create table accounting_rule (
  id uuid primary key default uuidv7(),
  enterprise_id uuid not null references enterprise(id),
  accounting_book_id uuid not null references accounting_book(id),
  code text not null,
  name text not null,
  source_business_data_type text not null,
  priority integer not null default 100,
  condition_ast jsonb not null default '{"type":"literal","value":true}'::jsonb,
  effect_ast jsonb not null,
  version integer not null,
  status text not null check (status in ('DRAFT','PUBLISHED','RETIRED')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (enterprise_id, accounting_book_id, code, version)
);

create index ix_accounting_rule_source
  on accounting_rule(enterprise_id, accounting_book_id, source_business_data_type, status, priority, version);

create table accounting_rule_execution (
  id uuid primary key default uuidv7(),
  enterprise_id uuid not null references enterprise(id),
  accounting_book_id uuid not null references accounting_book(id),
  accounting_rule_id uuid not null references accounting_rule(id),
  accounting_rule_version integer not null,
  business_data_id uuid not null references business_data(id),
  matched boolean not null,
  condition_trace jsonb not null default '{}'::jsonb,
  generated_effects jsonb not null default '[]'::jsonb,
  journal_id uuid references accounting_journal(id),
  status text not null check (status in ('NOT_MATCHED','POSTED','REJECTED')),
  error_code text,
  created_at timestamptz not null default now(),
  unique (accounting_rule_id, business_data_id)
);

create index ix_accounting_rule_execution_source
  on accounting_rule_execution(enterprise_id, accounting_book_id, business_data_id, created_at);

create table accounting_replay_run (
  id uuid primary key default uuidv7(),
  enterprise_id uuid not null references enterprise(id),
  accounting_book_id uuid not null references accounting_book(id),
  status text not null check (status in ('PREPARING','REBUILDING','VALIDATING','COMPLETED','FAILED')),
  before_digest char(64),
  after_digest char(64),
  validation_status text check (validation_status in ('MATCH','MISMATCH','NOT_VALIDATED')),
  journal_count_before integer not null default 0,
  journal_count_after integer not null default 0,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  error jsonb
);

update evo_runtime_info
set db_schema_version = 24,
    updated_at = now()
where singleton = true;

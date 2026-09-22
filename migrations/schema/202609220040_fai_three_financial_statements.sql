-- EVO Financial Accounting Integrity FAI-07
-- Three core financial statement projections, deterministic report replay, and cross-statement reconciliation.

alter table accounting_account
  add column is_cash_equivalent boolean not null default false;

alter table statement_line_definition
  add column semantic_role text;

alter table statement_line_definition
  drop constraint statement_line_definition_value_semantics_check;

alter table statement_line_definition
  add constraint statement_line_definition_value_semantics_check
  check (value_semantics in ('OPENING_BALANCE','ENDING_BALANCE','PERIOD_MOVEMENT','CASH_FLOW'));

create table statement_projection_run (
  id uuid primary key default uuidv7(),
  enterprise_id uuid not null references enterprise(id),
  accounting_book_id uuid not null references accounting_book(id),
  accounting_period_id uuid not null references accounting_period(id),
  statement_definition_id uuid not null references statement_definition(id),
  status text not null check (status in ('PROCESSING','COMPLETED','FAILED')),
  semantic_digest char(64),
  error jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create index ix_statement_projection_lookup
  on statement_projection_run(accounting_book_id, accounting_period_id, statement_definition_id, started_at desc);

create table statement_projection_line (
  statement_projection_run_id uuid not null references statement_projection_run(id) on delete cascade,
  statement_line_code text not null,
  amount numeric(38,12) not null,
  components jsonb not null default '[]'::jsonb,
  primary key (statement_projection_run_id, statement_line_code)
);

create table statement_replay_run (
  id uuid primary key default uuidv7(),
  enterprise_id uuid not null references enterprise(id),
  accounting_book_id uuid not null references accounting_book(id),
  accounting_period_id uuid not null references accounting_period(id),
  statement_definition_id uuid not null references statement_definition(id),
  before_projection_run_id uuid not null references statement_projection_run(id),
  after_projection_run_id uuid not null references statement_projection_run(id),
  before_digest char(64) not null,
  after_digest char(64) not null,
  validation_status text not null check (validation_status in ('MATCH','MISMATCH')),
  created_at timestamptz not null default now()
);

create table financial_statement_reconciliation_run (
  id uuid primary key default uuidv7(),
  enterprise_id uuid not null references enterprise(id),
  accounting_book_id uuid not null references accounting_book(id),
  accounting_period_id uuid not null references accounting_period(id),
  balance_sheet_projection_run_id uuid not null references statement_projection_run(id),
  income_statement_projection_run_id uuid not null references statement_projection_run(id),
  cash_flow_projection_run_id uuid not null references statement_projection_run(id),
  status text not null check (status in ('MATCH','MISMATCH')),
  results jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

update evo_runtime_info
set db_schema_version = 26,
    updated_at = now()
where singleton = true;

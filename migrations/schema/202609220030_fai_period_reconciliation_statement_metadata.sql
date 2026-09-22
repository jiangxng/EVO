-- EVO Financial Accounting Integrity FAI-06
-- Accounting period governance, GL/economic reconciliation, and financial-statement projection metadata.

create table accounting_period (
  id uuid primary key default uuidv7(),
  enterprise_id uuid not null references enterprise(id),
  accounting_book_id uuid not null references accounting_book(id),
  fiscal_year integer not null,
  period_no integer not null check (period_no between 1 and 99),
  code text not null,
  name text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'OPEN' check (status in ('OPEN','CLOSED')),
  closed_at timestamptz,
  closed_by text,
  close_reason text,
  created_at timestamptz not null default now(),
  unique (accounting_book_id, fiscal_year, period_no),
  unique (accounting_book_id, code),
  check (ends_at > starts_at)
);

create index ix_accounting_period_effective
  on accounting_period(accounting_book_id, starts_at, ends_at, status);

create table account_reconciliation_rule (
  id uuid primary key default uuidv7(),
  enterprise_id uuid not null references enterprise(id),
  accounting_book_id uuid not null references accounting_book(id),
  code text not null,
  name text not null,
  source_ledger_code text not null,
  source_measure text not null check (source_measure in ('AMOUNT')),
  source_multiplier numeric(18,6) not null default 1,
  target_account_code text not null,
  target_basis text not null check (target_basis in ('NET_DEBIT','NET_CREDIT')),
  tolerance numeric(38,12) not null default 0,
  version integer not null,
  status text not null check (status in ('DRAFT','PUBLISHED','RETIRED')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (enterprise_id, accounting_book_id, code, version),
  foreign key (statement_definition_id, statement_line_code)
    references statement_line_definition(statement_definition_id, code)
);

create table account_reconciliation_run (
  id uuid primary key default uuidv7(),
  enterprise_id uuid not null references enterprise(id),
  accounting_book_id uuid not null references accounting_book(id),
  accounting_period_id uuid references accounting_period(id),
  status text not null check (status in ('MATCH','MISMATCH')),
  checked_rule_count integer not null,
  mismatch_count integer not null,
  results jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table statement_definition (
  id uuid primary key default uuidv7(),
  enterprise_id uuid not null references enterprise(id),
  accounting_book_id uuid not null references accounting_book(id),
  code text not null,
  name text not null,
  statement_type text not null check (statement_type in ('BALANCE_SHEET','INCOME_STATEMENT','CASH_FLOW_STATEMENT')),
  version integer not null,
  status text not null check (status in ('DRAFT','PUBLISHED','RETIRED')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (enterprise_id, accounting_book_id, code, version)
);

create table statement_line_definition (
  id uuid primary key default uuidv7(),
  statement_definition_id uuid not null references statement_definition(id),
  code text not null,
  name text not null,
  parent_code text,
  sort_order integer not null default 0,
  indent integer not null default 0 check (indent >= 0),
  aggregation_type text not null check (aggregation_type in ('ACCOUNT_MAPPING','SUM_CHILDREN','CASH_FLOW_CLASSIFICATION')),
  value_semantics text not null check (value_semantics in ('ENDING_BALANCE','PERIOD_MOVEMENT','CASH_FLOW')),
  presentation_sign numeric(18,6) not null default 1,
  is_total boolean not null default false,
  created_at timestamptz not null default now(),
  unique (statement_definition_id, code)
);

create table account_statement_mapping (
  id uuid primary key default uuidv7(),
  statement_definition_id uuid not null references statement_definition(id),
  statement_line_code text not null,
  accounting_account_code text not null,
  balance_basis text not null check (balance_basis in ('NET_DEBIT','NET_CREDIT','MOVEMENT_DEBIT','MOVEMENT_CREDIT','MOVEMENT_NET_DEBIT','MOVEMENT_NET_CREDIT')),
  multiplier numeric(18,6) not null default 1,
  created_at timestamptz not null default now(),
  unique (statement_definition_id, statement_line_code, accounting_account_code, balance_basis),
  foreign key (statement_definition_id, statement_line_code)
    references statement_line_definition(statement_definition_id, code)
);

create table cash_flow_classification_rule (
  id uuid primary key default uuidv7(),
  enterprise_id uuid not null references enterprise(id),
  accounting_book_id uuid not null references accounting_book(id),
  statement_definition_id uuid not null references statement_definition(id),
  code text not null,
  name text not null,
  source_business_data_type text not null,
  condition_ast jsonb not null default '{"type":"literal","value":true}'::jsonb,
  cash_flow_category text not null check (cash_flow_category in ('OPERATING','INVESTING','FINANCING')),
  statement_line_code text not null,
  direction text not null check (direction in ('INFLOW','OUTFLOW')),
  priority integer not null default 100,
  version integer not null,
  status text not null check (status in ('DRAFT','PUBLISHED','RETIRED')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (enterprise_id, accounting_book_id, code, version)
);

update evo_runtime_info
set db_schema_version = 25,
    updated_at = now()
where singleton = true;

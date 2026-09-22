-- EVO Financial Accounting Integrity FAI-01/02
-- Authoritative accounting book, chart of accounts, journal, journal lines,
-- and durable rejection diagnostics for strict double-entry integrity.

create table accounting_book (
  id uuid primary key default uuidv7(),
  enterprise_id uuid not null references enterprise(id),
  code text not null,
  name text not null,
  accounting_currency text not null,
  amount_scale integer not null default 2 check (amount_scale between 0 and 12),
  status text not null default 'ACTIVE' check (status in ('ACTIVE','CLOSED','ARCHIVED')),
  created_at timestamptz not null default now(),
  unique (enterprise_id, code)
);

create table accounting_account (
  id uuid primary key default uuidv7(),
  accounting_book_id uuid not null references accounting_book(id),
  code text not null,
  name text not null,
  account_type text not null check (account_type in ('ASSET','LIABILITY','EQUITY','REVENUE','EXPENSE')),
  normal_side text not null check (normal_side in ('DEBIT','CREDIT')),
  status text not null default 'ACTIVE' check (status in ('ACTIVE','DISABLED','ARCHIVED')),
  created_at timestamptz not null default now(),
  unique (accounting_book_id, code)
);

create table accounting_journal (
  id uuid primary key default uuidv7(),
  enterprise_id uuid not null references enterprise(id),
  accounting_book_id uuid not null references accounting_book(id),
  journal_no text not null,
  effective_at timestamptz not null,
  accounting_currency text not null,
  source_business_data_id uuid references business_data(id),
  accounting_rule_code text,
  accounting_rule_version integer,
  debit_total numeric(38,12) not null check (debit_total >= 0),
  credit_total numeric(38,12) not null check (credit_total >= 0),
  status text not null check (status in ('POSTED')),
  created_at timestamptz not null default now(),
  unique (accounting_book_id, journal_no),
  check (debit_total = credit_total),
  check (debit_total > 0)
);

create table accounting_journal_line (
  id uuid primary key default uuidv7(),
  journal_id uuid not null references accounting_journal(id) on delete restrict,
  line_no integer not null check (line_no > 0),
  accounting_account_id uuid not null references accounting_account(id),
  side text not null check (side in ('DEBIT','CREDIT')),
  amount numeric(38,12) not null check (amount > 0),
  currency text not null,
  dimensions jsonb not null default '{}'::jsonb,
  memo text,
  created_at timestamptz not null default now(),
  unique (journal_id, line_no)
);

create index ix_accounting_journal_source
  on accounting_journal(enterprise_id, source_business_data_id, effective_at);

create index ix_accounting_journal_line_account
  on accounting_journal_line(accounting_account_id, journal_id);

create table accounting_journal_diagnostic (
  id uuid primary key default uuidv7(),
  enterprise_id uuid not null references enterprise(id),
  accounting_book_id uuid references accounting_book(id),
  source_business_data_id uuid references business_data(id),
  journal_no text,
  accounting_rule_code text,
  accounting_rule_version integer,
  failure_code text not null,
  debit_total numeric(38,12) not null default 0,
  credit_total numeric(38,12) not null default 0,
  difference numeric(38,12) not null default 0,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index ix_accounting_journal_diagnostic_lookup
  on accounting_journal_diagnostic(
    enterprise_id,
    accounting_rule_code,
    failure_code,
    created_at desc
  );

update evo_runtime_info
set db_schema_version = 23,
    updated_at = now()
where singleton = true;

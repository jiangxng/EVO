-- EVO Economic Runtime v0.1 — generic valuation run/result persistence
-- Supports derived valuation interpretations such as FX period-end revaluation.
-- Valuation results are rebuildable derived state, not canonical BusinessData.

create table if not exists valuation_run (
  id uuid primary key default uuidv7(),
  enterprise_id uuid not null references enterprise(id),
  valuation_kind text not null,
  effective_at timestamptz not null,
  input_digest char(64) not null,
  rate_dataset_id uuid,
  rate_dataset_version integer,
  rate_dataset_digest char(64),
  policy jsonb not null default '{}'::jsonb,
  status text not null
    check (status in ('PROCESSING','COMPLETED','FAILED')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  error jsonb,
  foreign key (rate_dataset_id, rate_dataset_version)
    references rate_dataset(id, version),
  check (
    (rate_dataset_id is null and rate_dataset_version is null and rate_dataset_digest is null)
    or
    (rate_dataset_id is not null and rate_dataset_version is not null and rate_dataset_digest is not null)
  )
);

create index if not exists ix_valuation_run_enterprise
  on valuation_run(enterprise_id, valuation_kind, effective_at, started_at desc);

create table if not exists valuation_result (
  id uuid primary key default uuidv7(),
  enterprise_id uuid not null references enterprise(id),
  valuation_run_id uuid not null references valuation_run(id) on delete cascade,
  result_kind text not null,
  position_key text not null,
  source_business_data_ids jsonb not null default '[]'::jsonb,
  dimensions jsonb not null default '{}'::jsonb,
  source_measurements jsonb not null default '[]'::jsonb,
  target_measurements jsonb not null default '[]'::jsonb,
  delta_amount numeric(38,18) not null,
  delta_unit text not null,
  lineage jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (valuation_run_id, position_key)
);

create index if not exists ix_valuation_result_position
  on valuation_result(enterprise_id, result_kind, position_key, created_at desc);

create index if not exists ix_valuation_result_run
  on valuation_result(valuation_run_id);

update evo_runtime_info
set db_schema_version = 10,
    updated_at = now()
where singleton = true;

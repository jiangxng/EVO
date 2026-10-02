-- CORE-MIN-02 — direct BusinessDataSubmission idempotency receipt
--
-- This is deliberately separate from command_execution. Direct runtime
-- submissions are not synthetic Commands and must not inherit Command metadata
-- merely to obtain durable idempotency.

create table if not exists business_data_submission_receipt (
  id uuid primary key default uuidv7(),
  enterprise_id uuid not null references enterprise(id),
  scope_key text not null,
  application_id text not null,
  idempotency_key text not null,
  correlation_id text not null,
  causation_id text,
  request_digest char(64) not null,
  status text not null
    check (status in ('PROCESSING', 'COMPLETED', 'FAILED')),
  result jsonb,
  error jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (enterprise_id, application_id, idempotency_key)
);

create index if not exists ix_business_data_submission_receipt_lookup
  on business_data_submission_receipt(
    enterprise_id,
    application_id,
    created_at desc
  );

update evo_runtime_info
set db_schema_version = 29,
    updated_at = now()
where singleton = true;

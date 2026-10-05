-- Scope the current executable PostingRule registry by enterprise.
-- Existing rows remain NULL as compatibility/global fallback until a target
-- enterprise receives an explicit Ledger Manager publication.

alter table current_posting_rule
  add column if not exists enterprise_id uuid references enterprise(id);

alter table current_posting_rule
  drop constraint if exists current_posting_rule_application_id_code_key;

create unique index if not exists uq_current_posting_rule_enterprise_application_code
  on current_posting_rule(enterprise_id, application_id, code)
  where enterprise_id is not null;

create unique index if not exists uq_current_posting_rule_global_application_code
  on current_posting_rule(application_id, code)
  where enterprise_id is null;

create index if not exists ix_current_posting_rule_enterprise_application
  on current_posting_rule(enterprise_id, application_id, priority, rule_id);

update evo_runtime_info
set db_schema_version = 33,
    updated_at = now()
where singleton = true;

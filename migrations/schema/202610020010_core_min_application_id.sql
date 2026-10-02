-- CORE-MIN-02 — additive applicationId routing convergence, phase 1
--
-- Add the target minimal routing key without removing legacy rich-Application
-- columns. Existing rows are backfilled from the explicit Host sourceApplicationId
-- when available, otherwise from application_definition.code as migration fallback.
-- New compatibility Command writes dual-write application_id in application code.

alter table business_data
  add column if not exists application_id text;

alter table posting_input
  add column if not exists application_id text;

update business_data bd
set application_id = coalesce(
  nullif(ai.config ->> 'sourceApplicationId', ''),
  ad.code
)
from application_instance ai
join application_definition ad
  on ad.id = ai.application_definition_id
where bd.application_instance_id = ai.id
  and bd.application_id is null;

update posting_input pi
set application_id = coalesce(
  nullif(ai.config ->> 'sourceApplicationId', ''),
  ad.code
)
from application_instance ai
join application_definition ad
  on ad.id = ai.application_definition_id
where pi.application_instance_id = ai.id
  and pi.application_id is null;

create index if not exists ix_business_data_application_id
  on business_data(enterprise_id, application_id, effective_at, id);

create index if not exists ix_posting_input_application_id
  on posting_input(enterprise_id, application_id, posting_sequence);

update evo_runtime_info
set db_schema_version = 27,
    updated_at = now()
where singleton = true;

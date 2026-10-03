-- CORE-MIN-02 — minimal ApplicationAnchor registry
--
-- ApplicationAnchor is only the stable applicationId routing key.
-- Rich Application lifecycle remains outside EVO Core.

create table if not exists application_anchor (
  application_id text primary key,
  source_ref text,
  created_at timestamptz not null default now()
);

-- Upgrade compatibility: preserve routing identities already carried by the
-- legacy Application/PostingRule model without importing that lifecycle into
-- the new anchor contract.
insert into application_anchor(application_id, source_ref)
select distinct
  coalesce(
    nullif(ai.config ->> 'sourceApplicationId', ''),
    ad.code
  ) as application_id,
  'legacy:application_instance:' || ai.id::text
from application_instance ai
join application_definition ad
  on ad.id = ai.application_definition_id
where coalesce(
  nullif(ai.config ->> 'sourceApplicationId', ''),
  ad.code
) <> ''
on conflict (application_id) do nothing;

insert into application_anchor(application_id, source_ref)
select distinct
  cpr.application_id,
  coalesce(cpr.source_ref, 'legacy:current-posting-rule:' || cpr.code)
from current_posting_rule cpr
where cpr.application_id <> ''
on conflict (application_id) do nothing;

insert into application_anchor(application_id, source_ref)
select distinct
  bd.application_id,
  'legacy:business-data'
from business_data bd
where bd.application_id <> ''
on conflict (application_id) do nothing;

update evo_runtime_info
set db_schema_version = 33,
    updated_at = now()
where singleton = true;

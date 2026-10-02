-- CORE-MIN-02 — minimal ApplicationAnchor registry
--
-- ApplicationAnchor is only the stable applicationId routing key.
-- Rich Application lifecycle remains outside EVO Core.

create table if not exists application_anchor (
  application_id text primary key,
  source_ref text,
  created_at timestamptz not null default now()
);

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
  pr.application_id,
  'legacy:posting_rule:' || pr.id::text
from posting_rule pr
where pr.application_id <> ''
on conflict (application_id) do nothing;

update evo_runtime_info
set db_schema_version = 32,
    updated_at = now()
where singleton = true;

-- CORE-MIN-02 — PostingRule applicationId routing convergence, phase 1
--
-- PostingRule candidate selection moves to the exact minimal runtime routing key.
-- Legacy ApplicationDefinitionVersion remains compatibility lineage only.
--
-- Fail closed if one legacy ApplicationDefinition currently maps to multiple
-- explicit Host runtime applicationIds; such ambiguity cannot be guessed.

alter table posting_rule
  add column if not exists application_id text;

do $$
begin
  if exists (
    select 1
    from application_instance ai
    where nullif(ai.config ->> 'sourceApplicationId', '') is not null
    group by ai.application_definition_id
    having count(
      distinct nullif(ai.config ->> 'sourceApplicationId', '')
    ) > 1
  ) then
    raise exception 'CORE_MIN_POSTING_RULE_APPLICATION_ID_AMBIGUOUS';
  end if;
end
$$;

with runtime_ids as (
  select
    ai.application_definition_id,
    min(nullif(ai.config ->> 'sourceApplicationId', '')) as explicit_application_id
  from application_instance ai
  group by ai.application_definition_id
),
resolved as (
  select
    adv.id as application_definition_version_id,
    coalesce(ri.explicit_application_id, ad.code) as application_id
  from application_definition_version adv
  join application_definition ad
    on ad.id = adv.application_definition_id
  left join runtime_ids ri
    on ri.application_definition_id = ad.id
)
update posting_rule pr
set application_id = resolved.application_id
from resolved
where pr.application_definition_version_id =
      resolved.application_definition_version_id
  and pr.application_id is null;

do $$
begin
  if exists (
    select 1
    from posting_rule
    where application_id is null
    limit 1
  ) then
    raise exception 'CORE_MIN_POSTING_RULE_APPLICATION_ID_COVERAGE_INCOMPLETE';
  end if;
end
$$;

alter table posting_rule
  alter column application_id set not null;

create index if not exists ix_posting_rule_application_id
  on posting_rule(application_id, priority, code);

update evo_runtime_info
set db_schema_version = 30,
    updated_at = now()
where singleton = true;

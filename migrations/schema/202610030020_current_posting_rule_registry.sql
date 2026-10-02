-- CORE-MIN-02 — current executable PostingRule registry
--
-- Current executable PostingRules are Core runtime configuration keyed only by
-- applicationId. Legacy posting_rule/ApplicationDefinitionVersion rows remain
-- compatibility/history lineage for deterministic historical replay.

create table if not exists current_posting_rule (
  rule_id text primary key,
  application_id text not null,
  code text not null,
  priority integer not null default 0,
  condition_ast jsonb not null default '{"type":"literal","value":true}'::jsonb,
  effect_ast jsonb not null,
  rule_schema_version integer not null default 1,
  source_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (application_id, code)
);

do $$
begin
  if exists (
    select 1
    from posting_rule pr
    join application_definition_version adv
      on adv.id = pr.application_definition_version_id
    where adv.status = 'PUBLISHED'
    group by pr.application_id, pr.code
    having count(*) > 1
  ) then
    raise exception 'CORE_MIN_CURRENT_POSTING_RULE_AMBIGUOUS';
  end if;
end
$$;

insert into current_posting_rule (
  rule_id,
  application_id,
  code,
  priority,
  condition_ast,
  effect_ast,
  rule_schema_version,
  source_ref
)
select
  pr.id::text,
  pr.application_id,
  pr.code,
  pr.priority,
  pr.condition_ast,
  pr.effect_ast,
  pr.rule_schema_version,
  'legacy:posting_rule:' || pr.id::text
from posting_rule pr
join application_definition_version adv
  on adv.id = pr.application_definition_version_id
where adv.status = 'PUBLISHED'
on conflict (application_id, code) do update
set rule_id = excluded.rule_id,
    priority = excluded.priority,
    condition_ast = excluded.condition_ast,
    effect_ast = excluded.effect_ast,
    rule_schema_version = excluded.rule_schema_version,
    source_ref = excluded.source_ref,
    updated_at = now();

create index if not exists ix_current_posting_rule_application
  on current_posting_rule(application_id, priority, rule_id);

update evo_runtime_info
set db_schema_version = 31,
    updated_at = now()
where singleton = true;

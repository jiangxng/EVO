-- EVO Work Item Generation Identity v0.1
-- Allow CURRENT and CANDIDATE runtime generations to materialize independent
-- operational work state from their own ledger balances.

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select conname
    from pg_constraint
    where conrelid = 'work_item'::regclass
      and contype = 'u'
  loop
    execute format(
      'alter table work_item drop constraint %I',
      constraint_name
    );
  end loop;
end $$;

alter table work_item
  add constraint uq_work_item_generation
  unique nulls not distinct (
    enterprise_id,
    economic_runtime_dataset_id,
    work_type,
    source_ledger_code,
    source_dimension_hash
  );

create index if not exists ix_work_item_runtime_generation_open
  on work_item(
    enterprise_id,
    economic_runtime_dataset_id,
    status,
    priority desc,
    created_at
  )
  where status in ('OPEN','IN_PROGRESS');

update evo_runtime_info
set db_schema_version = 20,
    updated_at = now()
where singleton = true;

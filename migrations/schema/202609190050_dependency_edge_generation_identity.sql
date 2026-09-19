-- EVO Calculation Dependency Edge Generation Identity v0.1
-- Allow CURRENT and CANDIDATE materialization generations to carry independent
-- dependency graphs without cross-generation ON CONFLICT reuse.

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select conname
    from pg_constraint
    where conrelid = 'calculation_dependency_edge'::regclass
      and contype = 'u'
  loop
    execute format(
      'alter table calculation_dependency_edge drop constraint %I',
      constraint_name
    );
  end loop;
end $$;

alter table calculation_dependency_edge
  add constraint uq_calculation_dependency_edge_generation
  unique nulls not distinct (
    enterprise_id,
    economic_runtime_dataset_id,
    graph_version,
    from_kind,
    from_id,
    to_kind,
    to_id,
    edge_kind
  );

update evo_runtime_info
set db_schema_version = 19,
    updated_at = now()
where singleton = true;

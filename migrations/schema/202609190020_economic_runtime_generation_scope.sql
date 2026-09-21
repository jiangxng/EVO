-- EVO Economic Runtime Generation Scoping v0.1
-- Additive nullable generation roots for derived/runtime families.
-- Existing rows remain legacy/unscoped until module writers are migrated.

alter table ledger_dataset
  add column if not exists economic_runtime_dataset_id uuid
  references economic_runtime_dataset(id);

alter table posting_run
  add column if not exists economic_runtime_dataset_id uuid
  references economic_runtime_dataset(id);

alter table allocation_run
  add column if not exists economic_runtime_dataset_id uuid
  references economic_runtime_dataset(id);

alter table cost_run
  add column if not exists economic_runtime_dataset_id uuid
  references economic_runtime_dataset(id);

alter table valuation_run
  add column if not exists economic_runtime_dataset_id uuid
  references economic_runtime_dataset(id);

alter table valuation_position
  add column if not exists economic_runtime_dataset_id uuid
  references economic_runtime_dataset(id);

alter table work_item
  add column if not exists economic_runtime_dataset_id uuid
  references economic_runtime_dataset(id);

alter table calculation_dependency_edge
  add column if not exists economic_runtime_dataset_id uuid
  references economic_runtime_dataset(id);

create index if not exists ix_ledger_dataset_runtime_generation
  on ledger_dataset(enterprise_id, consistency_domain, economic_runtime_dataset_id);

create index if not exists ix_posting_run_runtime_generation
  on posting_run(enterprise_id, consistency_domain, economic_runtime_dataset_id);

create index if not exists ix_allocation_run_runtime_generation
  on allocation_run(enterprise_id, economic_runtime_dataset_id);

create index if not exists ix_cost_run_runtime_generation
  on cost_run(enterprise_id, economic_runtime_dataset_id);

create index if not exists ix_valuation_run_runtime_generation
  on valuation_run(enterprise_id, economic_runtime_dataset_id);

create index if not exists ix_valuation_position_runtime_generation
  on valuation_position(enterprise_id, economic_runtime_dataset_id);

create index if not exists ix_work_item_runtime_generation
  on work_item(enterprise_id, economic_runtime_dataset_id);

create index if not exists ix_calculation_dependency_edge_runtime_generation
  on calculation_dependency_edge(enterprise_id, graph_version, economic_runtime_dataset_id);

update evo_runtime_info
set db_schema_version = 16,
    updated_at = now()
where singleton = true;

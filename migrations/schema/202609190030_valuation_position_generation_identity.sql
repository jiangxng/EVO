-- EVO Valuation Position Generation Identity v0.1
-- Allows CURRENT and CANDIDATE materialization generations to hold independent
-- valuation-position state for the same canonical BusinessData.

alter table valuation_position
  add column if not exists id uuid default uuidv7();

alter table valuation_position
  alter column id set not null;

alter table valuation_position
  drop constraint if exists valuation_position_pkey;

alter table valuation_position
  add constraint valuation_position_pkey primary key (id);

alter table valuation_position
  drop constraint if exists uq_valuation_position_generation;

alter table valuation_position
  add constraint uq_valuation_position_generation
  unique nulls not distinct (
    enterprise_id,
    economic_runtime_dataset_id,
    business_data_id,
    valuation_rule_id
  );

create index if not exists ix_valuation_position_generation_lookup
  on valuation_position(
    enterprise_id,
    economic_runtime_dataset_id,
    business_data_id,
    valuation_rule_id
  );

update evo_runtime_info
set db_schema_version = 17,
    updated_at = now()
where singleton = true;

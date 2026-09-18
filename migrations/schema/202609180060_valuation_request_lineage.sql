-- EVO Economic Runtime — valuation request lineage
-- Derived valuation runs must be traceable to the canonical valuation.requested BusinessData
-- that authorized/parameterized the interpretation. Existing technical/direct runs may remain null.

alter table valuation_run
  add column if not exists request_business_data_id uuid references business_data(id);

create index if not exists ix_valuation_run_request_business_data
  on valuation_run(enterprise_id, request_business_data_id, effective_at)
  where request_business_data_id is not null;

update evo_runtime_info
set db_schema_version = 13,
    updated_at = now()
where singleton = true;

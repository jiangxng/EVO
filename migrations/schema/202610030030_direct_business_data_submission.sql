-- CORE-MIN-02 — direct BusinessDataSubmission schema cutover
--
-- The target runtime submission path does not synthesize legacy rich-Application
-- or Command provenance. Those columns remain available for compatibility rows
-- but are no longer mandatory runtime identity.
--
-- application_id is already NOT NULL and is the canonical routing key.

alter table business_data
  alter column application_instance_id drop not null,
  alter column command_execution_id drop not null,
  alter column metadata_version drop not null;

alter table posting_input
  alter column application_instance_id drop not null,
  alter column metadata_version drop not null;

create unique index if not exists uq_business_data_application_object_version
  on business_data(
    enterprise_id,
    application_id,
    business_object_key,
    business_object_version
  );

update evo_runtime_info
set db_schema_version = 32,
    updated_at = now()
where singleton = true;

ALTER TABLE business_object_link
  DROP CONSTRAINT IF EXISTS business_object_link_relation_type_check;

ALTER TABLE business_object_link
  ADD CONSTRAINT business_object_link_relation_type_check
  CHECK (
    relation_type IN (
      'CAUSES',
      'FULFILLS',
      'ALLOCATES_TO',
      'DERIVES_FROM',
      'REFERENCES',
      'REVERSES'
    )
  );

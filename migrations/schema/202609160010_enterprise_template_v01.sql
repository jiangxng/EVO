-- EVO Enterprise Template v0.1
-- A template is a versioned, reusable enterprise operating definition.
-- An enterprise explicitly pins the template version on which it runs.

create table if not exists enterprise_template (
  id uuid primary key default uuidv7(),
  code text not null unique,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists enterprise_template_version (
  id uuid primary key default uuidv7(),
  enterprise_template_id uuid not null references enterprise_template(id),
  version integer not null check (version > 0),
  status text not null default 'DRAFT' check (status in ('DRAFT','PUBLISHED','RETIRED')),
  definition jsonb not null,
  semantic_digest text not null,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  unique (enterprise_template_id, version),
  unique (enterprise_template_id, id)
);

create table if not exists enterprise_template_binding (
  enterprise_id uuid primary key references enterprise(id),
  enterprise_template_id uuid not null references enterprise_template(id),
  enterprise_template_version_id uuid not null,
  bound_at timestamptz not null default now(),
  bound_by text not null,
  binding_reason text,
  constraint enterprise_template_binding_version_fk
    foreign key (enterprise_template_id, enterprise_template_version_id)
    references enterprise_template_version(enterprise_template_id, id)
);

create index if not exists idx_enterprise_template_version_status
  on enterprise_template_version(enterprise_template_id, status, version desc);

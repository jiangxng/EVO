-- EVO M0 bootstrap.
-- The migration runner creates schema_migrations before applying SQL files.
-- Business tables begin in M1/M2 under their owning modules.

create table if not exists evo_runtime_info (
  singleton boolean primary key default true check (singleton),
  architecture_baseline text not null,
  db_schema_version integer not null,
  updated_at timestamptz not null default now()
);

insert into evo_runtime_info (
  singleton,
  architecture_baseline,
  db_schema_version
)
values (
  true,
  'EVO-08..EVO-12',
  1
)
on conflict (singleton) do update
set architecture_baseline = excluded.architecture_baseline,
    db_schema_version = excluded.db_schema_version,
    updated_at = now();

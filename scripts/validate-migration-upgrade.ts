import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import pg from 'pg';
import { loadRuntimeConfig } from '../platform/runtime/src/config.js';

const { Client } = pg;

interface Migration {
  readonly name: string;
  readonly sql: string;
  readonly checksum: string;
}

function checksum(sql: string): string {
  return createHash('sha256').update(sql).digest('hex');
}

async function loadMigrations(): Promise<Migration[]> {
  const migrationDir = join(process.cwd(), 'migrations', 'schema');
  const names = (await readdir(migrationDir))
    .filter((name) => name.endsWith('.sql'))
    .sort();
  return Promise.all(names.map(async (name) => {
    const sql = await readFile(join(migrationDir, name), 'utf8');
    return { name, sql, checksum: checksum(sql) };
  }));
}

function runProductionMigrator(): void {
  const result = spawnSync(
    process.execPath,
    ['--env-file-if-exists=.env', '--import', 'tsx', 'scripts/migrate.ts'],
    { stdio: 'inherit', env: process.env }
  );
  if (result.status !== 0) {
    throw new Error(`Production migrator failed with status ${String(result.status)}.`);
  }
}

const config = loadRuntimeConfig();
const migrations = await loadMigrations();
if (migrations.length < 2) {
  throw new Error('Migration upgrade validation requires at least two migrations.');
}

const baseline = migrations.slice(0, -1);
const latest = migrations.at(-1);
if (latest === undefined) throw new Error('Latest migration is unavailable.');

const client = new Client({ connectionString: config.databaseUrl });
await client.connect();

try {
  await client.query('drop schema public cascade');
  await client.query('create schema public');
  await client.query('grant all on schema public to public');

  await client.query(`
    create table schema_migrations (
      version text primary key,
      checksum text not null,
      applied_at timestamptz not null default now()
    )
  `);

  for (const migration of baseline) {
    await client.query('begin');
    try {
      await client.query(migration.sql);
      await client.query(
        'insert into schema_migrations(version, checksum) values ($1, $2)',
        [migration.name, migration.checksum]
      );
      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw error;
    }
  }

  await client.query(
    `insert into enterprise(code, name, status, default_timezone)
     values ('CI_UPGRADE_SENTINEL', 'CI Upgrade Sentinel', 'ACTIVE', 'UTC')`
  );
} finally {
  await client.end();
}

runProductionMigrator();

const verifier = new Client({ connectionString: config.databaseUrl });
await verifier.connect();
try {
  const applied = await verifier.query<{ version: string; checksum: string }>(
    'select version, checksum from schema_migrations order by version'
  );
  if (applied.rows.length !== migrations.length) {
    throw new Error(
      `Expected ${migrations.length} applied migrations after upgrade, got ${applied.rows.length}.`
    );
  }

  for (let index = 0; index < migrations.length; index += 1) {
    const expected = migrations[index];
    const actual = applied.rows[index];
    if (expected === undefined || actual === undefined) {
      throw new Error('Migration verification index mismatch.');
    }
    if (actual.version !== expected.name || actual.checksum !== expected.checksum) {
      throw new Error(`Migration verification failed for ${expected.name}.`);
    }
  }

  const sentinel = await verifier.query<{ code: string; name: string }>(
    `select code, name from enterprise where code = 'CI_UPGRADE_SENTINEL'`
  );
  if (sentinel.rows.length !== 1 || sentinel.rows[0]?.name !== 'CI Upgrade Sentinel') {
    throw new Error('Representative pre-upgrade enterprise data was not preserved.');
  }
} finally {
  await verifier.end();
}

runProductionMigrator();

console.log(JSON.stringify({
  status: 'PASS',
  fromMigration: baseline.at(-1)?.name ?? null,
  toMigration: latest.name,
  appliedMigrationCount: migrations.length,
  representativeDataPreserved: true,
  secondRunIdempotent: true
}));

import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import pg from 'pg';
import { loadRuntimeConfig } from '../platform/runtime/src/config.js';

const { Client } = pg;

interface AppliedMigration {
  readonly version: string;
  readonly checksum: string;
}

function checksum(sql: string): string {
  return createHash('sha256').update(sql).digest('hex');
}

const config = loadRuntimeConfig();
const client = new Client({ connectionString: config.databaseUrl });

await client.connect();

try {
  await client.query(`
    create table if not exists schema_migrations (
      version text primary key,
      checksum text not null,
      applied_at timestamptz not null default now()
    )
  `);

  const migrationDir = join(process.cwd(), 'migrations', 'schema');
  const names = (await readdir(migrationDir))
    .filter((name) => name.endsWith('.sql'))
    .sort();

  const appliedResult = await client.query<AppliedMigration>(
    'select version, checksum from schema_migrations'
  );
  const applied = new Map(
    appliedResult.rows.map((row) => [row.version, row.checksum])
  );

  for (const name of names) {
    const sql = await readFile(join(migrationDir, name), 'utf8');
    const hash = checksum(sql);
    const existing = applied.get(name);

    if (existing !== undefined) {
      if (existing !== hash) {
        throw new Error(
          `Applied migration ${name} was modified. ` +
            'Never rewrite applied migration history.'
        );
      }
      continue;
    }

    console.log(`Applying ${name}`);

    await client.query('begin');
    try {
      await client.query(sql);
      await client.query(
        'insert into schema_migrations(version, checksum) values ($1, $2)',
        [name, hash]
      );
      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw error;
    }
  }

  console.log('Migrations are current.');
} finally {
  await client.end();
}

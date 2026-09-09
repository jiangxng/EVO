import { Kysely, PostgresDialect, sql } from 'kysely';
import pg from 'pg';
import type { Database } from './types.js';

const { Pool } = pg;

export interface DatabaseHandle {
  readonly db: Kysely<Database>;
  ping(): Promise<void>;
  destroy(): Promise<void>;
}

export function createDatabase(databaseUrl: string): DatabaseHandle {
  const pool = new Pool({
    connectionString: databaseUrl,
    max: 20
  });

  const db = new Kysely<Database>({
    dialect: new PostgresDialect({ pool })
  });

  return {
    db,
    async ping(): Promise<void> {
      await sql`select 1`.execute(db);
    },
    async destroy(): Promise<void> {
      await db.destroy();
    }
  };
}

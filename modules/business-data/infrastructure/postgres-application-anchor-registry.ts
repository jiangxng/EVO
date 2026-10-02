import type { Kysely } from 'kysely';
import type { Database } from '../../../platform/database/src/types.js';
import type {
  ApplicationAnchorRegistryV010,
  ApplicationAnchorV010
} from '../api/application-anchor.js';

function requiredApplicationId(value: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error('APPLICATION_ID_REQUIRED');
  return normalized;
}

export class PostgresApplicationAnchorRegistryV010
  implements ApplicationAnchorRegistryV010
{
  constructor(private readonly db: Kysely<Database>) {}

  async exists(applicationId: string): Promise<boolean> {
    const id = requiredApplicationId(applicationId);
    const row = await this.db
      .selectFrom('application_anchor')
      .select('application_id')
      .where('application_id', '=', id)
      .executeTakeFirst();
    return row !== undefined;
  }

  async register(anchor: ApplicationAnchorV010): Promise<void> {
    const applicationId = requiredApplicationId(anchor.applicationId);
    await this.db
      .insertInto('application_anchor')
      .values({
        application_id: applicationId,
        source_ref: null
      })
      .onConflict((oc) => oc.column('application_id').doNothing())
      .execute();
  }
}

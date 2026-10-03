import type { Kysely } from 'kysely';
import { AppError } from '../../../platform/contracts/src/index.js';
import type { Database } from '../../../platform/database/src/types.js';
import type {
  ApplicationAnchorReaderV010,
  ApplicationAnchorRegistryV010,
  ApplicationAnchorV010
} from '../api/application-anchor.js';

function requiredApplicationId(value: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new AppError({
      code: 'APPLICATION_ID_REQUIRED',
      message: 'applicationId is required.',
      module: 'business-data',
      operation: 'applicationAnchor'
    });
  }
  return normalized;
}

export class PostgresApplicationAnchorRegistryV010
  implements ApplicationAnchorRegistryV010, ApplicationAnchorReaderV010
{
  constructor(private readonly db: Kysely<Database>) {}

  async require(applicationId: string): Promise<ApplicationAnchorV010> {
    const id = requiredApplicationId(applicationId);
    const row = await this.db
      .selectFrom('application_anchor')
      .select('application_id')
      .where('application_id', '=', id)
      .executeTakeFirst();

    if (row === undefined) {
      throw new AppError({
        code: 'APPLICATION_ANCHOR_NOT_FOUND',
        message: 'applicationId is not registered in the EVO runtime.',
        module: 'business-data',
        operation: 'applicationAnchor',
        details: { applicationId: id }
      });
    }

    return { applicationId: row.application_id };
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

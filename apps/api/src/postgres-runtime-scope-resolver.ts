import type { Kysely } from 'kysely';
import { AppError } from '../../../platform/contracts/src/index.js';
import type { Database } from '../../../platform/database/src/types.js';
import type {
  BusinessDataScopeResolverV010
} from '../../../modules/business-data/infrastructure/postgres-business-data-submission.js';

/**
 * v0.1 transport compatibility adapter.
 *
 * scopeKey is the exact opaque EVO runtime scope id currently persisted as
 * enterprise.id. This adapter does not expose or own rich Enterprise lifecycle.
 */
export class PostgresRuntimeScopeResolverV010
implements BusinessDataScopeResolverV010 {
  constructor(private readonly db: Kysely<Database>) {}

  async resolveEnterpriseId(scopeKey: string): Promise<string> {
    const normalized = scopeKey.trim();
    if (!normalized) {
      throw new AppError({
        code: 'BUSINESS_DATA_SCOPE_KEY_REQUIRED',
        message: 'scopeKey is required.',
        module: 'api',
        operation: 'resolveRuntimeScope'
      });
    }

    const row = await this.db
      .selectFrom('enterprise')
      .select('id')
      .where('id', '=', normalized)
      .executeTakeFirst();

    if (row === undefined) {
      throw new AppError({
        code: 'BUSINESS_DATA_SCOPE_NOT_FOUND',
        message: 'EVO runtime scope was not found.',
        module: 'api',
        operation: 'resolveRuntimeScope',
        details: { scopeKey: normalized }
      });
    }

    return row.id;
  }
}

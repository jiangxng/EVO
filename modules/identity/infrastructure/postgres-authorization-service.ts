import type { Kysely } from 'kysely';
import { AppError } from '../../../platform/contracts/src/index.js';
import type { Database } from '../../../platform/database/src/types.js';
import type {
  AuthorizationRequest,
  AuthorizationService
} from '../api/authorization.js';

export class PostgresAuthorizationService implements AuthorizationService {
  constructor(private readonly db: Kysely<Database>) {}

  async require(request: AuthorizationRequest): Promise<void> {
    const direct = await this.db
      .selectFrom('permission_grant')
      .select('id')
      .where('enterprise_id', '=', request.enterpriseId)
      .where('actor_type', '=', request.actorType)
      .where('actor_id', '=', request.actorId)
      .where('permission_code', 'in', [request.permissionCode, '*'])
      .executeTakeFirst();

    if (direct === undefined) {
      throw new AppError({
        code: 'PERMISSION_DENIED',
        message: 'Actor does not have permission for this command.',
        module: 'identity',
        operation: 'require',
        details: { ...request }
      });
    }
  }
}

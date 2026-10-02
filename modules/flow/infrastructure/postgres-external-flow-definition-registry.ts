import type { Kysely } from 'kysely';
import type { Database } from '../../../platform/database/src/types.js';
import type {
  ExternalFlowDefinitionRegistryV010,
  RegisteredExternalFlowDefinitionV010,
  RegisterExternalFlowDefinitionRequestV010
} from '../api/contracts.js';

interface StoredExternalDefinition {
  source?: {
    authority?: unknown;
    ref?: unknown;
    revision?: unknown;
    digest?: unknown;
  };
  body?: unknown;
}

function requiredText(value: unknown, code: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(code);
  }
  return value.trim();
}

function positiveRevision(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    throw new Error('EVO_RUNTIME_FLOW_SOURCE_REVISION_INVALID');
  }
  return value;
}

export class PostgresExternalFlowDefinitionRegistryV010
  implements ExternalFlowDefinitionRegistryV010 {
  constructor(private readonly db: Kysely<Database>) {}

  async register(
    request: RegisterExternalFlowDefinitionRequestV010
  ): Promise<RegisteredExternalFlowDefinitionV010> {
    const enterpriseId = requiredText(
      request.enterpriseId,
      'EVO_RUNTIME_FLOW_ENTERPRISE_REQUIRED'
    );
    const code = requiredText(
      request.code,
      'EVO_RUNTIME_FLOW_CODE_REQUIRED'
    );
    const name = requiredText(
      request.name,
      'EVO_RUNTIME_FLOW_NAME_REQUIRED'
    );
    if (request.source?.authority !== 'HOST') {
      throw new Error('EVO_RUNTIME_FLOW_SOURCE_AUTHORITY_UNSUPPORTED');
    }
    const source = {
      authority: 'HOST' as const,
      ref: requiredText(
        request.source.ref,
        'EVO_RUNTIME_FLOW_SOURCE_REF_REQUIRED'
      ),
      revision: positiveRevision(request.source.revision),
      digest: requiredText(
        request.source.digest,
        'EVO_RUNTIME_FLOW_SOURCE_DIGEST_REQUIRED'
      )
    };

    const enterprise = await this.db
      .selectFrom('enterprise')
      .select(['id','status'])
      .where('id', '=', enterpriseId)
      .executeTakeFirst();
    if (!enterprise || enterprise.status !== 'ACTIVE') {
      throw new Error('EVO_RUNTIME_FLOW_ENTERPRISE_NOT_ACTIVE');
    }

    const existing = await this.db
      .selectFrom('flow_definition')
      .select(['id','name','status','definition'])
      .where('enterprise_id', '=', enterpriseId)
      .where('code', '=', code)
      .where('version', '=', source.revision)
      .executeTakeFirst();

    if (existing) {
      const stored = existing.definition as unknown as StoredExternalDefinition;
      if (
        existing.status !== 'PUBLISHED'
        || existing.name !== name
        || stored.source?.authority !== source.authority
        || stored.source?.ref !== source.ref
        || stored.source?.revision !== source.revision
        || stored.source?.digest !== source.digest
      ) {
        throw new Error('EVO_RUNTIME_FLOW_VERSION_CONFLICT');
      }
      return {
        contractVersion: '0.1.0',
        flowDefinitionId: existing.id,
        enterpriseId,
        code,
        name,
        version: source.revision,
        source
      };
    }

    const row = await this.db
      .insertInto('flow_definition')
      .values({
        enterprise_id: enterpriseId,
        code,
        name,
        description: 'Externally governed runtime flow definition registered by Host.',
        version: source.revision,
        status: 'PUBLISHED',
        definition: {
          source,
          body: request.definition
        },
        published_at: new Date()
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    return {
      contractVersion: '0.1.0',
      flowDefinitionId: row.id,
      enterpriseId,
      code,
      name,
      version: source.revision,
      source
    };
  }
}

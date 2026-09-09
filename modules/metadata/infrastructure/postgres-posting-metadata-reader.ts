import type { Kysely } from 'kysely';
import { AppError } from '../../../platform/contracts/src/index.js';
import type { Database } from '../../../platform/database/src/types.js';
import type {
  PostingMetadataReader,
  PostingMetadataSnapshot
} from '../api/posting-metadata-reader.js';
import type {
  JsonObject,
  PostingRuleDefinition
} from '../api/contracts.js';

function jsonObject(value: unknown): JsonObject {
  return (value ?? {}) as JsonObject;
}

export class PostgresPostingMetadataReader
  implements PostingMetadataReader
{
  constructor(private readonly db: Kysely<Database>) {}

  async loadPostingMetadata(
    applicationDefinitionId: string,
    metadataVersion: number
  ): Promise<PostingMetadataSnapshot> {
    const version = await this.db
      .selectFrom('application_definition_version')
      .select(['id', 'application_definition_id', 'version'])
      .where('application_definition_id', '=', applicationDefinitionId)
      .where('version', '=', metadataVersion)
      .executeTakeFirst();

    if (version === undefined) {
      throw new AppError({
        code: 'POSTING_METADATA_VERSION_NOT_FOUND',
        message: 'Posting metadata version does not exist.',
        module: 'metadata',
        operation: 'loadPostingMetadata',
        details: { applicationDefinitionId, metadataVersion }
      });
    }

    const rows = await this.db
      .selectFrom('posting_rule')
      .selectAll()
      .where('application_definition_version_id', '=', version.id)
      .orderBy('priority')
      .orderBy('code')
      .execute();

    const postingRules: PostingRuleDefinition[] = rows.map((row) => ({
      id: row.id,
      code: row.code,
      priority: row.priority,
      conditionAst: jsonObject(row.condition_ast),
      effectAst: jsonObject(row.effect_ast),
      ruleSchemaVersion: row.rule_schema_version
    }));

    return {
      applicationDefinitionVersionId: version.id,
      applicationDefinitionId: version.application_definition_id,
      metadataVersion: version.version,
      postingRules
    };
  }
}

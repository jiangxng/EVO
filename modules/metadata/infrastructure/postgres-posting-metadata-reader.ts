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
    applicationId: string,
    metadataVersion: number
  ): Promise<PostingMetadataSnapshot> {
    const rows = await this.db
      .selectFrom('posting_rule as pr')
      .innerJoin(
        'application_definition_version as adv',
        'adv.id',
        'pr.application_definition_version_id'
      )
      .select([
        'pr.id',
        'pr.code',
        'pr.priority',
        'pr.condition_ast',
        'pr.effect_ast',
        'pr.rule_schema_version',
        'pr.application_id',
        'adv.id as application_definition_version_id',
        'adv.application_definition_id',
        'adv.version'
      ])
      .where('pr.application_id', '=', applicationId)
      .where('adv.version', '=', metadataVersion)
      .orderBy('pr.priority')
      .orderBy('pr.code')
      .execute();

    if (rows.length === 0) {
      throw new AppError({
        code: 'POSTING_METADATA_VERSION_NOT_FOUND',
        message: 'Posting metadata version does not exist for applicationId.',
        module: 'metadata',
        operation: 'loadPostingMetadata',
        details: { applicationId, metadataVersion }
      });
    }

    const [version] = rows;

    const postingRules: PostingRuleDefinition[] = rows.map((row) => ({
      id: row.id,
      code: row.code,
      priority: row.priority,
      conditionAst: jsonObject(row.condition_ast),
      effectAst: jsonObject(row.effect_ast),
      ruleSchemaVersion: row.rule_schema_version
    }));

    return {
      applicationId: version!.application_id,
      applicationDefinitionVersionId:
        version!.application_definition_version_id,
      applicationDefinitionId: version!.application_definition_id,
      metadataVersion: version!.version,
      postingRules
    };
  }
}

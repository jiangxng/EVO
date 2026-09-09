import type { Kysely } from 'kysely';
import type { Database } from '../../../platform/database/src/types.js';
import type { JsonObject } from '../../metadata/api/contracts.js';
import type {
  AiCapabilityCatalog,
  AiCommandTool
} from '../api/contracts.js';

export class PostgresAiCapabilityCatalog implements AiCapabilityCatalog {
  constructor(private readonly db: Kysely<Database>) {}

  async list(enterpriseId: string): Promise<readonly AiCommandTool[]> {
    const rows = await this.db
      .selectFrom('application_instance as ai')
      .innerJoin('application_definition as ad', 'ad.id', 'ai.application_definition_id')
      .innerJoin('application_definition_version as av', 'av.application_definition_id', 'ad.id')
      .innerJoin('command_definition as cd', 'cd.application_definition_version_id', 'av.id')
      .select([
        'cd.code',
        'cd.name',
        'cd.input_schema',
        'ai.code as application_code'
      ])
      .where('ai.enterprise_id', '=', enterpriseId)
      .where('ai.status', '=', 'ACTIVE')
      .where('av.status', '=', 'PUBLISHED')
      .orderBy('ai.code')
      .orderBy('cd.code')
      .execute();

    return rows.map((row) => ({
      code: row.code,
      name: row.name,
      applicationCode: row.application_code,
      inputSchema: row.input_schema as JsonObject
    }));
  }
}

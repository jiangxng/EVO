import type { Kysely } from 'kysely';
import type { Database } from '../../../platform/database/src/types.js';
import type { JsonObject, PostingRuleDefinition } from '../../metadata/api/contracts.js';
import type { CurrentPostingRuleReader } from '../api/current-posting-rule-reader.js';

function jsonObject(value: unknown): JsonObject {
  return (value ?? {}) as JsonObject;
}

export class PostgresCurrentPostingRuleReader
  implements CurrentPostingRuleReader
{
  constructor(private readonly db: Kysely<Database>) {}

  async loadCurrentPostingRules(
    applicationId: string
  ): Promise<readonly PostingRuleDefinition[]> {
    const rows = await this.db
      .selectFrom('current_posting_rule')
      .selectAll()
      .where('application_id', '=', applicationId)
      .orderBy('priority')
      .orderBy('rule_id')
      .execute();

    return rows.map((row) => ({
      id: row.rule_id,
      code: row.code,
      priority: row.priority,
      conditionAst: jsonObject(row.condition_ast),
      effectAst: jsonObject(row.effect_ast),
      ruleSchemaVersion: row.rule_schema_version
    }));
  }
}

import { sql, type Kysely } from 'kysely';
import { AppError } from '../../../platform/contracts/src/index.js';
import type { Database } from '../../../platform/database/src/types.js';
import type {
  ApplicationDefinitionVersion,
  ApplicationInstance,
  CommandDefinition,
  Enterprise,
  EnterpriseApplicationOverlay,
  FieldDefinition,
  JsonObject,
  JsonValue,
  PostingRuleDefinition
} from '../api/contracts.js';
import type { MetadataReader } from '../api/metadata-reader.js';
import type {
  CreateApplicationSkeletonInput,
  CreateApplicationVersionInput,
  CreateEnterpriseInput,
  MetadataWriter
} from '../api/metadata-writer.js';

function jsonObject(value: unknown): JsonObject {
  return (value ?? {}) as JsonObject;
}

function jsonArray(value: unknown): readonly JsonValue[] {
  return (value ?? []) as readonly JsonValue[];
}

export class PostgresMetadataRepository
  implements MetadataReader, MetadataWriter
{
  constructor(private readonly db: Kysely<Database>) {}

  async getEnterprise(enterpriseId: string): Promise<Enterprise | null> {
    const row = await this.db
      .selectFrom('enterprise')
      .selectAll()
      .where('id', '=', enterpriseId)
      .executeTakeFirst();

    if (row === undefined) return null;

    return {
      id: row.id,
      code: row.code,
      name: row.name,
      status: row.status,
      defaultTimezone: row.default_timezone
    };
  }

  async getApplicationInstance(
    enterpriseId: string,
    applicationInstanceId: string
  ): Promise<ApplicationInstance | null> {
    const row = await this.db
      .selectFrom('application_instance')
      .selectAll()
      .where('id', '=', applicationInstanceId)
      .where('enterprise_id', '=', enterpriseId)
      .executeTakeFirst();

    if (row === undefined) return null;

    return {
      id: row.id,
      enterpriseId: row.enterprise_id,
      applicationDefinitionId: row.application_definition_id,
      code: row.code,
      name: row.name,
      pinnedDefinitionVersion: row.pinned_definition_version,
      status: row.status,
      config: jsonObject(row.config)
    };
  }

  async getPublishedApplicationDefinitionVersion(
    applicationDefinitionId: string
  ): Promise<ApplicationDefinitionVersion | null> {
    const row = await this.db
      .selectFrom('application_definition_version')
      .selectAll()
      .where('application_definition_id', '=', applicationDefinitionId)
      .where('status', '=', 'PUBLISHED')
      .executeTakeFirst();

    return row === undefined ? null : this.mapApplicationVersion(row);
  }

  async getApplicationDefinitionVersion(
    applicationDefinitionId: string,
    version: number
  ): Promise<ApplicationDefinitionVersion | null> {
    const row = await this.db
      .selectFrom('application_definition_version')
      .selectAll()
      .where('application_definition_id', '=', applicationDefinitionId)
      .where('version', '=', version)
      .executeTakeFirst();

    return row === undefined ? null : this.mapApplicationVersion(row);
  }

  async getPublishedOverlay(
    applicationInstanceId: string
  ): Promise<EnterpriseApplicationOverlay | null> {
    const row = await this.db
      .selectFrom('enterprise_application_overlay')
      .selectAll()
      .where('application_instance_id', '=', applicationInstanceId)
      .where('status', '=', 'PUBLISHED')
      .executeTakeFirst();

    if (row === undefined) return null;

    return {
      id: row.id,
      enterpriseId: row.enterprise_id,
      applicationInstanceId: row.application_instance_id,
      baseDefinitionVersion: row.base_definition_version,
      overlayVersion: row.overlay_version,
      status: row.status,
      patch: jsonObject(row.patch),
      overlayHash: row.overlay_hash
    };
  }

  async getFields(
    applicationDefinitionVersionId: string
  ): Promise<readonly FieldDefinition[]> {
    const rows = await this.db
      .selectFrom('field_definition')
      .selectAll()
      .where(
        'application_definition_version_id',
        '=',
        applicationDefinitionVersionId
      )
      .orderBy('sort_order')
      .orderBy('code')
      .execute();

    return rows.map((row) => ({
      id: row.id,
      code: row.code,
      label: row.label,
      dataType: row.data_type,
      required: row.required,
      referenceMode: row.reference_mode,
      sortOrder: row.sort_order,
      config: jsonObject(row.config)
    }));
  }

  async getCommands(
    applicationDefinitionVersionId: string
  ): Promise<readonly CommandDefinition[]> {
    const rows = await this.db
      .selectFrom('command_definition')
      .selectAll()
      .where(
        'application_definition_version_id',
        '=',
        applicationDefinitionVersionId
      )
      .orderBy('code')
      .execute();

    return rows.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      inputSchema: jsonObject(row.input_schema),
      preconditions: jsonArray(row.preconditions),
      executionPolicy: jsonObject(row.execution_policy),
      resultingBusinessDataType: row.resulting_business_data_type,
      config: jsonObject(row.config)
    }));
  }

  async getPostingRules(
    applicationDefinitionVersionId: string
  ): Promise<readonly PostingRuleDefinition[]> {
    const rows = await this.db
      .selectFrom('posting_rule')
      .selectAll()
      .where(
        'application_definition_version_id',
        '=',
        applicationDefinitionVersionId
      )
      .orderBy('priority')
      .orderBy('code')
      .execute();

    return rows.map((row) => ({
      id: row.id,
      code: row.code,
      priority: row.priority,
      conditionAst: jsonObject(row.condition_ast),
      effectAst: jsonObject(row.effect_ast),
      ruleSchemaVersion: row.rule_schema_version
    }));
  }

  async createEnterprise(input: CreateEnterpriseInput): Promise<string> {
    const row = await this.db
      .insertInto('enterprise')
      .values({
        code: input.code,
        name: input.name,
        status: 'ACTIVE',
        default_timezone: input.defaultTimezone ?? 'UTC'
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    return row.id;
  }

  async createApplicationSkeleton(
    input: CreateApplicationSkeletonInput
  ): Promise<string> {
    return this.db.transaction().execute(async (trx) => {
      const domain = await trx
        .insertInto('domain_definition')
        .values({
          code: input.domainCode,
          name: input.domainName,
          description: null
        })
        .onConflict((oc) =>
          oc.column('code').doUpdateSet({ name: input.domainName })
        )
        .returning('id')
        .executeTakeFirstOrThrow();

      const transactionType = await trx
        .insertInto('transaction_type')
        .values({
          domain_id: domain.id,
          code: input.transactionTypeCode,
          name: input.transactionTypeName,
          description: null
        })
        .onConflict((oc) =>
          oc.column('code').doUpdateSet({
            domain_id: domain.id,
            name: input.transactionTypeName
          })
        )
        .returning('id')
        .executeTakeFirstOrThrow();

      const application = await trx
        .insertInto('application_definition')
        .values({
          transaction_type_id: transactionType.id,
          code: input.applicationCode,
          name: input.applicationName,
          description: null
        })
        .onConflict((oc) =>
          oc.column('code').doUpdateSet({
            transaction_type_id: transactionType.id,
            name: input.applicationName
          })
        )
        .returning('id')
        .executeTakeFirstOrThrow();

      return application.id;
    });
  }

  async createApplicationVersion(
    input: CreateApplicationVersionInput
  ): Promise<string> {
    const row = await this.db
      .insertInto('application_definition_version')
      .values({
        application_definition_id: input.applicationDefinitionId,
        version: input.version,
        status: 'DRAFT',
        schema_version: input.schemaVersion ?? 1,
        base_config: input.baseConfig ?? {},
        definition_hash: null,
        published_at: null
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    return row.id;
  }

  async publishApplicationVersion(
    applicationDefinitionId: string,
    version: number
  ): Promise<void> {
    await this.db.transaction().execute(async (trx) => {
      const target = await trx
        .selectFrom('application_definition_version')
        .select(['id', 'status'])
        .where('application_definition_id', '=', applicationDefinitionId)
        .where('version', '=', version)
        .forUpdate()
        .executeTakeFirst();

      if (target === undefined) {
        throw new AppError({
          code: 'APPLICATION_VERSION_NOT_FOUND',
          message: 'Application definition version does not exist.',
          module: 'metadata',
          operation: 'publishApplicationVersion',
          details: { applicationDefinitionId, version }
        });
      }

      if (target.status === 'RETIRED') {
        throw new AppError({
          code: 'RETIRED_VERSION_CANNOT_BE_PUBLISHED',
          message: 'A retired application definition version cannot be republished.',
          module: 'metadata',
          operation: 'publishApplicationVersion',
          details: { applicationDefinitionId, version }
        });
      }

      await trx
        .updateTable('application_definition_version')
        .set({ status: 'RETIRED' })
        .where('application_definition_id', '=', applicationDefinitionId)
        .where('status', '=', 'PUBLISHED')
        .where('id', '!=', target.id)
        .execute();

      await trx
        .updateTable('application_definition_version')
        .set({
          status: 'PUBLISHED',
          published_at: sql`now()`
        })
        .where('id', '=', target.id)
        .execute();
    });
  }

  private mapApplicationVersion(
    row: {
      readonly id: string;
      readonly application_definition_id: string;
      readonly version: number;
      readonly schema_version: number;
      readonly status: 'DRAFT' | 'PUBLISHED' | 'RETIRED';
      readonly base_config: unknown;
      readonly definition_hash: string | null;
    }
  ): ApplicationDefinitionVersion {
    return {
      id: row.id,
      applicationDefinitionId: row.application_definition_id,
      version: row.version,
      schemaVersion: row.schema_version,
      status: row.status,
      baseConfig: jsonObject(row.base_config),
      definitionHash: row.definition_hash
    };
  }
}

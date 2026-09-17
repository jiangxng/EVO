import { createDatabase } from '../platform/database/src/index.js';
import { loadRuntimeConfig } from '../platform/runtime/src/config.js';
import { PostgresMetadataRepository } from '../modules/metadata/infrastructure/postgres-metadata-repository.js';
import { MetadataService } from '../modules/metadata/application/metadata-service.js';

const config = loadRuntimeConfig();
const handle = createDatabase(config.databaseUrl);
const repository = new PostgresMetadataRepository(handle.db);
const service = new MetadataService(repository);

try {
  const enterpriseId = await service.createEnterprise({
    code: 'EVO_DEMO',
    name: 'EVO Demo Enterprise',
    defaultTimezone: 'Asia/Singapore'
  }).catch(async (error: unknown) => {
    const row = await handle.db
      .selectFrom('enterprise')
      .select('id')
      .where('code', '=', 'EVO_DEMO')
      .executeTakeFirstOrThrow();
    return row.id;
  });

  const applicationDefinitionId = await service.createApplicationSkeleton({
    domainCode: 'sales',
    domainName: 'Sales',
    transactionTypeCode: 'sales_order',
    transactionTypeName: 'Sales Order',
    applicationCode: 'sales_order',
    applicationName: 'Sales Order'
  });

  const existing = await handle.db
    .selectFrom('application_definition_version')
    .select('id')
    .where('application_definition_id', '=', applicationDefinitionId)
    .where('version', '=', 1)
    .executeTakeFirst();

  if (existing === undefined) {
    await service.createApplicationVersion({
      applicationDefinitionId,
      version: 1,
      baseConfig: {
        ui: {
          title: 'Sales Order'
        }
      }
    });

    await service.publishApplicationVersion(applicationDefinitionId, 1);
  }

  const instance = await handle.db
    .selectFrom('application_instance')
    .select('id')
    .where('enterprise_id', '=', enterpriseId)
    .where('code', '=', 'sales_order')
    .executeTakeFirst();

  if (instance === undefined) {
    await handle.db
      .insertInto('application_instance')
      .values({
        enterprise_id: enterpriseId,
        application_definition_id: applicationDefinitionId,
        code: 'sales_order',
        name: 'Sales Order',
        pinned_definition_version: null,
        status: 'ACTIVE',
        config: {}
      })
      .execute();
  }

  console.log({
    enterpriseId,
    applicationDefinitionId,
    status: 'M1 demo metadata ready'
  });
} finally {
  await handle.destroy();
}

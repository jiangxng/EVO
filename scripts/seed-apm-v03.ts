import { createDatabase } from '../platform/database/src/index.js';
import { loadRuntimeConfig } from '../platform/runtime/src/config.js';

const config = loadRuntimeConfig();
const database = createDatabase(config.databaseUrl);
const db = database.db;

async function one<T>(promise: Promise<T | undefined>, label: string): Promise<T> {
  const value = await promise;
  if (value === undefined) throw new Error(`APM seed failed: ${label}`);
  return value;
}

try {
  // v0.3 augments the normal demo seed so it inherits the tested runtime state.
  const enterprise = await one(
    db.selectFrom('enterprise').select(['id']).where('code', '=', 'EVO_DEMO').executeTakeFirst(),
    'run npm run seed:demo first'
  );

  const domain = await one(
    db.insertInto('domain_definition').values({
      code: 'procurement', name: 'Procurement', description: 'Supplier sourcing and commitment domain'
    }).onConflict((oc) => oc.column('code').doUpdateSet({ name: 'Procurement' }))
      .returning('id').executeTakeFirst(), 'procurement domain'
  );
  const txType = await one(
    db.insertInto('transaction_type').values({
      domain_id: domain.id, code: 'supplier_commitment', name: 'Supplier Commitment', description: null
    }).onConflict((oc) => oc.column('code').doUpdateSet({ name: 'Supplier Commitment' }))
      .returning('id').executeTakeFirst(), 'supplier commitment type'
  );
  const app = await one(
    db.insertInto('application_definition').values({
      transaction_type_id: txType.id, code: 'procurement_supplier_commitment',
      name: 'Procurement Supplier Commitment', description: 'APM alternate-supplier decision runtime'
    }).onConflict((oc) => oc.column('code').doUpdateSet({ name: 'Procurement Supplier Commitment' }))
      .returning('id').executeTakeFirst(), 'procurement application'
  );

  let version = await db.selectFrom('application_definition_version').select('id')
    .where('application_definition_id', '=', app.id).where('version', '=', 1).executeTakeFirst();
  version ??= await one(
    db.insertInto('application_definition_version').values({
      application_definition_id: app.id, version: 1, status: 'PUBLISHED', schema_version: 1,
      base_config: { referenceEnterprise: 'APM' }, definition_hash: 'apm-procurement-v0.3.0-v1', published_at: new Date()
    }).returning('id').executeTakeFirst(), 'procurement application version'
  );

  const instance = await one(
    db.insertInto('application_instance').values({
      enterprise_id: enterprise.id, application_definition_id: app.id, code: 'apm-procurement',
      name: 'APM Procurement', pinned_definition_version: 1, status: 'ACTIVE',
      config: { referenceEnterprise: 'Apex Precision Manufacturing' }
    }).onConflict((oc) => oc.columns(['enterprise_id','code']).doUpdateSet({
      name: 'APM Procurement', pinned_definition_version: 1, status: 'ACTIVE'
    })).returning('id').executeTakeFirst(), 'APM procurement instance'
  );

  const inputSchema = {
    type: 'object',
    required: ['supplierId'],
    additionalProperties: false,
    properties: {
      supplierId: { type: 'string', enum: ['SUPPLIER-A', 'SUPPLIER-B'] }
    }
  };
  await db.insertInto('command_definition').values({
    application_definition_version_id: version.id,
    code: 'procurement.use-alternate-supplier',
    name: 'Use Alternate Supplier',
    input_schema: inputSchema,
    preconditions: [],
    execution_policy: { authorization: 'procurement.use-alternate-supplier', humanConfirmationRequired: true },
    resulting_business_data_type: 'procurement.alternate-supplier-selected',
    config: { referenceScenario: 'APM-SO-20260918-0182' }
  }).onConflict((oc) => oc.columns(['application_definition_version_id','code']).doUpdateSet({
    name: 'Use Alternate Supplier', input_schema: inputSchema,
    execution_policy: { authorization: 'procurement.use-alternate-supplier', humanConfirmationRequired: true },
    resulting_business_data_type: 'procurement.alternate-supplier-selected'
  })).execute();

  for (const [actorType, actorId] of [['HUMAN','demo-user'], ['AI','demo-agent']] as const) {
    await db.insertInto('permission_grant').values({
      enterprise_id: enterprise.id, actor_type: actorType, actor_id: actorId,
      permission_code: 'procurement.use-alternate-supplier', resource_scope: {}
    }).onConflict((oc) => oc.columns(['enterprise_id','actor_type','actor_id','permission_code']).doNothing()).execute();
  }

  console.log(JSON.stringify({
    status: 'ok', referenceEnterprise: 'APM', enterpriseId: enterprise.id,
    procurementApplicationInstanceId: instance.id,
    commandCode: 'procurement.use-alternate-supplier', inputSchemaVersion: '1'
  }, null, 2));
} finally {
  await database.destroy();
}

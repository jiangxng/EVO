import { createDatabase } from '../platform/database/src/index.js';
import { loadRuntimeConfig } from '../platform/runtime/src/config.js';

const config = loadRuntimeConfig();
const database = createDatabase(config.databaseUrl);
const db = database.db;

async function one<T>(promise: Promise<T | undefined>, label: string): Promise<T> {
  const value = await promise;
  if (value === undefined) throw new Error(`Seed failed: ${label}`);
  return value;
}

try {
  const enterprise = await one(
    db.insertInto('enterprise')
      .values({
        code: 'EVO_DEMO',
        name: 'EVO Demo Enterprise',
        status: 'ACTIVE',
        default_timezone: 'Asia/Singapore'
      })
      .onConflict((oc) => oc.column('code').doUpdateSet({ name: 'EVO Demo Enterprise' }))
      .returning(['id']).executeTakeFirst(),
    'enterprise'
  );

  const salesDomain = await one(
    db.insertInto('domain_definition')
      .values({ code: 'sales', name: 'Sales', description: 'Sales domain' })
      .onConflict((oc) => oc.column('code').doUpdateSet({ name: 'Sales' }))
      .returning('id').executeTakeFirst(), 'sales domain'
  );
  const inventoryDomain = await one(
    db.insertInto('domain_definition')
      .values({ code: 'inventory', name: 'Inventory', description: 'Inventory domain' })
      .onConflict((oc) => oc.column('code').doUpdateSet({ name: 'Inventory' }))
      .returning('id').executeTakeFirst(), 'inventory domain'
  );

  const salesType = await one(
    db.insertInto('transaction_type')
      .values({ domain_id: salesDomain.id, code: 'sales_order', name: 'Sales Order', description: null })
      .onConflict((oc) => oc.column('code').doUpdateSet({ name: 'Sales Order' }))
      .returning('id').executeTakeFirst(), 'sales type'
  );
  const inventoryType = await one(
    db.insertInto('transaction_type')
      .values({ domain_id: inventoryDomain.id, code: 'inventory_movement', name: 'Inventory Movement', description: null })
      .onConflict((oc) => oc.column('code').doUpdateSet({ name: 'Inventory Movement' }))
      .returning('id').executeTakeFirst(), 'inventory type'
  );

  async function app(code: string, name: string, typeId: string) {
    return one(
      db.insertInto('application_definition')
        .values({ transaction_type_id: typeId, code, name, description: null })
        .onConflict((oc) => oc.column('code').doUpdateSet({ name }))
        .returning('id').executeTakeFirst(), code
    );
  }
  const salesApp = await app('sales_order', 'Sales Order', salesType.id);
  const invApp = await app('inventory_movement', 'Inventory Movement', inventoryType.id);

  async function version(appId: string) {
    const existing = await db.selectFrom('application_definition_version')
      .select('id').where('application_definition_id','=',appId).where('version','=',1).executeTakeFirst();
    if (existing) return existing;
    return one(
      db.insertInto('application_definition_version').values({
        application_definition_id: appId,
        version: 1,
        status: 'PUBLISHED',
        schema_version: 1,
        base_config: {},
        definition_hash: 'demo-v1',
        published_at: new Date()
      }).returning('id').executeTakeFirst(), 'version'
    );
  }
  const salesVersion = await version(salesApp.id);
  const invVersion = await version(invApp.id);

  async function instance(appId: string, code: string, name: string) {
    return one(
      db.insertInto('application_instance').values({
        enterprise_id: enterprise.id,
        application_definition_id: appId,
        code,
        name,
        pinned_definition_version: null,
        status: 'ACTIVE',
        config: {}
      }).onConflict((oc) => oc.columns(['enterprise_id','code']).doUpdateSet({ name }))
        .returning('id').executeTakeFirst(), code
    );
  }
  await instance(salesApp.id, 'sales', 'Sales');
  await instance(invApp.id, 'inventory', 'Inventory');

  const trueExpr = { type: 'literal', value: true };
  const field = (path: string) => ({ type: 'field', path });
  const eq = (path: string, value: string) => ({
    type: 'eq', left: field(path), right: { type: 'literal', value }
  });
  const neg = (path: string) => ({
    type: 'sub', left: { type: 'literal', value: 0 }, right: field(path)
  });

  async function command(versionId: string, code: string, name: string, resultType: string) {
    await db.insertInto('command_definition').values({
      application_definition_version_id: versionId,
      code, name,
      input_schema: { type: 'object' },
      preconditions: [],
      execution_policy: {},
      resulting_business_data_type: resultType,
      config: {}
    }).onConflict((oc) => oc.columns(['application_definition_version_id','code']).doUpdateSet({
      name,
      resulting_business_data_type: resultType
    })).execute();
  }
  await command(salesVersion.id, 'approve-sales-order', 'Approve Sales Order', 'sales_order.approved');
  await command(invVersion.id, 'receive-inventory', 'Receive Inventory', 'inventory.received');
  await command(invVersion.id, 'ship-inventory', 'Ship Inventory', 'inventory.shipped');

  async function ledger(code: string, name: string) {
    await db.insertInto('ledger_definition').values({
      code, name,
      quantity_semantics: 'SIGNED',
      amount_semantics: 'SIGNED',
      dimension_schema: {},
      config: {}
    }).onConflict((oc) => oc.column('code').doUpdateSet({ name })).execute();
  }
  await ledger('pending_production','待生产');
  await ledger('pending_shipment','待出库/发货');
  await ledger('receivable','待收款');
  await ledger('inventory','库存');

  async function rule(
    versionId: string,
    code: string,
    priority: number,
    condition: Record<string, unknown>,
    effect: Record<string, unknown>
  ) {
    await db.insertInto('posting_rule').values({
      application_definition_version_id: versionId,
      code, priority,
      condition_ast: condition,
      effect_ast: effect,
      rule_schema_version: 1
    }).onConflict((oc) => oc.columns(['application_definition_version_id','code']).doUpdateSet({
      priority, condition_ast: condition, effect_ast: effect, rule_schema_version: 1
    })).execute();
  }

  const orderDims = {
    order_no: field('orderNo'),
    customer: field('customer')
  };
  await rule(salesVersion.id,'order-pending-production',10,trueExpr,{
    ledgerCode:'pending_production',
    quantity: field('totalQuantity'),
    amount: { type:'literal', value:'0' },
    dimensions: orderDims
  });
  await rule(salesVersion.id,'order-pending-shipment',20,trueExpr,{
    ledgerCode:'pending_shipment',
    quantity: field('totalQuantity'),
    amount: { type:'literal', value:'0' },
    dimensions: orderDims
  });
  await rule(salesVersion.id,'order-receivable',30,trueExpr,{
    ledgerCode:'receivable',
    quantity: { type:'literal', value:0 },
    amount: field('totalAmount'),
    currency: field('currency'),
    dimensions: orderDims
  });

  const invDims = {
    product_id: field('productId'),
    warehouse: field('warehouse')
  };
  await rule(invVersion.id,'inventory-receive',10,eq('movementType','RECEIVE'),{
    ledgerCode:'inventory',
    quantity: field('quantity'),
    amount: field('totalCost'),
    dimensions: invDims
  });
  await rule(invVersion.id,'inventory-ship',20,eq('movementType','SHIP'),{
    ledgerCode:'inventory',
    quantity: neg('quantity'),
    amount: { type:'literal', value:'0' },
    dimensions: invDims
  });

  for (const [actorType, actorId] of [
    ['HUMAN','demo-user'],
    ['AI','demo-agent'],
    ['AUTOMATION','demo-automation']
  ] as const) {
    await db.insertInto('permission_grant').values({
      enterprise_id: enterprise.id,
      actor_type: actorType,
      actor_id: actorId,
      permission_code: '*',
      resource_scope: {}
    }).onConflict((oc) => oc.columns([
      'enterprise_id','actor_type','actor_id','permission_code'
    ]).doNothing()).execute();
  }

  await db.insertInto('feature_flag').values({
    code: 'posting_evaluator_v2',
    enterprise_id: enterprise.id,
    enabled: false,
    config: { rollout: 'demo' },
    owner: 'posting',
    introduced_in: '0.9.0',
    expires_at: null
  }).onConflict((oc) => oc.columns(['code','enterprise_id']).doNothing()).execute();

  await db.insertInto('valuation_policy').values({
    enterprise_id: enterprise.id,
    code: 'inventory_default',
    name: 'Default Inventory Cost',
    method: 'FIFO',
    negative_inventory_policy: 'DISALLOW_NEGATIVE',
    pool_dimension_schema: { keys: ['warehouse','productId'] },
    config: {},
    version: 1,
    status: 'ACTIVE'
  }).onConflict((oc) => oc.columns(['enterprise_id','code','version']).doNothing()).execute();

  console.log(JSON.stringify({
    status: 'ok',
    enterpriseId: enterprise.id,
    enterpriseCode: 'EVO_DEMO'
  }, null, 2));
} finally {
  await database.destroy();
}

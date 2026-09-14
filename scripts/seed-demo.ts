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

  async function domain(code: string, name: string) {
    return one(
      db.insertInto('domain_definition')
        .values({ code, name, description: `${name} domain` })
        .onConflict((oc) => oc.column('code').doUpdateSet({ name }))
        .returning('id').executeTakeFirst(), `${code} domain`
    );
  }
  const salesDomain = await domain('sales', 'Sales');
  const productionDomain = await domain('production', 'Production');
  const inventoryDomain = await domain('inventory', 'Inventory');

  async function txType(domainId: string, code: string, name: string) {
    return one(
      db.insertInto('transaction_type')
        .values({ domain_id: domainId, code, name, description: null })
        .onConflict((oc) => oc.column('code').doUpdateSet({ name }))
        .returning('id').executeTakeFirst(), `${code} transaction type`
    );
  }
  const salesType = await txType(salesDomain.id, 'sales_order', 'Sales Order');
  const productionType = await txType(productionDomain.id, 'production_completion', 'Production Completion');
  const inventoryType = await txType(inventoryDomain.id, 'inventory_movement', 'Inventory Movement');

  async function app(code: string, name: string, typeId: string) {
    return one(
      db.insertInto('application_definition')
        .values({ transaction_type_id: typeId, code, name, description: null })
        .onConflict((oc) => oc.column('code').doUpdateSet({ name }))
        .returning('id').executeTakeFirst(), code
    );
  }
  const salesApp = await app('sales_order', 'Sales Order', salesType.id);
  const productionApp = await app('production_completion', 'Production Completion', productionType.id);
  const inventoryApp = await app('inventory_movement', 'Inventory Movement', inventoryType.id);

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
        definition_hash: 'demo-v1-alpha2',
        published_at: new Date()
      }).returning('id').executeTakeFirst(), 'version'
    );
  }
  const salesVersion = await version(salesApp.id);
  const productionVersion = await version(productionApp.id);
  const inventoryVersion = await version(inventoryApp.id);

  async function instance(appId: string, code: string, name: string) {
    return one(
      db.insertInto('application_instance').values({
        enterprise_id: enterprise.id,
        application_definition_id: appId,
        code,
        name,
        pinned_definition_version: 1,
        status: 'ACTIVE',
        config: {}
      }).onConflict((oc) => oc.columns(['enterprise_id','code']).doUpdateSet({ name, pinned_definition_version: 1 }))
        .returning('id').executeTakeFirst(), code
    );
  }
  await instance(salesApp.id, 'sales', 'Sales');
  await instance(productionApp.id, 'production', 'Production');
  await instance(inventoryApp.id, 'inventory', 'Inventory');

  await db.insertInto('item_definition').values({
    enterprise_id: enterprise.id,
    code: 'P-100',
    name: 'Demo Finished Good P-100',
    item_type: 'FINISHED_GOOD',
    track_inventory: true,
    default_fulfillment_mode: 'MAKE',
    base_unit: 'EA',
    config: {}
  }).onConflict((oc) => oc.columns(['enterprise_id','code']).doUpdateSet({
    name: 'Demo Finished Good P-100',
    item_type: 'FINISHED_GOOD',
    track_inventory: true,
    default_fulfillment_mode: 'MAKE',
    base_unit: 'EA'
  })).execute();

  async function capability(code: string, name: string) {
    await db.insertInto('capability_definition').values({
      enterprise_id: enterprise.id,
      code, name, description: null, version: 1, status: 'PUBLISHED', config: {}, published_at: new Date()
    }).onConflict((oc) => oc.columns(['enterprise_id','code','version']).doUpdateSet({ name, status: 'PUBLISHED' })).execute();
  }
  await capability('sell', 'Sell');
  await capability('produce', 'Produce');
  await capability('deliver', 'Deliver');
  await capability('collect', 'Collect');

  const flow = await one(
    db.insertInto('flow_definition').values({
      enterprise_id: enterprise.id,
      code: 'order-to-cash',
      name: 'Order to Cash',
      description: 'Reference cross-domain flow for EVO v1 alpha.',
      version: 1,
      status: 'PUBLISHED',
      definition: {
        steps: ['sales-order-approved','production-completed','shipment-created','costed','collection']
      },
      published_at: new Date()
    }).onConflict((oc) => oc.columns(['enterprise_id','code','version']).doUpdateSet({
      name: 'Order to Cash', status: 'PUBLISHED'
    })).returning('id').executeTakeFirst(), 'flow definition'
  );

  await db.insertInto('metric_definition').values({
    enterprise_id: enterprise.id,
    code: 'order-fulfillment-open-qty',
    name: 'Open Order Fulfillment Quantity',
    description: 'Quantity still pending shipment in the reference flow.',
    version: 1,
    status: 'PUBLISHED',
    value_type: 'DECIMAL',
    definition: { source: 'ledger_balance', ledger: 'pending_shipment', aggregation: 'sum(quantity)' },
    lineage: { sourceLedger: 'pending_shipment' },
    published_at: new Date()
  }).onConflict((oc) => oc.columns(['enterprise_id','code','version']).doUpdateSet({ status: 'PUBLISHED' })).execute();

  const sop = await one(
    db.insertInto('sop_definition').values({
      enterprise_id: enterprise.id,
      code: 'finished-goods-completion',
      name: 'Finished Goods Completion',
      description: 'Reference SOP for production completion.'
    }).onConflict((oc) => oc.columns(['enterprise_id','code']).doUpdateSet({ name: 'Finished Goods Completion' }))
      .returning('id').executeTakeFirst(), 'sop definition'
  );
  const sopVersion = await one(
    db.insertInto('sop_version').values({
      sop_definition_id: sop.id,
      version: 1,
      status: 'PUBLISHED',
      summary: 'Confirm produced quantity, warehouse and total production cost before completion.',
      config: {},
      published_at: new Date()
    }).onConflict((oc) => oc.columns(['sop_definition_id','version']).doUpdateSet({ status: 'PUBLISHED' }))
      .returning('id').executeTakeFirst(), 'sop version'
  );
  await db.insertInto('sop_step').values({
    sop_version_id: sopVersion.id,
    step_no: 1,
    code: 'confirm-completion',
    title: 'Confirm production completion',
    instruction: 'Verify order, item, completed quantity, warehouse and total production cost before issuing the completion Command.',
    evidence_requirement: { requiredFields: ['orderNo','productId','quantity','warehouse','totalCost'] },
    control: { authorization: 'production.complete' }
  }).onConflict((oc) => oc.columns(['sop_version_id','step_no']).doUpdateSet({ title: 'Confirm production completion' })).execute();

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
  await command(productionVersion.id, 'complete-production', 'Complete Production', 'production.completed');
  await command(inventoryVersion.id, 'ship-sales-order', 'Ship Sales Order', 'sales_shipment.created');
  // v0.9 compatibility-only technical command. Not part of the v1 semantic reference flow.
  await command(inventoryVersion.id, 'receive-inventory', 'Receive Inventory (Legacy Demo)', 'inventory.received');

  for (const [code, name] of [
    ['order_no','Order'],
    ['customer','Customer'],
    ['product_id','Product'],
    ['warehouse','Warehouse'],
    ['project','Project'],
    ['department','Department'],
    ['profit_center','Profit Center'],
    ['cost_center','Cost Center']
  ] as const) {
    await db.insertInto('dimension_definition').values({
      enterprise_id: null,
      code,
      name,
      data_type: 'TEXT',
      version: 1,
      status: 'PUBLISHED',
      config: {},
      published_at: new Date()
    }).onConflict((oc) => oc.columns(['enterprise_id','code','version']).doUpdateSet({
      name, status: 'PUBLISHED'
    })).execute();
  }

  async function ledger(code: string, name: string, dimensionSchema: Record<string, unknown>) {
    await db.insertInto('ledger_definition').values({
      code, name,
      quantity_semantics: 'SIGNED',
      amount_semantics: 'SIGNED',
      dimension_schema: dimensionSchema,
      config: {}
    }).onConflict((oc) => oc.column('code').doUpdateSet({ name, dimension_schema: dimensionSchema })).execute();
  }
  const operationalOrderPolicy = {
    required: ['order_no','product_id'],
    optional: ['customer','project','department','profit_center','cost_center']
  };
  const inventoryPolicy = {
    required: ['product_id','warehouse'],
    optional: ['order_no','customer','project','department','profit_center','cost_center']
  };
  const receivablePolicy = {
    required: ['order_no','customer'],
    optional: ['product_id','project','department','profit_center','cost_center']
  };
  await ledger('pending_production','待生产', operationalOrderPolicy);
  await ledger('pending_shipment','待出库/发货', operationalOrderPolicy);
  await ledger('receivable','待收款', receivablePolicy);
  await ledger('inventory','库存', inventoryPolicy);
  await ledger('cogs','销售成本', inventoryPolicy);

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
    order_no: field('orderNo'), customer: field('customer'), product_id: field('productId'),
    project: field('project'), department: field('department'),
    profit_center: field('profitCenter'), cost_center: field('costCenter')
  };
  await rule(salesVersion.id,'order-pending-production',10,trueExpr,{
    ledgerCode:'pending_production', quantity: field('quantity'), amount: { type:'literal', value:'0' }, dimensions: orderDims
  });
  await rule(salesVersion.id,'order-pending-shipment',20,trueExpr,{
    ledgerCode:'pending_shipment', quantity: field('quantity'), amount: { type:'literal', value:'0' }, dimensions: orderDims
  });
  await rule(salesVersion.id,'order-receivable',30,trueExpr,{
    ledgerCode:'receivable', quantity: { type:'literal', value:0 }, amount: field('totalAmount'), currency: field('currency'), dimensions: orderDims
  });

  const invDims = {
    product_id: field('productId'), warehouse: field('warehouse'),
    order_no: field('orderNo'), customer: field('customer'),
    project: field('project'), department: field('department'),
    profit_center: field('profitCenter'), cost_center: field('costCenter')
  };
  await rule(productionVersion.id,'production-close-demand',10,trueExpr,{
    ledgerCode:'pending_production', quantity: neg('quantity'), amount: { type:'literal', value:'0' }, dimensions: orderDims
  });
  await rule(productionVersion.id,'production-finished-goods',20,trueExpr,{
    ledgerCode:'inventory', quantity: field('quantity'), amount: field('totalCost'), dimensions: invDims
  });

  await rule(inventoryVersion.id,'shipment-inventory',10,eq('movementType','SHIP'),{
    ledgerCode:'inventory', quantity: neg('quantity'), amount: { type:'literal', value:'0' }, dimensions: invDims
  });
  await rule(inventoryVersion.id,'shipment-close-pending',20,eq('movementType','SHIP'),{
    ledgerCode:'pending_shipment', quantity: neg('quantity'), amount: { type:'literal', value:'0' }, dimensions: orderDims
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
    code: 'v10_reference_flow',
    enterprise_id: enterprise.id,
    enabled: true,
    config: { flow: 'order-to-cash', alpha: 2, dimensions: true, valuationPosting: true },
    owner: 'flow',
    introduced_in: '1.0.0-alpha.2',
    expires_at: null
  }).onConflict((oc) => oc.columns(['code','enterprise_id']).doUpdateSet({ enabled: true })).execute();

  await db.insertInto('valuation_rule').values({
    enterprise_id: enterprise.id,
    code: 'shipment-inventory-to-cogs',
    name: 'Shipment Inventory Value to COGS',
    source_business_data_type: 'sales_shipment.created',
    inventory_ledger_code: 'inventory',
    cogs_ledger_code: 'cogs',
    dimension_mapping: {
      product_id: field('productId'),
      warehouse: field('warehouse'),
      order_no: field('orderNo'),
      customer: field('customer'),
      project: field('project'),
      department: field('department'),
      profit_center: field('profitCenter'),
      cost_center: field('costCenter')
    },
    version: 1,
    status: 'PUBLISHED',
    published_at: new Date()
  }).onConflict((oc) => oc.columns(['enterprise_id','code','version']).doUpdateSet({
    status: 'PUBLISHED'
  })).execute();

  for (const method of ['FIFO','LIFO','MOVING_AVERAGE','SPECIFIC_IDENTIFICATION'] as const) {
    await db.insertInto('valuation_policy').values({
      enterprise_id: enterprise.id,
      code: `inventory_${method.toLowerCase()}`,
      name: `${method} Inventory Cost`,
      method,
      negative_inventory_policy: 'DISALLOW_NEGATIVE',
      pool_dimension_schema: { keys: ['warehouse','productId'] },
      config: { alpha2: true },
      version: 1,
      status: 'ACTIVE'
    }).onConflict((oc) => oc.columns(['enterprise_id','code','version']).doUpdateSet({ status: 'ACTIVE' })).execute();
  }

  console.log(JSON.stringify({
    status: 'ok',
    enterpriseId: enterprise.id,
    enterpriseCode: 'EVO_DEMO',
    referenceItem: 'P-100',
    referenceFlowId: flow.id
  }, null, 2));
} finally {
  await database.destroy();
}

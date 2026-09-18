import { Decimal } from 'decimal.js';
import { createDatabase } from '../platform/database/src/index.js';
import { loadRuntimeConfig } from '../platform/runtime/src/config.js';
import { createEvoRuntime, demoIds, drainPosting } from '../apps/api/src/evo-runtime.js';

const config = loadRuntimeConfig();
const database = createDatabase(config.databaseUrl);
const runtime = createEvoRuntime(database);

try {
  const ids = await demoIds(runtime);
  const suffix = Date.now();
  const orderNo = `ALPHA2-${suffix}`;
  const correlationId = `O2C:${orderNo}`;
  const project = `PROJECT-${suffix}`;

  const order = await runtime.command.execute({
    enterpriseId: ids.enterpriseId,
    applicationInstanceId: ids.salesAppId,
    commandCode: 'approve-sales-order',
    actor: { type: 'AUTOMATION', id: 'demo-automation' },
    requestId: `${orderNo}:approve`, correlationId,
    idempotencyKey: `${orderNo}:approve`,
    input: {
      orderNo, customer: 'Validation', productId: 'P-100', quantity: 10,
      unitPrice: '100.00', totalAmount: '1000.00', currency: 'USD',
      fulfillmentMode: 'MAKE', project, department: 'SALES',
      profitCenter: 'PC-PROJECT', costCenter: 'CC-SALES'
    },
    effectiveAt: new Date(), businessObjectKey: orderNo,
    lineage: { flowDefinitionId: ids.flowDefinitionId, flowInstanceKey: orderNo, stepCode: 'sales-order-approved' }
  });
  await runtime.flow.projectCommand(order.commandExecutionId);
  await drainPosting(runtime, ids.enterpriseId);
  const orderBusiness = await runtime.db.selectFrom('business_data').select('id')
    .where('command_execution_id','=',order.commandExecutionId).executeTakeFirstOrThrow();

  const production = await runtime.command.execute({
    enterpriseId: ids.enterpriseId,
    applicationInstanceId: ids.productionAppId,
    commandCode: 'complete-production',
    actor: { type: 'AUTOMATION', id: 'demo-automation' },
    requestId: `${orderNo}:production`, correlationId, causationId: orderBusiness.id,
    idempotencyKey: `${orderNo}:production`,
    input: {
      orderNo, customer: 'Validation', productId: 'P-100', warehouse: 'HK',
      quantity: 10, totalCost: '100.00', project, department: 'SALES',
      profitCenter: 'PC-PROJECT', costCenter: 'CC-SALES'
    },
    effectiveAt: new Date(), businessObjectKey: `PROD:${orderNo}:P-100`,
    lineage: {
      flowDefinitionId: ids.flowDefinitionId, flowInstanceKey: orderNo,
      stepCode: 'production-completed', parentBusinessDataId: orderBusiness.id,
      relationType: 'FULFILLS'
    }
  });
  await runtime.flow.projectCommand(production.commandExecutionId);
  await drainPosting(runtime, ids.enterpriseId);

  const shipmentNo = `SHIP-${suffix}`;
  const shipment = await runtime.command.execute({
    enterpriseId: ids.enterpriseId,
    applicationInstanceId: ids.inventoryAppId,
    commandCode: 'ship-sales-order',
    actor: { type: 'AUTOMATION', id: 'demo-automation' },
    requestId: `${orderNo}:shipment`, correlationId, causationId: orderBusiness.id,
    idempotencyKey: shipmentNo,
    input: {
      movementType: 'SHIP', shipmentNo, orderNo, customer: 'Validation',
      productId: 'P-100', warehouse: 'HK', quantity: 2, lot: null,
      project, department: 'SALES', profitCenter: 'PC-PROJECT', costCenter: 'CC-SALES'
    },
    effectiveAt: new Date(), businessObjectKey: shipmentNo,
    lineage: {
      flowDefinitionId: ids.flowDefinitionId, flowInstanceKey: orderNo,
      stepCode: 'shipment-created', parentBusinessDataId: orderBusiness.id,
      relationType: 'FULFILLS'
    }
  });
  await runtime.flow.projectCommand(shipment.commandExecutionId);
  await drainPosting(runtime, ids.enterpriseId);

  const fifoPolicy = await runtime.db.selectFrom('valuation_policy')
    .select(['id','version'])
    .where('enterprise_id','=',ids.enterpriseId)
    .where('method','=','FIFO')
    .where('status','=','ACTIVE')
    .orderBy('version','desc')
    .executeTakeFirstOrThrow();

  const fifoAllocationPolicy = await runtime.db.selectFrom('allocation_policy')
    .select(['id','version'])
    .where('enterprise_id','=',ids.enterpriseId)
    .where('code','=','inventory_fifo')
    .where('status','=','PUBLISHED')
    .orderBy('version','desc')
    .executeTakeFirstOrThrow();

  const shipmentValuationRule = await runtime.db.selectFrom('valuation_rule')
    .select(['id','version'])
    .where('enterprise_id','=',ids.enterpriseId)
    .where('source_business_data_type','=','sales_shipment.created')
    .where('status','=','PUBLISHED')
    .orderBy('version','desc')
    .executeTakeFirstOrThrow();

  const cost = await runtime.cost.recalculate(ids.enterpriseId, 'FIFO', {
    valuationPolicyId: fifoPolicy.id,
    valuationPolicyVersion: fifoPolicy.version,
    allocationPolicyId: fifoAllocationPolicy.id,
    allocationPolicyVersion: fifoAllocationPolicy.version,
    valuationRules: {
      'sales_shipment.created': {
        id: shipmentValuationRule.id,
        version: shipmentValuationRule.version
      }
    }
  });
  if (cost.resultCount < 1 || cost.valuationPostingCount < 1) {
    throw new Error(`Expected cost + valuation posting, got ${JSON.stringify(cost)}`);
  }

  const shipmentBusiness = await runtime.db.selectFrom('business_data')
    .select('id')
    .where('command_execution_id','=',shipment.commandExecutionId)
    .executeTakeFirstOrThrow();

  const allocationEdges = await runtime.db.selectFrom('allocation_relation')
    .select(['source_business_data_id','consumer_business_data_id','measurements','lineage'])
    .where('enterprise_id','=',ids.enterpriseId)
    .where('consumer_business_data_id','=',shipmentBusiness.id)
    .execute();

  if (allocationEdges.length < 1) {
    throw new Error('Expected FIFO cost run to persist at least one allocation relation.');
  }

  const productionBusiness = await runtime.db.selectFrom('business_data')
    .select('id')
    .where('command_execution_id','=',production.commandExecutionId)
    .executeTakeFirstOrThrow();

  if (!allocationEdges.some((edge) => edge.source_business_data_id === productionBusiness.id)) {
    throw new Error('Expected shipment allocation lineage to point to production completion source.');
  }

  const balances = await runtime.db.selectFrom('ledger_balance as b')
    .innerJoin('ledger_definition as d','d.id','b.ledger_definition_id')
    .select(['d.code as ledger','b.dimensions','b.quantity','b.amount'])
    .where('b.enterprise_id','=',ids.enterpriseId)
    .execute();
  const scoped = balances.filter((row) => (row.dimensions as Record<string, unknown>).order_no === orderNo);
  const inventory = scoped.find((row) => row.ledger === 'inventory');
  const cogs = scoped.find((row) => row.ledger === 'cogs');
  if (inventory === undefined || cogs === undefined) throw new Error('Expected scoped inventory and COGS balances.');
  if (!new Decimal(inventory.quantity).eq(8) || !new Decimal(inventory.amount).eq(80)) {
    throw new Error(`Inventory expected qty=8 amount=80, got qty=${inventory.quantity} amount=${inventory.amount}`);
  }
  if (!new Decimal(cogs.amount).eq(20)) {
    throw new Error(`COGS expected 20, got ${cogs.amount}`);
  }

  const before = await runtime.query.balanceDigest(ids.enterpriseId);
  const replay = await runtime.replay.prepareFullReplay(ids.enterpriseId);
  await drainPosting(runtime, ids.enterpriseId);
  if (replay.costMethod !== null) {
    await runtime.cost.recalculate(ids.enterpriseId, replay.costMethod, replay.costPins ?? undefined);
  }
  const after = await runtime.query.balanceDigest(ids.enterpriseId);
  await runtime.replay.completeFullReplay(replay.replayRunId, ids.enterpriseId, after);

  if (before !== after || replay.beforeDigest !== before) {
    throw new Error(`Replay digest mismatch: query=${before}, replay=${replay.beforeDigest}, after=${after}`);
  }

  console.log(JSON.stringify({
    status: 'PASS',
    alpha2: 'dimensions+valuation-posting',
    orderNo,
    fifo: { producedQuantity: 10, producedValue: 100, shippedQuantity: 2, inventoryQuantity: 8, inventoryValue: 80, cogs: 20 },
    explicitDimensions: { project, department: 'SALES', profitCenter: 'PC-PROJECT', costCenter: 'CC-SALES' },
    valuationPostingCount: cost.valuationPostingCount,
    allocationRelationCount: allocationEdges.length,
    replayDeterministic: true,
    beforeDigest: before,
    afterDigest: after,
    contextContractVersion: '1.1'
  }, null, 2));
} finally {
  await database.destroy();
}

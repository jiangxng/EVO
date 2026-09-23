import assert from 'node:assert/strict';
import { createDatabase } from '../platform/database/src/index.js';
import { loadRuntimeConfig } from '../platform/runtime/src/config.js';
import { buildApp } from '../apps/api/src/build-app.js';
import { createEvoRuntime, drainPosting } from '../apps/api/src/evo-runtime.js';

const config = loadRuntimeConfig();
const database = createDatabase(config.databaseUrl);
const app = buildApp({ database, loggerLevel: 'silent' });
const runtime = createEvoRuntime(database);

try {
  const enterpriseResponse = await app.inject({
    method: 'GET',
    url: '/api/v1/enterprises/EVO_DEMO'
  });
  assert.equal(enterpriseResponse.statusCode, 200);
  const enterprise = enterpriseResponse.json() as {
    id: string;
    code: string;
    status: string;
  };
  assert.equal(enterprise.code, 'EVO_DEMO');
  assert.equal(enterprise.status, 'ACTIVE');

  const enterpriseId = enterprise.id;
  const capabilityResponse = await app.inject({
    method: 'GET',
    url: `/api/v1/capabilities?enterprise_id=${encodeURIComponent(enterpriseId)}`
  });

  assert.equal(capabilityResponse.statusCode, 200);
  const catalog = capabilityResponse.json() as {
    enterpriseId: string;
    capabilities: Array<{
      code: string;
      kind: string;
      applicationInstanceId: string;
      commandCode?: string;
      permissionCode?: string;
    }>;
  };

  const capability = catalog.capabilities.find(
    (item) => item.code === 'sales_order.approve-sales-order'
  );
  assert.ok(capability, 'sales order public capability must be discoverable');
  assert.equal(capability.kind, 'COMMAND');
  assert.equal(capability.commandCode, 'approve-sales-order');
  assert.equal(capability.permissionCode, 'sales.approve');

  const orderNo = `PUBLIC-API-${Date.now()}`;
  const commandResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/commands',
    payload: {
      enterpriseId,
      capabilityCode: capability.code,
      actor: { type: 'AI', id: 'demo-agent' },
      idempotencyKey: `approve:${orderNo}`,
      correlationId: `PUBLIC:${orderNo}`,
      effectiveAt: '2026-09-18T08:00:00.000Z',
      businessObjectKey: orderNo,
      input: {
        eventKind: 'ORDER',
        orderNo,
        customer: 'Public API Customer',
        productId: 'P-100',
        quantity: 3,
        unitPrice: '100.00',
        totalAmount: '300.00',
        currency: 'USD',
        localCarryingAmount: '2100.00',
        localCurrency: 'CNY',
        fulfillmentMode: 'MAKE',
        project: 'PUBLIC-API-PROJECT',
        department: 'SALES',
        profitCenter: 'PC-PUBLIC',
        costCenter: 'CC-SALES'
      }
    }
  });

  assert.equal(
    commandResponse.statusCode,
    200,
    `public command failed: ${commandResponse.body}`
  );

  const result = commandResponse.json() as {
    capabilityCode: string;
    command: {
      commandExecutionId: string;
      businessDataId: string;
      postingInputId: string;
      postingSequence: string;
      postingStatus: string;
    };
  };
  assert.equal(result.capabilityCode, capability.code);
  assert.ok(result.command.commandExecutionId);
  assert.ok(result.command.businessDataId);
  assert.ok(result.command.postingInputId);
  assert.equal(result.command.postingStatus, 'QUEUED');

  const businessData = await runtime.db
    .selectFrom('business_data')
    .select(['id', 'business_data_type', 'business_object_key'])
    .where('id', '=', result.command.businessDataId)
    .executeTakeFirstOrThrow();
  assert.equal(businessData.business_data_type, 'sales_order.approved');
  assert.equal(businessData.business_object_key, orderNo);

  const posted = await drainPosting(runtime, enterpriseId);
  assert.ok(posted >= 1, 'public command posting input must be processed');

  const [pendingProduction, pendingShipment, receivable] = await Promise.all([
    runtime.ledger.getBalances(enterpriseId, 'pending_production'),
    runtime.ledger.getBalances(enterpriseId, 'pending_shipment'),
    runtime.ledger.getBalances(enterpriseId, 'receivable')
  ]);

  const productionBalance = pendingProduction.find(
    (row) => row.dimensions.order_no === orderNo
  );
  const shipmentBalance = pendingShipment.find(
    (row) => row.dimensions.order_no === orderNo
  );
  const receivableBalance = receivable.find(
    (row) => row.dimensions.order_no === orderNo
  );

  assert.ok(productionBalance, 'pending_production balance must exist');
  assert.ok(shipmentBalance, 'pending_shipment balance must exist');
  assert.ok(receivableBalance, 'receivable balance must exist');
  assert.equal(productionBalance.quantity, '3.000000000000');
  assert.equal(shipmentBalance.quantity, '3.000000000000');
  assert.equal(receivableBalance.amount, '300.000000000000');

  console.log(JSON.stringify({
    status: 'PASS',
    proof: 'PUBLIC_CAPABILITY_COMMAND_TO_LEDGER',
    enterpriseId,
    capabilityCode: capability.code,
    commandExecutionId: result.command.commandExecutionId,
    businessDataId: result.command.businessDataId,
    postingInputId: result.command.postingInputId,
    posted,
    balances: {
      pendingProduction: productionBalance.quantity,
      pendingShipment: shipmentBalance.quantity,
      receivable: receivableBalance.amount
    }
  }, null, 2));
} finally {
  await app.close();
  await database.destroy();
}

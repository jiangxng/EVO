import assert from 'node:assert/strict';
import { createDatabase } from '../platform/database/src/index.js';
import { loadRuntimeConfig } from '../platform/runtime/src/config.js';
import { buildApp } from '../apps/api/src/build-app.js';
import {
  createEvoRuntime,
  drainPosting
} from '../apps/api/src/evo-runtime.js';

const config = loadRuntimeConfig();
const database = createDatabase(config.databaseUrl);
const app = buildApp({ database, loggerLevel: 'silent' });
const runtime = createEvoRuntime(database);

try {
  const enterprise = await runtime.db
    .selectFrom('enterprise')
    .select(['id', 'code'])
    .where('code', '=', 'EVO_DEMO')
    .executeTakeFirstOrThrow();

  const orderNo = `HTTP-SUBMISSION-${Date.now()}`;
  const idempotencyKey = `http:${orderNo}`;
  const body = {
    contractVersion: '0.1.0',
    scopeKey: enterprise.id,
    applicationId: 'sales_order',
    businessDataType: 'sales_order.approved',
    businessObjectKey: orderNo,
    effectiveAt: '2026-10-03T02:00:00.000Z',
    payload: {
      eventKind: 'ORDER',
      orderNo,
      customer: 'HTTP Submission Customer',
      productId: 'P-100',
      quantity: 5,
      unitPrice: '120.00',
      totalAmount: '600.00',
      currency: 'USD',
      localCarryingAmount: '4200.00',
      localCurrency: 'CNY',
      fulfillmentMode: 'MAKE',
      project: 'HTTP-SUBMISSION',
      department: 'SALES',
      profitCenter: 'PC-HTTP',
      costCenter: 'CC-SALES'
    },
    correlationId: `HTTP:${orderNo}`,
    idempotencyKey
  };

  const firstResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/business-data',
    payload: body
  });
  assert.equal(
    firstResponse.statusCode,
    202,
    `submission failed: ${firstResponse.body}`
  );
  const first = firstResponse.json() as {
    contractVersion: string;
    businessDataId: string;
    businessObjectVersion: string;
    postingInputId: string;
    postingSequence: string;
    postingStatus: string;
    idempotentReplay: boolean;
  };
  assert.equal(first.contractVersion, '0.1.0');
  assert.equal(first.businessObjectVersion, '1');
  assert.equal(first.postingStatus, 'QUEUED');
  assert.equal(first.idempotentReplay, false);

  const repeatResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/business-data',
    payload: body
  });
  assert.equal(repeatResponse.statusCode, 202);
  const repeat = repeatResponse.json() as typeof first;
  assert.equal(repeat.idempotentReplay, true);
  assert.equal(repeat.businessDataId, first.businessDataId);
  assert.equal(repeat.postingInputId, first.postingInputId);
  assert.equal(repeat.postingSequence, first.postingSequence);

  const changedResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/business-data',
    payload: {
      ...body,
      payload: {
        ...body.payload,
        totalAmount: '601.00'
      }
    }
  });
  assert.equal(changedResponse.statusCode, 422);
  assert.equal(
    (changedResponse.json() as { error: { code: string } }).error.code,
    'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST'
  );

  const unknownResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/business-data',
    payload: {
      ...body,
      applicationId: 'not-registered',
      idempotencyKey: `unknown:${orderNo}`
    }
  });
  assert.equal(unknownResponse.statusCode, 422);
  assert.equal(
    (unknownResponse.json() as { error: { code: string } }).error.code,
    'APPLICATION_ANCHOR_NOT_FOUND'
  );

  const [businessData, postingInput, commandExecution] = await Promise.all([
    runtime.db
      .selectFrom('business_data')
      .select([
        'application_id',
        'application_instance_id',
        'command_execution_id',
        'metadata_version'
      ])
      .where('id', '=', first.businessDataId)
      .executeTakeFirstOrThrow(),
    runtime.db
      .selectFrom('posting_input')
      .select(['application_id', 'application_instance_id', 'metadata_version'])
      .where('id', '=', first.postingInputId)
      .executeTakeFirstOrThrow(),
    runtime.db
      .selectFrom('command_execution')
      .select('id')
      .where('correlation_id', '=', body.correlationId)
      .executeTakeFirst()
  ]);

  assert.equal(businessData.application_id, 'sales_order');
  assert.equal(businessData.application_instance_id, null);
  assert.equal(businessData.command_execution_id, null);
  assert.equal(businessData.metadata_version, null);
  assert.equal(postingInput.application_id, 'sales_order');
  assert.equal(postingInput.application_instance_id, null);
  assert.equal(postingInput.metadata_version, null);
  assert.equal(commandExecution, undefined);

  const posted = await drainPosting(runtime, enterprise.id);
  assert.ok(posted >= 1);

  const observationResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/runtime-observations/query',
    payload: {
      contractVersion: '0.1.0',
      enterpriseId: enterprise.id,
      target: {
        kind: 'APPLICATION_ANCHOR',
        applicationId: 'sales_order'
      },
      window: {
        startAt: '2026-10-03T01:59:00.000Z',
        endAt: '2026-10-03T02:01:00.000Z'
      },
      metricCodes: ['event.count']
    }
  });
  assert.equal(observationResponse.statusCode, 200);
  const observationBody = observationResponse.json() as {
    observations: Array<{
      metricCode: string;
      value: number;
      target: { kind: string; applicationId?: string };
    }>;
  };
  const applicationEventCount = observationBody.observations.find(
    item => item.metricCode === 'event.count'
  );
  assert.ok(applicationEventCount);
  assert.equal(applicationEventCount.target.kind, 'APPLICATION_ANCHOR');
  assert.equal(applicationEventCount.target.applicationId, 'sales_order');
  assert.equal(applicationEventCount.value, 1);

  const [pendingProduction, pendingShipment, receivable] = await Promise.all([
    runtime.ledger.getBalances(enterprise.id, 'pending_production'),
    runtime.ledger.getBalances(enterprise.id, 'pending_shipment'),
    runtime.ledger.getBalances(enterprise.id, 'receivable')
  ]);

  const production = pendingProduction.find(
    (row) => row.dimensions.order_no === orderNo
  );
  const shipment = pendingShipment.find(
    (row) => row.dimensions.order_no === orderNo
  );
  const receivableRow = receivable.find(
    (row) => row.dimensions.order_no === orderNo
  );

  assert.ok(production);
  assert.ok(shipment);
  assert.ok(receivableRow);
  assert.equal(production.quantity, '5.000000000000');
  assert.equal(shipment.quantity, '5.000000000000');
  assert.equal(receivableRow.amount, '600.000000000000');

  console.log(JSON.stringify({
    status: 'PASS',
    proof: 'HTTP_BUSINESS_DATA_SUBMISSION_TO_LEDGER',
    endpoint: 'POST /api/v1/business-data',
    scopeKey: enterprise.id,
    applicationId: 'sales_order',
    businessDataId: first.businessDataId,
    postingInputId: first.postingInputId,
    commandExecutionCreated: false,
    idempotentReplay: repeat.idempotentReplay,
    applicationEventCount: applicationEventCount.value,
    posted
  }, null, 2));
} finally {
  await app.close();
  await database.destroy();
}

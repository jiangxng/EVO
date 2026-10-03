import assert from 'node:assert/strict';
import { AppError } from '../platform/contracts/src/index.js';
import { createDatabase } from '../platform/database/src/index.js';
import { loadRuntimeConfig } from '../platform/runtime/src/config.js';
import {
  PostgresApplicationAnchorRegistryV010
} from '../modules/business-data/infrastructure/postgres-application-anchor-registry.js';
import {
  PostgresBusinessDataSubmissionPortV010
} from '../modules/business-data/infrastructure/postgres-business-data-submission.js';
import {
  createEvoRuntime,
  drainPosting
} from '../apps/api/src/evo-runtime.js';

const config = loadRuntimeConfig();
const database = createDatabase(config.databaseUrl);
const runtime = createEvoRuntime(database);

try {
  const enterprise = await runtime.db
    .selectFrom('enterprise')
    .select(['id', 'code'])
    .where('code', '=', 'EVO_DEMO')
    .executeTakeFirstOrThrow();

  const scopeKey = 'enterprise:EVO_DEMO';
  const anchors = new PostgresApplicationAnchorRegistryV010(runtime.db);
  const submission = new PostgresBusinessDataSubmissionPortV010(
    runtime.db,
    {
      async resolveEnterpriseId(inputScopeKey) {
        assert.equal(inputScopeKey, scopeKey);
        return enterprise.id;
      }
    },
    anchors
  );

  const orderNo = `DIRECT-SUBMISSION-${Date.now()}`;
  const correlationId = `DIRECT:${orderNo}`;
  const idempotencyKey = `submit:${orderNo}`;
  const request = {
    contractVersion: '0.1.0' as const,
    scopeKey,
    applicationId: 'sales_order',
    businessDataType: 'sales_order.approved',
    businessObjectKey: orderNo,
    effectiveAt: new Date('2026-10-03T01:00:00.000Z'),
    payload: {
      eventKind: 'ORDER',
      orderNo,
      customer: 'Direct Submission Customer',
      productId: 'P-100',
      quantity: 4,
      unitPrice: '125.00',
      totalAmount: '500.00',
      currency: 'USD',
      localCarryingAmount: '3500.00',
      localCurrency: 'CNY',
      fulfillmentMode: 'MAKE',
      project: 'DIRECT-SUBMISSION',
      department: 'SALES',
      profitCenter: 'PC-DIRECT',
      costCenter: 'CC-SALES'
    },
    correlationId,
    idempotencyKey
  };

  await assert.rejects(
    submission.submit({
      ...request,
      applicationId: 'unregistered-application',
      idempotencyKey: `unknown:${orderNo}`
    }),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.code, 'APPLICATION_ANCHOR_NOT_FOUND');
      return true;
    }
  );

  const first = await submission.submit(request);
  assert.equal(first.postingStatus, 'QUEUED');
  assert.equal(first.idempotentReplay, false);
  assert.ok(first.businessDataId);
  assert.ok(first.postingInputId);

  const [businessData, postingInput, commandExecution] = await Promise.all([
    runtime.db
      .selectFrom('business_data')
      .select([
        'id',
        'application_id',
        'application_instance_id',
        'command_execution_id',
        'metadata_version',
        'business_data_type',
        'business_object_key'
      ])
      .where('id', '=', first.businessDataId)
      .executeTakeFirstOrThrow(),
    runtime.db
      .selectFrom('posting_input')
      .select([
        'id',
        'application_id',
        'application_instance_id',
        'metadata_version',
        'status'
      ])
      .where('id', '=', first.postingInputId)
      .executeTakeFirstOrThrow(),
    runtime.db
      .selectFrom('command_execution')
      .select('id')
      .where('correlation_id', '=', correlationId)
      .executeTakeFirst()
  ]);

  assert.equal(businessData.application_id, 'sales_order');
  assert.equal(businessData.application_instance_id, null);
  assert.equal(businessData.command_execution_id, null);
  assert.equal(businessData.metadata_version, null);
  assert.equal(businessData.business_data_type, 'sales_order.approved');
  assert.equal(businessData.business_object_key, orderNo);

  assert.equal(postingInput.application_id, 'sales_order');
  assert.equal(postingInput.application_instance_id, null);
  assert.equal(postingInput.metadata_version, null);
  assert.equal(postingInput.status, 'QUEUED');

  assert.equal(
    commandExecution,
    undefined,
    'direct submission must not synthesize CommandExecution'
  );

  const replay = await submission.submit(request);
  assert.equal(replay.idempotentReplay, true);
  assert.equal(replay.businessDataId, first.businessDataId);
  assert.equal(replay.postingInputId, first.postingInputId);
  assert.equal(replay.postingSequence, first.postingSequence);

  const objectRows = await runtime.db
    .selectFrom('business_data')
    .select('id')
    .where('enterprise_id', '=', enterprise.id)
    .where('application_id', '=', 'sales_order')
    .where('business_object_key', '=', orderNo)
    .execute();
  assert.equal(objectRows.length, 1);

  await assert.rejects(
    submission.submit({
      ...request,
      payload: {
        ...request.payload,
        totalAmount: '501.00'
      }
    }),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(
        error.code,
        'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST'
      );
      return true;
    }
  );

  const posted = await drainPosting(runtime, enterprise.id);
  assert.ok(posted >= 1, 'direct submission must reach PostingService');

  const run = await runtime.db
    .selectFrom('posting_run')
    .select(['id', 'metadata_version', 'status'])
    .where('posting_input_id', '=', first.postingInputId)
    .where('mode', '=', 'NORMAL')
    .executeTakeFirstOrThrow();
  assert.equal(run.metadata_version, null);
  assert.equal(run.status, 'COMPLETED');

  const [pendingProduction, pendingShipment, receivable] = await Promise.all([
    runtime.ledger.getBalances(enterprise.id, 'pending_production'),
    runtime.ledger.getBalances(enterprise.id, 'pending_shipment'),
    runtime.ledger.getBalances(enterprise.id, 'receivable')
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

  assert.ok(productionBalance);
  assert.ok(shipmentBalance);
  assert.ok(receivableBalance);
  assert.equal(productionBalance.quantity, '4.000000000000');
  assert.equal(shipmentBalance.quantity, '4.000000000000');
  assert.equal(receivableBalance.amount, '500.000000000000');

  const receipt = await runtime.db
    .selectFrom('business_data_submission_receipt')
    .select(['status', 'result', 'error'])
    .where('enterprise_id', '=', enterprise.id)
    .where('application_id', '=', 'sales_order')
    .where('idempotency_key', '=', idempotencyKey)
    .executeTakeFirstOrThrow();
  assert.equal(receipt.status, 'COMPLETED');
  assert.equal(receipt.error, null);

  console.log(JSON.stringify({
    status: 'PASS',
    proof: 'DIRECT_BUSINESS_DATA_SUBMISSION_TO_LEDGER',
    enterpriseId: enterprise.id,
    applicationId: 'sales_order',
    businessDataId: first.businessDataId,
    postingInputId: first.postingInputId,
    postingRunId: run.id,
    idempotentReplay: replay.idempotentReplay,
    commandExecutionCreated: false,
    legacyProvenance: {
      applicationInstanceId: null,
      commandExecutionId: null,
      metadataVersion: null
    },
    balances: {
      pendingProduction: productionBalance.quantity,
      pendingShipment: shipmentBalance.quantity,
      receivable: receivableBalance.amount
    }
  }, null, 2));
} finally {
  await database.destroy();
}

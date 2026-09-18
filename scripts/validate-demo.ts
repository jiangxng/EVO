import { Decimal } from 'decimal.js';
import { createDatabase } from '../platform/database/src/index.js';
import { loadRuntimeConfig } from '../platform/runtime/src/config.js';
import { createEvoRuntime, demoIds, drainPosting } from '../apps/api/src/evo-runtime.js';
import { computeEconomicRuntimeDigest } from '../modules/replay/infrastructure/postgres-replay-digest.js';

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

  const consistencyDomain = (await runtime.db.selectFrom('enterprise_runtime_state')
    .select('consistency_domain')
    .where('enterprise_id','=',ids.enterpriseId)
    .executeTakeFirstOrThrow()).consistency_domain;
  const boundaryBeforeReplay = BigInt((await runtime.db.selectFrom('enterprise_runtime_state')
    .select('next_posting_sequence')
    .where('enterprise_id','=',ids.enterpriseId)
    .executeTakeFirstOrThrow()).next_posting_sequence) - 1n;

  const before = await computeEconomicRuntimeDigest(
    runtime.db,
    ids.enterpriseId,
    consistencyDomain,
    boundaryBeforeReplay
  );
  const replay = await runtime.replay.prepareFullReplay(ids.enterpriseId);
  await drainPosting(runtime, ids.enterpriseId);
  if (replay.costMethod !== null) {
    await runtime.cost.recalculate(ids.enterpriseId, replay.costMethod, replay.costPins ?? undefined);
  }
  const after = await computeEconomicRuntimeDigest(
    runtime.db,
    ids.enterpriseId,
    consistencyDomain,
    replay.boundarySequence
  );
  await runtime.replay.completeFullReplay(replay.replayRunId, ids.enterpriseId, after);

  if (before !== after || replay.beforeDigest !== before) {
    throw new Error(`Replay digest mismatch: query=${before}, replay=${replay.beforeDigest}, after=${after}`);
  }

  const checkpoint = await runtime.replayCheckpoint.createFromVerifiedFullReplay(
    replay.replayRunId,
    ids.enterpriseId
  );
  const checkpointAgain = await runtime.replayCheckpoint.createFromVerifiedFullReplay(
    replay.replayRunId,
    ids.enterpriseId
  );
  if (checkpointAgain.id !== checkpoint.id) {
    throw new Error('Replay checkpoint creation must be idempotent per source replay run.');
  }
  if (checkpoint.validity.safeForIncremental !== false) {
    throw new Error('Fresh checkpoint must remain unsafe for incremental replay until coverage is certified.');
  }
  const blockers = Array.isArray(checkpoint.validity.blockers)
    ? checkpoint.validity.blockers
    : [];
  if (blockers.length < 1) {
    throw new Error('Expected conservative replay checkpoint blockers.');
  }

  const coverage = await runtime.replayCoverage.evaluate(
    checkpoint.id,
    'validate-demo'
  );
  if (!coverage.materializationDigestComplete) {
    throw new Error('Expected Economic Runtime materialization digest coverage to certify.');
  }
  if (!coverage.templateBindingComplete) {
    throw new Error('Expected reference enterprise template binding to certify.');
  }
  if (!coverage.referenceDatasetPinsComplete) {
    throw new Error('Expected reference dataset pin coverage to certify for the current scenario.');
  }
  if (coverage.dependencyGraphComplete) {
    throw new Error('Dependency graph completeness must remain false until coverage families are certified.');
  }
  if (coverage.derivedRuntimeReplayComplete) {
    throw new Error('Derived runtime replay completeness must remain false until independently certified.');
  }
  if (coverage.status !== 'DRAFT') {
    throw new Error('Coverage certification must remain DRAFT while safety blockers remain.');
  }

  // Dependency-graph coverage scenario runs AFTER the verified Full Replay checkpoint.
  // This intentionally does not claim that FX derived state is replayable yet.
  const fxRateDataset = await runtime.rates.publish({
    enterpriseId: ids.enterpriseId,
    code: `demo-fx-${suffix}`,
    version: 1,
    provider: 'validate-demo',
    observations: [{
      role: 'PERIOD_END_VALUATION',
      sourceUnit: 'USD',
      targetUnit: 'CNY',
      rate: '7.2',
      effectiveAt: new Date('2026-09-18T00:00:00.000Z'),
      precision: 6
    }]
  });

  const fxOpenPosition = {
    positionKey: `receivable:${orderBusiness.id}`,
    sourceBusinessDataIds: [orderBusiness.id],
    dimensions: { order_no: orderNo, customer: 'Validation' },
    foreign: {
      value: '1000',
      unit: 'USD',
      role: 'RESOURCE_QUANTITY' as const
    },
    carrying: {
      value: '7000',
      unit: 'CNY',
      role: 'VALUATION_AMOUNT' as const
    }
  };

  const fxPeriodEnd = await runtime.fxValuation.revaluePeriodEnd({
    enterpriseId: ids.enterpriseId,
    valuationAt: new Date('2026-09-18T23:59:59.000Z'),
    rateDataset: {
      datasetId: fxRateDataset.id,
      version: fxRateDataset.version,
      digest: fxRateDataset.digest
    },
    policy: { amountScale: 2, roundingMode: 'HALF_UP' },
    positions: [fxOpenPosition]
  });

  const fxPeriodResult = fxPeriodEnd.results[0];
  if (fxPeriodResult === undefined || fxPeriodResult.delta.value !== '200') {
    throw new Error(`Expected FX period-end delta 200, got ${fxPeriodResult?.delta.value ?? 'missing'}.`);
  }

  const payment = await runtime.command.execute({
    enterpriseId: ids.enterpriseId,
    applicationInstanceId: ids.salesAppId,
    commandCode: 'record-customer-payment',
    actor: { type: 'AUTOMATION', id: 'demo-automation' },
    requestId: `${orderNo}:payment`,
    correlationId,
    causationId: orderBusiness.id,
    idempotencyKey: `${orderNo}:payment`,
    input: {
      orderNo,
      customer: 'Validation',
      foreignAmount: '1000',
      foreignCurrency: 'USD',
      localAmount: '7300',
      localCurrency: 'CNY',
      project,
      department: 'SALES',
      profitCenter: 'PC-PROJECT',
      costCenter: 'CC-SALES'
    },
    effectiveAt: new Date(),
    businessObjectKey: `PAY:${orderNo}`,
    lineage: {
      flowDefinitionId: ids.flowDefinitionId,
      flowInstanceKey: orderNo,
      stepCode: 'customer-payment-recorded',
      parentBusinessDataId: orderBusiness.id,
      relationType: 'FULFILLS'
    }
  });
  await runtime.flow.projectCommand(payment.commandExecutionId);
  await drainPosting(runtime, ids.enterpriseId);

  const paymentBusiness = await runtime.db.selectFrom('business_data')
    .select('id')
    .where('command_execution_id','=',payment.commandExecutionId)
    .executeTakeFirstOrThrow();

  const fxAllocationPolicy = await runtime.db.selectFrom('allocation_policy')
    .select(['id','version'])
    .where('enterprise_id','=',ids.enterpriseId)
    .where('code','=','fx_settlement_explicit')
    .where('status','=','PUBLISHED')
    .where('version','=',1)
    .executeTakeFirstOrThrow();

  const fxInstruction = await runtime.allocation.recordInstruction({
    enterpriseId: ids.enterpriseId,
    consumerBusinessDataId: paymentBusiness.id,
    mode: 'EXPLICIT',
    sourceSelector: {
      kind: 'BUSINESS_DATA',
      businessDataId: orderBusiness.id
    },
    actorType: 'AUTOMATION',
    actorId: 'demo-automation',
    effectiveAt: new Date(),
    reason: 'Reference FX settlement closes the sales-order foreign receivable.',
    allocationPolicyId: fxAllocationPolicy.id,
    allocationPolicyVersion: fxAllocationPolicy.version,
    idempotencyKey: `${orderNo}:fx-settlement`
  });

  const fxSettlement = await runtime.fxSettlement.closePosition({
    enterpriseId: ids.enterpriseId,
    settledAt: new Date(),
    settlementBusinessDataId: paymentBusiness.id,
    position: {
      ...fxOpenPosition,
      carrying: fxPeriodResult.carryingAfter
    },
    settlementForeign: {
      value: '1000',
      unit: 'USD',
      role: 'SETTLEMENT_QUANTITY'
    },
    settlementLocal: {
      value: '7300',
      unit: 'CNY',
      role: 'DIRECT_BUSINESS_AMOUNT'
    },
    allocationPolicyId: fxAllocationPolicy.id,
    allocationPolicyVersion: fxAllocationPolicy.version,
    instructionId: fxInstruction.id
  });

  if (fxSettlement.result.realizedDelta.value !== '100') {
    throw new Error(
      `Expected realized FX settlement delta 100 after period-end revaluation, got ${fxSettlement.result.realizedDelta.value}.`
    );
  }

  const graphCoverage = await runtime.dependencyGraph.rebuildEnterprise(ids.enterpriseId);
  if (graphCoverage.missingFamilies.length !== 0) {
    throw new Error(
      `Expected all dependency producer families to be exercised, missing: ${graphCoverage.missingFamilies.join(', ')}`
    );
  }

  const coverageAfterFx = await runtime.replayCoverage.evaluate(
    checkpoint.id,
    'validate-demo'
  );
  if (!coverageAfterFx.dependencyGraphComplete) {
    throw new Error('Expected dependency graph producer-family coverage to certify after FX scenario.');
  }
  if (coverageAfterFx.referenceDatasetPinsComplete) {
    throw new Error(
      'The pre-FX checkpoint must not claim rate-dataset pin completeness for later FX valuation state.'
    );
  }
  if (coverageAfterFx.derivedRuntimeReplayComplete) {
    throw new Error('Derived runtime replay completeness must remain false.');
  }
  if (coverageAfterFx.status !== 'DRAFT') {
    throw new Error('Incremental replay certification must remain DRAFT.');
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
    replayCheckpoint: {
      id: checkpoint.id,
      safeForIncremental: checkpoint.validity.safeForIncremental,
      blockers
    },
    replayCoverageCertification: {
      beforeFxCoverage: {
        id: coverage.id,
        status: coverage.status,
        materializationDigestComplete: coverage.materializationDigestComplete,
        templateBindingComplete: coverage.templateBindingComplete,
        referenceDatasetPinsComplete: coverage.referenceDatasetPinsComplete,
        dependencyGraphComplete: coverage.dependencyGraphComplete,
        derivedRuntimeReplayComplete: coverage.derivedRuntimeReplayComplete,
        blockers: coverage.blockers
      },
      afterFxProducerCoverage: {
        id: coverageAfterFx.id,
        status: coverageAfterFx.status,
        dependencyGraphComplete: coverageAfterFx.dependencyGraphComplete,
        referenceDatasetPinsComplete: coverageAfterFx.referenceDatasetPinsComplete,
        derivedRuntimeReplayComplete: coverageAfterFx.derivedRuntimeReplayComplete,
        blockers: coverageAfterFx.blockers,
        familyCounts: graphCoverage.familyCounts
      }
    },
    fxCoverage: {
      periodEndDelta: fxPeriodResult.delta.value,
      realizedSettlementDelta: fxSettlement.result.realizedDelta.value,
      rateDatasetId: fxRateDataset.id,
      allocationInstructionId: fxInstruction.id
    },
    beforeDigest: before,
    afterDigest: after,
    contextContractVersion: '1.1'
  }, null, 2));
} finally {
  await database.destroy();
}

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

  // Reference-enterprise economic time must be deterministic and independent
  // from CI wall-clock time. Date.now() above is used only for unique business keys.
  const orderAt = new Date('2026-09-18T09:00:00.000Z');
  const productionAt = new Date('2026-09-18T12:00:00.000Z');
  const shipmentAt = new Date('2026-09-18T15:00:00.000Z');

  const order = await runtime.command.execute({
    enterpriseId: ids.enterpriseId,
    applicationInstanceId: ids.salesAppId,
    commandCode: 'approve-sales-order',
    actor: { type: 'AUTOMATION', id: 'demo-automation' },
    requestId: `${orderNo}:approve`, correlationId,
    idempotencyKey: `${orderNo}:approve`,
    input: {
      eventKind: 'ORDER', orderNo, customer: 'Validation', productId: 'P-100', quantity: 10,
      unitPrice: '100.00', totalAmount: '1000.00', currency: 'USD',
      localCarryingAmount: '7000.00', localCurrency: 'CNY',
      fulfillmentMode: 'MAKE', project, department: 'SALES',
      profitCenter: 'PC-PROJECT', costCenter: 'CC-SALES'
    },
    effectiveAt: orderAt, businessObjectKey: orderNo,
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
    effectiveAt: productionAt, businessObjectKey: `PROD:${orderNo}:P-100`,
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
    effectiveAt: shipmentAt, businessObjectKey: shipmentNo,
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

  const fxPositionDefinition = await runtime.db.selectFrom('position_definition')
    .select(['id','version','semantic_digest'])
    .where('enterprise_id','=',ids.enterpriseId)
    .where('code','=','fx_receivable')
    .where('status','=','PUBLISHED')
    .where('version','=',1)
    .executeTakeFirstOrThrow();

  const replayRateDataset = await runtime.rates.publish({
    enterpriseId: ids.enterpriseId,
    code: `demo-replay-fx-${suffix}`,
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

  const valuationAt = new Date('2026-09-18T23:59:59.000Z');
  const valuationRequest = await runtime.command.execute({
    enterpriseId: ids.enterpriseId,
    applicationInstanceId: ids.valuationAppId,
    commandCode: 'request-valuation',
    actor: { type: 'AUTOMATION', id: 'demo-automation' },
    requestId: `${orderNo}:fx-period-end`,
    correlationId,
    causationId: orderBusiness.id,
    idempotencyKey: `${orderNo}:fx-period-end`,
    input: {
      requestCode: `FX-${orderNo}`,
      valuationKind: 'FX_PERIOD_END',
      valuationAt: valuationAt.toISOString(),
      scope: {
        kind: 'DIMENSION_QUERY',
        dimensions: { order_no: orderNo, customer: 'Validation' }
      },
      positionDefinition: {
        definitionId: fxPositionDefinition.id,
        version: fxPositionDefinition.version,
        digest: fxPositionDefinition.semantic_digest
      },
      rateDataset: {
        datasetId: replayRateDataset.id,
        version: replayRateDataset.version,
        digest: replayRateDataset.digest
      },
      policy: { amountScale: 2, roundingMode: 'HALF_UP' }
    },
    effectiveAt: valuationAt,
    businessObjectKey: `FX-REQ:${orderNo}`
  });
  await drainPosting(runtime, ids.enterpriseId);

  const settlementAt = new Date('2026-09-19T01:00:00.000Z');
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
      eventKind: 'PAYMENT',
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
    effectiveAt: settlementAt,
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
    effectiveAt: settlementAt,
    reason: 'Reference FX settlement closes the sales-order foreign receivable.',
    allocationPolicyId: fxAllocationPolicy.id,
    allocationPolicyVersion: fxAllocationPolicy.version,
    idempotencyKey: `${orderNo}:fx-settlement`
  });

  const settlementRequest = await runtime.command.execute({
    enterpriseId: ids.enterpriseId,
    applicationInstanceId: ids.valuationAppId,
    commandCode: 'request-valuation',
    actor: { type: 'AUTOMATION', id: 'demo-automation' },
    requestId: `${orderNo}:fx-settlement-request`,
    correlationId,
    causationId: paymentBusiness.id,
    idempotencyKey: `${orderNo}:fx-settlement-request`,
    input: {
      requestCode: `FX-SETTLE-${orderNo}`,
      valuationKind: 'FX_REALIZED_SETTLEMENT',
      valuationAt: settlementAt.toISOString(),
      scope: {
        kind: 'DIMENSION_QUERY',
        dimensions: { order_no: orderNo, customer: 'Validation' }
      },
      positionDefinition: {
        definitionId: fxPositionDefinition.id,
        version: fxPositionDefinition.version,
        digest: fxPositionDefinition.semantic_digest
      },
      settlementBusinessDataId: paymentBusiness.id,
      allocationPolicy: {
        id: fxAllocationPolicy.id,
        version: fxAllocationPolicy.version
      },
      instructionId: fxInstruction.id,
      settlementMapping: {
        foreignValueField: 'foreignAmount',
        foreignUnitField: 'foreignCurrency',
        localValueField: 'localAmount',
        localUnitField: 'localCurrency'
      }
    },
    effectiveAt: settlementAt,
    businessObjectKey: `FX-SETTLE-REQ:${orderNo}`
  });
  await drainPosting(runtime, ids.enterpriseId);

  const preReplayBoundary = BigInt((await runtime.db.selectFrom('enterprise_runtime_state')
    .select('next_posting_sequence')
    .where('enterprise_id','=',ids.enterpriseId)
    .executeTakeFirstOrThrow()).next_posting_sequence) - 1n;
  const valuationInitial = await runtime.valuationReplay.replayAcceptedRequests(
    ids.enterpriseId,
    'enterprise',
    preReplayBoundary
  );
  if (valuationInitial.replayedRequestCount !== 2) {
    throw new Error(`Expected two canonical valuation requests, got ${valuationInitial.replayedRequestCount}.`);
  }
  const initialFxResult = await runtime.db.selectFrom('valuation_result')
    .select(['result_kind','delta_amount'])
    .where('enterprise_id','=',ids.enterpriseId)
    .where('result_kind','=','FX_PERIOD_END')
    .executeTakeFirstOrThrow();
  if (!new Decimal(initialFxResult.delta_amount).eq(200)) {
    throw new Error(`Expected canonical FX period-end delta 200, got ${initialFxResult.delta_amount}.`);
  }
  const initialSettlementResult = await runtime.db.selectFrom('valuation_result')
    .select('delta_amount')
    .where('enterprise_id','=',ids.enterpriseId)
    .where('result_kind','=','FX_REALIZED_SETTLEMENT')
    .executeTakeFirstOrThrow();
  if (!new Decimal(initialSettlementResult.delta_amount).eq(100)) {
    throw new Error(
      `Expected canonical FX realized settlement delta 100, got ${initialSettlementResult.delta_amount}.`
    );
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
  const valuationReplayResult = await runtime.valuationReplay.replayAcceptedRequests(
    ids.enterpriseId,
    consistencyDomain,
    replay.boundarySequence
  );
  if (valuationReplayResult.replayedRequestCount !== 2) {
    throw new Error(
      `Expected Full Replay to rebuild two canonical valuation requests, got ${valuationReplayResult.replayedRequestCount}.`
    );
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

  const costPoolSnapshots = await runtime.replayCheckpointMaterialization.captureCostPools(
    checkpoint.id
  );
  const costPoolSnapshotsAgain = await runtime.replayCheckpointMaterialization.captureCostPools(
    checkpoint.id
  );
  if (costPoolSnapshots.length < 1) {
    throw new Error('Expected ReplayCheckpoint to capture at least one COST_POOL state.');
  }
  if (
    costPoolSnapshotsAgain.length !== costPoolSnapshots.length ||
    costPoolSnapshotsAgain.some((snapshot,index) =>
      snapshot.id !== costPoolSnapshots[index]?.id ||
      snapshot.semanticDigest !== costPoolSnapshots[index]?.semanticDigest
    )
  ) {
    throw new Error('Cost-pool checkpoint materialization capture must be idempotent.');
  }

  const fifoCheckpointPool = costPoolSnapshots.find((snapshot) =>
    snapshot.state.method === 'FIFO' &&
    snapshot.state.layers.some((layer) =>
      layer.sourceBusinessDataId === productionBusiness.id
    )
  );
  if (fifoCheckpointPool === undefined) {
    throw new Error('Expected checkpoint FIFO pool to retain the production source layer.');
  }
  const productionLayer = fifoCheckpointPool.state.layers.find((layer) =>
    layer.sourceBusinessDataId === productionBusiness.id
  );
  if (
    productionLayer === undefined ||
    !new Decimal(productionLayer.remainingQuantity).eq(8) ||
    !new Decimal(productionLayer.unitCost).eq(10)
  ) {
    throw new Error(
      `Checkpoint FIFO state expected production remainder qty=8 unitCost=10, got ${JSON.stringify(productionLayer)}`
    );
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
  if (!coverage.dependencyGraphComplete) {
    throw new Error('Expected all dependency producer families to certify inside the replay boundary.');
  }
  if (!coverage.derivedRuntimeReplayComplete) {
    throw new Error('Expected Full Replay to rebuild all canonical derived-runtime requests.');
  }
  if (coverage.status !== 'CERTIFIED') {
    throw new Error(`Expected replay coverage certification CERTIFIED, got ${coverage.status}.`);
  }
  if (coverage.blockers.length !== 0) {
    throw new Error(
      `Certified replay coverage must have no blockers, got: ${coverage.blockers.join(', ')}`
    );
  }

  const promotion = await runtime.replayPromotion.promote({
    checkpointId: checkpoint.id,
    certificationId: coverage.id,
    promotedBy: 'validate-demo',
    reason: 'Reference enterprise E2E certification authorizes this boundary for incremental planning.'
  });

  if (checkpoint.validity.safeForIncremental !== false) {
    throw new Error('Promotion must not mutate the original checkpoint validity snapshot.');
  }

  const promotedCheckpoint = await runtime.replayTopology.getLatestIncrementalSafeCheckpoint(
    ids.enterpriseId,
    consistencyDomain,
    checkpoint.boundarySequence
  );
  if (promotedCheckpoint === null || promotedCheckpoint.id !== checkpoint.id) {
    throw new Error('Expected promoted checkpoint to become the incremental-safe starting point.');
  }
  if (promotedCheckpoint.validity.safeForIncremental !== true) {
    throw new Error('Promoted checkpoint view must be explicitly safe for incremental replay.');
  }
  if (promotedCheckpoint.validity.promotionId !== promotion.id) {
    throw new Error('Promoted checkpoint must expose the governing promotion evidence.');
  }

  const incrementalPlan = await runtime.incrementalReplayPlanner.plan({
    enterpriseId: ids.enterpriseId,
    consistencyDomain,
    graphVersion: checkpoint.dependencyGraphVersion,
    runtimeSemanticVersion: checkpoint.runtimeSemanticVersion,
    impactRoots: [{
      kind: 'BUSINESS_FACT',
      id: orderBusiness.id
    }],
    earliestAffectedSequence: checkpoint.boundarySequence + 1n,
    dependencyGraphComplete: coverage.dependencyGraphComplete
  });
  if (incrementalPlan.fallbackToFullReplay) {
    throw new Error(
      `Promoted checkpoint should be eligible for incremental planning, fallback: ${incrementalPlan.fallbackReasons.join(', ')}`
    );
  }
  if (incrementalPlan.checkpoint?.id !== checkpoint.id) {
    throw new Error('Incremental plan must select the explicitly promoted checkpoint.');
  }

  const activeRuntimeDataset = await runtime.runtimeDatasets.getActive(
    ids.enterpriseId,
    consistencyDomain
  );
  const candidateRuntimeDataset = await runtime.runtimeDatasets.createCandidate({
    enterpriseId: ids.enterpriseId,
    consistencyDomain,
    parentDatasetId: activeRuntimeDataset.id,
    sourceCheckpointId: checkpoint.id,
    sourcePromotionId: promotion.id,
    incrementalPlanDigest: incrementalPlan.planDigest,
    startSequence: checkpoint.boundarySequence + 1n,
    boundarySequence: checkpoint.boundarySequence + 1n
  });
  if (candidateRuntimeDataset.status !== 'BUILDING') {
    throw new Error('New economic runtime candidate dataset must start in BUILDING status.');
  }
  if (candidateRuntimeDataset.parentDatasetId !== activeRuntimeDataset.id) {
    throw new Error('Economic runtime candidate must bind the current ACTIVE parent dataset.');
  }

  const verifiedRuntimeDataset = await runtime.runtimeDatasets.markVerified(
    candidateRuntimeDataset.id,
    after
  );
  if (verifiedRuntimeDataset.status !== 'VERIFIED') {
    throw new Error('Economic runtime candidate must become VERIFIED before activation.');
  }

  const activatedRuntimeDataset = await runtime.runtimeDatasets.activateVerified(
    verifiedRuntimeDataset.id
  );
  if (
    activatedRuntimeDataset.status !== 'ACTIVE' ||
    activatedRuntimeDataset.kind !== 'CURRENT'
  ) {
    throw new Error('Verified economic runtime candidate must atomically become CURRENT/ACTIVE.');
  }
  const archivedParent = await runtime.db.selectFrom('economic_runtime_dataset')
    .select(['kind','status'])
    .where('id','=',activeRuntimeDataset.id)
    .executeTakeFirstOrThrow();
  if (archivedParent.kind !== 'ARCHIVED' || archivedParent.status !== 'ARCHIVED') {
    throw new Error('Previous economic runtime CURRENT dataset must be archived on activation.');
  }

  const graphCoverage = await runtime.dependencyGraph.rebuildEnterprise(ids.enterpriseId);
  if (graphCoverage.missingFamilies.length !== 0) {
    throw new Error(
      `Expected all dependency producer families to remain complete, missing: ${graphCoverage.missingFamilies.join(', ')}`
    );
  }

  const replayedFxResults = await runtime.db.selectFrom('valuation_result')
    .select(['result_kind','delta_amount'])
    .where('enterprise_id','=',ids.enterpriseId)
    .where('result_kind','in',['FX_PERIOD_END','FX_REALIZED_SETTLEMENT'])
    .orderBy('result_kind')
    .execute();
  const replayedPeriod = replayedFxResults.find((row) => row.result_kind === 'FX_PERIOD_END');
  const replayedSettlement = replayedFxResults.find((row) => row.result_kind === 'FX_REALIZED_SETTLEMENT');
  if (
    replayedPeriod === undefined ||
    !new Decimal(replayedPeriod.delta_amount).eq(200) ||
    replayedSettlement === undefined ||
    !new Decimal(replayedSettlement.delta_amount).eq(100)
  ) {
    throw new Error('Full Replay did not rebuild the expected FX period-end/settlement results.');
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
    checkpointCostPool: {
      snapshotCount: costPoolSnapshots.length,
      fifoPoolKey: fifoCheckpointPool.state.poolKey,
      remainingProductionQuantity: productionLayer.remainingQuantity,
      unitCost: productionLayer.unitCost,
      sourceBusinessDataId: productionLayer.sourceBusinessDataId,
      semanticDigest: fifoCheckpointPool.semanticDigest,
      idempotent: true
    },
    replayCoverageCertification: {
      id: coverage.id,
      status: coverage.status,
      materializationDigestComplete: coverage.materializationDigestComplete,
      templateBindingComplete: coverage.templateBindingComplete,
      referenceDatasetPinsComplete: coverage.referenceDatasetPinsComplete,
      dependencyGraphComplete: coverage.dependencyGraphComplete,
      derivedRuntimeReplayComplete: coverage.derivedRuntimeReplayComplete,
      blockers: coverage.blockers,
      familyCounts: graphCoverage.familyCounts
    },
    replayCheckpointPromotion: {
      id: promotion.id,
      status: promotion.status,
      certificationId: promotion.certificationId,
      originalCheckpointSafeForIncremental: checkpoint.validity.safeForIncremental,
      promotedViewSafeForIncremental: promotedCheckpoint.validity.safeForIncremental,
      incrementalPlannerFallback: incrementalPlan.fallbackToFullReplay,
      incrementalPlannerCheckpointId: incrementalPlan.checkpoint?.id ?? null,
      planDigest: incrementalPlan.planDigest
    },
    economicRuntimeDataset: {
      previousDatasetId: activeRuntimeDataset.id,
      candidateDatasetId: candidateRuntimeDataset.id,
      activatedDatasetId: activatedRuntimeDataset.id,
      candidateInitialStatus: candidateRuntimeDataset.status,
      verifiedStatus: verifiedRuntimeDataset.status,
      activatedKind: activatedRuntimeDataset.kind,
      activatedStatus: activatedRuntimeDataset.status,
      previousDatasetFinalStatus: archivedParent.status
    },
    fxCoverage: {
      periodEndDelta: replayedPeriod.delta_amount,
      realizedSettlementDelta: replayedSettlement.delta_amount,
      rateDatasetId: replayRateDataset.id,
      allocationInstructionId: fxInstruction.id,
      periodEndRequestBusinessDataId: valuationRequest.businessDataId,
      settlementRequestBusinessDataId: settlementRequest.businessDataId
    },
    beforeDigest: before,
    afterDigest: after,
    contextContractVersion: '1.1'
  }, null, 2));
} finally {
  await database.destroy();
}

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

  const ledgerBalanceSnapshots = await runtime.replayCheckpointMaterialization.captureLedgerBalances(
    checkpoint.id
  );
  if (ledgerBalanceSnapshots.length < 1) {
    throw new Error('Expected ReplayCheckpoint to capture LEDGER_BALANCE prefix state.');
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

  await runtime.runtimeDatasets.markFailed(
    candidateRuntimeDataset.id,
    'Superseded by the complete checkpoint-restored Candidate certification scenario.'
  );

  // True incremental-cost proof: add one canonical shipment after the promoted checkpoint,
  // restore the certified FIFO prefix (8 units @ 10), and cost only the suffix.
  const incrementalShipmentNo = `SHIP-INCREMENTAL-${suffix}`;
  const incrementalShipment = await runtime.command.execute({
    enterpriseId: ids.enterpriseId,
    applicationInstanceId: ids.inventoryAppId,
    commandCode: 'ship-sales-order',
    actor: { type: 'AUTOMATION', id: 'demo-automation' },
    requestId: `${orderNo}:incremental-shipment`,
    correlationId,
    causationId: orderBusiness.id,
    idempotencyKey: incrementalShipmentNo,
    input: {
      movementType: 'SHIP',
      shipmentNo: incrementalShipmentNo,
      orderNo,
      customer: 'Validation',
      productId: 'P-100',
      warehouse: 'HK',
      quantity: 1,
      lot: null,
      project,
      department: 'SALES',
      profitCenter: 'PC-PROJECT',
      costCenter: 'CC-SALES'
    },
    effectiveAt: new Date('2026-09-19T02:00:00.000Z'),
    businessObjectKey: incrementalShipmentNo,
    lineage: {
      flowDefinitionId: ids.flowDefinitionId,
      flowInstanceKey: orderNo,
      stepCode: 'incremental-shipment-created',
      parentBusinessDataId: orderBusiness.id,
      relationType: 'FULFILLS'
    }
  });
  await runtime.flow.projectCommand(incrementalShipment.commandExecutionId);

  const incrementalShipmentBusiness = await runtime.db.selectFrom('business_data')
    .select('id')
    .where('command_execution_id','=',incrementalShipment.commandExecutionId)
    .executeTakeFirstOrThrow();
  const incrementalShipmentPosting = await runtime.db.selectFrom('posting_input')
    .select(['posting_sequence','status'])
    .where('business_data_id','=',incrementalShipmentBusiness.id)
    .executeTakeFirstOrThrow();
  const incrementalTargetBoundary = BigInt(incrementalShipmentPosting.posting_sequence);

  if (incrementalTargetBoundary <= checkpoint.boundarySequence) {
    throw new Error('Incremental suffix business fact must be strictly after the promoted checkpoint.');
  }

  const suffixPlan = await runtime.incrementalReplayPlanner.plan({
    enterpriseId: ids.enterpriseId,
    consistencyDomain,
    graphVersion: checkpoint.dependencyGraphVersion,
    runtimeSemanticVersion: checkpoint.runtimeSemanticVersion,
    impactRoots: [{
      kind: 'BUSINESS_FACT',
      id: incrementalShipmentBusiness.id
    }],
    earliestAffectedSequence: incrementalTargetBoundary,
    dependencyGraphComplete: coverage.dependencyGraphComplete
  });
  if (suffixPlan.fallbackToFullReplay || suffixPlan.checkpoint?.id !== checkpoint.id) {
    throw new Error(
      `Expected suffix plan to use promoted checkpoint, fallback=${suffixPlan.fallbackReasons.join(', ')}`
    );
  }

  const currentRuntimeDataset = await runtime.runtimeDatasets.getActive(
    ids.enterpriseId,
    consistencyDomain
  );
  const incrementalCandidate = await runtime.runtimeDatasets.createCandidate({
    enterpriseId: ids.enterpriseId,
    consistencyDomain,
    parentDatasetId: currentRuntimeDataset.id,
    sourceCheckpointId: checkpoint.id,
    sourcePromotionId: promotion.id,
    incrementalPlanDigest: suffixPlan.planDigest,
    startSequence: checkpoint.boundarySequence + 1n,
    boundarySequence: incrementalTargetBoundary
  });
  const candidateContext = await runtime.materializationContexts.candidate(
    incrementalCandidate.id,
    ids.enterpriseId,
    consistencyDomain
  );

  if (incrementalShipmentPosting.status !== 'QUEUED') {
    throw new Error('Incremental suffix posting input must remain QUEUED before candidate replay.');
  }

  const restoredLedgerPrefix = await runtime.replayCheckpointMaterialization.restoreLedgerBalances(
    checkpoint.id,
    candidateContext
  );
  if (restoredLedgerPrefix.balanceCount !== ledgerBalanceSnapshots.length) {
    throw new Error('Candidate ledger prefix restore did not restore every checkpoint balance.');
  }

  const candidatePosting = await runtime.candidatePostingReplay.replayRange(
    ids.enterpriseId,
    checkpoint.boundarySequence,
    incrementalTargetBoundary,
    candidateContext
  );
  if (candidatePosting.postingInputCount !== 1) {
    throw new Error(
      `Candidate posting replay must process exactly one suffix input, got ${candidatePosting.postingInputCount}`
    );
  }

  const postingStatusAfterCandidate = await runtime.db.selectFrom('posting_input')
    .select('status')
    .where('business_data_id','=',incrementalShipmentBusiness.id)
    .executeTakeFirstOrThrow();
  if (postingStatusAfterCandidate.status !== 'QUEUED') {
    throw new Error('Candidate posting replay must not mutate canonical posting-input processing state.');
  }

  const restoredCostPools = await runtime.replayCheckpointMaterialization.loadCostPools(
    checkpoint.id
  );
  const incrementalCost = await runtime.cost.recalculate(
    ids.enterpriseId,
    'FIFO',
    {
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
    },
    candidateContext,
    {
      checkpointBoundarySequence: checkpoint.boundarySequence,
      targetBoundarySequence: incrementalTargetBoundary,
      poolStates: restoredCostPools.map((snapshot) => snapshot.state)
    }
  );

  if (incrementalCost.resultCount !== 1 || incrementalCost.valuationPostingCount !== 1) {
    throw new Error(
      `Incremental candidate costing must process exactly one suffix shipment, got ${JSON.stringify(incrementalCost)}`
    );
  }

  const incrementalCostResult = await runtime.db.selectFrom('cost_result as cr')
    .innerJoin('cost_run as run','run.id','cr.cost_run_id')
    .select([
      'cr.business_data_id',
      'cr.quantity',
      'cr.unit_cost',
      'cr.total_cost',
      'run.economic_runtime_dataset_id'
    ])
    .where('run.id','=',incrementalCost.costRunId)
    .executeTakeFirstOrThrow();

  if (
    incrementalCostResult.unit_cost === null ||
    incrementalCostResult.total_cost === null ||
    incrementalCostResult.business_data_id !== incrementalShipmentBusiness.id ||
    !new Decimal(incrementalCostResult.quantity).eq(1) ||
    !new Decimal(incrementalCostResult.unit_cost).eq(10) ||
    !new Decimal(incrementalCostResult.total_cost).eq(10) ||
    incrementalCostResult.economic_runtime_dataset_id !== incrementalCandidate.id
  ) {
    throw new Error(
      `Incremental suffix cost result is incorrect: ${JSON.stringify(incrementalCostResult)}`
    );
  }

  const candidateAllocation = await runtime.db.selectFrom('allocation_relation as ar')
    .innerJoin('allocation_run as run','run.id','ar.allocation_run_id')
    .select([
      'ar.source_business_data_id',
      'ar.consumer_business_data_id',
      'ar.measurements',
      'run.economic_runtime_dataset_id'
    ])
    .where('ar.consumer_business_data_id','=',incrementalShipmentBusiness.id)
    .where('run.economic_runtime_dataset_id','=',incrementalCandidate.id)
    .executeTakeFirstOrThrow();

  if (
    candidateAllocation.source_business_data_id !== productionBusiness.id ||
    candidateAllocation.economic_runtime_dataset_id !== incrementalCandidate.id
  ) {
    throw new Error('Incremental allocation must consume the checkpoint-restored production layer inside the candidate generation.');
  }

  const candidateValuationPosition = await runtime.db.selectFrom('valuation_position')
    .select(['economic_runtime_dataset_id','business_data_id','total_cost'])
    .where('enterprise_id','=',ids.enterpriseId)
    .where('economic_runtime_dataset_id','=',incrementalCandidate.id)
    .where('business_data_id','=',incrementalShipmentBusiness.id)
    .executeTakeFirstOrThrow();

  if (
    candidateValuationPosition.economic_runtime_dataset_id !== incrementalCandidate.id ||
    !new Decimal(candidateValuationPosition.total_cost).eq(10)
  ) {
    throw new Error('Incremental valuation position must remain isolated in the candidate generation.');
  }

  const candidateLedgerDataset = await runtime.db.selectFrom('ledger_dataset')
    .select(['id','kind','status','economic_runtime_dataset_id'])
    .where('enterprise_id','=',ids.enterpriseId)
    .where('economic_runtime_dataset_id','=',incrementalCandidate.id)
    .where('kind','=','CANDIDATE')
    .where('status','=','BUILDING')
    .executeTakeFirstOrThrow();

  if (candidateLedgerDataset.id !== restoredLedgerPrefix.ledgerDatasetId) {
    throw new Error('Candidate posting/cost must reuse the checkpoint-restored ledger dataset.');
  }

  const candidateDependencyCount = await runtime.db.selectFrom('calculation_dependency_edge')
    .select(({ fn }) => fn.countAll<number>().as('count'))
    .where('enterprise_id','=',ids.enterpriseId)
    .where('economic_runtime_dataset_id','=',incrementalCandidate.id)
    .executeTakeFirstOrThrow();

  if (Number(candidateDependencyCount.count) < 1) {
    throw new Error('Incremental candidate costing must emit generation-scoped dependency evidence.');
  }

  const candidateWorkProjectionCount = await runtime.work.refresh(
    ids.enterpriseId,
    candidateContext
  );
  const candidateWork = await runtime.work.listOpen(
    ids.enterpriseId,
    candidateContext
  );
  const candidatePendingShipment = candidateWork.find((item) =>
    item.sourceLedgerCode === 'pending_shipment'
  );
  if (
    candidateWorkProjectionCount < 1 ||
    candidatePendingShipment === undefined ||
    !new Decimal(candidatePendingShipment.quantity).eq(7)
  ) {
    throw new Error(
      `Candidate work projection expected pending_shipment quantity 7, got ${JSON.stringify(candidateWork)}`
    );
  }

  const candidateWorkGenerationCount = await runtime.db.selectFrom('work_item')
    .select(({fn})=>fn.countAll<number>().as('count'))
    .where('enterprise_id','=',ids.enterpriseId)
    .where('economic_runtime_dataset_id','=',incrementalCandidate.id)
    .executeTakeFirstOrThrow();
  if (Number(candidateWorkGenerationCount.count) < 1) {
    throw new Error('Candidate work items must be scoped to the candidate runtime generation.');
  }

  const candidateDigest = await runtime.candidateEconomicRuntimeDigest.compute({
    checkpointId: checkpoint.id,
    candidateRuntimeDatasetId: incrementalCandidate.id,
    targetBoundarySequence: incrementalTargetBoundary
  });
  if (
    candidateDigest.familyCounts.ledgerBalances < 1 ||
    candidateDigest.familyCounts.ledgerEntries < 1 ||
    candidateDigest.familyCounts.costResults < 1 ||
    candidateDigest.familyCounts.allocationRelations < 1 ||
    candidateDigest.familyCounts.valuationPositions < 1 ||
    candidateDigest.familyCounts.workItems < 1
  ) {
    throw new Error(
      `Candidate Economic Runtime digest is missing required semantic families: ${JSON.stringify(candidateDigest.familyCounts)}`
    );
  }
  if (!/^[0-9a-f]{64}$/i.test(candidateDigest.digest)) {
    throw new Error('Candidate Economic Runtime digest must be a deterministic SHA-256 digest.');
  }

  // Isolated Full Replay oracle: rebuild the entire updated canonical history
  // into a separate ORACLE generation while CURRENT and CANDIDATE remain intact.
  const oracleDataset = await runtime.runtimeDatasets.createOracle({
    enterpriseId: ids.enterpriseId,
    consistencyDomain,
    parentDatasetId: currentRuntimeDataset.id,
    oracleOfDatasetId: incrementalCandidate.id,
    boundarySequence: incrementalTargetBoundary
  });
  const oracleContext = await runtime.materializationContexts.oracle(
    oracleDataset.id,
    ids.enterpriseId,
    consistencyDomain
  );

  const oraclePosting = await runtime.candidatePostingReplay.replayRange(
    ids.enterpriseId,
    0n,
    incrementalTargetBoundary,
    oracleContext
  );
  if (oraclePosting.postingInputCount !== Number(incrementalTargetBoundary)) {
    throw new Error(
      `Isolated oracle must replay the complete posting range, got ${oraclePosting.postingInputCount} inputs through boundary ${incrementalTargetBoundary}.`
    );
  }

  const oracleCost = await runtime.cost.recalculate(
    ids.enterpriseId,
    'FIFO',
    {
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
    },
    oracleContext
  );
  if (oracleCost.resultCount !== 2) {
    throw new Error(
      `Isolated Full Replay oracle expected two shipment cost results, got ${oracleCost.resultCount}.`
    );
  }

  const oracleValuationReplay = await runtime.valuationReplay.replayAcceptedRequests(
    ids.enterpriseId,
    consistencyDomain,
    incrementalTargetBoundary,
    oracleContext
  );
  if (oracleValuationReplay.replayedRequestCount !== 2) {
    throw new Error(
      `Isolated Full Replay oracle expected two valuation requests, got ${oracleValuationReplay.replayedRequestCount}.`
    );
  }

  const oracleWorkProjectionCount = await runtime.work.refresh(
    ids.enterpriseId,
    oracleContext
  );
  if (oracleWorkProjectionCount < 1) {
    throw new Error('Isolated Full Replay oracle must rebuild work materialization.');
  }

  const oracleDigestResult = await runtime.oracleEconomicRuntimeDigest.compute(
    oracleDataset.id
  );
  if (candidateDigest.digest !== oracleDigestResult.digest) {
    throw new Error(
      `Incremental equivalence mismatch: candidate=${candidateDigest.digest}, oracle=${oracleDigestResult.digest}`
    );
  }

  const verifiedOracle = await runtime.runtimeDatasets.markOracleVerified(
    oracleDataset.id,
    oracleDigestResult.digest
  );
  if (verifiedOracle.kind !== 'ORACLE' || verifiedOracle.status !== 'VERIFIED') {
    throw new Error('Exact-match oracle generation must become ORACLE/VERIFIED.');
  }

  const intactCandidate = await runtime.db.selectFrom('economic_runtime_dataset')
    .select(['kind','status'])
    .where('id','=',incrementalCandidate.id)
    .executeTakeFirstOrThrow();
  if (intactCandidate.kind !== 'CANDIDATE' || intactCandidate.status !== 'BUILDING') {
    throw new Error('Isolated oracle certification must leave the Candidate intact and BUILDING.');
  }

  const candidateCostStillExists = await runtime.db.selectFrom('cost_run')
    .select(({fn})=>fn.countAll<number>().as('count'))
    .where('enterprise_id','=',ids.enterpriseId)
    .where('economic_runtime_dataset_id','=',incrementalCandidate.id)
    .executeTakeFirstOrThrow();
  if (Number(candidateCostStillExists.count) < 1) {
    throw new Error('Isolated oracle must not destroy Candidate derived state.');
  }

  const currentSuffixPosting = await runtime.db.selectFrom('posting_input')
    .select('status')
    .where('business_data_id','=',incrementalShipmentBusiness.id)
    .executeTakeFirstOrThrow();
  if (currentSuffixPosting.status !== 'QUEUED') {
    throw new Error('Isolated oracle must not advance CURRENT posting state.');
  }

  const currentWorkAfterOracle = await runtime.work.listOpen(ids.enterpriseId);
  const currentPendingShipmentAfterOracle = currentWorkAfterOracle.find((item) =>
    item.sourceLedgerCode === 'pending_shipment'
  );
  if (
    currentPendingShipmentAfterOracle === undefined ||
    !new Decimal(currentPendingShipmentAfterOracle.quantity).eq(8)
  ) {
    throw new Error(
      'CURRENT work state must remain at checkpoint quantity 8 while Candidate/Oracle evaluate suffix state 7.'
    );
  }

  const governedActivation = await runtime.runtimeEquivalence.certifyAndActivate({
    candidateDatasetId: incrementalCandidate.id,
    oracleDatasetId: oracleDataset.id,
    certifiedBy: 'evo-reference-certifier',
    reason: 'Candidate equals its isolated Full Replay Oracle for the governed reference scenario.'
  });
  if (
    governedActivation.certification.status !== 'CERTIFIED' ||
    governedActivation.certification.blockers.length !== 0 ||
    governedActivation.activatedDataset?.id !== incrementalCandidate.id ||
    governedActivation.activatedDataset.kind !== 'CURRENT' ||
    governedActivation.activatedDataset.status !== 'ACTIVE'
  ) {
    throw new Error(
      `Exact Candidate/Oracle equivalence must atomically activate the Candidate: ${JSON.stringify(governedActivation)}`
    );
  }

  const certificationCountBeforeRetry = await runtime.db
    .selectFrom('runtime_equivalence_certification')
    .select(({fn})=>fn.countAll<number>().as('count'))
    .where('candidate_dataset_id','=',incrementalCandidate.id)
    .executeTakeFirstOrThrow();
  const duplicateActivation = await runtime.runtimeEquivalence.certifyAndActivate({
    candidateDatasetId: incrementalCandidate.id,
    oracleDatasetId: oracleDataset.id,
    certifiedBy: 'evo-reference-certifier',
    reason: 'Idempotent duplicate activation retry for the already-certified pair.'
  });
  const certificationCountAfterRetry = await runtime.db
    .selectFrom('runtime_equivalence_certification')
    .select(({fn})=>fn.countAll<number>().as('count'))
    .where('candidate_dataset_id','=',incrementalCandidate.id)
    .executeTakeFirstOrThrow();
  const activeGenerationAfterRetry = await runtime.db
    .selectFrom('economic_runtime_dataset')
    .select(['id','kind','status'])
    .where('enterprise_id','=',ids.enterpriseId)
    .where('consistency_domain','=',consistencyDomain)
    .where('status','=','ACTIVE')
    .execute();
  if (
    duplicateActivation.certification.id !== governedActivation.certification.id ||
    duplicateActivation.certification.certificationDigest !== governedActivation.certification.certificationDigest ||
    duplicateActivation.activatedDataset?.id !== incrementalCandidate.id ||
    Number(certificationCountBeforeRetry.count) !== 1 ||
    Number(certificationCountAfterRetry.count) !== 1 ||
    activeGenerationAfterRetry.length !== 1 ||
    activeGenerationAfterRetry[0]?.id !== incrementalCandidate.id ||
    activeGenerationAfterRetry[0]?.kind !== 'CURRENT'
  ) {
    throw new Error(
      'Duplicate activation retry must be idempotent and preserve exactly one certified CURRENT generation.'
    );
  }

  const archivedParent = await runtime.db.selectFrom('economic_runtime_dataset')
    .select(['kind','status'])
    .where('id','=',currentRuntimeDataset.id)
    .executeTakeFirstOrThrow();
  if (archivedParent.kind !== 'ARCHIVED' || archivedParent.status !== 'ARCHIVED') {
    throw new Error('Governed activation must archive the exact previous CURRENT generation.');
  }

  const activeCandidateLedger = await runtime.db.selectFrom('ledger_dataset')
    .select(['kind','status'])
    .where('economic_runtime_dataset_id','=',incrementalCandidate.id)
    .executeTakeFirstOrThrow();
  if (activeCandidateLedger.kind !== 'CURRENT' || activeCandidateLedger.status !== 'ACTIVE') {
    throw new Error('Governed activation must atomically activate the Candidate ledger generation.');
  }

  const currentMaterialization = await runtime.materializationContexts.current(
    ids.enterpriseId,
    consistencyDomain
  );
  if (currentMaterialization.runtimeDatasetId !== incrementalCandidate.id) {
    throw new Error('Current materialization context must resolve to the certified Candidate generation.');
  }
  const activatedSuffixPosting = await runtime.db.selectFrom('posting_input')
    .select('status')
    .where('business_data_id','=',incrementalShipmentBusiness.id)
    .executeTakeFirstOrThrow();
  if (activatedSuffixPosting.status !== 'POSTED') {
    throw new Error('Governed activation must atomically consume the certified suffix PostingInput.');
  }
  const activatedWork = await runtime.work.listOpen(ids.enterpriseId,currentMaterialization);
  const activatedPendingShipment = activatedWork.find((item) =>
    item.sourceLedgerCode === 'pending_shipment'
  );
  if (
    activatedPendingShipment === undefined ||
    !new Decimal(activatedPendingShipment.quantity).eq(7)
  ) {
    throw new Error('Activated Candidate must expose pending_shipment quantity 7 as CURRENT work state.');
  }

  const currentOverlay = await runtime.currentEconomicRuntimeView.read(
    ids.enterpriseId,
    consistencyDomain
  );
  if (
    currentOverlay.activeRuntimeDatasetId !== incrementalCandidate.id ||
    currentOverlay.generationChain.length !== 2 ||
    currentOverlay.certifiedActivationDigest !== candidateDigest.digest ||
    currentOverlay.computedSemanticDigest !== candidateDigest.digest ||
    JSON.stringify(currentOverlay.familyCounts) !== JSON.stringify(candidateDigest.familyCounts)
  ) {
    throw new Error(
      `Activated CURRENT overlay must reproduce the certified Candidate semantic view: ${JSON.stringify(currentOverlay)}`
    );
  }

  const routedDashboard = await runtime.query.dashboard(ids.enterpriseId);
  const dashboardPendingShipment = (routedDashboard.balances as Array<Record<string,unknown>>)
    .find((row) => row.ledger === 'pending_shipment');
  if (
    dashboardPendingShipment === undefined ||
    !new Decimal(String(dashboardPendingShipment.quantity)).eq(7)
  ) {
    throw new Error('Default Dashboard must route balances through the activated CURRENT generation.');
  }

  const routedLedgerBalances = await runtime.ledger.getBalances(
    ids.enterpriseId,
    'pending_shipment'
  );
  if (
    routedLedgerBalances.length === 0 ||
    !new Decimal(routedLedgerBalances[0]!.quantity).eq(7)
  ) {
    throw new Error('Default LedgerReader must resolve the activated CURRENT Ledger generation.');
  }

  const defaultCurrentWork = await runtime.work.listOpen(ids.enterpriseId);
  const defaultPendingShipment = defaultCurrentWork.find((item) =>
    item.sourceLedgerCode === 'pending_shipment'
  );
  if (
    defaultPendingShipment === undefined ||
    !new Decimal(defaultPendingShipment.quantity).eq(7)
  ) {
    throw new Error('Default WorkProjection read must resolve the activated CURRENT generation.');
  }

  const legacyWorkBeforeRefresh = await runtime.db.selectFrom('work_item')
    .select(({fn})=>fn.countAll<number>().as('count'))
    .where('enterprise_id','=',ids.enterpriseId)
    .where('economic_runtime_dataset_id','is',null)
    .where('status','in',['OPEN','IN_PROGRESS'])
    .executeTakeFirstOrThrow();
  await runtime.work.refresh(ids.enterpriseId);
  const legacyWorkAfterRefresh = await runtime.db.selectFrom('work_item')
    .select(({fn})=>fn.countAll<number>().as('count'))
    .where('enterprise_id','=',ids.enterpriseId)
    .where('economic_runtime_dataset_id','is',null)
    .where('status','in',['OPEN','IN_PROGRESS'])
    .executeTakeFirstOrThrow();
  const currentWorkAfterRefresh = await runtime.db.selectFrom('work_item')
    .select(({fn})=>fn.countAll<number>().as('count'))
    .where('enterprise_id','=',ids.enterpriseId)
    .where('economic_runtime_dataset_id','=',incrementalCandidate.id)
    .where('status','in',['OPEN','IN_PROGRESS'])
    .executeTakeFirstOrThrow();
  if (
    Number(currentWorkAfterRefresh.count) < 1 ||
    Number(legacyWorkAfterRefresh.count) !== Number(legacyWorkBeforeRefresh.count)
  ) {
    throw new Error(
      'CURRENT work refresh must remain generation-scoped and must not create new legacy-scope WorkItems.'
    );
  }


  // EVO-WORK-PACKET: ER-C05B4.4B
  // EVO-INVARIANT: A later Candidate may reuse the same certified checkpoint, but its
  // formal generation interval must begin exactly after the active parent boundary.
  // Its isolated rebuild may replay earlier suffix facts to reconstruct a complete leaf snapshot.
  const secondIncrementalShipmentNo = `SHIP-INCREMENTAL-2-${suffix}`;
  const secondIncrementalShipment = await runtime.command.execute({
    enterpriseId: ids.enterpriseId,
    applicationInstanceId: ids.inventoryAppId,
    commandCode: 'ship-sales-order',
    actor: { type: 'AUTOMATION', id: 'demo-automation' },
    requestId: `${orderNo}:incremental-shipment-2`,
    correlationId,
    causationId: orderBusiness.id,
    idempotencyKey: secondIncrementalShipmentNo,
    input: {
      movementType: 'SHIP',
      shipmentNo: secondIncrementalShipmentNo,
      orderNo,
      customer: 'Validation',
      productId: 'P-100',
      warehouse: 'HK',
      quantity: 1,
      lot: null,
      project,
      department: 'SALES',
      profitCenter: 'PC-PROJECT',
      costCenter: 'CC-SALES'
    },
    effectiveAt: new Date('2026-09-19T03:00:00.000Z'),
    businessObjectKey: secondIncrementalShipmentNo,
    lineage: {
      flowDefinitionId: ids.flowDefinitionId,
      flowInstanceKey: orderNo,
      stepCode: 'incremental-shipment-2-created',
      parentBusinessDataId: orderBusiness.id,
      relationType: 'FULFILLS'
    }
  });
  await runtime.flow.projectCommand(secondIncrementalShipment.commandExecutionId);

  const secondIncrementalShipmentBusiness = await runtime.db.selectFrom('business_data')
    .select('id')
    .where('command_execution_id','=',secondIncrementalShipment.commandExecutionId)
    .executeTakeFirstOrThrow();
  const secondIncrementalShipmentPosting = await runtime.db.selectFrom('posting_input')
    .select(['posting_sequence','status'])
    .where('business_data_id','=',secondIncrementalShipmentBusiness.id)
    .executeTakeFirstOrThrow();
  const secondIncrementalTargetBoundary = BigInt(secondIncrementalShipmentPosting.posting_sequence);
  if (
    secondIncrementalTargetBoundary !== incrementalTargetBoundary + 1n ||
    secondIncrementalShipmentPosting.status !== 'QUEUED'
  ) {
    throw new Error(
      'Second incremental shipment must be the next QUEUED canonical posting input.'
    );
  }

  const secondSuffixPlan = await runtime.incrementalReplayPlanner.plan({
    enterpriseId: ids.enterpriseId,
    consistencyDomain,
    graphVersion: checkpoint.dependencyGraphVersion,
    runtimeSemanticVersion: checkpoint.runtimeSemanticVersion,
    impactRoots: [{
      kind: 'BUSINESS_FACT',
      id: secondIncrementalShipmentBusiness.id
    }],
    earliestAffectedSequence: secondIncrementalTargetBoundary,
    dependencyGraphComplete: coverage.dependencyGraphComplete
  });
  if (
    secondSuffixPlan.fallbackToFullReplay ||
    secondSuffixPlan.checkpoint?.id !== checkpoint.id
  ) {
    throw new Error(
      `Second-generation plan must reuse the promoted checkpoint, fallback=${secondSuffixPlan.fallbackReasons.join(', ')}`
    );
  }

  const generationOneCurrent = await runtime.runtimeDatasets.getActive(
    ids.enterpriseId,
    consistencyDomain
  );
  if (generationOneCurrent.id !== incrementalCandidate.id) {
    throw new Error('Second generation must bind the first activated Candidate as its ACTIVE parent.');
  }

  const secondCandidate = await runtime.runtimeDatasets.createCandidate({
    enterpriseId: ids.enterpriseId,
    consistencyDomain,
    parentDatasetId: generationOneCurrent.id,
    sourceCheckpointId: checkpoint.id,
    sourcePromotionId: promotion.id,
    incrementalPlanDigest: secondSuffixPlan.planDigest,
    startSequence: incrementalTargetBoundary + 1n,
    boundarySequence: secondIncrementalTargetBoundary
  });
  const secondCandidateContext = await runtime.materializationContexts.candidate(
    secondCandidate.id,
    ids.enterpriseId,
    consistencyDomain
  );

  const secondRestoredLedgerPrefix = await runtime.replayCheckpointMaterialization.restoreLedgerBalances(
    checkpoint.id,
    secondCandidateContext
  );
  if (secondRestoredLedgerPrefix.balanceCount !== ledgerBalanceSnapshots.length) {
    throw new Error('Second Candidate must restore the complete certified checkpoint balance prefix.');
  }

  const secondCandidatePosting = await runtime.candidatePostingReplay.replayRange(
    ids.enterpriseId,
    checkpoint.boundarySequence,
    secondIncrementalTargetBoundary,
    secondCandidateContext
  );
  if (secondCandidatePosting.postingInputCount !== 2) {
    throw new Error(
      `Second Candidate must replay both post-checkpoint suffix facts, got ${secondCandidatePosting.postingInputCount}.`
    );
  }

  const secondCandidateCost = await runtime.cost.recalculate(
    ids.enterpriseId,
    'FIFO',
    {
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
    },
    secondCandidateContext,
    {
      checkpointBoundarySequence: checkpoint.boundarySequence,
      targetBoundarySequence: secondIncrementalTargetBoundary,
      poolStates: restoredCostPools.map((snapshot) => snapshot.state)
    }
  );
  if (
    secondCandidateCost.resultCount !== 2 ||
    secondCandidateCost.valuationPostingCount !== 2
  ) {
    throw new Error(
      `Second Candidate must rebuild two suffix shipment costs, got ${JSON.stringify(secondCandidateCost)}`
    );
  }

  const secondCandidateWorkProjectionCount = await runtime.work.refresh(
    ids.enterpriseId,
    secondCandidateContext
  );
  const secondCandidateWork = await runtime.work.listOpen(
    ids.enterpriseId,
    secondCandidateContext
  );
  const secondCandidatePendingShipment = secondCandidateWork.find((item) =>
    item.sourceLedgerCode === 'pending_shipment'
  );
  if (
    secondCandidateWorkProjectionCount < 1 ||
    secondCandidatePendingShipment === undefined ||
    !new Decimal(secondCandidatePendingShipment.quantity).eq(6)
  ) {
    throw new Error(
      `Second Candidate expected pending_shipment quantity 6, got ${JSON.stringify(secondCandidateWork)}`
    );
  }

  const secondCandidateDigest = await runtime.candidateEconomicRuntimeDigest.compute({
    checkpointId: checkpoint.id,
    candidateRuntimeDatasetId: secondCandidate.id,
    targetBoundarySequence: secondIncrementalTargetBoundary
  });

  const secondOracle = await runtime.runtimeDatasets.createOracle({
    enterpriseId: ids.enterpriseId,
    consistencyDomain,
    parentDatasetId: generationOneCurrent.id,
    oracleOfDatasetId: secondCandidate.id,
    boundarySequence: secondIncrementalTargetBoundary
  });
  const secondOracleContext = await runtime.materializationContexts.oracle(
    secondOracle.id,
    ids.enterpriseId,
    consistencyDomain
  );
  const secondOraclePosting = await runtime.candidatePostingReplay.replayRange(
    ids.enterpriseId,
    0n,
    secondIncrementalTargetBoundary,
    secondOracleContext
  );
  if (secondOraclePosting.postingInputCount !== Number(secondIncrementalTargetBoundary)) {
    throw new Error(
      `Second Full-Replay Oracle must replay every posting input through boundary ${secondIncrementalTargetBoundary}.`
    );
  }

  const secondOracleCost = await runtime.cost.recalculate(
    ids.enterpriseId,
    'FIFO',
    {
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
    },
    secondOracleContext
  );
  if (secondOracleCost.resultCount !== 3) {
    throw new Error(
      `Second Full-Replay Oracle expected three shipment cost results, got ${secondOracleCost.resultCount}.`
    );
  }

  const secondOracleValuationReplay = await runtime.valuationReplay.replayAcceptedRequests(
    ids.enterpriseId,
    consistencyDomain,
    secondIncrementalTargetBoundary,
    secondOracleContext
  );
  if (secondOracleValuationReplay.replayedRequestCount !== 2) {
    throw new Error('Second Full-Replay Oracle must rebuild both canonical valuation requests.');
  }
  const secondOracleWorkProjectionCount = await runtime.work.refresh(
    ids.enterpriseId,
    secondOracleContext
  );
  if (secondOracleWorkProjectionCount < 1) {
    throw new Error('Second Full-Replay Oracle must rebuild Work materialization.');
  }

  const secondOracleDigest = await runtime.oracleEconomicRuntimeDigest.compute(secondOracle.id);
  if (secondCandidateDigest.digest !== secondOracleDigest.digest) {
    throw new Error(
      `Second-generation equivalence mismatch: ${JSON.stringify({
        candidateDigest:secondCandidateDigest.digest,
        oracleDigest:secondOracleDigest.digest,
        candidateFamilyCounts:secondCandidateDigest.familyCounts,
        oracleFamilyCounts:secondOracleDigest.familyCounts,
        candidateFamilyDigests:secondCandidateDigest.familyDigests,
        oracleFamilyDigests:secondOracleDigest.familyDigests
      })}`
    );
  }
  const secondVerifiedOracle = await runtime.runtimeDatasets.markOracleVerified(
    secondOracle.id,
    secondOracleDigest.digest
  );
  if (secondVerifiedOracle.status !== 'VERIFIED') {
    throw new Error('Second Oracle must become VERIFIED before activation.');
  }

  const secondActivation = await runtime.runtimeEquivalence.certifyAndActivate({
    candidateDatasetId: secondCandidate.id,
    oracleDatasetId: secondOracle.id,
    certifiedBy: 'evo-reference-certifier',
    reason: 'Second consecutive Candidate equals its isolated Full Replay Oracle.'
  });
  if (
    secondActivation.certification.status !== 'CERTIFIED' ||
    secondActivation.certification.blockers.length !== 0 ||
    secondActivation.activatedDataset?.id !== secondCandidate.id ||
    secondActivation.activatedDataset.kind !== 'CURRENT' ||
    secondActivation.activatedDataset.status !== 'ACTIVE'
  ) {
    throw new Error(
      `Second governed activation must atomically promote the Candidate: ${JSON.stringify(secondActivation)}`
    );
  }

  const generationOneAfterSecondActivation = await runtime.db
    .selectFrom('economic_runtime_dataset')
    .select(['kind','status'])
    .where('id','=',incrementalCandidate.id)
    .executeTakeFirstOrThrow();
  if (
    generationOneAfterSecondActivation.kind !== 'ARCHIVED' ||
    generationOneAfterSecondActivation.status !== 'ARCHIVED'
  ) {
    throw new Error('Second activation must archive generation one.');
  }

  const secondCurrentOverlay = await runtime.currentEconomicRuntimeView.read(
    ids.enterpriseId,
    consistencyDomain
  );
  if (
    secondCurrentOverlay.activeRuntimeDatasetId !== secondCandidate.id ||
    secondCurrentOverlay.generationChain.length !== 3 ||
    secondCurrentOverlay.generationChain[0] !== currentRuntimeDataset.id ||
    secondCurrentOverlay.generationChain[1] !== incrementalCandidate.id ||
    secondCurrentOverlay.generationChain[2] !== secondCandidate.id ||
    secondCurrentOverlay.certifiedActivationDigest !== secondCandidateDigest.digest ||
    secondCurrentOverlay.computedSemanticDigest !== secondCandidateDigest.digest ||
    JSON.stringify(secondCurrentOverlay.familyCounts) !== JSON.stringify(secondCandidateDigest.familyCounts)
  ) {
    throw new Error(
      `Second activated CURRENT overlay must equal the second certified Candidate: ${JSON.stringify(secondCurrentOverlay)}`
    );
  }

  const secondDashboard = await runtime.query.dashboard(ids.enterpriseId);
  const secondDashboardPendingShipment = (secondDashboard.balances as Array<Record<string,unknown>>)
    .find((row) => row.ledger === 'pending_shipment');
  const secondLedgerBalances = await runtime.ledger.getBalances(
    ids.enterpriseId,
    'pending_shipment'
  );
  const secondDefaultWork = await runtime.work.listOpen(ids.enterpriseId);
  const secondDefaultPendingShipment = secondDefaultWork.find((item) =>
    item.sourceLedgerCode === 'pending_shipment'
  );
  if (
    secondDashboardPendingShipment === undefined ||
    !new Decimal(String(secondDashboardPendingShipment.quantity)).eq(6) ||
    secondLedgerBalances.length === 0 ||
    !new Decimal(secondLedgerBalances[0]!.quantity).eq(6) ||
    secondDefaultPendingShipment === undefined ||
    !new Decimal(secondDefaultPendingShipment.quantity).eq(6)
  ) {
    throw new Error(
      'Dashboard, LedgerReader, and WorkProjection must all expose generation-two pending_shipment quantity 6.'
    );
  }

  // EVO-EVIDENCE: DATABASE E2E target — two consecutive governed activations,
  // Candidate = Full-Replay Oracle = activated CURRENT overlay.

  const graphCoverage = await runtime.dependencyGraph.rebuildEnterprise(ids.enterpriseId);
  if (graphCoverage.missingFamilies.length !== 0) {
    throw new Error(
      `Expected all dependency producer families to remain complete, missing: ${graphCoverage.missingFamilies.join(', ')}`
    );
  }

  const replayedFxResults = await runtime.db.selectFrom('valuation_result as result')
    .innerJoin('valuation_run as run','run.id','result.valuation_run_id')
    .select(['result.result_kind','result.delta_amount'])
    .where('result.enterprise_id','=',ids.enterpriseId)
    .where('run.economic_runtime_dataset_id','=',oracleDataset.id)
    .where('result.result_kind','in',['FX_PERIOD_END','FX_REALIZED_SETTLEMENT'])
    .orderBy('result.result_kind')
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
      candidateInitialStatus: candidateRuntimeDataset.status,
      candidateFinalStatus: 'FAILED'
    },
    incrementalCostCandidate: {
      checkpointBoundarySequence: checkpoint.boundarySequence.toString(),
      targetBoundarySequence: incrementalTargetBoundary.toString(),
      candidateDatasetId: incrementalCandidate.id,
      candidateLedgerDatasetId: candidateLedgerDataset.id,
      restoredLedgerBalanceCount: restoredLedgerPrefix.balanceCount,
      candidatePostingInputCount: candidatePosting.postingInputCount,
      candidatePostingLedgerEffectCount: candidatePosting.ledgerEffectCount,
      postingInputStatusAfterCandidate: postingStatusAfterCandidate.status,
      processedSuffixResultCount: incrementalCost.resultCount,
      suffixBusinessDataId: incrementalShipmentBusiness.id,
      quantity: incrementalCostResult.quantity,
      unitCost: incrementalCostResult.unit_cost,
      totalCost: incrementalCostResult.total_cost,
      allocationSourceBusinessDataId: candidateAllocation.source_business_data_id,
      generationScopedDependencyCount: Number(candidateDependencyCount.count),
      candidateWorkProjectionCount,
      candidateWorkItemCount: Number(candidateWorkGenerationCount.count),
      pendingShipmentQuantity: candidatePendingShipment.quantity,
      candidateEconomicRuntimeDigest: candidateDigest.digest,
      candidateDigestFamilyCounts: candidateDigest.familyCounts,
      isolatedOracleDatasetId: oracleDataset.id,
      isolatedOracleStatus: verifiedOracle.status,
      isolatedOraclePostingInputCount: oraclePosting.postingInputCount,
      isolatedOracleCostResultCount: oracleCost.resultCount,
      isolatedOracleWorkProjectionCount: oracleWorkProjectionCount,
      fullReplayOracleDigest: oracleDigestResult.digest,
      oracleDigestFamilyCounts: oracleDigestResult.familyCounts,
      incrementalEqualsFullReplay: candidateDigest.digest === oracleDigestResult.digest,
      candidateStillIntact: intactCandidate.status === 'BUILDING',
      currentSuffixPostingStatus: currentSuffixPosting.status,
      currentPendingShipmentQuantity: currentPendingShipmentAfterOracle.quantity,
      equivalenceCertificationId: governedActivation.certification.id,
      equivalenceCertificationStatus: governedActivation.certification.status,
      equivalenceCertificationDigest: governedActivation.certification.certificationDigest,
      duplicateActivationIdempotent: true,
      duplicateActivationCertificationId: duplicateActivation.certification.id,
      duplicateActivationCertificationCount: Number(certificationCountAfterRetry.count),
      governedActivatedDatasetId: governedActivation.activatedDataset.id,
      governedActivatedKind: governedActivation.activatedDataset.kind,
      governedActivatedStatus: governedActivation.activatedDataset.status,
      previousDatasetFinalStatus: archivedParent.status,
      activatedPendingShipmentQuantity: activatedPendingShipment.quantity,
      activatedSuffixPostingStatus: activatedSuffixPosting.status,
      currentOverlayGenerationChain: currentOverlay.generationChain,
      currentOverlaySemanticDigest: currentOverlay.computedSemanticDigest,
      currentOverlayFamilyCounts: currentOverlay.familyCounts,
      plannerFallback: suffixPlan.fallbackToFullReplay,
      multiGeneration: {
        secondCandidateDatasetId: secondCandidate.id,
        secondOracleDatasetId: secondOracle.id,
        secondTargetBoundarySequence: secondIncrementalTargetBoundary.toString(),
        secondCandidatePostingInputCount: secondCandidatePosting.postingInputCount,
        secondCandidateCostResultCount: secondCandidateCost.resultCount,
        secondCandidatePendingShipmentQuantity: secondCandidatePendingShipment.quantity,
        secondCandidateDigest: secondCandidateDigest.digest,
        secondOracleDigest: secondOracleDigest.digest,
        secondEquivalenceCertificationId: secondActivation.certification.id,
        secondActivatedDatasetId: secondActivation.activatedDataset.id,
        generationChain: secondCurrentOverlay.generationChain,
        activatedPendingShipmentQuantity: secondDefaultPendingShipment.quantity,
        consecutiveActivationsVerified: true
      }
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

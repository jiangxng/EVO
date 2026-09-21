import { Decimal } from 'decimal.js';
import { createDatabase } from '../platform/database/src/index.js';
import { loadRuntimeConfig } from '../platform/runtime/src/config.js';
import { createEvoRuntime, demoIds, drainPosting } from '../apps/api/src/evo-runtime.js';
import {
  computeEconomicRuntimeDigest,
  computeReplayInputDigest
} from '../modules/replay/infrastructure/postgres-replay-digest.js';

const config = loadRuntimeConfig();
const database = createDatabase(config.databaseUrl);
const runtime = createEvoRuntime(database);

function orderNoOf(dimensions: unknown): string | undefined {
  if (dimensions === null || typeof dimensions !== 'object' || Array.isArray(dimensions)) {
    return undefined;
  }
  const value = (dimensions as Record<string,unknown>).order_no;
  return typeof value === 'string' ? value : undefined;
}

async function businessSnapshot(
  enterpriseId: string,
  orderNo: string,
  shipmentBusinessDataId: string,
  receiptBusinessDataId: string,
  instructionId: string
) {
  const balances = await runtime.db.selectFrom('ledger_balance as b')
    .innerJoin('ledger_definition as d','d.id','b.ledger_definition_id')
    .innerJoin('ledger_dataset as ds','ds.id','b.ledger_dataset_id')
    .select(['d.code as ledger','b.quantity','b.amount','b.dimensions'])
    .where('b.enterprise_id','=',enterpriseId)
    .where('ds.status','=','ACTIVE')
    .where('d.code','in',['pending_production','pending_shipment','receivable','cash'])
    .execute();

  const scopedBalances = balances.filter((row)=>orderNoOf(row.dimensions)===orderNo);
  const byLedger = new Map(scopedBalances.map((row)=>[row.ledger,row]));

  const work = await runtime.db.selectFrom('work_item')
    .select(['work_type','status','source_ledger_code','source_dimensions','source_quantity','source_amount'])
    .where('enterprise_id','=',enterpriseId)
    .execute();
  const scopedWork = work
    .filter((row)=>orderNoOf(row.source_dimensions)===orderNo)
    .sort((a,b)=>a.source_ledger_code.localeCompare(b.source_ledger_code));

  const relation = await runtime.db.selectFrom('allocation_relation')
    .select([
      'source_position_key','consumer_business_data_id','measurements',
      'instruction_id','allocation_policy_id','allocation_policy_version'
    ])
    .where('enterprise_id','=',enterpriseId)
    .where('consumer_business_data_id','=',receiptBusinessDataId)
    .where('instruction_id','=',instructionId)
    .executeTakeFirstOrThrow();

  const valuationResults = await runtime.db.selectFrom('valuation_result')
    .select([
      'result_kind','source_business_data_ids','delta_amount','delta_unit',
      'source_measurements','target_measurements'
    ])
    .where('enterprise_id','=',enterpriseId)
    .where('result_kind','=','FX_REALIZED_SETTLEMENT')
    .execute();
  const realized = valuationResults.find((row)=>
    Array.isArray(row.source_business_data_ids) &&
    row.source_business_data_ids.includes(receiptBusinessDataId)
  );
  if (realized === undefined) {
    throw new Error('Reference O2C snapshot requires the realized FX result.');
  }

  const cost = await runtime.db.selectFrom('cost_result')
    .select(['business_data_id','method','quantity','unit_cost','total_cost'])
    .where('enterprise_id','=',enterpriseId)
    .where('business_data_id','=',shipmentBusinessDataId)
    .executeTakeFirstOrThrow();

  const required = ['pending_production','pending_shipment','receivable','cash'];
  for (const ledger of required) {
    if (!byLedger.has(ledger)) {
      throw new Error(`Reference O2C snapshot is missing ${ledger} balance.`);
    }
  }

  return {
    balances: {
      pendingProductionQuantity: byLedger.get('pending_production')!.quantity,
      pendingShipmentQuantity: byLedger.get('pending_shipment')!.quantity,
      receivableAmount: byLedger.get('receivable')!.amount,
      cashAmount: byLedger.get('cash')!.amount
    },
    work: scopedWork.map((row)=>({
      workType:row.work_type,
      status:row.status,
      sourceLedgerCode:row.source_ledger_code,
      quantity:row.source_quantity,
      amount:row.source_amount
    })),
    settlement: {
      sourcePositionKey:relation.source_position_key,
      consumerBusinessDataId:relation.consumer_business_data_id,
      measurements:relation.measurements,
      instructionId:relation.instruction_id,
      allocationPolicyId:relation.allocation_policy_id,
      allocationPolicyVersion:relation.allocation_policy_version
    },
    realizedFx: {
      amount:realized.delta_amount,
      unit:realized.delta_unit,
      sourceMeasurements:realized.source_measurements,
      targetMeasurements:realized.target_measurements
    },
    shipmentCost: {
      method:cost.method,
      quantity:cost.quantity,
      unitCost:cost.unit_cost,
      totalCost:cost.total_cost
    }
  };
}

function assertClosedSnapshot(snapshot: Awaited<ReturnType<typeof businessSnapshot>>, label: string): void {
  if (
    !new Decimal(snapshot.balances.pendingProductionQuantity).eq(0) ||
    !new Decimal(snapshot.balances.pendingShipmentQuantity).eq(0) ||
    !new Decimal(snapshot.balances.receivableAmount).eq(0) ||
    !new Decimal(snapshot.balances.cashAmount).eq(7300)
  ) {
    throw new Error(`${label} balances are not the expected full-closure state: ${JSON.stringify(snapshot.balances)}`);
  }

  if (
    snapshot.work.length !== 3 ||
    snapshot.work.some((row)=>row.status!=='DONE')
  ) {
    throw new Error(`${label} Work state must contain exactly three DONE O2C items: ${JSON.stringify(snapshot.work)}`);
  }

  const measurements = snapshot.settlement.measurements as Array<Record<string,unknown>>;
  const settled = measurements[0];
  if (
    settled === undefined ||
    !new Decimal(String(settled.value ?? 0)).eq(1000) ||
    settled.unit !== 'USD' ||
    settled.role !== 'SETTLEMENT_QUANTITY'
  ) {
    throw new Error(`${label} settlement relation must consume 1000 USD: ${JSON.stringify(snapshot.settlement)}`);
  }

  if (
    !new Decimal(snapshot.realizedFx.amount).eq(100) ||
    snapshot.realizedFx.unit !== 'CNY'
  ) {
    throw new Error(`${label} realized FX must equal +100 CNY: ${JSON.stringify(snapshot.realizedFx)}`);
  }

  if (
    snapshot.shipmentCost.method !== 'FIFO' ||
    !new Decimal(String(snapshot.shipmentCost.quantity ?? 0)).eq(10) ||
    !new Decimal(String(snapshot.shipmentCost.unitCost ?? 0)).eq(10) ||
    !new Decimal(String(snapshot.shipmentCost.totalCost ?? 0)).eq(100)
  ) {
    throw new Error(`${label} shipment cost is not the expected FIFO result: ${JSON.stringify(snapshot.shipmentCost)}`);
  }
}

try {
  const ids = await demoIds(runtime);
  const suffix = Date.now();
  const orderNo = `EEL-C01-REPLAY-${suffix}`;
  const correlationId = `O2C:${orderNo}`;
  const project = `PROJECT-${suffix}`;

  const orderAt = new Date('2026-09-22T09:00:00.000Z');
  const productionAt = new Date('2026-09-22T10:00:00.000Z');
  const shipmentAt = new Date('2026-09-22T11:00:00.000Z');
  const receiptAt = new Date('2026-09-22T12:00:00.000Z');

  const order = await runtime.command.execute({
    enterpriseId:ids.enterpriseId,
    applicationInstanceId:ids.salesAppId,
    commandCode:'approve-sales-order',
    actor:{ type:'AUTOMATION', id:'demo-automation' },
    requestId:`${orderNo}:approve`,
    correlationId,
    idempotencyKey:`${orderNo}:approve`,
    input:{
      eventKind:'ORDER',
      orderNo,
      customer:'EEL-C01-Replay-Customer',
      productId:'P-100',
      quantity:10,
      unitPrice:'100.00',
      totalAmount:'1000.00',
      currency:'USD',
      localCarryingAmount:'7200.00',
      localCurrency:'CNY',
      fulfillmentMode:'MAKE',
      project,
      department:'SALES',
      profitCenter:'PC-EEL-C01',
      costCenter:'CC-SALES'
    },
    effectiveAt:orderAt,
    businessObjectKey:orderNo
  });
  await drainPosting(runtime,ids.enterpriseId);

  const orderBusiness = await runtime.db.selectFrom('business_data')
    .select('id')
    .where('command_execution_id','=',order.commandExecutionId)
    .executeTakeFirstOrThrow();

  await runtime.command.execute({
    enterpriseId:ids.enterpriseId,
    applicationInstanceId:ids.productionAppId,
    commandCode:'complete-production',
    actor:{ type:'AUTOMATION', id:'demo-automation' },
    requestId:`${orderNo}:production`,
    correlationId,
    causationId:orderBusiness.id,
    idempotencyKey:`${orderNo}:production`,
    input:{
      orderNo,
      customer:'EEL-C01-Replay-Customer',
      productId:'P-100',
      warehouse:'HK',
      quantity:10,
      totalCost:'100.00',
      project,
      department:'SALES',
      profitCenter:'PC-EEL-C01',
      costCenter:'CC-SALES'
    },
    effectiveAt:productionAt,
    businessObjectKey:`PROD:${orderNo}:P-100`
  });
  await drainPosting(runtime,ids.enterpriseId);

  const shipmentNo = `SHIP-${suffix}`;
  const shipment = await runtime.command.execute({
    enterpriseId:ids.enterpriseId,
    applicationInstanceId:ids.inventoryAppId,
    commandCode:'ship-sales-order',
    actor:{ type:'AUTOMATION', id:'demo-automation' },
    requestId:`${orderNo}:shipment`,
    correlationId,
    causationId:orderBusiness.id,
    idempotencyKey:shipmentNo,
    input:{
      movementType:'SHIP',
      shipmentNo,
      orderNo,
      customer:'EEL-C01-Replay-Customer',
      productId:'P-100',
      warehouse:'HK',
      quantity:10,
      lot:null,
      project,
      department:'SALES',
      profitCenter:'PC-EEL-C01',
      costCenter:'CC-SALES'
    },
    effectiveAt:shipmentAt,
    businessObjectKey:shipmentNo
  });
  await drainPosting(runtime,ids.enterpriseId);

  const shipmentBusiness = await runtime.db.selectFrom('business_data')
    .select('id')
    .where('command_execution_id','=',shipment.commandExecutionId)
    .executeTakeFirstOrThrow();

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

  const initialCost = await runtime.cost.recalculate(ids.enterpriseId,'FIFO',{
    valuationPolicyId:fifoPolicy.id,
    valuationPolicyVersion:fifoPolicy.version,
    allocationPolicyId:fifoAllocationPolicy.id,
    allocationPolicyVersion:fifoAllocationPolicy.version,
    valuationRules:{
      'sales_shipment.created':{
        id:shipmentValuationRule.id,
        version:shipmentValuationRule.version
      }
    }
  });
  if (initialCost.resultCount < 1 || initialCost.valuationPostingCount < 1) {
    throw new Error(`Reference O2C requires cost + valuation posting: ${JSON.stringify(initialCost)}`);
  }

  const receipt = await runtime.command.execute({
    enterpriseId:ids.enterpriseId,
    applicationInstanceId:ids.cashAppId,
    commandCode:'record-receipt',
    actor:{ type:'AUTOMATION', id:'demo-automation' },
    requestId:`${orderNo}:receipt`,
    correlationId,
    causationId:orderBusiness.id,
    idempotencyKey:`${orderNo}:receipt`,
    input:{
      semanticRole:'CUSTOMER_CASH_RECEIPT',
      orderNo,
      customer:'EEL-C01-Replay-Customer',
      settledAmount:'1000.00',
      settledCurrency:'USD',
      cashAmount:'7300.00',
      cashCurrency:'CNY',
      project,
      department:'SALES',
      profitCenter:'PC-EEL-C01',
      costCenter:'CC-SALES'
    },
    effectiveAt:receiptAt,
    businessObjectKey:`RECEIPT:${orderNo}`
  });
  await drainPosting(runtime,ids.enterpriseId);

  const receiptBusiness = await runtime.db.selectFrom('business_data')
    .select(['id','business_data_type'])
    .where('command_execution_id','=',receipt.commandExecutionId)
    .executeTakeFirstOrThrow();
  if (receiptBusiness.business_data_type !== 'cash.received') {
    throw new Error('Reference Full Replay scenario requires canonical cash.received.');
  }

  const fxAllocationPolicy = await runtime.db.selectFrom('allocation_policy')
    .select(['id','version'])
    .where('enterprise_id','=',ids.enterpriseId)
    .where('code','=','fx_settlement_explicit')
    .where('status','=','PUBLISHED')
    .where('version','=',1)
    .executeTakeFirstOrThrow();

  const instruction = await runtime.allocation.recordInstruction({
    enterpriseId:ids.enterpriseId,
    consumerBusinessDataId:receiptBusiness.id,
    mode:'EXPLICIT',
    sourceSelector:{ kind:'BUSINESS_DATA', businessDataId:orderBusiness.id },
    actorType:'AUTOMATION',
    actorId:'demo-automation',
    effectiveAt:receiptAt,
    reason:'EEL-C01 Full Replay reference receipt explicitly settles the selected sales-order receivable.',
    allocationPolicyId:fxAllocationPolicy.id,
    allocationPolicyVersion:fxAllocationPolicy.version,
    idempotencyKey:`${orderNo}:settlement-allocation`
  });

  const positionDefinition = await runtime.db.selectFrom('position_definition')
    .select(['id','version','semantic_digest'])
    .where('enterprise_id','=',ids.enterpriseId)
    .where('code','=','fx_receivable')
    .where('status','=','PUBLISHED')
    .where('version','=',1)
    .executeTakeFirstOrThrow();

  await runtime.command.execute({
    enterpriseId:ids.enterpriseId,
    applicationInstanceId:ids.valuationAppId,
    commandCode:'request-valuation',
    actor:{ type:'AUTOMATION', id:'demo-automation' },
    requestId:`${orderNo}:realized-fx`,
    correlationId,
    causationId:receiptBusiness.id,
    idempotencyKey:`${orderNo}:realized-fx`,
    input:{
      requestCode:`FX-SETTLE-${orderNo}`,
      valuationKind:'FX_REALIZED_SETTLEMENT',
      valuationAt:receiptAt.toISOString(),
      scope:{
        kind:'DIMENSION_QUERY',
        dimensions:{ order_no:orderNo, customer:'EEL-C01-Replay-Customer' }
      },
      positionDefinition:{
        definitionId:positionDefinition.id,
        version:positionDefinition.version,
        digest:positionDefinition.semantic_digest
      },
      settlementBusinessDataId:receiptBusiness.id,
      allocationPolicy:{ id:fxAllocationPolicy.id, version:fxAllocationPolicy.version },
      instructionId:instruction.id,
      settlementMapping:{
        foreignValueField:'settledAmount',
        foreignUnitField:'settledCurrency',
        localValueField:'cashAmount',
        localUnitField:'cashCurrency'
      }
    },
    effectiveAt:receiptAt,
    businessObjectKey:`FX-SETTLE:${orderNo}`
  });
  await drainPosting(runtime,ids.enterpriseId);

  const consistencyDomain = (await runtime.db.selectFrom('enterprise_runtime_state')
    .select('consistency_domain')
    .where('enterprise_id','=',ids.enterpriseId)
    .executeTakeFirstOrThrow()).consistency_domain;
  const boundary = BigInt((await runtime.db.selectFrom('enterprise_runtime_state')
    .select('next_posting_sequence')
    .where('enterprise_id','=',ids.enterpriseId)
    .executeTakeFirstOrThrow()).next_posting_sequence) - 1n;

  const initialValuationReplay = await runtime.valuationReplay.replayAcceptedRequests(
    ids.enterpriseId,
    consistencyDomain,
    boundary
  );
  if (initialValuationReplay.replayedRequestCount !== 1) {
    throw new Error(
      `Fresh isolated EEL-C01 replay environment must contain exactly one valuation request, got ${initialValuationReplay.replayedRequestCount}.`
    );
  }
  await runtime.work.refresh(ids.enterpriseId);

  const beforeBusiness = await businessSnapshot(
    ids.enterpriseId,
    orderNo,
    shipmentBusiness.id,
    receiptBusiness.id,
    instruction.id
  );
  assertClosedSnapshot(beforeBusiness,'Before Full Replay');

  const beforeInput = await computeReplayInputDigest(
    runtime.db,
    ids.enterpriseId,
    consistencyDomain,
    boundary
  );
  const beforeEconomic = await computeEconomicRuntimeDigest(
    runtime.db,
    ids.enterpriseId,
    consistencyDomain,
    boundary
  );

  const replay = await runtime.replay.prepareFullReplay(ids.enterpriseId);
  if (replay.boundarySequence !== boundary) {
    throw new Error(
      `Full Replay boundary changed unexpectedly: expected ${boundary}, got ${replay.boundarySequence}.`
    );
  }

  await drainPosting(runtime,ids.enterpriseId);
  if (replay.costMethod === null || replay.costPins === null) {
    throw new Error('EEL-C01 Full Replay must capture the pinned FIFO cost interpretation.');
  }
  await runtime.cost.recalculate(
    ids.enterpriseId,
    replay.costMethod,
    replay.costPins
  );

  const replayedValuation = await runtime.valuationReplay.replayAcceptedRequests(
    ids.enterpriseId,
    consistencyDomain,
    replay.boundarySequence
  );
  if (replayedValuation.replayedRequestCount !== 1) {
    throw new Error(
      `Full Replay must rebuild exactly the one canonical EEL-C01 valuation request, got ${replayedValuation.replayedRequestCount}.`
    );
  }
  await runtime.work.refresh(ids.enterpriseId);

  const afterEconomic = await computeEconomicRuntimeDigest(
    runtime.db,
    ids.enterpriseId,
    consistencyDomain,
    replay.boundarySequence
  );
  const afterInput = await computeReplayInputDigest(
    runtime.db,
    ids.enterpriseId,
    consistencyDomain,
    replay.boundarySequence
  );
  await runtime.replay.completeFullReplay(
    replay.replayRunId,
    ids.enterpriseId,
    afterEconomic
  );

  if (
    beforeEconomic !== afterEconomic ||
    replay.beforeDigest !== beforeEconomic
  ) {
    throw new Error(
      `EEL-C01 Full Replay economic digest mismatch: before=${beforeEconomic}, replay=${replay.beforeDigest}, after=${afterEconomic}`
    );
  }

  if (
    beforeInput.digest !== afterInput.digest ||
    beforeInput.count !== afterInput.count ||
    beforeInput.lastIncludedFactId !== afterInput.lastIncludedFactId
  ) {
    throw new Error(
      `Canonical replay inputs changed during Full Replay: before=${JSON.stringify(beforeInput)}, after=${JSON.stringify(afterInput)}`
    );
  }

  const run = await runtime.db.selectFrom('replay_run')
    .select(['status','validation_status','before_digest','after_digest'])
    .where('id','=',replay.replayRunId)
    .executeTakeFirstOrThrow();
  if (
    run.status !== 'COMPLETED' ||
    run.validation_status !== 'MATCH' ||
    run.before_digest !== beforeEconomic ||
    run.after_digest !== afterEconomic
  ) {
    throw new Error(`Replay run did not persist MATCH evidence: ${JSON.stringify(run)}`);
  }

  const survivingInstruction = await runtime.allocation.getInstruction(instruction.id);
  if (
    survivingInstruction === null ||
    survivingInstruction.consumerBusinessDataId !== receiptBusiness.id ||
    survivingInstruction.sourceSelector.kind !== 'BUSINESS_DATA' ||
    survivingInstruction.sourceSelector.businessDataId !== orderBusiness.id
  ) {
    throw new Error('Canonical AllocationInstruction must survive Full Replay unchanged.');
  }

  const afterBusiness = await businessSnapshot(
    ids.enterpriseId,
    orderNo,
    shipmentBusiness.id,
    receiptBusiness.id,
    instruction.id
  );
  assertClosedSnapshot(afterBusiness,'After Full Replay');

  if (JSON.stringify(beforeBusiness) !== JSON.stringify(afterBusiness)) {
    throw new Error(
      `EEL-C01 business snapshot changed across Full Replay: before=${JSON.stringify(beforeBusiness)}, after=${JSON.stringify(afterBusiness)}`
    );
  }

  console.log(JSON.stringify({
    status:'PASS',
    packet:'EEL-C01.5',
    orderNo,
    canonicalHistoryPreserved:true,
    businessOutcomePreserved:true,
    replayDeterministic:true,
    replayRunId:replay.replayRunId,
    boundarySequence:boundary.toString(),
    canonicalInputDigest:beforeInput.digest,
    beforeEconomicDigest:beforeEconomic,
    afterEconomicDigest:afterEconomic,
    balances:afterBusiness.balances,
    work:afterBusiness.work,
    realizedFx:afterBusiness.realizedFx,
    shipmentCost:afterBusiness.shipmentCost
  },null,2));
} finally {
  await database.destroy();
}

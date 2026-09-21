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

async function legacySnapshot(
  enterpriseId: string,
  orderNo: string,
  paymentBusinessDataId: string,
  instructionId: string
) {
  const payment = await runtime.db.selectFrom('business_data')
    .select(['id','business_data_type','payload','effective_at'])
    .where('id','=',paymentBusinessDataId)
    .where('enterprise_id','=',enterpriseId)
    .executeTakeFirstOrThrow();

  const relation = await runtime.db.selectFrom('allocation_relation as r')
    .innerJoin('allocation_run as run','run.id','r.allocation_run_id')
    .select([
      'r.source_position_key','r.consumer_business_data_id','r.measurements',
      'r.instruction_id','r.allocation_policy_id','r.allocation_policy_version',
      'run.status as run_status'
    ])
    .where('r.enterprise_id','=',enterpriseId)
    .where('r.consumer_business_data_id','=',paymentBusinessDataId)
    .where('r.instruction_id','=',instructionId)
    .executeTakeFirstOrThrow();

  const valuationResults = await runtime.db.selectFrom('valuation_result as r')
    .innerJoin('valuation_run as run','run.id','r.valuation_run_id')
    .select([
      'r.result_kind','r.delta_amount','r.delta_unit','r.source_business_data_ids',
      'run.status as run_status'
    ])
    .where('r.enterprise_id','=',enterpriseId)
    .where('r.result_kind','in',['FX_PERIOD_END','FX_REALIZED_SETTLEMENT'])
    .execute();

  const periodEnd = valuationResults.find((row)=>row.result_kind==='FX_PERIOD_END');
  const realized = valuationResults.find((row)=>
    row.result_kind==='FX_REALIZED_SETTLEMENT' &&
    Array.isArray(row.source_business_data_ids) &&
    row.source_business_data_ids.includes(paymentBusinessDataId)
  );
  if (periodEnd === undefined || realized === undefined) {
    throw new Error('Legacy compatibility snapshot requires period-end and realized FX results.');
  }

  const ledgerEffects = await runtime.db.selectFrom('ledger_entry as e')
    .innerJoin('ledger_definition as d','d.id','e.ledger_definition_id')
    .select(['d.code as ledger','e.amount','e.currency'])
    .where('e.enterprise_id','=',enterpriseId)
    .where('e.business_data_id','=',paymentBusinessDataId)
    .where('e.entry_source_kind','=','POSTING')
    .execute();

  const work = await runtime.db.selectFrom('work_item')
    .select(['work_type','status','source_ledger_code','source_dimensions','source_amount'])
    .where('enterprise_id','=',enterpriseId)
    .execute();
  const scopedWork = work.filter((row)=>{
    const dimensions = row.source_dimensions as Record<string,unknown>;
    return dimensions.order_no===orderNo;
  });

  return {
    paymentType:payment.business_data_type,
    paymentPayload:payment.payload,
    paymentEffectiveAt:payment.effective_at,
    relation:{
      sourcePositionKey:relation.source_position_key,
      consumerBusinessDataId:relation.consumer_business_data_id,
      measurements:relation.measurements,
      instructionId:relation.instruction_id,
      allocationPolicyId:relation.allocation_policy_id,
      allocationPolicyVersion:relation.allocation_policy_version,
      runStatus:relation.run_status
    },
    periodEnd:{
      deltaAmount:periodEnd.delta_amount,
      deltaUnit:periodEnd.delta_unit,
      runStatus:periodEnd.run_status
    },
    realized:{
      deltaAmount:realized.delta_amount,
      deltaUnit:realized.delta_unit,
      runStatus:realized.run_status
    },
    ledgerEffects,
    work:scopedWork.map((row)=>({
      workType:row.work_type,
      status:row.status,
      ledger:row.source_ledger_code,
      amount:row.source_amount
    }))
  };
}

function assertLegacySnapshot(
  snapshot: Awaited<ReturnType<typeof legacySnapshot>>,
  label: string
): void {
  if (snapshot.paymentType !== 'customer_payment.received') {
    throw new Error(`${label}: legacy BusinessData type was rewritten: ${snapshot.paymentType}`);
  }

  const payload = snapshot.paymentPayload as Record<string,unknown>;
  if (
    String(payload.foreignAmount) !== '1000' ||
    payload.foreignCurrency !== 'USD' ||
    String(payload.localAmount) !== '7300' ||
    payload.localCurrency !== 'CNY'
  ) {
    throw new Error(`${label}: legacy payment measurements changed: ${JSON.stringify(payload)}`);
  }

  const measurements = snapshot.relation.measurements as Array<Record<string,unknown>>;
  const settled = measurements[0];
  if (
    snapshot.relation.runStatus !== 'COMPLETED' ||
    settled === undefined ||
    !new Decimal(String(settled.value ?? 0)).eq(1000) ||
    settled.unit !== 'USD' ||
    settled.role !== 'SETTLEMENT_QUANTITY'
  ) {
    throw new Error(`${label}: legacy settlement relation is not preserved: ${JSON.stringify(snapshot.relation)}`);
  }

  if (
    snapshot.periodEnd.runStatus !== 'COMPLETED' ||
    !new Decimal(String(snapshot.periodEnd.deltaAmount ?? 0)).eq(200) ||
    snapshot.periodEnd.deltaUnit !== 'CNY'
  ) {
    throw new Error(`${label}: expected period-end FX +200 CNY: ${JSON.stringify(snapshot.periodEnd)}`);
  }

  if (
    snapshot.realized.runStatus !== 'COMPLETED' ||
    !new Decimal(String(snapshot.realized.deltaAmount ?? 0)).eq(100) ||
    snapshot.realized.deltaUnit !== 'CNY'
  ) {
    throw new Error(`${label}: expected realized FX +100 CNY: ${JSON.stringify(snapshot.realized)}`);
  }

  if (snapshot.ledgerEffects.length !== 0) {
    throw new Error(
      `${label}: legacy customer_payment.received must not be silently reinterpreted as new cash/receivable posting: ${JSON.stringify(snapshot.ledgerEffects)}`
    );
  }
}

try {
  const ids = await demoIds(runtime);
  const suffix = Date.now();
  const orderNo = `EEL-C01-LEGACY-${suffix}`;
  const correlationId = `O2C:${orderNo}`;
  const project = `LEGACY-${suffix}`;

  const orderAt = new Date('2026-09-18T00:00:00.000Z');
  const valuationAt = new Date('2026-09-18T23:59:59.000Z');
  const settlementAt = new Date('2026-09-19T01:00:00.000Z');

  const order = await runtime.command.execute({
    enterpriseId:ids.enterpriseId,
    applicationInstanceId:ids.salesAppId,
    commandCode:'approve-sales-order',
    actor:{ type:'AUTOMATION', id:'legacy-compat-validator' },
    requestId:`${orderNo}:approve`,
    correlationId,
    idempotencyKey:`${orderNo}:approve`,
    input:{
      eventKind:'ORDER',
      orderNo,
      customer:'Legacy-Compatibility-Customer',
      productId:'P-100',
      quantity:1,
      unitPrice:'1000.00',
      totalAmount:'1000.00',
      currency:'USD',
      localCarryingAmount:'7000.00',
      localCurrency:'CNY',
      fulfillmentMode:'MAKE',
      project,
      department:'SALES',
      profitCenter:'PC-LEGACY',
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

  const positionDefinition = await runtime.db.selectFrom('position_definition')
    .select(['id','version','semantic_digest','config'])
    .where('enterprise_id','=',ids.enterpriseId)
    .where('code','=','fx_receivable')
    .where('version','=',1)
    .where('status','=','PUBLISHED')
    .executeTakeFirstOrThrow();

  const positionConfig = positionDefinition.config as Record<string,unknown>;
  if (
    positionConfig.settlementBusinessDataType !== 'cash.received' ||
    !Array.isArray(positionConfig.legacySettlementBusinessDataTypes) ||
    !positionConfig.legacySettlementBusinessDataTypes.includes('customer_payment.received')
  ) {
    throw new Error('Reference position definition must explicitly retain customer_payment.received as legacy compatibility input.');
  }

  const rateDataset = await runtime.rates.publish({
    enterpriseId:ids.enterpriseId,
    code:`legacy-compat-fx-${suffix}`,
    version:1,
    provider:'eel-c01-legacy-compat',
    observations:[{
      role:'PERIOD_END_VALUATION',
      sourceUnit:'USD',
      targetUnit:'CNY',
      rate:'7.2',
      effectiveAt:orderAt,
      precision:6
    }]
  });

  await runtime.command.execute({
    enterpriseId:ids.enterpriseId,
    applicationInstanceId:ids.valuationAppId,
    commandCode:'request-valuation',
    actor:{ type:'AUTOMATION', id:'legacy-compat-validator' },
    requestId:`${orderNo}:period-end`,
    correlationId,
    causationId:orderBusiness.id,
    idempotencyKey:`${orderNo}:period-end`,
    input:{
      requestCode:`FX-PERIOD-END-${orderNo}`,
      valuationKind:'FX_PERIOD_END',
      valuationAt:valuationAt.toISOString(),
      scope:{
        kind:'DIMENSION_QUERY',
        dimensions:{ order_no:orderNo, customer:'Legacy-Compatibility-Customer' }
      },
      positionDefinition:{
        definitionId:positionDefinition.id,
        version:positionDefinition.version,
        digest:positionDefinition.semantic_digest
      },
      rateDataset:{
        datasetId:rateDataset.id,
        version:rateDataset.version,
        digest:rateDataset.digest
      },
      policy:{ amountScale:2, roundingMode:'HALF_UP' }
    },
    effectiveAt:valuationAt,
    businessObjectKey:`FX-PERIOD-END:${orderNo}`
  });
  await drainPosting(runtime,ids.enterpriseId);

  const payment = await runtime.command.execute({
    enterpriseId:ids.enterpriseId,
    applicationInstanceId:ids.salesAppId,
    commandCode:'record-customer-payment',
    actor:{ type:'AUTOMATION', id:'legacy-compat-validator' },
    requestId:`${orderNo}:payment`,
    correlationId,
    causationId:orderBusiness.id,
    idempotencyKey:`${orderNo}:payment`,
    input:{
      eventKind:'PAYMENT',
      orderNo,
      customer:'Legacy-Compatibility-Customer',
      foreignAmount:'1000',
      foreignCurrency:'USD',
      localAmount:'7300',
      localCurrency:'CNY',
      project,
      department:'SALES',
      profitCenter:'PC-LEGACY',
      costCenter:'CC-SALES'
    },
    effectiveAt:settlementAt,
    businessObjectKey:`PAY:${orderNo}`
  });
  await drainPosting(runtime,ids.enterpriseId);

  const paymentBusiness = await runtime.db.selectFrom('business_data')
    .select(['id','business_data_type'])
    .where('command_execution_id','=',payment.commandExecutionId)
    .executeTakeFirstOrThrow();
  if (paymentBusiness.business_data_type !== 'customer_payment.received') {
    throw new Error(`Legacy command emitted unexpected type ${paymentBusiness.business_data_type}.`);
  }

  const policy = await runtime.db.selectFrom('allocation_policy')
    .select(['id','version'])
    .where('enterprise_id','=',ids.enterpriseId)
    .where('code','=','fx_settlement_explicit')
    .where('version','=',1)
    .where('status','=','PUBLISHED')
    .executeTakeFirstOrThrow();

  const instruction = await runtime.allocation.recordInstruction({
    enterpriseId:ids.enterpriseId,
    consumerBusinessDataId:paymentBusiness.id,
    mode:'EXPLICIT',
    sourceSelector:{ kind:'BUSINESS_DATA', businessDataId:orderBusiness.id },
    actorType:'AUTOMATION',
    actorId:'legacy-compat-validator',
    effectiveAt:settlementAt,
    reason:'Legacy customer_payment.received explicitly settles the selected historical receivable.',
    allocationPolicyId:policy.id,
    allocationPolicyVersion:policy.version,
    idempotencyKey:`${orderNo}:legacy-settlement`
  });

  await runtime.command.execute({
    enterpriseId:ids.enterpriseId,
    applicationInstanceId:ids.valuationAppId,
    commandCode:'request-valuation',
    actor:{ type:'AUTOMATION', id:'legacy-compat-validator' },
    requestId:`${orderNo}:realized-fx`,
    correlationId,
    causationId:paymentBusiness.id,
    idempotencyKey:`${orderNo}:realized-fx`,
    input:{
      requestCode:`FX-LEGACY-SETTLE-${orderNo}`,
      valuationKind:'FX_REALIZED_SETTLEMENT',
      valuationAt:settlementAt.toISOString(),
      scope:{
        kind:'DIMENSION_QUERY',
        dimensions:{ order_no:orderNo, customer:'Legacy-Compatibility-Customer' }
      },
      positionDefinition:{
        definitionId:positionDefinition.id,
        version:positionDefinition.version,
        digest:positionDefinition.semantic_digest
      },
      settlementBusinessDataId:paymentBusiness.id,
      allocationPolicy:{ id:policy.id, version:policy.version },
      instructionId:instruction.id,
      settlementMapping:{
        foreignValueField:'foreignAmount',
        foreignUnitField:'foreignCurrency',
        localValueField:'localAmount',
        localUnitField:'localCurrency'
      }
    },
    effectiveAt:settlementAt,
    businessObjectKey:`FX-LEGACY-SETTLE:${orderNo}`
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

  const initialValuation = await runtime.valuationReplay.replayAcceptedRequests(
    ids.enterpriseId,
    consistencyDomain,
    boundary
  );
  if (initialValuation.replayedRequestCount !== 2) {
    throw new Error(`Legacy compatibility scenario expected two valuation requests, got ${initialValuation.replayedRequestCount}.`);
  }
  await runtime.work.refresh(ids.enterpriseId);

  const beforeSnapshot = await legacySnapshot(
    ids.enterpriseId,
    orderNo,
    paymentBusiness.id,
    instruction.id
  );
  assertLegacySnapshot(beforeSnapshot,'Before Full Replay');

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
  await drainPosting(runtime,ids.enterpriseId);
  if (replay.costMethod !== null) {
    await runtime.cost.recalculate(
      ids.enterpriseId,
      replay.costMethod,
      replay.costPins ?? undefined
    );
  }
  const replayedValuation = await runtime.valuationReplay.replayAcceptedRequests(
    ids.enterpriseId,
    consistencyDomain,
    replay.boundarySequence
  );
  if (replayedValuation.replayedRequestCount !== 2) {
    throw new Error(`Full Replay expected two legacy-compatible valuation requests, got ${replayedValuation.replayedRequestCount}.`);
  }
  await runtime.work.refresh(ids.enterpriseId);

  const afterInput = await computeReplayInputDigest(
    runtime.db,
    ids.enterpriseId,
    consistencyDomain,
    replay.boundarySequence
  );
  const afterEconomic = await computeEconomicRuntimeDigest(
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

  const afterSnapshot = await legacySnapshot(
    ids.enterpriseId,
    orderNo,
    paymentBusiness.id,
    instruction.id
  );
  assertLegacySnapshot(afterSnapshot,'After Full Replay');

  if (
    beforeInput.digest !== afterInput.digest ||
    beforeInput.count !== afterInput.count ||
    beforeInput.lastIncludedFactId !== afterInput.lastIncludedFactId
  ) {
    throw new Error(
      `Legacy canonical replay input changed: before=${JSON.stringify(beforeInput)}, after=${JSON.stringify(afterInput)}`
    );
  }

  if (
    beforeEconomic !== afterEconomic ||
    replay.beforeDigest !== beforeEconomic
  ) {
    throw new Error(
      `Legacy economic runtime changed after replay: before=${beforeEconomic}, replay=${replay.beforeDigest}, after=${afterEconomic}`
    );
  }

  const survivingInstruction = await runtime.allocation.getInstruction(instruction.id);
  if (
    survivingInstruction === null ||
    survivingInstruction.consumerBusinessDataId !== paymentBusiness.id ||
    survivingInstruction.sourceSelector.kind !== 'BUSINESS_DATA' ||
    survivingInstruction.sourceSelector.businessDataId !== orderBusiness.id
  ) {
    throw new Error('Legacy AllocationInstruction did not survive Full Replay unchanged.');
  }

  if (JSON.stringify(beforeSnapshot) !== JSON.stringify(afterSnapshot)) {
    throw new Error(
      `Legacy business snapshot changed across replay: before=${JSON.stringify(beforeSnapshot)}, after=${JSON.stringify(afterSnapshot)}`
    );
  }

  console.log(JSON.stringify({
    status:'PASS',
    packet:'EEL-C01 legacy receipt compatibility',
    orderNo,
    legacyBusinessDataType:paymentBusiness.business_data_type,
    canonicalTargetBusinessDataType:positionConfig.settlementBusinessDataType,
    legacyCompatibilityDeclared:true,
    historicalSemanticRewrite:false,
    canonicalHistoryPreserved:true,
    allocationInstructionPreserved:true,
    realizedFxPreserved:{ amount:'100', unit:'CNY' },
    periodEndFxPreserved:{ amount:'200', unit:'CNY' },
    oldPaymentPostingEffects:beforeSnapshot.ledgerEffects.length,
    replayInputDigest:beforeInput.digest,
    beforeEconomicDigest:beforeEconomic,
    afterEconomicDigest:afterEconomic,
    replayDeterministic:true
  },null,2));
} finally {
  await database.destroy();
}

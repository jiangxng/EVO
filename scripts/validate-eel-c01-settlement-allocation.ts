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
  const orderNo = `EEL-C01-ALLOC-${suffix}`;
  const correlationId = `O2C:${orderNo}`;
  const orderAt = new Date('2026-09-22T03:00:00.000Z');
  const receiptAt = new Date('2026-09-22T04:00:00.000Z');

  const order = await runtime.command.execute({
    enterpriseId: ids.enterpriseId,
    applicationInstanceId: ids.salesAppId,
    commandCode: 'approve-sales-order',
    actor: { type: 'AUTOMATION', id: 'demo-automation' },
    requestId: `${orderNo}:approve`,
    correlationId,
    idempotencyKey: `${orderNo}:approve`,
    input: {
      eventKind:'ORDER',
      orderNo,
      customer:'EEL-C01-Customer',
      productId:'P-100',
      quantity:1,
      unitPrice:'1000.00',
      totalAmount:'1000.00',
      currency:'USD',
      localCarryingAmount:'7200.00',
      localCurrency:'CNY',
      fulfillmentMode:'MAKE',
      project:'EEL-C01',
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

  const receipt = await runtime.command.execute({
    enterpriseId: ids.enterpriseId,
    applicationInstanceId: ids.cashAppId,
    commandCode: 'record-receipt',
    actor: { type:'AUTOMATION', id:'demo-automation' },
    requestId: `${orderNo}:receipt`,
    correlationId,
    causationId: orderBusiness.id,
    idempotencyKey: `${orderNo}:receipt`,
    input: {
      semanticRole:'CUSTOMER_CASH_RECEIPT',
      orderNo,
      customer:'EEL-C01-Customer',
      settledAmount:'1000.00',
      settledCurrency:'USD',
      cashAmount:'7300.00',
      cashCurrency:'CNY',
      project:'EEL-C01',
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
    throw new Error('EEL-C01 allocation scenario requires canonical cash.received.');
  }

  const policy = await runtime.db.selectFrom('allocation_policy')
    .select(['id','version','eligibility'])
    .where('enterprise_id','=',ids.enterpriseId)
    .where('code','=','fx_settlement_explicit')
    .where('status','=','PUBLISHED')
    .where('version','=',1)
    .executeTakeFirstOrThrow();

  const instruction = await runtime.allocation.recordInstruction({
    enterpriseId:ids.enterpriseId,
    consumerBusinessDataId:receiptBusiness.id,
    mode:'EXPLICIT',
    sourceSelector:{
      kind:'BUSINESS_DATA',
      businessDataId:orderBusiness.id
    },
    actorType:'AUTOMATION',
    actorId:'demo-automation',
    effectiveAt:receiptAt,
    reason:'EEL-C01 canonical customer cash receipt explicitly settles the selected sales-order receivable.',
    allocationPolicyId:policy.id,
    allocationPolicyVersion:policy.version,
    idempotencyKey:`${orderNo}:settlement-allocation`
  });

  const positionDefinition = await runtime.db.selectFrom('position_definition')
    .select(['id','version','semantic_digest'])
    .where('enterprise_id','=',ids.enterpriseId)
    .where('code','=','fx_receivable')
    .where('status','=','PUBLISHED')
    .where('version','=',1)
    .executeTakeFirstOrThrow();

  const request = await runtime.command.execute({
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
        dimensions:{ order_no:orderNo, customer:'EEL-C01-Customer' }
      },
      positionDefinition:{
        definitionId:positionDefinition.id,
        version:positionDefinition.version,
        digest:positionDefinition.semantic_digest
      },
      settlementBusinessDataId:receiptBusiness.id,
      allocationPolicy:{ id:policy.id, version:policy.version },
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

  const boundary = BigInt((await runtime.db.selectFrom('enterprise_runtime_state')
    .select('next_posting_sequence')
    .where('enterprise_id','=',ids.enterpriseId)
    .executeTakeFirstOrThrow()).next_posting_sequence) - 1n;

  const replayed = await runtime.valuationReplay.replayAcceptedRequests(
    ids.enterpriseId,
    'enterprise',
    boundary
  );
  if (replayed.replayedRequestCount !== 1) {
    throw new Error(`Expected one realized settlement request, got ${replayed.replayedRequestCount}.`);
  }

  const relation = await runtime.db.selectFrom('allocation_relation as r')
    .innerJoin('allocation_run as run','run.id','r.allocation_run_id')
    .select([
      'r.id','r.consumer_business_data_id','r.source_position_key',
      'r.measurements','r.instruction_id','r.lineage','run.status'
    ])
    .where('r.enterprise_id','=',ids.enterpriseId)
    .where('r.consumer_business_data_id','=',receiptBusiness.id)
    .where('r.instruction_id','=',instruction.id)
    .executeTakeFirstOrThrow();

  if (
    relation.consumer_business_data_id !== receiptBusiness.id ||
    relation.source_position_key === null ||
    relation.instruction_id !== instruction.id ||
    relation.status !== 'COMPLETED'
  ) {
    throw new Error(`Explicit settlement relation is incomplete: ${JSON.stringify(relation)}`);
  }

  const measurements = relation.measurements as Array<Record<string,unknown>>;
  const consumed = measurements[0];
  if (
    consumed === undefined ||
    String(consumed.value) !== '1000' ||
    consumed.unit !== 'USD' ||
    consumed.role !== 'SETTLEMENT_QUANTITY'
  ) {
    throw new Error(`Settlement AllocationRelation must consume exactly 1000 USD: ${JSON.stringify(measurements)}`);
  }

  const result = await runtime.db.selectFrom('valuation_result as r')
    .innerJoin('valuation_run as run','run.id','r.valuation_run_id')
    .select([
      'r.result_kind','r.delta_amount','r.delta_unit','r.source_business_data_ids',
      'r.lineage','run.status'
    ])
    .where('r.enterprise_id','=',ids.enterpriseId)
    .where('r.result_kind','=','FX_REALIZED_SETTLEMENT')
    .where('r.source_business_data_ids','@>',JSON.stringify([receiptBusiness.id]))
    .executeTakeFirstOrThrow();

  if (
    result.status !== 'COMPLETED' ||
    !new Decimal(result.delta_amount).eq(100) ||
    result.delta_unit !== 'CNY'
  ) {
    throw new Error(`Expected realized FX +100 CNY from canonical cash receipt, got ${JSON.stringify(result)}`);
  }

  const receivable = await runtime.db.selectFrom('ledger_balance as b')
    .innerJoin('ledger_definition as d','d.id','b.ledger_definition_id')
    .select(['b.amount','b.dimensions'])
    .where('b.enterprise_id','=',ids.enterpriseId)
    .where('d.code','=','receivable')
    .execute();
  const scopedReceivable = receivable.find((row)=>
    (row.dimensions as Record<string,unknown>).order_no===orderNo
  );
  if (scopedReceivable === undefined || !new Decimal(scopedReceivable.amount).eq(0)) {
    throw new Error('Explicit FX settlement must coexist with the already-closed operational receivable balance.');
  }

  console.log(JSON.stringify({
    status:'PASS',
    packet:'EEL-C01.3',
    orderNo,
    settlementBusinessDataType:receiptBusiness.business_data_type,
    allocationInstructionId:instruction.id,
    allocationRelationId:relation.id,
    sourcePositionKey:relation.source_position_key,
    consumedForeign:{ value:String(consumed.value), unit:consumed.unit, role:consumed.role },
    realizedFx:{ amount:result.delta_amount, unit:result.delta_unit },
    receivableBalance:scopedReceivable.amount,
    canonicalSettlementSource:true
  },null,2));
} finally {
  await database.destroy();
}

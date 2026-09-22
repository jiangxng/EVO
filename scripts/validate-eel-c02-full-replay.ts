import { Decimal } from 'decimal.js';
import { createDatabase } from '../platform/database/src/index.js';
import { loadRuntimeConfig } from '../platform/runtime/src/config.js';
import { createEvoRuntime, demoIds, drainPosting } from '../apps/api/src/evo-runtime.js';
import { computeEconomicRuntimeDigest } from '../modules/replay/infrastructure/postgres-replay-digest.js';

const config = loadRuntimeConfig();
const database = createDatabase(config.databaseUrl);
const runtime = createEvoRuntime(database);

function orderNoOf(dimensions: unknown): string | undefined {
  if (dimensions === null || typeof dimensions !== 'object' || Array.isArray(dimensions)) return undefined;
  const value = (dimensions as Record<string,unknown>).order_no;
  return typeof value === 'string' ? value : undefined;
}

async function businessSnapshot(enterpriseId:string, orderNo:string) {
  const balances = await runtime.db.selectFrom('ledger_balance as b')
    .innerJoin('ledger_definition as d','d.id','b.ledger_definition_id')
    .innerJoin('ledger_dataset as ds','ds.id','b.ledger_dataset_id')
    .select(['d.code as ledger','b.quantity','b.amount','b.dimensions'])
    .where('b.enterprise_id','=',enterpriseId)
    .where('ds.kind','=','CURRENT')
    .where('ds.status','=','ACTIVE')
    .where('d.code','in',['pending_purchase','payable','inventory','cash'])
    .execute();

  const scoped = balances.filter((row)=>orderNoOf(row.dimensions)===orderNo);
  const byLedger = new Map(scoped.map((row)=>[row.ledger,row]));

  for (const code of ['pending_purchase','payable','inventory','cash']) {
    if (!byLedger.has(code)) throw new Error(`Missing ${code} balance for ${orderNo}`);
  }

  const workRows = await runtime.db.selectFrom('work_item')
    .select(['work_type','status','source_ledger_code','source_dimensions','source_quantity','source_amount'])
    .where('enterprise_id','=',enterpriseId)
    .execute();
  const work = workRows
    .filter((row)=>orderNoOf(row.source_dimensions)===orderNo)
    .filter((row)=>['pending_purchase','payable'].includes(row.source_ledger_code))
    .sort((a,b)=>a.source_ledger_code.localeCompare(b.source_ledger_code))
    .map((row)=>({
      workType:row.work_type,
      status:row.status,
      ledger:row.source_ledger_code,
      quantity:row.source_quantity,
      amount:row.source_amount
    }));

  const facts = await runtime.db.selectFrom('business_data')
    .select(['id','business_data_type','business_object_key','business_object_version','effective_at','payload'])
    .where('enterprise_id','=',enterpriseId)
    .execute();
  const scopedFacts = facts
    .filter((row)=>{
      const payload = row.payload as Record<string,unknown>;
      return payload.orderNo === orderNo || row.business_object_key === orderNo;
    })
    .sort((a,b)=>a.id.localeCompare(b.id))
    .map((row)=>({
      id:row.id,
      type:row.business_data_type,
      key:row.business_object_key,
      version:String(row.business_object_version),
      effectiveAt:row.effective_at.toISOString(),
      payload:row.payload
    }));

  const instructions = await runtime.db.selectFrom('allocation_instruction')
    .select(['id','consumer_business_data_id','source_selector','mode','allocation_policy_id','allocation_policy_version'])
    .where('enterprise_id','=',enterpriseId)
    .execute();
  const scopedInstructions = instructions
    .filter((row)=>{
      const selector = row.source_selector as Record<string,unknown>;
      const sourceId = selector.businessDataId;
      return scopedFacts.some((fact)=>fact.id===sourceId);
    })
    .sort((a,b)=>a.id.localeCompare(b.id))
    .map((row)=>({
      id:row.id,
      consumerBusinessDataId:row.consumer_business_data_id,
      sourceSelector:row.source_selector,
      mode:row.mode,
      allocationPolicyId:row.allocation_policy_id,
      allocationPolicyVersion:row.allocation_policy_version
    }));

  return {
    balances:{
      pendingPurchaseQuantity:byLedger.get('pending_purchase')!.quantity,
      payableAmount:byLedger.get('payable')!.amount,
      inventoryQuantity:byLedger.get('inventory')!.quantity,
      inventoryAmount:byLedger.get('inventory')!.amount,
      cashAmount:byLedger.get('cash')!.amount
    },
    work,
    facts:scopedFacts,
    allocationInstructions:scopedInstructions
  };
}

function assertClosed(snapshot:Awaited<ReturnType<typeof businessSnapshot>>, label:string) {
  const b = snapshot.balances;
  if (
    !new Decimal(b.pendingPurchaseQuantity).eq(0) ||
    !new Decimal(b.payableAmount).eq(0) ||
    !new Decimal(b.inventoryQuantity).eq(100) ||
    !new Decimal(b.inventoryAmount).eq(1250) ||
    !new Decimal(b.cashAmount).eq(-1250)
  ) {
    throw new Error(`${label} P2P balances incorrect: ${JSON.stringify(b)}`);
  }

  const receive = snapshot.work.find((row)=>row.ledger==='pending_purchase');
  const pay = snapshot.work.find((row)=>row.ledger==='payable');
  if (receive?.status !== 'DONE' || pay?.status !== 'DONE') {
    throw new Error(`${label} P2P Work must be DONE: ${JSON.stringify(snapshot.work)}`);
  }

  if (snapshot.facts.length !== 7) {
    throw new Error(`${label} must contain exactly 7 canonical P2P BusinessData facts, got ${snapshot.facts.length}`);
  }
  const types = snapshot.facts.map((x)=>x.type);
  if (
    types.filter((x)=>x==='purchase_order.approved').length !== 1 ||
    types.filter((x)=>x==='goods_receipt.received').length !== 3 ||
    types.filter((x)=>x==='cash.paid').length !== 3
  ) {
    throw new Error(`${label} canonical fact composition mismatch: ${JSON.stringify(types)}`);
  }
  if (snapshot.allocationInstructions.length !== 3) {
    throw new Error(`${label} must retain three explicit AP settlement instructions.`);
  }
}

try {
  const ids = await demoIds(runtime);
  const suffix = Date.now();
  const orderNo = `PO-C02-REPLAY-${suffix}`;
  const correlationId = `P2P:${orderNo}`;
  const supplier = 'SUPPLIER-C02';
  const project = `PROJECT-${suffix}`;

  const order = await runtime.command.execute({
    enterpriseId:ids.enterpriseId,
    applicationInstanceId:ids.procurementAppId,
    commandCode:'approve-purchase-order',
    actor:{ type:'AUTOMATION', id:'demo-automation' },
    requestId:`${orderNo}:approve`,
    correlationId,
    idempotencyKey:`${orderNo}:approve`,
    input:{
      orderNo,supplier,productId:'P-100',warehouse:'HK',
      quantity:100,unitPrice:'12.50',totalAmount:'1250.00',currency:'CNY',
      project,department:'PROCUREMENT',costCenter:'CC-PROCUREMENT'
    },
    effectiveAt:new Date('2026-09-22T20:00:00.000Z'),
    businessObjectKey:orderNo,
    lineage:{
      flowDefinitionId:ids.procureToPayFlowDefinitionId,
      flowInstanceKey:orderNo,
      stepCode:'purchase-order-approved'
    }
  });
  await runtime.flow.projectCommand(order.commandExecutionId);
  await drainPosting(runtime,ids.enterpriseId);

  const orderBusiness = await runtime.db.selectFrom('business_data')
    .select('id')
    .where('command_execution_id','=',order.commandExecutionId)
    .executeTakeFirstOrThrow();

  const receipts = [
    { quantity:30,totalCost:'375.00',at:'2026-09-22T21:00:00.000Z' },
    { quantity:20,totalCost:'250.00',at:'2026-09-22T22:00:00.000Z' },
    { quantity:50,totalCost:'625.00',at:'2026-09-22T23:00:00.000Z' }
  ];
  for (let index=0; index<receipts.length; index+=1) {
    const receipt=receipts[index]!;
    const result=await runtime.command.execute({
      enterpriseId:ids.enterpriseId,
      applicationInstanceId:ids.inventoryAppId,
      commandCode:'receive-purchase-order',
      actor:{ type:'AUTOMATION', id:'demo-automation' },
      requestId:`${orderNo}:receipt:${index+1}`,
      correlationId,
      causationId:orderBusiness.id,
      idempotencyKey:`${orderNo}:receipt:${index+1}`,
      input:{
        movementType:'PURCHASE_RECEIPT',
        receiptNo:`GR-${suffix}-${index+1}`,
        orderNo,supplier,productId:'P-100',warehouse:'HK',
        quantity:receipt.quantity,totalCost:receipt.totalCost,currency:'CNY',
        project,department:'PROCUREMENT',costCenter:'CC-PROCUREMENT'
      },
      effectiveAt:new Date(receipt.at),
      businessObjectKey:`GR-${suffix}-${index+1}`,
      lineage:{
        flowDefinitionId:ids.procureToPayFlowDefinitionId,
        flowInstanceKey:orderNo,
        stepCode:'goods-received',
        parentBusinessDataId:orderBusiness.id,
        relationType:'FULFILLS'
      }
    });
    await runtime.flow.projectCommand(result.commandExecutionId);
    await drainPosting(runtime,ids.enterpriseId);
  }

  const policy = await runtime.db.selectFrom('allocation_policy')
    .select(['id','version'])
    .where('enterprise_id','=',ids.enterpriseId)
    .where('code','=','ap_settlement_explicit')
    .where('status','=','PUBLISHED')
    .where('version','=',1)
    .executeTakeFirstOrThrow();

  const payments = [
    { amount:'300.00', at:'2026-09-23T00:00:00.000Z' },
    { amount:'400.00', at:'2026-09-23T01:00:00.000Z' },
    { amount:'550.00', at:'2026-09-23T02:00:00.000Z' }
  ];
  for (let index=0; index<payments.length; index+=1) {
    const payment=payments[index]!;
    const paymentNo=`PAY-REPLAY-${suffix}-${index+1}`;
    const result=await runtime.command.execute({
      enterpriseId:ids.enterpriseId,
      applicationInstanceId:ids.cashPaymentAppId,
      commandCode:'record-payment',
      actor:{ type:'AUTOMATION', id:'demo-automation' },
      requestId:`${orderNo}:payment:${index+1}`,
      correlationId,
      causationId:orderBusiness.id,
      idempotencyKey:paymentNo,
      input:{
        semanticRole:'SUPPLIER_CASH_PAYMENT',
        paymentNo,orderNo,supplier,productId:'P-100',
        settledAmount:payment.amount,currency:'CNY',
        project,department:'PROCUREMENT',costCenter:'CC-PROCUREMENT'
      },
      effectiveAt:new Date(payment.at),
      businessObjectKey:paymentNo,
      lineage:{
        flowDefinitionId:ids.procureToPayFlowDefinitionId,
        flowInstanceKey:orderNo,
        stepCode:'supplier-paid',
        parentBusinessDataId:orderBusiness.id,
        relationType:'ALLOCATES_TO'
      }
    });
    await runtime.flow.projectCommand(result.commandExecutionId);
    await drainPosting(runtime,ids.enterpriseId);

    const paymentBusiness=await runtime.db.selectFrom('business_data')
      .select('id')
      .where('command_execution_id','=',result.commandExecutionId)
      .executeTakeFirstOrThrow();

    await runtime.allocation.recordInstruction({
      enterpriseId:ids.enterpriseId,
      consumerBusinessDataId:paymentBusiness.id,
      mode:'EXPLICIT',
      sourceSelector:{kind:'BUSINESS_DATA',businessDataId:orderBusiness.id},
      actorType:'AUTOMATION',
      actorId:'demo-automation',
      effectiveAt:new Date(payment.at),
      reason:'EEL-C02 Full Replay reference payment explicitly settles the selected purchase-order payable.',
      allocationPolicyId:policy.id,
      allocationPolicyVersion:policy.version,
      idempotencyKey:`${paymentNo}:ap-settlement`
    });
  }
  await runtime.work.refresh(ids.enterpriseId);

  const before = await businessSnapshot(ids.enterpriseId,orderNo);
  assertClosed(before,'Before replay');

  const runtimeState = await runtime.db.selectFrom('enterprise_runtime_state')
    .select(['consistency_domain','next_posting_sequence'])
    .where('enterprise_id','=',ids.enterpriseId)
    .executeTakeFirstOrThrow();
  const boundary = BigInt(runtimeState.next_posting_sequence)-1n;
  const beforeDigest = await computeEconomicRuntimeDigest(
    runtime.db,
    ids.enterpriseId,
    runtimeState.consistency_domain,
    boundary
  );

  const replay = await runtime.replay.prepareFullReplay(ids.enterpriseId);
  if (replay.boundarySequence !== boundary) {
    throw new Error(`Replay boundary changed: expected ${boundary}, got ${replay.boundarySequence}`);
  }

  await drainPosting(runtime,ids.enterpriseId);
  if (replay.costMethod !== null) {
    await runtime.cost.recalculate(ids.enterpriseId,replay.costMethod,replay.costPins??undefined);
  }
  await runtime.work.refresh(ids.enterpriseId);

  const after = await businessSnapshot(ids.enterpriseId,orderNo);
  assertClosed(after,'After replay');

  if (JSON.stringify(before.facts) !== JSON.stringify(after.facts)) {
    throw new Error('Full Replay changed canonical P2P BusinessData.');
  }
  if (JSON.stringify(before.allocationInstructions) !== JSON.stringify(after.allocationInstructions)) {
    throw new Error('Full Replay changed explicit AP AllocationInstructions.');
  }
  if (JSON.stringify(before.balances) !== JSON.stringify(after.balances)) {
    throw new Error(`P2P balances changed after replay: before=${JSON.stringify(before.balances)} after=${JSON.stringify(after.balances)}`);
  }
  if (JSON.stringify(before.work) !== JSON.stringify(after.work)) {
    throw new Error(`P2P Work changed after replay: before=${JSON.stringify(before.work)} after=${JSON.stringify(after.work)}`);
  }

  const afterDigest = await computeEconomicRuntimeDigest(
    runtime.db,
    ids.enterpriseId,
    runtimeState.consistency_domain,
    boundary
  );
  await runtime.replay.completeFullReplay(replay.replayRunId,ids.enterpriseId,afterDigest);

  if (beforeDigest !== afterDigest || replay.beforeDigest !== beforeDigest) {
    throw new Error(`Replay digest mismatch: before=${beforeDigest} recorded=${replay.beforeDigest} after=${afterDigest}`);
  }

  console.log(JSON.stringify({
    status:'PASS',
    packet:'EEL-C02.4',
    orderNo,
    facts:before.facts.length,
    receiptCount:3,
    paymentCount:3,
    balances:after.balances,
    work:after.work,
    allocationInstructions:after.allocationInstructions.length,
    businessDataUnchanged:true,
    replayDeterministic:true,
    beforeDigest,
    afterDigest
  },null,2));
} finally {
  await database.destroy();
}

import { Decimal } from 'decimal.js';
import { createDatabase } from '../platform/database/src/index.js';
import { loadRuntimeConfig } from '../platform/runtime/src/config.js';
import { createEvoRuntime, demoIds, drainPosting } from '../apps/api/src/evo-runtime.js';

const config = loadRuntimeConfig();
const database = createDatabase(config.databaseUrl);
const runtime = createEvoRuntime(database);

function orderNoOf(dimensions: unknown): string | undefined {
  if (dimensions === null || typeof dimensions !== 'object' || Array.isArray(dimensions)) return undefined;
  const value = (dimensions as Record<string,unknown>).order_no;
  return typeof value === 'string' ? value : undefined;
}

async function workForOrder(enterpriseId:string,orderNo:string) {
  const rows = await runtime.db.selectFrom('work_item')
    .select(['work_type','status','source_ledger_code','source_dimensions','source_quantity','source_amount','completed_at'])
    .where('enterprise_id','=',enterpriseId)
    .execute();
  return rows.filter((row)=>orderNoOf(row.source_dimensions)===orderNo);
}

async function scopedBalances(enterpriseId:string,orderNo:string) {
  const rows = await runtime.db.selectFrom('ledger_balance as b')
    .innerJoin('ledger_definition as d','d.id','b.ledger_definition_id')
    .innerJoin('ledger_dataset as ds','ds.id','b.ledger_dataset_id')
    .select(['d.code as ledger_code','b.dimensions','b.quantity','b.amount'])
    .where('b.enterprise_id','=',enterpriseId)
    .where('ds.kind','=','CURRENT')
    .where('ds.status','=','ACTIVE')
    .execute();
  return rows.filter((row)=>orderNoOf(row.dimensions)===orderNo);
}

try {
  const ids = await demoIds(runtime);
  const suffix = Date.now();
  const orderNo = `PO-C02-PAY-${suffix}`;
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
    effectiveAt:new Date('2026-09-22T09:00:00.000Z'),
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

  const policy = await runtime.db.selectFrom('allocation_policy')
    .select(['id','version'])
    .where('enterprise_id','=',ids.enterpriseId)
    .where('code','=','ap_settlement_explicit')
    .where('status','=','PUBLISHED')
    .where('version','=',1)
    .executeTakeFirstOrThrow();

  const payments = [
    { amount:'300.00', at:'2026-09-22T13:00:00.000Z' },
    { amount:'400.00', at:'2026-09-22T14:00:00.000Z' },
    { amount:'550.00', at:'2026-09-22T15:00:00.000Z' }
  ];
  const expectedPayable = ['950','550','0'];
  const expectedCash = ['-300','-700','-1250'];

  for (let index=0; index<payments.length; index+=1) {
    const payment = payments[index]!;
    const paymentNo = `PAY-${suffix}-${index+1}`;

    const execution = await runtime.command.execute({
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
        paymentNo,
        orderNo,
        supplier,
        productId:'P-100',
        settledAmount:payment.amount,
        currency:'CNY',
        project,
        department:'PROCUREMENT',
        costCenter:'CC-PROCUREMENT'
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
    await runtime.flow.projectCommand(execution.commandExecutionId);
    await drainPosting(runtime,ids.enterpriseId);

    const paymentBusiness = await runtime.db.selectFrom('business_data')
      .select(['id','business_data_type'])
      .where('command_execution_id','=',execution.commandExecutionId)
      .executeTakeFirstOrThrow();

    if (paymentBusiness.business_data_type !== 'cash.paid') {
      throw new Error(`Expected cash.paid, got ${paymentBusiness.business_data_type}`);
    }

    await runtime.allocation.recordInstruction({
      enterpriseId:ids.enterpriseId,
      consumerBusinessDataId:paymentBusiness.id,
      mode:'EXPLICIT',
      sourceSelector:{ kind:'BUSINESS_DATA', businessDataId:orderBusiness.id },
      actorType:'AUTOMATION',
      actorId:'demo-automation',
      effectiveAt:new Date(payment.at),
      reason:'EEL-C02 supplier payment explicitly settles the selected purchase-order payable.',
      allocationPolicyId:policy.id,
      allocationPolicyVersion:policy.version,
      idempotencyKey:`${paymentNo}:ap-settlement`
    });

    await runtime.work.refresh(ids.enterpriseId);

    const work = await workForOrder(ids.enterpriseId,orderNo);
    const payWork = work.find((row)=>row.source_ledger_code==='payable');
    if (payWork === undefined) {
      const allWork = await runtime.db.selectFrom('work_item')
        .select(['work_type','status','source_ledger_code','source_dimensions','source_quantity','source_amount'])
        .where('enterprise_id','=',ids.enterpriseId)
        .execute();
      const payableBalances = await runtime.db.selectFrom('ledger_balance as b')
        .innerJoin('ledger_definition as d','d.id','b.ledger_definition_id')
        .select(['d.code as ledger_code','b.dimensions','b.dimension_hash','b.quantity','b.amount'])
        .where('b.enterprise_id','=',ids.enterpriseId)
        .where('d.code','=','payable')
        .execute();
      throw new Error('PAY work missing. diagnostics=' + JSON.stringify({ orderNo, work, allWork, payableBalances }));
    }

    if (!new Decimal(payWork.source_amount).eq(expectedPayable[index]!)) {
      throw new Error(`Payable after payment ${index+1} must be ${expectedPayable[index]}, got ${payWork.source_amount}`);
    }
    if ((index < 2 && payWork.status !== 'OPEN') || (index === 2 && payWork.status !== 'DONE')) {
      throw new Error(`PAY work status mismatch after payment ${index+1}: ${payWork.status}`);
    }

    const balances = await scopedBalances(ids.enterpriseId,orderNo);
    const cash = balances.find((row)=>row.ledger_code==='cash');
    if (cash === undefined || !new Decimal(cash.amount).eq(expectedCash[index]!)) {
      throw new Error(`Cash after payment ${index+1} must be ${expectedCash[index]}, got ${cash?.amount}`);
    }
  }

  const allocationLinks = await runtime.db.selectFrom('business_object_link')
    .select(['from_business_data_id','to_business_data_id','relation_type'])
    .where('enterprise_id','=',ids.enterpriseId)
    .where('from_business_data_id','=',orderBusiness.id)
    .where('relation_type','=','ALLOCATES_TO')
    .execute();

  const instructions = await runtime.db.selectFrom('allocation_instruction')
    .select(['consumer_business_data_id','source_selector','mode'])
    .where('enterprise_id','=',ids.enterpriseId)
    .where('allocation_policy_id','=',policy.id)
    .execute();

  const scopedInstructions = instructions.filter((row)=>{
    const selector = row.source_selector as Record<string,unknown>;
    return selector.businessDataId === orderBusiness.id;
  });

  if (allocationLinks.length !== 3 || scopedInstructions.length !== 3) {
    throw new Error(`Expected 3 explicit settlement links/instructions, got links=${allocationLinks.length} instructions=${scopedInstructions.length}`);
  }

  const finalWork = await workForOrder(ids.enterpriseId,orderNo);
  const payWork = finalWork.find((row)=>row.source_ledger_code==='payable');
  const receiveWork = finalWork.find((row)=>row.source_ledger_code==='pending_purchase');

  console.log(JSON.stringify({
    status:'PASS',
    packet:'EEL-C02.3',
    orderNo,
    paymentSequence:[300,400,550],
    payableSequence:[1250,950,550,0],
    cashSequence:[0,-300,-700,-1250],
    explicitSettlement:{
      allocationInstructions:scopedInstructions.length,
      allocationLinks:allocationLinks.length
    },
    final:{
      payWork:payWork?.status,
      receiveWork:receiveWork?.status,
      payableAmount:payWork?.source_amount
    },
    specializedPartialPaymentEngine:false
  },null,2));
} finally {
  await database.destroy();
}

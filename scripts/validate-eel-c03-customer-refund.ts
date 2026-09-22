import { Decimal } from 'decimal.js';
import { createDatabase } from '../platform/database/src/index.js';
import { loadRuntimeConfig } from '../platform/runtime/src/config.js';
import { createEvoRuntime, demoIds, drainPosting } from '../apps/api/src/evo-runtime.js';

const config=loadRuntimeConfig();
const database=createDatabase(config.databaseUrl);
const runtime=createEvoRuntime(database);

function orderNoOf(dimensions:unknown):string|undefined{
  if(dimensions===null||typeof dimensions!=='object'||Array.isArray(dimensions)) return undefined;
  const value=(dimensions as Record<string,unknown>).order_no;
  return typeof value==='string'?value:undefined;
}

async function scopedBalances(enterpriseId:string,orderNo:string){
  const rows=await runtime.db.selectFrom('ledger_balance as b')
    .innerJoin('ledger_definition as d','d.id','b.ledger_definition_id')
    .innerJoin('ledger_dataset as ds','ds.id','b.ledger_dataset_id')
    .select(['d.code as ledger','b.amount','b.dimensions'])
    .where('b.enterprise_id','=',enterpriseId)
    .where('ds.kind','=','CURRENT')
    .where('ds.status','=','ACTIVE')
    .where('d.code','in',['cash','receivable'])
    .execute();
  return rows.filter(row=>orderNoOf(row.dimensions)===orderNo);
}

try{
  const ids=await demoIds(runtime);
  if(ids.cashRefundAppId.length===0) throw new Error('C03.3 requires seeded cash-refund application.');

  const suffix=Date.now();
  const orderNo=`SO-C03-REFUND-${suffix}`;
  const correlationId=`O2C:${orderNo}`;
  const customer='CUSTOMER-C03';
  const project=`PROJECT-${suffix}`;

  const order=await runtime.command.execute({
    enterpriseId:ids.enterpriseId,
    applicationInstanceId:ids.salesAppId,
    commandCode:'approve-sales-order',
    actor:{type:'AUTOMATION',id:'demo-automation'},
    requestId:`${orderNo}:approve`,
    correlationId,
    idempotencyKey:`${orderNo}:approve`,
    input:{
      eventKind:'ORDER',orderNo,customer,productId:'P-100',
      quantity:1,unitPrice:'1000.00',totalAmount:'1000.00',currency:'CNY',
      fulfillmentMode:'MAKE',project,department:'SALES',
      profitCenter:'PC-C03',costCenter:'CC-SALES'
    },
    effectiveAt:new Date('2026-09-22T09:00:00.000Z'),
    businessObjectKey:orderNo
  });
  await drainPosting(runtime,ids.enterpriseId);

  const receiptNo=`RECEIPT-C03-${suffix}`;
  const receipt=await runtime.command.execute({
    enterpriseId:ids.enterpriseId,
    applicationInstanceId:ids.cashAppId,
    commandCode:'record-receipt',
    actor:{type:'AUTOMATION',id:'demo-automation'},
    requestId:`${orderNo}:receipt`,
    correlationId,
    idempotencyKey:receiptNo,
    input:{
      semanticRole:'CUSTOMER_CASH_RECEIPT',
      orderNo,customer,
      settledAmount:'1000.00',settledCurrency:'CNY',
      cashAmount:'1000.00',cashCurrency:'CNY',
      project,department:'SALES',
      profitCenter:'PC-C03',costCenter:'CC-SALES'
    },
    effectiveAt:new Date('2026-09-22T10:00:00.000Z'),
    businessObjectKey:receiptNo
  });
  await drainPosting(runtime,ids.enterpriseId);

  const receiptBusiness=await runtime.db.selectFrom('business_data')
    .select(['id','business_data_type','business_object_key','payload'])
    .where('command_execution_id','=',receipt.commandExecutionId)
    .executeTakeFirstOrThrow();

  if(receiptBusiness.business_data_type!=='cash.received'){
    throw new Error(`Expected cash.received, got ${receiptBusiness.business_data_type}`);
  }

  const before=await scopedBalances(ids.enterpriseId,orderNo);
  const cashBefore=before.find(x=>x.ledger==='cash');
  const receivableBefore=before.find(x=>x.ledger==='receivable');
  if(cashBefore===undefined||!new Decimal(cashBefore.amount).eq(1000)){
    throw new Error(`Cash before refund must be 1000: ${JSON.stringify(before)}`);
  }
  if(receivableBefore===undefined||!new Decimal(receivableBefore.amount).eq(0)){
    throw new Error(`Receivable must be closed before refund: ${JSON.stringify(before)}`);
  }

  const immutableReceiptBefore=JSON.stringify(receiptBusiness);

  const refundNo=`REFUND-C03-${suffix}`;
  const refund=await runtime.command.execute({
    enterpriseId:ids.enterpriseId,
    applicationInstanceId:ids.cashRefundAppId,
    commandCode:'record-customer-refund',
    actor:{type:'AUTOMATION',id:'demo-automation'},
    requestId:`${orderNo}:refund`,
    correlationId,
    causationId:receiptBusiness.id,
    idempotencyKey:refundNo,
    input:{
      semanticRole:'CUSTOMER_CASH_REFUND',
      refundNo,orderNo,customer,
      refundAmount:'400.00',currency:'CNY',
      reason:'CUSTOMER_RETURN_OR_COMMERCIAL_ADJUSTMENT',
      project,department:'SALES',
      profitCenter:'PC-C03',costCenter:'CC-SALES'
    },
    effectiveAt:new Date('2026-09-22T11:00:00.000Z'),
    businessObjectKey:refundNo,
    lineage:{
      flowDefinitionId:ids.flowDefinitionId,
      flowInstanceKey:orderNo,
      stepCode:'customer-refund',
      parentBusinessDataId:receiptBusiness.id,
      relationType:'REFERENCES'
    }
  });
  await runtime.flow.projectCommand(refund.commandExecutionId);
  await drainPosting(runtime,ids.enterpriseId);

  const refundBusiness=await runtime.db.selectFrom('business_data')
    .select(['id','business_data_type','business_object_key','payload'])
    .where('command_execution_id','=',refund.commandExecutionId)
    .executeTakeFirstOrThrow();

  if(refundBusiness.business_data_type!=='cash.refunded'){
    throw new Error(`Expected cash.refunded, got ${refundBusiness.business_data_type}`);
  }

  const link=await runtime.db.selectFrom('business_object_link')
    .select(['from_business_data_id','to_business_data_id','relation_type'])
    .where('enterprise_id','=',ids.enterpriseId)
    .where('from_business_data_id','=',receiptBusiness.id)
    .where('to_business_data_id','=',refundBusiness.id)
    .where('relation_type','=','REFERENCES')
    .executeTakeFirstOrThrow();

  const after=await scopedBalances(ids.enterpriseId,orderNo);
  const cashAfter=after.find(x=>x.ledger==='cash');
  const receivableAfter=after.find(x=>x.ledger==='receivable');

  if(cashAfter===undefined||!new Decimal(cashAfter.amount).eq(600)){
    throw new Error(`Cash after refund must be 600: ${JSON.stringify(after)}`);
  }
  if(receivableAfter===undefined||!new Decimal(receivableAfter.amount).eq(0)){
    throw new Error(`Refund must not automatically restore receivable: ${JSON.stringify(after)}`);
  }

  const receiptAfter=await runtime.db.selectFrom('business_data')
    .select(['id','business_data_type','business_object_key','payload'])
    .where('id','=',receiptBusiness.id)
    .executeTakeFirstOrThrow();

  if(JSON.stringify(receiptAfter)!==immutableReceiptBefore){
    throw new Error('Customer refund mutated original cash.received BusinessData.');
  }

  console.log(JSON.stringify({
    status:'PASS',
    packet:'EEL-C03.3',
    orderNo,
    refundBusinessDataType:refundBusiness.business_data_type,
    cashBefore:cashBefore.amount,
    cashAfter:cashAfter.amount,
    cashDelta:new Decimal(cashAfter.amount).minus(cashBefore.amount).toString(),
    receivableBefore:receivableBefore.amount,
    receivableAfter:receivableAfter.amount,
    explicitSourceRelation:{
      relationType:link.relation_type,
      originalReceiptBusinessDataId:link.from_business_data_id,
      refundBusinessDataId:link.to_business_data_id
    },
    originalCashReceiptBusinessDataUnchanged:true,
    receivableNotImplicitlyRestored:true,
    newRefundRuntimeRequired:false
  },null,2));
}finally{
  await database.destroy();
}

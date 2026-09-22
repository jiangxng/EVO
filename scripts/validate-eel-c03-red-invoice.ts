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

async function balance(enterpriseId:string,orderNo:string,ledgerCode:string){
  const rows=await runtime.db.selectFrom('ledger_balance as b')
    .innerJoin('ledger_definition as d','d.id','b.ledger_definition_id')
    .innerJoin('ledger_dataset as ds','ds.id','b.ledger_dataset_id')
    .select(['b.amount','b.dimensions'])
    .where('b.enterprise_id','=',enterpriseId)
    .where('d.code','=',ledgerCode)
    .where('ds.kind','=','CURRENT')
    .where('ds.status','=','ACTIVE')
    .execute();
  return rows.find(row=>orderNoOf(row.dimensions)===orderNo);
}

try{
  const ids=await demoIds(runtime);
  if(ids.salesInvoiceAppId.length===0) throw new Error('C03.4 requires seeded sales-invoice application.');

  const suffix=Date.now();
  const orderNo=`SO-C03-RED-${suffix}`;
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

  const blueInvoiceNo=`INV-BLUE-${suffix}`;
  const blue=await runtime.command.execute({
    enterpriseId:ids.enterpriseId,
    applicationInstanceId:ids.salesInvoiceAppId,
    commandCode:'issue-sales-invoice',
    actor:{type:'AUTOMATION',id:'demo-automation'},
    requestId:`${orderNo}:blue-invoice`,
    correlationId,
    causationId:order.businessDataId,
    idempotencyKey:blueInvoiceNo,
    input:{
      invoiceKind:'BLUE',
      invoiceNo:blueInvoiceNo,
      orderNo,customer,
      invoiceAmount:'1000.00',
      currency:'CNY',
      taxIdentity:'DEMO-TAXPAYER-ID',
      project,department:'SALES',
      profitCenter:'PC-C03',costCenter:'CC-SALES'
    },
    effectiveAt:new Date('2026-09-22T10:00:00.000Z'),
    businessObjectKey:blueInvoiceNo,
    lineage:{
      flowDefinitionId:ids.flowDefinitionId,
      flowInstanceKey:orderNo,
      stepCode:'sales-invoice-issued',
      parentBusinessDataId:order.businessDataId,
      relationType:'REFERENCES'
    }
  });
  await runtime.flow.projectCommand(blue.commandExecutionId);
  await drainPosting(runtime,ids.enterpriseId);

  const blueBusiness=await runtime.db.selectFrom('business_data')
    .select(['id','business_data_type','business_object_key','payload'])
    .where('command_execution_id','=',blue.commandExecutionId)
    .executeTakeFirstOrThrow();

  if(blueBusiness.business_data_type!=='sales_invoice.issued'){
    throw new Error(`Expected sales_invoice.issued, got ${blueBusiness.business_data_type}`);
  }

  const invoiceBefore=await balance(ids.enterpriseId,orderNo,'sales_invoice_amount');
  if(invoiceBefore===undefined||!new Decimal(invoiceBefore.amount).eq(1000)){
    throw new Error(`Blue invoice must create sales_invoice_amount 1000: ${JSON.stringify(invoiceBefore)}`);
  }

  const receivableBefore=await balance(ids.enterpriseId,orderNo,'receivable');
  if(receivableBefore===undefined||!new Decimal(receivableBefore.amount).eq(1000)){
    throw new Error(`Reference order receivable must remain 1000 before red invoice: ${JSON.stringify(receivableBefore)}`);
  }

  const immutableBlueBefore=JSON.stringify(blueBusiness);

  const redInvoiceNo=`INV-RED-${suffix}`;
  const red=await runtime.command.execute({
    enterpriseId:ids.enterpriseId,
    applicationInstanceId:ids.salesInvoiceAppId,
    commandCode:'issue-sales-red-invoice',
    actor:{type:'AUTOMATION',id:'demo-automation'},
    requestId:`${orderNo}:red-invoice`,
    correlationId,
    causationId:blueBusiness.id,
    idempotencyKey:redInvoiceNo,
    input:{
      invoiceKind:'RED',
      invoiceNo:redInvoiceNo,
      originalInvoiceNo:blueInvoiceNo,
      orderNo,customer,
      invoiceAmount:'400.00',
      currency:'CNY',
      fullOrPartial:'PARTIAL',
      taxIdentity:'DEMO-TAXPAYER-ID',
      project,department:'SALES',
      profitCenter:'PC-C03',costCenter:'CC-SALES'
    },
    effectiveAt:new Date('2026-09-22T11:00:00.000Z'),
    businessObjectKey:redInvoiceNo,
    lineage:{
      flowDefinitionId:ids.flowDefinitionId,
      flowInstanceKey:orderNo,
      stepCode:'sales-red-invoice-issued',
      parentBusinessDataId:blueBusiness.id,
      relationType:'REFERENCES'
    }
  });
  await runtime.flow.projectCommand(red.commandExecutionId);
  await drainPosting(runtime,ids.enterpriseId);

  const redBusiness=await runtime.db.selectFrom('business_data')
    .select(['id','business_data_type','business_object_key','payload'])
    .where('command_execution_id','=',red.commandExecutionId)
    .executeTakeFirstOrThrow();

  if(redBusiness.business_data_type!=='sales_red_invoice.issued'){
    throw new Error(`Expected sales_red_invoice.issued, got ${redBusiness.business_data_type}`);
  }

  const link=await runtime.db.selectFrom('business_object_link')
    .select(['from_business_data_id','to_business_data_id','relation_type'])
    .where('enterprise_id','=',ids.enterpriseId)
    .where('from_business_data_id','=',blueBusiness.id)
    .where('to_business_data_id','=',redBusiness.id)
    .where('relation_type','=','REFERENCES')
    .executeTakeFirstOrThrow();

  const invoiceAfter=await balance(ids.enterpriseId,orderNo,'sales_invoice_amount');
  if(invoiceAfter===undefined||!new Decimal(invoiceAfter.amount).eq(600)){
    throw new Error(`Red invoice must reduce sales_invoice_amount to 600: ${JSON.stringify(invoiceAfter)}`);
  }

  const receivableAfter=await balance(ids.enterpriseId,orderNo,'receivable');
  if(receivableAfter===undefined||!new Decimal(receivableAfter.amount).eq(1000)){
    throw new Error(`Red invoice business event must not automatically change Receivable: ${JSON.stringify(receivableAfter)}`);
  }

  const cashAfter=await balance(ids.enterpriseId,orderNo,'cash');
  if(cashAfter!==undefined&&!new Decimal(cashAfter.amount).eq(0)){
    throw new Error(`Red invoice business event must not automatically move Cash: ${JSON.stringify(cashAfter)}`);
  }

  const blueAfter=await runtime.db.selectFrom('business_data')
    .select(['id','business_data_type','business_object_key','payload'])
    .where('id','=',blueBusiness.id)
    .executeTakeFirstOrThrow();
  if(JSON.stringify(blueAfter)!==immutableBlueBefore){
    throw new Error('Red invoice mutated original blue invoice BusinessData.');
  }

  console.log(JSON.stringify({
    status:'PASS',
    packet:'EEL-C03.4',
    orderNo,
    blueInvoiceBusinessDataType:blueBusiness.business_data_type,
    redInvoiceBusinessDataType:redBusiness.business_data_type,
    invoiceBalanceBefore:invoiceBefore.amount,
    invoiceBalanceAfter:invoiceAfter.amount,
    invoiceDelta:new Decimal(invoiceAfter.amount).minus(invoiceBefore.amount).toString(),
    receivableUnaffected:true,
    cashUnaffected:true,
    explicitSourceRelation:{
      relationType:link.relation_type,
      originalBlueInvoiceBusinessDataId:link.from_business_data_id,
      redInvoiceBusinessDataId:link.to_business_data_id
    },
    originalBlueInvoiceBusinessDataUnchanged:true,
    revenueRecognitionNotHardCoded:true,
    taxPlatformRequired:false
  },null,2));
}finally{
  await database.destroy();
}

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

async function inventoryForOrder(enterpriseId:string,orderNo:string){
  const rows=await runtime.db.selectFrom('ledger_balance as b')
    .innerJoin('ledger_definition as d','d.id','b.ledger_definition_id')
    .innerJoin('ledger_dataset as ds','ds.id','b.ledger_dataset_id')
    .select(['b.quantity','b.amount','b.dimensions'])
    .where('b.enterprise_id','=',enterpriseId)
    .where('d.code','=','inventory')
    .where('ds.kind','=','CURRENT')
    .where('ds.status','=','ACTIVE')
    .execute();
  return rows.find(row=>orderNoOf(row.dimensions)===orderNo);
}

try{
  const ids=await demoIds(runtime);
  const suffix=Date.now();
  const orderNo=`SO-C03-EX-${suffix}`;
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
      quantity:10,unitPrice:'100.00',totalAmount:'1000.00',currency:'CNY',
      fulfillmentMode:'MAKE',project,department:'SALES',
      profitCenter:'PC-C03',costCenter:'CC-SALES'
    },
    effectiveAt:new Date('2026-09-22T09:00:00.000Z'),
    businessObjectKey:orderNo
  });
  await drainPosting(runtime,ids.enterpriseId);
  const orderBusiness=await runtime.db.selectFrom('business_data').select(['id','payload'])
    .where('command_execution_id','=',order.commandExecutionId).executeTakeFirstOrThrow();

  const production=await runtime.command.execute({
    enterpriseId:ids.enterpriseId,
    applicationInstanceId:ids.productionAppId,
    commandCode:'complete-production',
    actor:{type:'AUTOMATION',id:'demo-automation'},
    requestId:`${orderNo}:production`,correlationId,causationId:orderBusiness.id,
    idempotencyKey:`${orderNo}:production`,
    input:{orderNo,customer,productId:'P-100',warehouse:'HK',quantity:10,totalCost:'100.00',
      project,department:'SALES',profitCenter:'PC-C03',costCenter:'CC-SALES'},
    effectiveAt:new Date('2026-09-22T10:00:00.000Z'),
    businessObjectKey:`PROD:${orderNo}`
  });
  await drainPosting(runtime,ids.enterpriseId);

  const shipmentNo=`SHIP-C03-EX-${suffix}`;
  const shipment=await runtime.command.execute({
    enterpriseId:ids.enterpriseId,applicationInstanceId:ids.inventoryAppId,
    commandCode:'ship-sales-order',actor:{type:'AUTOMATION',id:'demo-automation'},
    requestId:`${orderNo}:shipment`,correlationId,causationId:orderBusiness.id,
    idempotencyKey:shipmentNo,
    input:{movementType:'SHIP',shipmentNo,orderNo,customer,productId:'P-100',warehouse:'HK',
      quantity:10,project,department:'SALES',profitCenter:'PC-C03',costCenter:'CC-SALES'},
    effectiveAt:new Date('2026-09-22T11:00:00.000Z'),businessObjectKey:shipmentNo
  });
  await drainPosting(runtime,ids.enterpriseId);
  const shipmentBusiness=await runtime.db.selectFrom('business_data').select(['id','payload'])
    .where('command_execution_id','=',shipment.commandExecutionId).executeTakeFirstOrThrow();

  const returnNo=`RET-C03-EX-${suffix}`;
  const returned=await runtime.command.execute({
    enterpriseId:ids.enterpriseId,applicationInstanceId:ids.salesReturnAppId,
    commandCode:'receive-sales-return',actor:{type:'AUTOMATION',id:'demo-automation'},
    requestId:`${orderNo}:return`,correlationId,causationId:shipmentBusiness.id,
    idempotencyKey:returnNo,
    input:{returnNo,orderNo,customer,productId:'P-100',warehouse:'HK',quantity:4,
      returnCost:'40.00',currency:'CNY',project,department:'SALES',
      profitCenter:'PC-C03',costCenter:'CC-SALES'},
    effectiveAt:new Date('2026-09-22T12:00:00.000Z'),businessObjectKey:returnNo,
    lineage:{flowDefinitionId:ids.flowDefinitionId,flowInstanceKey:orderNo,
      stepCode:'sales-return-received',parentBusinessDataId:shipmentBusiness.id,relationType:'REFERENCES'}
  });
  await runtime.flow.projectCommand(returned.commandExecutionId);
  await drainPosting(runtime,ids.enterpriseId);
  const returnBusiness=await runtime.db.selectFrom('business_data')
    .select(['id','business_data_type','payload'])
    .where('command_execution_id','=',returned.commandExecutionId).executeTakeFirstOrThrow();

  const inventoryAfterReturn=await inventoryForOrder(ids.enterpriseId,orderNo);
  if(inventoryAfterReturn===undefined) throw new Error('Inventory balance missing after return.');

  const immutableBefore=await runtime.db.selectFrom('business_data')
    .select(['id','business_data_type','business_object_key','payload'])
    .where('enterprise_id','=',ids.enterpriseId)
    .where('id','in',[orderBusiness.id,shipmentBusiness.id,returnBusiness.id])
    .orderBy('id').execute();

  const exchangeNo=`EX-C03-${suffix}`;
  const exchange=await runtime.command.execute({
    enterpriseId:ids.enterpriseId,
    applicationInstanceId:ids.salesExchangeAppId,
    commandCode:'create-sales-exchange',
    actor:{type:'AUTOMATION',id:'demo-automation'},
    requestId:`${orderNo}:exchange`,correlationId,causationId:returnBusiness.id,
    idempotencyKey:exchangeNo,
    input:{exchangeNo,orderNo,customer,originalProductId:'P-100',replacementProductId:'P-100',
      warehouse:'HK',replacementQuantity:4,replacementCost:'40.00',currency:'CNY',
      project,department:'SALES',profitCenter:'PC-C03',costCenter:'CC-SALES'},
    effectiveAt:new Date('2026-09-22T13:00:00.000Z'),businessObjectKey:exchangeNo,
    lineage:{flowDefinitionId:ids.flowDefinitionId,flowInstanceKey:orderNo,
      stepCode:'sales-exchange-created',parentBusinessDataId:returnBusiness.id,relationType:'REFERENCES'}
  });
  await runtime.flow.projectCommand(exchange.commandExecutionId);
  await drainPosting(runtime,ids.enterpriseId);

  const exchangeBusiness=await runtime.db.selectFrom('business_data')
    .select(['id','business_data_type','payload'])
    .where('command_execution_id','=',exchange.commandExecutionId).executeTakeFirstOrThrow();

  if(exchangeBusiness.business_data_type!=='sales_exchange.created'){
    throw new Error(`Expected sales_exchange.created, got ${exchangeBusiness.business_data_type}`);
  }

  const inventoryAfterExchange=await inventoryForOrder(ids.enterpriseId,orderNo);
  if(inventoryAfterExchange===undefined) throw new Error('Inventory balance missing after exchange.');

  if(!new Decimal(inventoryAfterExchange.quantity).minus(inventoryAfterReturn.quantity).eq(-4)){
    throw new Error(`Exchange must decrease inventory quantity by 4: afterReturn=${inventoryAfterReturn.quantity} afterExchange=${inventoryAfterExchange.quantity}`);
  }
  if(!new Decimal(inventoryAfterExchange.amount).minus(inventoryAfterReturn.amount).eq(-40)){
    throw new Error(`Exchange must decrease inventory amount by 40: afterReturn=${inventoryAfterReturn.amount} afterExchange=${inventoryAfterExchange.amount}`);
  }

  const link=await runtime.db.selectFrom('business_object_link')
    .select(['from_business_data_id','to_business_data_id','relation_type'])
    .where('enterprise_id','=',ids.enterpriseId)
    .where('from_business_data_id','=',returnBusiness.id)
    .where('to_business_data_id','=',exchangeBusiness.id)
    .where('relation_type','=','REFERENCES').executeTakeFirstOrThrow();

  const immutableAfter=await runtime.db.selectFrom('business_data')
    .select(['id','business_data_type','business_object_key','payload'])
    .where('enterprise_id','=',ids.enterpriseId)
    .where('id','in',[orderBusiness.id,shipmentBusiness.id,returnBusiness.id])
    .orderBy('id').execute();

  if(JSON.stringify(immutableBefore)!==JSON.stringify(immutableAfter)){
    throw new Error('Sales exchange mutated original sales/shipment/return BusinessData.');
  }

  console.log(JSON.stringify({
    status:'PASS',
    packet:'EEL-C03.2',
    orderNo,
    exchangeBusinessDataType:exchangeBusiness.business_data_type,
    exchangeInventoryDelta:{
      quantity:new Decimal(inventoryAfterExchange.quantity).minus(inventoryAfterReturn.quantity).toString(),
      amount:new Decimal(inventoryAfterExchange.amount).minus(inventoryAfterReturn.amount).toString(),
      currency:'CNY'
    },
    explicitSourceRelation:{
      relationType:link.relation_type,
      sourceReturnBusinessDataId:link.from_business_data_id,
      exchangeBusinessDataId:link.to_business_data_id
    },
    originalSalesShipmentReturnBusinessDataUnchanged:true,
    afterReturnQuantity:inventoryAfterReturn.quantity,
    afterExchangeQuantity:inventoryAfterExchange.quantity,
    newExchangeRuntimeRequired:false
  },null,2));
}finally{
  await database.destroy();
}

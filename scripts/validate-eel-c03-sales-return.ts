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

async function inventoryForOrder(enterpriseId:string,orderNo:string) {
  const rows = await runtime.db.selectFrom('ledger_balance as b')
    .innerJoin('ledger_definition as d','d.id','b.ledger_definition_id')
    .innerJoin('ledger_dataset as ds','ds.id','b.ledger_dataset_id')
    .select(['b.quantity','b.amount','b.dimensions'])
    .where('b.enterprise_id','=',enterpriseId)
    .where('d.code','=','inventory')
    .where('ds.kind','=','CURRENT')
    .where('ds.status','=','ACTIVE')
    .execute();
  return rows.find((row)=>orderNoOf(row.dimensions)===orderNo);
}

try {
  const ids=await demoIds(runtime);
  const suffix=Date.now();
  const orderNo=`SO-C03-RETURN-${suffix}`;
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
      eventKind:'ORDER',
      orderNo,
      customer,
      productId:'P-100',
      quantity:10,
      unitPrice:'100.00',
      totalAmount:'1000.00',
      currency:'CNY',
      fulfillmentMode:'MAKE',
      project,
      department:'SALES',
      profitCenter:'PC-C03',
      costCenter:'CC-SALES'
    },
    effectiveAt:new Date('2026-09-22T09:00:00.000Z'),
    businessObjectKey:orderNo
  });
  await drainPosting(runtime,ids.enterpriseId);

  const orderBusiness=await runtime.db.selectFrom('business_data')
    .select(['id','payload'])
    .where('command_execution_id','=',order.commandExecutionId)
    .executeTakeFirstOrThrow();

  const production=await runtime.command.execute({
    enterpriseId:ids.enterpriseId,
    applicationInstanceId:ids.productionAppId,
    commandCode:'complete-production',
    actor:{type:'AUTOMATION',id:'demo-automation'},
    requestId:`${orderNo}:production`,
    correlationId,
    causationId:orderBusiness.id,
    idempotencyKey:`${orderNo}:production`,
    input:{
      orderNo,
      customer,
      productId:'P-100',
      warehouse:'HK',
      quantity:10,
      totalCost:'100.00',
      project,
      department:'SALES',
      profitCenter:'PC-C03',
      costCenter:'CC-SALES'
    },
    effectiveAt:new Date('2026-09-22T10:00:00.000Z'),
    businessObjectKey:`PROD:${orderNo}`
  });
  await drainPosting(runtime,ids.enterpriseId);

  const shipmentNo=`SHIP-C03-${suffix}`;
  const shipment=await runtime.command.execute({
    enterpriseId:ids.enterpriseId,
    applicationInstanceId:ids.inventoryAppId,
    commandCode:'ship-sales-order',
    actor:{type:'AUTOMATION',id:'demo-automation'},
    requestId:`${orderNo}:shipment`,
    correlationId,
    causationId:orderBusiness.id,
    idempotencyKey:shipmentNo,
    input:{
      movementType:'SHIP',
      shipmentNo,
      orderNo,
      customer,
      productId:'P-100',
      warehouse:'HK',
      quantity:10,
      project,
      department:'SALES',
      profitCenter:'PC-C03',
      costCenter:'CC-SALES'
    },
    effectiveAt:new Date('2026-09-22T11:00:00.000Z'),
    businessObjectKey:shipmentNo
  });
  await drainPosting(runtime,ids.enterpriseId);

  const shipmentBusiness=await runtime.db.selectFrom('business_data')
    .select(['id','payload'])
    .where('command_execution_id','=',shipment.commandExecutionId)
    .executeTakeFirstOrThrow();

  const forwardBefore=await runtime.db.selectFrom('business_data')
    .select(['id','business_data_type','business_object_key','payload'])
    .where('enterprise_id','=',ids.enterpriseId)
    .where('id','in',[orderBusiness.id,shipmentBusiness.id])
    .orderBy('id')
    .execute();

  const inventoryBefore=await inventoryForOrder(ids.enterpriseId,orderNo);
  if (inventoryBefore === undefined) throw new Error('Inventory balance missing before return.');

  const returnNo=`RET-C03-${suffix}`;
  const returned=await runtime.command.execute({
    enterpriseId:ids.enterpriseId,
    applicationInstanceId:ids.salesReturnAppId,
    commandCode:'receive-sales-return',
    actor:{type:'AUTOMATION',id:'demo-automation'},
    requestId:`${orderNo}:return`,
    correlationId,
    causationId:shipmentBusiness.id,
    idempotencyKey:returnNo,
    input:{
      returnNo,
      orderNo,
      customer,
      productId:'P-100',
      warehouse:'HK',
      quantity:4,
      returnCost:'40.00',
      currency:'CNY',
      project,
      department:'SALES',
      profitCenter:'PC-C03',
      costCenter:'CC-SALES'
    },
    effectiveAt:new Date('2026-09-22T12:00:00.000Z'),
    businessObjectKey:returnNo,
    lineage:{
      flowDefinitionId:ids.flowDefinitionId,
      flowInstanceKey:orderNo,
      stepCode:'sales-return-received',
      parentBusinessDataId:shipmentBusiness.id,
      relationType:'REFERENCES'
    }
  });
  await runtime.flow.projectCommand(returned.commandExecutionId);
  await drainPosting(runtime,ids.enterpriseId);

  const returnBusiness=await runtime.db.selectFrom('business_data')
    .select(['id','business_data_type','business_object_key','payload'])
    .where('command_execution_id','=',returned.commandExecutionId)
    .executeTakeFirstOrThrow();

  if (returnBusiness.business_data_type !== 'sales_return.received') {
    throw new Error(`Expected sales_return.received, got ${returnBusiness.business_data_type}`);
  }

  const inventoryAfter=await inventoryForOrder(ids.enterpriseId,orderNo);
  if (inventoryAfter === undefined) throw new Error('Inventory balance missing after return.');

  if (!new Decimal(inventoryAfter.quantity).minus(inventoryBefore.quantity).eq(4)) {
    throw new Error(`Return must increase inventory quantity by 4: before=${inventoryBefore.quantity} after=${inventoryAfter.quantity}`);
  }
  if (!new Decimal(inventoryAfter.amount).minus(inventoryBefore.amount).eq(40)) {
    throw new Error(`Return must increase inventory amount by 40: before=${inventoryBefore.amount} after=${inventoryAfter.amount}`);
  }

  const link=await runtime.db.selectFrom('business_object_link')
    .select(['from_business_data_id','to_business_data_id','relation_type'])
    .where('enterprise_id','=',ids.enterpriseId)
    .where('from_business_data_id','=',shipmentBusiness.id)
    .where('to_business_data_id','=',returnBusiness.id)
    .where('relation_type','=','REFERENCES')
    .executeTakeFirstOrThrow();

  const forwardAfter=await runtime.db.selectFrom('business_data')
    .select(['id','business_data_type','business_object_key','payload'])
    .where('enterprise_id','=',ids.enterpriseId)
    .where('id','in',[orderBusiness.id,shipmentBusiness.id])
    .orderBy('id')
    .execute();

  if (JSON.stringify(forwardBefore)!==JSON.stringify(forwardAfter)) {
    throw new Error('Sales return mutated original sales/shipment BusinessData.');
  }

  console.log(JSON.stringify({
    status:'PASS',
    packet:'EEL-C03.1',
    orderNo,
    returnBusinessDataType:returnBusiness.business_data_type,
    inventoryDelta:{
      quantity:new Decimal(inventoryAfter.quantity).minus(inventoryBefore.quantity).toString(),
      amount:new Decimal(inventoryAfter.amount).minus(inventoryBefore.amount).toString(),
      currency:'CNY'
    },
    explicitSourceRelation:{
      relationType:link.relation_type,
      sourceShipmentBusinessDataId:link.from_business_data_id,
      returnBusinessDataId:link.to_business_data_id
    },
    originalForwardBusinessDataUnchanged:true,
    newReturnRuntimeRequired:false
  },null,2));
} finally {
  await database.destroy();
}

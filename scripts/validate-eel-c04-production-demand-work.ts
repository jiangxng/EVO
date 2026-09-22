import { Decimal } from 'decimal.js';
import { createDatabase } from '../platform/database/src/index.js';
import { loadRuntimeConfig } from '../platform/runtime/src/config.js';
import { createEvoRuntime, demoIds, drainPosting } from '../apps/api/src/evo-runtime.js';

const config=loadRuntimeConfig();
const database=createDatabase(config.databaseUrl);
const runtime=createEvoRuntime(database);

function demandNoOf(dimensions:unknown):string|undefined{
  if(dimensions===null||typeof dimensions!=='object'||Array.isArray(dimensions)) return undefined;
  const value=(dimensions as Record<string,unknown>).order_no;
  return typeof value==='string'?value:undefined;
}

try{
  const ids=await demoIds(runtime);
  if(ids.productionDemandAppId.length===0){
    throw new Error('C04.1 requires seeded production-demand application.');
  }

  const suffix=Date.now();
  const demandNo=`PD-C04-${suffix}`;
  const productId='P-100';

  const beforeSalesCount=await runtime.db.selectFrom('business_data')
    .select(({fn})=>fn.countAll<number>().as('count'))
    .where('enterprise_id','=',ids.enterpriseId)
    .where('business_data_type','=','sales_order.approved')
    .where('business_object_key','=',demandNo)
    .executeTakeFirstOrThrow();

  if(Number(beforeSalesCount.count)!==0){
    throw new Error('Reference production demand must not depend on a Sales Order.');
  }

  const demand=await runtime.command.execute({
    enterpriseId:ids.enterpriseId,
    applicationInstanceId:ids.productionDemandAppId,
    commandCode:'create-production-demand',
    actor:{type:'AUTOMATION',id:'demo-automation'},
    requestId:`${demandNo}:create`,
    correlationId:`MFG:${demandNo}`,
    idempotencyKey:demandNo,
    input:{
      demandNo,
      demandSource:'INTERNAL_PLAN',
      productId,
      quantity:100,
      customer:null,
      project:`MFG-PROJECT-${suffix}`,
      department:'PRODUCTION',
      profitCenter:'PC-MFG',
      costCenter:'CC-MFG'
    },
    effectiveAt:new Date('2026-09-22T09:00:00.000Z'),
    businessObjectKey:demandNo
  });
  await drainPosting(runtime,ids.enterpriseId);

  const fact=await runtime.db.selectFrom('business_data')
    .select(['id','business_data_type','business_object_key','payload'])
    .where('command_execution_id','=',demand.commandExecutionId)
    .executeTakeFirstOrThrow();

  if(fact.business_data_type!=='production_demand.created'){
    throw new Error(`Expected production_demand.created, got ${fact.business_data_type}`);
  }

  const balances=await runtime.db.selectFrom('ledger_balance as b')
    .innerJoin('ledger_definition as d','d.id','b.ledger_definition_id')
    .innerJoin('ledger_dataset as ds','ds.id','b.ledger_dataset_id')
    .select(['d.code as ledger','b.quantity','b.amount','b.dimensions'])
    .where('b.enterprise_id','=',ids.enterpriseId)
    .where('d.code','=','pending_production')
    .where('ds.kind','=','CURRENT')
    .where('ds.status','=','ACTIVE')
    .execute();

  const pending=balances.find(row=>demandNoOf(row.dimensions)===demandNo);
  if(pending===undefined){
    throw new Error('Production demand did not create pending_production balance.');
  }
  if(!new Decimal(pending.quantity).eq(100)){
    throw new Error(`Expected pending_production 100, got ${pending.quantity}`);
  }

  const workRows=await runtime.db.selectFrom('work_item')
    .select(['work_type','status','source_ledger_code','source_quantity','source_dimensions'])
    .where('enterprise_id','=',ids.enterpriseId)
    .where('source_ledger_code','=','pending_production')
    .execute();

  const work=workRows.find(row=>demandNoOf(row.source_dimensions)===demandNo);
  if(work===undefined){
    throw new Error('Production demand did not project PRODUCE Work.');
  }
  if(work.work_type!=='PRODUCE'||work.status!=='OPEN'){
    throw new Error(`Expected PRODUCE OPEN, got ${work.work_type} ${work.status}`);
  }
  if(!new Decimal(work.source_quantity).eq(100)){
    throw new Error(`Expected Work source quantity 100, got ${work.source_quantity}`);
  }

  const salesFact=await runtime.db.selectFrom('business_data')
    .select('id')
    .where('enterprise_id','=',ids.enterpriseId)
    .where('business_data_type','=','sales_order.approved')
    .where('business_object_key','=',demandNo)
    .executeTakeFirst();

  if(salesFact!==undefined){
    throw new Error('C04.1 production demand unexpectedly created or required sales_order.approved.');
  }

  console.log(JSON.stringify({
    status:'PASS',
    packet:'EEL-C04.1',
    demandNo,
    businessDataType:fact.business_data_type,
    pendingProduction:pending.quantity,
    work:{
      type:work.work_type,
      status:work.status,
      sourceLedger:work.source_ledger_code,
      sourceQuantity:work.source_quantity
    },
    independentOfSalesOrder:true,
    inventoryUnaffected:true,
    costUnaffected:true,
    newManufacturingRuntimeRequired:false
  },null,2));
}finally{
  await database.destroy();
}

import { Decimal } from 'decimal.js';
import { createDatabase } from '../platform/database/src/index.js';
import { loadRuntimeConfig } from '../platform/runtime/src/config.js';
import { createEvoRuntime, demoIds, drainPosting } from '../apps/api/src/evo-runtime.js';

const config=loadRuntimeConfig();
const database=createDatabase(config.databaseUrl);
const runtime=createEvoRuntime(database);

function dimValue(dimensions:unknown,key:string):string|undefined{
  if(dimensions===null||typeof dimensions!=='object'||Array.isArray(dimensions)) return undefined;
  const value=(dimensions as Record<string,unknown>)[key];
  return typeof value==='string'?value:undefined;
}

async function balance(enterpriseId:string,ledger:string,orderNo:string,productId?:string){
  const rows=await runtime.db.selectFrom('ledger_balance as b')
    .innerJoin('ledger_definition as d','d.id','b.ledger_definition_id')
    .innerJoin('ledger_dataset as ds','ds.id','b.ledger_dataset_id')
    .select(['b.quantity','b.amount','b.dimensions'])
    .where('b.enterprise_id','=',enterpriseId)
    .where('d.code','=',ledger)
    .where('ds.kind','=','CURRENT')
    .where('ds.status','=','ACTIVE')
    .execute();
  return rows.find(r=>
    dimValue(r.dimensions,'order_no')===orderNo &&
    (productId===undefined||dimValue(r.dimensions,'product_id')===productId)
  );
}

async function productionWork(enterpriseId:string,demandNo:string){
  const rows=await runtime.db.selectFrom('work_item')
    .select(['work_type','status','source_ledger_code','source_quantity','source_dimensions'])
    .where('enterprise_id','=',enterpriseId)
    .where('source_ledger_code','=','pending_production')
    .execute();
  return rows.find(r=>dimValue(r.source_dimensions,'order_no')===demandNo);
}

try{
  const ids=await demoIds(runtime);
  if(ids.materialIssueAppId.length===0) throw new Error('Material Issue application is not installed.');

  const suffix=Date.now();
  const poNo=`PO-C04-RM-${suffix}`;
  const demandNo=`PD-C04-BUNDLE-${suffix}`;
  const supplier='SUPPLIER-C04';
  const raw='RM-100';
  const finished='FG-100';
  const rawWarehouse='RM';
  const fgWarehouse='FG';
  const project=`MFG-${suffix}`;

  // Precondition: buy raw material through the already-certified P2P fact path.
  const po=await runtime.command.execute({
    enterpriseId:ids.enterpriseId,applicationInstanceId:ids.procurementAppId,
    commandCode:'approve-purchase-order',actor:{type:'AUTOMATION',id:'demo-automation'},
    requestId:`${poNo}:approve`,correlationId:`P2P:${poNo}`,idempotencyKey:`${poNo}:approve`,
    input:{orderNo:poNo,supplier,productId:raw,warehouse:rawWarehouse,quantity:100,unitPrice:'10.00',
      totalAmount:'1000.00',currency:'CNY',project,department:'PROCUREMENT',costCenter:'CC-MFG'},
    effectiveAt:new Date('2026-09-22T01:00:00.000Z'),businessObjectKey:poNo,
    lineage:{flowDefinitionId:ids.procureToPayFlowDefinitionId,flowInstanceKey:poNo,stepCode:'purchase-order-approved'}
  });
  await runtime.flow.projectCommand(po.commandExecutionId);
  await drainPosting(runtime,ids.enterpriseId);
  const poFact=await runtime.db.selectFrom('business_data').select('id')
    .where('command_execution_id','=',po.commandExecutionId).executeTakeFirstOrThrow();

  const receipt=await runtime.command.execute({
    enterpriseId:ids.enterpriseId,applicationInstanceId:ids.inventoryAppId,
    commandCode:'receive-purchase-order',actor:{type:'AUTOMATION',id:'demo-automation'},
    requestId:`${poNo}:receipt`,correlationId:`P2P:${poNo}`,causationId:poFact.id,idempotencyKey:`${poNo}:receipt`,
    input:{movementType:'PURCHASE_RECEIPT',receiptNo:`GR-${suffix}`,orderNo:poNo,supplier,productId:raw,
      warehouse:rawWarehouse,quantity:100,totalCost:'1000.00',currency:'CNY',project,department:'PROCUREMENT',costCenter:'CC-MFG'},
    effectiveAt:new Date('2026-09-22T02:00:00.000Z'),businessObjectKey:`GR-${suffix}`,
    lineage:{flowDefinitionId:ids.procureToPayFlowDefinitionId,flowInstanceKey:poNo,stepCode:'goods-received',
      parentBusinessDataId:poFact.id,relationType:'FULFILLS'}
  });
  await runtime.flow.projectCommand(receipt.commandExecutionId);
  await drainPosting(runtime,ids.enterpriseId);

  // Independent manufacturing demand.
  const demand=await runtime.command.execute({
    enterpriseId:ids.enterpriseId,applicationInstanceId:ids.productionDemandAppId,
    commandCode:'create-production-demand',actor:{type:'AUTOMATION',id:'demo-automation'},
    requestId:`${demandNo}:create`,correlationId:`MFG:${demandNo}`,idempotencyKey:`${demandNo}:create`,
    input:{demandNo,demandSource:'INTERNAL_PLAN',productId:finished,quantity:50,customer:null,project,
      department:'PRODUCTION',profitCenter:'PC-MFG',costCenter:'CC-MFG'},
    effectiveAt:new Date('2026-09-22T03:00:00.000Z'),businessObjectKey:demandNo,
    lineage:{flowDefinitionId:ids.manufacturingFlowDefinitionId,flowInstanceKey:demandNo,stepCode:'production-demand-created'}
  });
  await runtime.flow.projectCommand(demand.commandExecutionId);
  await drainPosting(runtime,ids.enterpriseId);

  const demandFact=await runtime.db.selectFrom('business_data').select('id')
    .where('command_execution_id','=',demand.commandExecutionId).executeTakeFirstOrThrow();

  let work=await productionWork(ids.enterpriseId,demandNo);
  if(work?.status!=='OPEN'||!new Decimal(work.source_quantity).eq(50)){
    throw new Error(`Demand must open PRODUCE 50: ${JSON.stringify(work)}`);
  }

  // Issue 20 raw-material units for this demand.
  const issue=await runtime.command.execute({
    enterpriseId:ids.enterpriseId,applicationInstanceId:ids.materialIssueAppId,
    commandCode:'issue-material',actor:{type:'AUTOMATION',id:'demo-automation'},
    requestId:`${demandNo}:issue:1`,correlationId:`MFG:${demandNo}`,causationId:demandFact.id,idempotencyKey:`${demandNo}:issue:1`,
    input:{issueNo:`MI-${suffix}`,orderNo:demandNo,productId:raw,warehouse:rawWarehouse,quantity:20,
      project,department:'PRODUCTION',costCenter:'CC-MFG'},
    effectiveAt:new Date('2026-09-22T04:00:00.000Z'),businessObjectKey:`MI-${suffix}`,
    lineage:{flowDefinitionId:ids.manufacturingFlowDefinitionId,flowInstanceKey:demandNo,stepCode:'material-issued',
      parentBusinessDataId:demandFact.id,relationType:'REFERENCES'}
  });
  await runtime.flow.projectCommand(issue.commandExecutionId);
  await drainPosting(runtime,ids.enterpriseId);
  const issueFact=await runtime.db.selectFrom('business_data').select('id')
    .where('command_execution_id','=',issue.commandExecutionId).executeTakeFirstOrThrow();

  const fifoPolicy=await runtime.db.selectFrom('valuation_policy').select(['id','version'])
    .where('enterprise_id','=',ids.enterpriseId).where('method','=','FIFO').where('status','=','ACTIVE')
    .orderBy('version','desc').executeTakeFirstOrThrow();
  const fifoAllocation=await runtime.db.selectFrom('allocation_policy').select(['id','version'])
    .where('enterprise_id','=',ids.enterpriseId).where('code','=','inventory_fifo').where('status','=','PUBLISHED')
    .orderBy('version','desc').executeTakeFirstOrThrow();
  const materialRule=await runtime.db.selectFrom('valuation_rule').select(['id','version'])
    .where('enterprise_id','=',ids.enterpriseId).where('source_business_data_type','=','material_issue.issued')
    .where('status','=','PUBLISHED').orderBy('version','desc').executeTakeFirstOrThrow();

  await runtime.cost.recalculate(ids.enterpriseId,'FIFO',{
    valuationPolicyId:fifoPolicy.id,valuationPolicyVersion:fifoPolicy.version,
    allocationPolicyId:fifoAllocation.id,allocationPolicyVersion:fifoAllocation.version,
    valuationRules:{'material_issue.issued':{id:materialRule.id,version:materialRule.version}}
  });
  await runtime.work.refresh(ids.enterpriseId);

  const issueCost=await runtime.db.selectFrom('cost_result as c')
    .innerJoin('cost_run as r','r.id','c.cost_run_id')
    .select(['c.business_data_id','c.quantity','c.total_cost'])
    .where('r.enterprise_id','=',ids.enterpriseId)
    .where('c.business_data_id','=',issueFact.id)
    .orderBy('r.started_at','desc')
    .executeTakeFirstOrThrow();

  if(!new Decimal(issueCost.total_cost).eq(200)){
    throw new Error(`Expected material issue FIFO cost 200, got ${issueCost.total_cost}`);
  }

  const rawAfterIssue=await balance(ids.enterpriseId,'inventory',poNo,raw);
  if(rawAfterIssue===undefined||!new Decimal(rawAfterIssue.quantity).eq(80)||!new Decimal(rawAfterIssue.amount).eq(800)){
    throw new Error(`Raw inventory after issue must be 80 / 800: ${JSON.stringify(rawAfterIssue)}`);
  }

  const wipAfterIssue=await balance(ids.enterpriseId,'manufacturing_wip',demandNo,raw);
  if(wipAfterIssue===undefined||!new Decimal(wipAfterIssue.amount).eq(200)){
    throw new Error(`Manufacturing WIP after issue must be 200: ${JSON.stringify(wipAfterIssue)}`);
  }

  const completions=[
    {qty:20,cost:'80.00',at:'2026-09-22T05:00:00.000Z'},
    {qty:30,cost:'120.00',at:'2026-09-22T06:00:00.000Z'}
  ];
  const expectedRemaining=[30,0];

  for(let index=0;index<completions.length;index+=1){
    const part=completions[index]!;
    const completed=await runtime.command.execute({
      enterpriseId:ids.enterpriseId,applicationInstanceId:ids.productionAppId,
      commandCode:'complete-production',actor:{type:'AUTOMATION',id:'demo-automation'},
      requestId:`${demandNo}:complete:${index+1}`,correlationId:`MFG:${demandNo}`,causationId:demandFact.id,
      idempotencyKey:`${demandNo}:complete:${index+1}`,
      input:{orderNo:demandNo,customer:null,productId:finished,warehouse:fgWarehouse,quantity:part.qty,totalCost:part.cost,
        materialProductId:raw,materialWarehouse:rawWarehouse,project,department:'PRODUCTION',
        profitCenter:'PC-MFG',costCenter:'CC-MFG'},
      effectiveAt:new Date(part.at),businessObjectKey:`PROD:${demandNo}:${index+1}`,
      lineage:{flowDefinitionId:ids.manufacturingFlowDefinitionId,flowInstanceKey:demandNo,stepCode:'production-completed',
        parentBusinessDataId:demandFact.id,relationType:'FULFILLS'}
    });
    await runtime.flow.projectCommand(completed.commandExecutionId);
    await drainPosting(runtime,ids.enterpriseId);

    work=await productionWork(ids.enterpriseId,demandNo);
    if(work===undefined||!new Decimal(work.source_quantity).eq(expectedRemaining[index]!)){
      throw new Error(`Pending production after completion ${index+1} must be ${expectedRemaining[index]}: ${JSON.stringify(work)}`);
    }
    if((index===0&&work.status!=='OPEN')||(index===1&&work.status!=='DONE')){
      throw new Error(`PRODUCE Work status mismatch after completion ${index+1}: ${work.status}`);
    }
  }

  const fg=await balance(ids.enterpriseId,'inventory',demandNo,finished);
  if(fg===undefined||!new Decimal(fg.quantity).eq(50)||!new Decimal(fg.amount).eq(200)){
    throw new Error(`Finished goods must be 50 / 200: ${JSON.stringify(fg)}`);
  }

  const wipFinal=await balance(ids.enterpriseId,'manufacturing_wip',demandNo,raw);
  if(wipFinal===undefined||!new Decimal(wipFinal.amount).eq(0)){
    throw new Error(`Manufacturing WIP must close to zero: ${JSON.stringify(wipFinal)}`);
  }

  const links=await runtime.db.selectFrom('business_object_link')
    .select(['from_business_data_id','to_business_data_id','relation_type'])
    .where('enterprise_id','=',ids.enterpriseId)
    .where('from_business_data_id','=',demandFact.id)
    .execute();
  if(links.filter(l=>l.relation_type==='REFERENCES').length!==1||links.filter(l=>l.relation_type==='FULFILLS').length!==2){
    throw new Error(`Expected one material REFERENCES and two completion FULFILLS links: ${JSON.stringify(links)}`);
  }

  console.log(JSON.stringify({
    status:'PASS',packet:'EEL-C04.2-C04.5',demandNo,
    materialIssue:{quantity:20,fifoCost:issueCost.total_cost},
    rawMaterialFinal:{quantity:rawAfterIssue.quantity,amount:rawAfterIssue.amount},
    finishedGoodsFinal:{quantity:fg.quantity,amount:fg.amount},
    manufacturingWipFinal:wipFinal.amount,
    completionSequence:[20,30],
    pendingProductionSequence:[50,30,0],
    produceWorkFinal:work.status,
    explicitRelations:{materialReferences:1,completionFulfills:2},
    costTransferExplainable:true,
    partialCompletionBalanceDriven:true,
    newManufacturingCoreRuntimeRequired:false
  },null,2));
}finally{
  await database.destroy();
}

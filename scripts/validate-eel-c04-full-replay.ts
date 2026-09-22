import { Decimal } from 'decimal.js';
import { createDatabase } from '../platform/database/src/index.js';
import { loadRuntimeConfig } from '../platform/runtime/src/config.js';
import { createEvoRuntime, demoIds, drainPosting } from '../apps/api/src/evo-runtime.js';
import {
  computeEconomicRuntimeDigest,
  computeReplayInputDigest
} from '../modules/replay/infrastructure/postgres-replay-digest.js';

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

async function inventoryTotal(enterpriseId:string,productId:string,warehouse:string){
  const rows=await runtime.db.selectFrom('ledger_balance as b')
    .innerJoin('ledger_definition as d','d.id','b.ledger_definition_id')
    .innerJoin('ledger_dataset as ds','ds.id','b.ledger_dataset_id')
    .select(['b.quantity','b.amount','b.dimensions'])
    .where('b.enterprise_id','=',enterpriseId)
    .where('d.code','=','inventory')
    .where('ds.kind','=','CURRENT')
    .where('ds.status','=','ACTIVE')
    .execute();
  const matching=rows.filter(r=>
    dimValue(r.dimensions,'product_id')===productId &&
    dimValue(r.dimensions,'warehouse')===warehouse
  );
  return {
    quantity:matching.reduce((total,row)=>total.plus(row.quantity),new Decimal(0)).toString(),
    amount:matching.reduce((total,row)=>total.plus(row.amount),new Decimal(0)).toString()
  };
}

async function snapshot(
  enterpriseId:string,
  demandNo:string,
  rawProductId:string,
  rawWarehouse:string,
  finishedProductId:string,
  finishedWarehouse:string,
  issueFactId:string,
  factIds:string[]
){
  const pending=await balance(enterpriseId,'pending_production',demandNo);
  const wip=await balance(enterpriseId,'manufacturing_wip',demandNo,rawProductId);
  const finished=await balance(enterpriseId,'inventory',demandNo,finishedProductId);
  const raw=await inventoryTotal(enterpriseId,rawProductId,rawWarehouse);
  const finishedTotal=await inventoryTotal(enterpriseId,finishedProductId,finishedWarehouse);

  const work=(await runtime.db.selectFrom('work_item')
    .select(['work_type','status','source_ledger_code','source_quantity','source_amount','source_dimensions'])
    .where('enterprise_id','=',enterpriseId)
    .where('source_ledger_code','=','pending_production')
    .execute())
    .filter(row=>dimValue(row.source_dimensions,'order_no')===demandNo)
    .map(row=>({
      workType:row.work_type,
      status:row.status,
      ledger:row.source_ledger_code,
      quantity:row.source_quantity,
      amount:row.source_amount
    }));

  const facts=await runtime.db.selectFrom('business_data')
    .select(['id','business_data_type','business_object_key','payload','effective_at'])
    .where('enterprise_id','=',enterpriseId)
    .where('id','in',factIds)
    .orderBy('effective_at')
    .orderBy('id')
    .execute();

  const links=(await runtime.db.selectFrom('business_object_link')
    .select(['from_business_data_id','to_business_data_id','relation_type'])
    .where('enterprise_id','=',enterpriseId)
    .execute())
    .filter(row=>factIds.includes(row.from_business_data_id)&&factIds.includes(row.to_business_data_id))
    .sort((a,b)=>
      a.from_business_data_id.localeCompare(b.from_business_data_id)||
      a.to_business_data_id.localeCompare(b.to_business_data_id)||
      a.relation_type.localeCompare(b.relation_type)
    );

  const issueCost=await runtime.db.selectFrom('cost_result as result')
    .innerJoin('cost_run as run','run.id','result.cost_run_id')
    .select(['result.business_data_id','result.quantity','result.total_cost'])
    .where('run.enterprise_id','=',enterpriseId)
    .where('result.business_data_id','=',issueFactId)
    .orderBy('run.started_at','desc')
    .executeTakeFirstOrThrow();

  return {
    raw,
    finishedTotal,
    pending:pending===undefined?null:{quantity:pending.quantity,amount:pending.amount},
    wip:wip===undefined?null:{quantity:wip.quantity,amount:wip.amount},
    finished:finished===undefined?null:{quantity:finished.quantity,amount:finished.amount},
    work,
    issueCost,
    facts,
    links
  };
}

type ManufacturingSnapshot=Awaited<ReturnType<typeof snapshot>>;

function jsonComparable<T>(value:T):T{
  return JSON.parse(JSON.stringify(value,(_key,item)=>typeof item==='bigint'?item.toString():item)) as T;
}

async function economicFamilies(enterpriseId:string,consistencyDomain:string,boundarySequence:bigint){
  const [ledgerEntries,ledgerBalances,costResults,allocationRelations,valuationPositions,valuationResults,workItems]=await Promise.all([
    runtime.db.selectFrom('ledger_entry as e')
      .innerJoin('ledger_definition as d','d.id','e.ledger_definition_id')
      .select(['d.code as ledger','e.business_data_id','e.posting_rule_id','e.posting_rule_schema_version','e.effect_index',
        'e.quantity','e.amount','e.unit','e.currency','e.dimensions','e.dimension_hash','e.effective_at','e.posting_priority',
        'e.posting_sequence','e.entry_source_kind','e.valuation_rule_id','e.valuation_rule_version'])
      .where('e.enterprise_id','=',enterpriseId).where('e.consistency_domain','=',consistencyDomain)
      .where('e.posting_sequence','<=',boundarySequence)
      .orderBy('e.posting_sequence').orderBy('d.code').orderBy('e.effect_index').orderBy('e.posting_priority')
      .orderBy('e.entry_source_kind').orderBy('e.business_data_id').orderBy('e.valuation_rule_id').orderBy('e.dimension_hash').execute(),
    runtime.db.selectFrom('ledger_balance as b')
      .innerJoin('ledger_definition as d','d.id','b.ledger_definition_id')
      .innerJoin('ledger_dataset as ds','ds.id','b.ledger_dataset_id')
      .select(['d.code as ledger','b.dimension_hash','b.dimensions','b.quantity','b.amount','b.last_posting_sequence'])
      .where('b.enterprise_id','=',enterpriseId).where('b.consistency_domain','=',consistencyDomain).where('ds.status','=','ACTIVE')
      .orderBy('d.code').orderBy('b.dimension_hash').execute(),
    runtime.db.selectFrom('cost_result')
      .select(['business_data_id','pool_key','method','quantity','unit_cost','total_cost','valuation_rule_id','valuation_rule_version'])
      .where('enterprise_id','=',enterpriseId).orderBy('business_data_id').orderBy('pool_key').execute(),
    runtime.db.selectFrom('allocation_relation')
      .select(['source_business_data_id','source_position_key','consumer_business_data_id','measurements','allocation_sequence',
        'instruction_id','allocation_policy_id','allocation_policy_version'])
      .where('enterprise_id','=',enterpriseId).orderBy('consumer_business_data_id').orderBy('allocation_sequence').execute(),
    runtime.db.selectFrom('valuation_position')
      .select(['business_data_id','valuation_rule_id','valuation_rule_version','total_cost'])
      .where('enterprise_id','=',enterpriseId).orderBy('business_data_id').orderBy('valuation_rule_id').execute(),
    runtime.db.selectFrom('valuation_result')
      .select(['result_kind','position_key','source_business_data_ids','dimensions','source_measurements','target_measurements','delta_amount','delta_unit'])
      .where('enterprise_id','=',enterpriseId).orderBy('result_kind').orderBy('position_key').execute(),
    runtime.db.selectFrom('work_item')
      .select(['work_type','title','status','priority','source_ledger_code','source_dimension_hash','source_dimensions',
        'source_quantity','source_amount','assigned_actor_type','assigned_actor_id'])
      .where('enterprise_id','=',enterpriseId).orderBy('work_type').orderBy('source_ledger_code').orderBy('source_dimension_hash').execute()
  ]);
  return jsonComparable({ledgerEntries,ledgerBalances,costResults,allocationRelations,valuationPositions,valuationResults,workItems});
}

function assertManufacturingClosed(state:ManufacturingSnapshot,label:string){
  if(state.pending===null||!new Decimal(state.pending.quantity).eq(0)){
    throw new Error(`${label} pending production must be zero: ${JSON.stringify(state.pending)}`);
  }
  if(state.wip===null||!new Decimal(state.wip.amount).eq(0)){
    throw new Error(`${label} manufacturing WIP must be zero: ${JSON.stringify(state.wip)}`);
  }
  if(state.finished===null||!new Decimal(state.finished.quantity).eq(50)||!new Decimal(state.finished.amount).eq(200)){
    throw new Error(`${label} finished goods must be 50 / 200: ${JSON.stringify(state.finished)}`);
  }
  if(!new Decimal(state.raw.quantity).eq(80)||!new Decimal(state.raw.amount).eq(800)){
    throw new Error(`${label} raw material inventory must be 80 / 800: ${JSON.stringify(state.raw)}`);
  }
  if(!new Decimal(state.finishedTotal.quantity).eq(50)||!new Decimal(state.finishedTotal.amount).eq(200)){
    throw new Error(`${label} finished-goods inventory total must be 50 / 200: ${JSON.stringify(state.finishedTotal)}`);
  }
  if(state.work.length!==1||state.work[0]?.status!=='DONE'||!new Decimal(state.work[0].quantity).eq(0)){
    throw new Error(`${label} must contain one DONE PRODUCE Work item: ${JSON.stringify(state.work)}`);
  }
  if(state.issueCost.total_cost===null||!new Decimal(state.issueCost.total_cost).eq(200)){
    throw new Error(`${label} material issue FIFO cost must be 200: ${JSON.stringify(state.issueCost)}`);
  }
  const types=state.facts.map(row=>row.business_data_type);
  const expected={
    'purchase_order.approved':1,
    'goods_receipt.received':1,
    'production_demand.created':1,
    'material_issue.issued':1,
    'production.completed':2
  } as const;
  for(const [type,count] of Object.entries(expected)){
    if(types.filter(value=>value===type).length!==count){
      throw new Error(`${label} expected ${count} ${type} facts: ${JSON.stringify(types)}`);
    }
  }
  if(state.links.filter(row=>row.relation_type==='REFERENCES').length!==1||
    state.links.filter(row=>row.relation_type==='FULFILLS').length!==3){
    throw new Error(`${label} requires one REFERENCES and three FULFILLS links: ${JSON.stringify(state.links)}`);
  }
}

try{
  const ids=await demoIds(runtime);
  if(ids.materialIssueAppId.length===0) throw new Error('Material Issue application is not installed.');

  const suffix=Date.now();
  const poNo=`PO-C04-REPLAY-${suffix}`;
  const demandNo=`PD-C04-REPLAY-${suffix}`;
  const supplier='SUPPLIER-C04';
  const raw='RM-100';
  const finished='FG-100';
  const rawWarehouse='RM';
  const fgWarehouse='FG';
  const project=`MFG-REPLAY-${suffix}`;
  const factIds:string[]=[];

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
  factIds.push(po.businessDataId);

  const receipt=await runtime.command.execute({
    enterpriseId:ids.enterpriseId,applicationInstanceId:ids.inventoryAppId,
    commandCode:'receive-purchase-order',actor:{type:'AUTOMATION',id:'demo-automation'},
    requestId:`${poNo}:receipt`,correlationId:`P2P:${poNo}`,causationId:po.businessDataId,idempotencyKey:`${poNo}:receipt`,
    input:{movementType:'PURCHASE_RECEIPT',receiptNo:`GR-${suffix}`,orderNo:poNo,supplier,productId:raw,
      warehouse:rawWarehouse,quantity:100,totalCost:'1000.00',currency:'CNY',project,department:'PROCUREMENT',costCenter:'CC-MFG'},
    effectiveAt:new Date('2026-09-22T02:00:00.000Z'),businessObjectKey:`GR-${suffix}`,
    lineage:{flowDefinitionId:ids.procureToPayFlowDefinitionId,flowInstanceKey:poNo,stepCode:'goods-received',
      parentBusinessDataId:po.businessDataId,relationType:'FULFILLS'}
  });
  await runtime.flow.projectCommand(receipt.commandExecutionId);
  await drainPosting(runtime,ids.enterpriseId);
  factIds.push(receipt.businessDataId);

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
  factIds.push(demand.businessDataId);

  const issue=await runtime.command.execute({
    enterpriseId:ids.enterpriseId,applicationInstanceId:ids.materialIssueAppId,
    commandCode:'issue-material',actor:{type:'AUTOMATION',id:'demo-automation'},
    requestId:`${demandNo}:issue:1`,correlationId:`MFG:${demandNo}`,causationId:demand.businessDataId,idempotencyKey:`${demandNo}:issue:1`,
    input:{issueNo:`MI-${suffix}`,orderNo:demandNo,productId:raw,warehouse:rawWarehouse,quantity:20,
      project,department:'PRODUCTION',costCenter:'CC-MFG'},
    effectiveAt:new Date('2026-09-22T04:00:00.000Z'),businessObjectKey:`MI-${suffix}`,
    lineage:{flowDefinitionId:ids.manufacturingFlowDefinitionId,flowInstanceKey:demandNo,stepCode:'material-issued',
      parentBusinessDataId:demand.businessDataId,relationType:'REFERENCES'}
  });
  await runtime.flow.projectCommand(issue.commandExecutionId);
  await drainPosting(runtime,ids.enterpriseId);
  factIds.push(issue.businessDataId);

  const fifoPolicy=await runtime.db.selectFrom('valuation_policy').select(['id','version'])
    .where('enterprise_id','=',ids.enterpriseId).where('method','=','FIFO').where('status','=','ACTIVE')
    .orderBy('version','desc').executeTakeFirstOrThrow();
  const fifoAllocation=await runtime.db.selectFrom('allocation_policy').select(['id','version'])
    .where('enterprise_id','=',ids.enterpriseId).where('code','=','inventory_fifo').where('status','=','PUBLISHED')
    .orderBy('version','desc').executeTakeFirstOrThrow();
  const materialRule=await runtime.db.selectFrom('valuation_rule').select(['id','version'])
    .where('enterprise_id','=',ids.enterpriseId).where('source_business_data_type','=','material_issue.issued')
    .where('status','=','PUBLISHED').orderBy('version','desc').executeTakeFirstOrThrow();
  const shipmentRule=await runtime.db.selectFrom('valuation_rule').select(['id','version'])
    .where('enterprise_id','=',ids.enterpriseId).where('source_business_data_type','=','sales_shipment.created')
    .where('status','=','PUBLISHED').orderBy('version','desc').executeTakeFirstOrThrow();

  await runtime.cost.recalculate(ids.enterpriseId,'FIFO',{
    valuationPolicyId:fifoPolicy.id,valuationPolicyVersion:fifoPolicy.version,
    allocationPolicyId:fifoAllocation.id,allocationPolicyVersion:fifoAllocation.version,
    valuationRules:{
      'material_issue.issued':{id:materialRule.id,version:materialRule.version},
      'sales_shipment.created':{id:shipmentRule.id,version:shipmentRule.version}
    }
  });
  await runtime.work.refresh(ids.enterpriseId);

  const completions=[
    {quantity:20,totalCost:'80.00',effectiveAt:'2026-09-22T05:00:00.000Z'},
    {quantity:30,totalCost:'120.00',effectiveAt:'2026-09-22T06:00:00.000Z'}
  ];
  for(let index=0;index<completions.length;index+=1){
    const part=completions[index]!;
    const completed=await runtime.command.execute({
      enterpriseId:ids.enterpriseId,applicationInstanceId:ids.productionAppId,
      commandCode:'complete-production',actor:{type:'AUTOMATION',id:'demo-automation'},
      requestId:`${demandNo}:complete:${index+1}`,correlationId:`MFG:${demandNo}`,causationId:demand.businessDataId,
      idempotencyKey:`${demandNo}:complete:${index+1}`,
      input:{orderNo:demandNo,customer:null,productId:finished,warehouse:fgWarehouse,quantity:part.quantity,totalCost:part.totalCost,
        materialProductId:raw,materialWarehouse:rawWarehouse,project,department:'PRODUCTION',
        profitCenter:'PC-MFG',costCenter:'CC-MFG'},
      effectiveAt:new Date(part.effectiveAt),businessObjectKey:`PROD:${demandNo}:${index+1}`,
      lineage:{flowDefinitionId:ids.manufacturingFlowDefinitionId,flowInstanceKey:demandNo,stepCode:'production-completed',
        parentBusinessDataId:demand.businessDataId,relationType:'FULFILLS'}
    });
    await runtime.flow.projectCommand(completed.commandExecutionId);
    await drainPosting(runtime,ids.enterpriseId);
    factIds.push(completed.businessDataId);
  }

  const before=await snapshot(
    ids.enterpriseId,demandNo,raw,rawWarehouse,finished,fgWarehouse,issue.businessDataId,factIds
  );
  assertManufacturingClosed(before,'Before Full Replay');

  const state=await runtime.db.selectFrom('enterprise_runtime_state')
    .select(['consistency_domain','next_posting_sequence'])
    .where('enterprise_id','=',ids.enterpriseId)
    .executeTakeFirstOrThrow();
  const boundary=BigInt(state.next_posting_sequence)-1n;
  const beforeInput=await computeReplayInputDigest(runtime.db,ids.enterpriseId,state.consistency_domain,boundary);
  const beforeEconomic=await computeEconomicRuntimeDigest(runtime.db,ids.enterpriseId,state.consistency_domain,boundary);
  const beforeFamilies=await economicFamilies(ids.enterpriseId,state.consistency_domain,boundary);

  const replay=await runtime.replay.prepareFullReplay(ids.enterpriseId);
  if(replay.boundarySequence!==boundary){
    throw new Error(`Replay boundary changed: expected ${boundary}, got ${replay.boundarySequence}`);
  }

  await drainPosting(runtime,ids.enterpriseId);
  if(replay.costMethod!==null){
    await runtime.cost.recalculate(ids.enterpriseId,replay.costMethod,replay.costPins??undefined);
  }
  await runtime.work.refresh(ids.enterpriseId);

  const after=await snapshot(
    ids.enterpriseId,demandNo,raw,rawWarehouse,finished,fgWarehouse,issue.businessDataId,factIds
  );
  assertManufacturingClosed(after,'After Full Replay');

  const afterInput=await computeReplayInputDigest(runtime.db,ids.enterpriseId,state.consistency_domain,boundary);
  const afterEconomic=await computeEconomicRuntimeDigest(runtime.db,ids.enterpriseId,state.consistency_domain,boundary);
  const afterFamilies=await economicFamilies(ids.enterpriseId,state.consistency_domain,boundary);
  await runtime.replay.completeFullReplay(replay.replayRunId,ids.enterpriseId,afterEconomic);

  if(beforeInput.digest!==afterInput.digest||beforeInput.count!==afterInput.count||beforeInput.lastIncludedFactId!==afterInput.lastIncludedFactId){
    throw new Error(`Canonical replay input changed: before=${JSON.stringify(beforeInput)} after=${JSON.stringify(afterInput)}`);
  }
  if(beforeEconomic!==afterEconomic||replay.beforeDigest!==beforeEconomic){
    const changedFamily=(Object.keys(beforeFamilies) as Array<keyof typeof beforeFamilies>)
      .find(key=>JSON.stringify(beforeFamilies[key])!==JSON.stringify(afterFamilies[key]));
    throw new Error(`Economic digest mismatch in ${String(changedFamily)}: before=${JSON.stringify(changedFamily===undefined?null:beforeFamilies[changedFamily])} after=${JSON.stringify(changedFamily===undefined?null:afterFamilies[changedFamily])}`);
  }
  if(JSON.stringify(before.facts)!==JSON.stringify(after.facts)){
    throw new Error('Canonical manufacturing BusinessData changed across Full Replay.');
  }
  if(JSON.stringify(before.links)!==JSON.stringify(after.links)){
    throw new Error('Explicit manufacturing BusinessObjectLinks changed across Full Replay.');
  }
  const beforeDerived={raw:before.raw,finishedTotal:before.finishedTotal,pending:before.pending,wip:before.wip,
    finished:before.finished,work:before.work,issueCost:before.issueCost};
  const afterDerived={raw:after.raw,finishedTotal:after.finishedTotal,pending:after.pending,wip:after.wip,
    finished:after.finished,work:after.work,issueCost:after.issueCost};
  if(JSON.stringify(beforeDerived)!==JSON.stringify(afterDerived)){
    throw new Error(`Manufacturing derived state changed across Full Replay: before=${JSON.stringify(beforeDerived)} after=${JSON.stringify(afterDerived)}`);
  }

  const run=await runtime.db.selectFrom('replay_run')
    .select(['status','validation_status','before_digest','after_digest'])
    .where('id','=',replay.replayRunId)
    .executeTakeFirstOrThrow();
  if(run.status!=='COMPLETED'||run.validation_status!=='MATCH'||run.before_digest!==beforeEconomic||run.after_digest!==afterEconomic){
    throw new Error(`Replay run did not persist MATCH evidence: ${JSON.stringify(run)}`);
  }

  console.log(JSON.stringify({
    status:'PASS',
    packet:'EEL-C04.6',
    demandNo,
    canonicalFacts:before.facts.map(row=>row.business_data_type),
    explicitRelations:{references:before.links.filter(row=>row.relation_type==='REFERENCES').length,
      fulfills:before.links.filter(row=>row.relation_type==='FULFILLS').length},
    rawMaterialFinal:after.raw,
    finishedGoodsFinal:after.finishedTotal,
    manufacturingWipFinal:after.wip?.amount,
    pendingProductionFinal:after.pending?.quantity,
    produceWorkFinal:after.work[0]?.status,
    materialIssueFifoCost:after.issueCost.total_cost,
    canonicalHistoryPreserved:true,
    explicitRelationshipsPreserved:true,
    inventoryRebuiltIdentically:true,
    costRebuiltIdentically:true,
    workRebuiltFromBalances:true,
    replayDeterministic:true,
    beforeDigest:beforeEconomic,
    afterDigest:afterEconomic
  },null,2));
}finally{
  await database.destroy();
}

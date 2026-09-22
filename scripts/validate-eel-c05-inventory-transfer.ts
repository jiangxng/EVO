import { Decimal } from 'decimal.js';
import { createDatabase } from '../platform/database/src/index.js';
import { loadRuntimeConfig } from '../platform/runtime/src/config.js';
import { createEvoRuntime, demoIds, drainPosting } from '../apps/api/src/evo-runtime.js';

const config=loadRuntimeConfig();
const database=createDatabase(config.databaseUrl);
const runtime=createEvoRuntime(database);

function dim(dimensions:unknown,key:string):string|undefined{
  if(dimensions===null||typeof dimensions!=='object'||Array.isArray(dimensions)) return undefined;
  const value=(dimensions as Record<string,unknown>)[key];
  return value===null||value===undefined?undefined:String(value);
}

async function inventoryByWarehouse(enterpriseId:string,productId:string,warehouse:string){
  const rows=await runtime.db.selectFrom('ledger_balance as b')
    .innerJoin('ledger_definition as d','d.id','b.ledger_definition_id')
    .innerJoin('ledger_dataset as ds','ds.id','b.ledger_dataset_id')
    .select(['b.quantity','b.amount','b.dimensions'])
    .where('b.enterprise_id','=',enterpriseId)
    .where('d.code','=','inventory')
    .where('ds.kind','=','CURRENT')
    .where('ds.status','=','ACTIVE')
    .execute();
  return rows
    .filter(r=>dim(r.dimensions,'product_id')===productId&&dim(r.dimensions,'warehouse')===warehouse)
    .reduce((acc,row)=>({
      quantity:acc.quantity.plus(row.quantity),
      amount:acc.amount.plus(row.amount)
    }),{quantity:new Decimal(0),amount:new Decimal(0)});
}

async function pendingTransfer(enterpriseId:string,transferNo:string){
  const rows=await runtime.db.selectFrom('ledger_balance as b')
    .innerJoin('ledger_definition as d','d.id','b.ledger_definition_id')
    .innerJoin('ledger_dataset as ds','ds.id','b.ledger_dataset_id')
    .select(['b.quantity','b.amount','b.dimensions'])
    .where('b.enterprise_id','=',enterpriseId)
    .where('d.code','=','pending_transfer')
    .where('ds.kind','=','CURRENT')
    .where('ds.status','=','ACTIVE')
    .execute();
  return rows.find(r=>dim(r.dimensions,'order_no')===transferNo);
}

async function transferWork(enterpriseId:string,transferNo:string){
  const rows=await runtime.db.selectFrom('work_item')
    .select(['work_type','status','source_quantity','source_dimensions'])
    .where('enterprise_id','=',enterpriseId)
    .where('source_ledger_code','=','pending_transfer')
    .execute();
  return rows.find(r=>dim(r.source_dimensions,'order_no')===transferNo);
}

async function recalcCost(enterpriseId:string){
  const fifoPolicy=await runtime.db.selectFrom('valuation_policy').select(['id','version'])
    .where('enterprise_id','=',enterpriseId).where('method','=','FIFO').where('status','=','ACTIVE')
    .orderBy('version','desc').executeTakeFirstOrThrow();
  const fifoAllocation=await runtime.db.selectFrom('allocation_policy').select(['id','version'])
    .where('enterprise_id','=',enterpriseId).where('code','=','inventory_fifo').where('status','=','PUBLISHED')
    .orderBy('version','desc').executeTakeFirstOrThrow();
  const ruleRows=await runtime.db.selectFrom('valuation_rule').select(['id','version','source_business_data_type'])
    .where('enterprise_id','=',enterpriseId).where('status','=','PUBLISHED').execute();
  const valuationRules=Object.fromEntries(ruleRows.map(r=>[
    r.source_business_data_type,{id:r.id,version:r.version}
  ]));
  await runtime.cost.recalculate(enterpriseId,'FIFO',{
    valuationPolicyId:fifoPolicy.id,
    valuationPolicyVersion:fifoPolicy.version,
    allocationPolicyId:fifoAllocation.id,
    allocationPolicyVersion:fifoAllocation.version,
    valuationRules
  });
  await runtime.work.refresh(enterpriseId);
}

try{
  const ids=await demoIds(runtime);
  if(ids.inventoryTransferAppId.length===0) throw new Error('Inventory Transfer app is not installed.');

  const suffix=Date.now();
  const poNo=`PO-C05-${suffix}`;
  const transferNo=`TR-C05-${suffix}`;
  const productId='P-100';
  const sourceWarehouse='A';
  const destinationWarehouse='B';
  const project=`TRANSFER-${suffix}`;

  const po=await runtime.command.execute({
    enterpriseId:ids.enterpriseId,applicationInstanceId:ids.procurementAppId,
    commandCode:'approve-purchase-order',actor:{type:'AUTOMATION',id:'demo-automation'},
    requestId:`${poNo}:approve`,correlationId:`P2P:${poNo}`,idempotencyKey:`${poNo}:approve`,
    input:{orderNo:poNo,supplier:'SUP-C05',productId,warehouse:sourceWarehouse,quantity:100,
      unitPrice:'10.00',totalAmount:'1000.00',currency:'CNY',project,department:'PROCUREMENT',costCenter:'CC-INV'},
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
    input:{movementType:'PURCHASE_RECEIPT',receiptNo:`GR-${suffix}`,orderNo:poNo,supplier:'SUP-C05',
      productId,warehouse:sourceWarehouse,quantity:100,totalCost:'1000.00',currency:'CNY',
      project,department:'PROCUREMENT',costCenter:'CC-INV'},
    effectiveAt:new Date('2026-09-22T02:00:00.000Z'),businessObjectKey:`GR-${suffix}`,
    lineage:{flowDefinitionId:ids.procureToPayFlowDefinitionId,flowInstanceKey:poNo,stepCode:'goods-received',
      parentBusinessDataId:poFact.id,relationType:'FULFILLS'}
  });
  await runtime.flow.projectCommand(receipt.commandExecutionId);
  await drainPosting(runtime,ids.enterpriseId);

  const initialA=await inventoryByWarehouse(ids.enterpriseId,productId,sourceWarehouse);
  if(!initialA.quantity.eq(100)||!initialA.amount.eq(1000)){
    throw new Error(`Initial A inventory must be 100 / 1000: ${JSON.stringify({q:initialA.quantity.toString(),a:initialA.amount.toString()})}`);
  }

  const created=await runtime.command.execute({
    enterpriseId:ids.enterpriseId,applicationInstanceId:ids.inventoryTransferAppId,
    commandCode:'create-transfer',actor:{type:'AUTOMATION',id:'demo-automation'},
    requestId:`${transferNo}:create`,correlationId:`TRANSFER:${transferNo}`,idempotencyKey:`${transferNo}:create`,
    input:{transferEvent:'CREATE',transferNo,productId,sourceWarehouse,destinationWarehouse,quantity:40,
      project,department:'WAREHOUSE',costCenter:'CC-INV'},
    effectiveAt:new Date('2026-09-22T03:00:00.000Z'),businessObjectKey:transferNo,
    lineage:{flowDefinitionId:ids.inventoryTransferFlowDefinitionId,flowInstanceKey:transferNo,stepCode:'transfer-created'}
  });
  await runtime.flow.projectCommand(created.commandExecutionId);
  await drainPosting(runtime,ids.enterpriseId);
  const createdFact=await runtime.db.selectFrom('business_data').select('id')
    .where('command_execution_id','=',created.commandExecutionId).executeTakeFirstOrThrow();

  let pending=await pendingTransfer(ids.enterpriseId,transferNo);
  let work=await transferWork(ids.enterpriseId,transferNo);
  if(pending===undefined||!new Decimal(pending.quantity).eq(40)||work?.status!=='OPEN'){
    throw new Error(`Transfer create must open 40 / OPEN: ${JSON.stringify({pending,work})}`);
  }

  const issued=await runtime.command.execute({
    enterpriseId:ids.enterpriseId,applicationInstanceId:ids.inventoryTransferAppId,
    commandCode:'issue-transfer',actor:{type:'AUTOMATION',id:'demo-automation'},
    requestId:`${transferNo}:issue`,correlationId:`TRANSFER:${transferNo}`,causationId:createdFact.id,
    idempotencyKey:`${transferNo}:issue`,
    input:{transferEvent:'ISSUE',transferNo,productId,sourceWarehouse,destinationWarehouse,quantity:40,
      project,department:'WAREHOUSE',costCenter:'CC-INV'},
    effectiveAt:new Date('2026-09-22T04:00:00.000Z'),businessObjectKey:`${transferNo}:ISSUE`,
    lineage:{flowDefinitionId:ids.inventoryTransferFlowDefinitionId,flowInstanceKey:transferNo,stepCode:'transfer-issued',
      parentBusinessDataId:createdFact.id,relationType:'REFERENCES'}
  });
  await runtime.flow.projectCommand(issued.commandExecutionId);
  await drainPosting(runtime,ids.enterpriseId);
  const issuedFact=await runtime.db.selectFrom('business_data').select('id')
    .where('command_execution_id','=',issued.commandExecutionId).executeTakeFirstOrThrow();

  // v0.1 recognition policy: official warehouse Inventory changes at destination receipt.
  const afterIssueA=await inventoryByWarehouse(ids.enterpriseId,productId,sourceWarehouse);
  if(!afterIssueA.quantity.eq(100)||!afterIssueA.amount.eq(1000)){
    throw new Error('Issue fact must not prematurely alter official Inventory under destination-receipt recognition.');
  }

  const parts=[15,25];
  const expected=[
    {aq:85,aa:850,bq:15,ba:150,pending:25,status:'OPEN'},
    {aq:60,aa:600,bq:40,ba:400,pending:0,status:'DONE'}
  ];

  const receiptFactIds:string[]=[];
  for(let i=0;i<parts.length;i+=1){
    const qty=parts[i]!;
    const received=await runtime.command.execute({
      enterpriseId:ids.enterpriseId,applicationInstanceId:ids.inventoryTransferAppId,
      commandCode:'receive-transfer',actor:{type:'AUTOMATION',id:'demo-automation'},
      requestId:`${transferNo}:receive:${i+1}`,correlationId:`TRANSFER:${transferNo}`,causationId:issuedFact.id,
      idempotencyKey:`${transferNo}:receive:${i+1}`,
      input:{transferEvent:'RECEIVE',transferNo,productId,sourceWarehouse,destinationWarehouse,
        warehouse:sourceWarehouse,quantity:qty,project,department:'WAREHOUSE',costCenter:'CC-INV'},
      effectiveAt:new Date(`2026-09-22T0${5+i}:00:00.000Z`),businessObjectKey:`${transferNo}:RECEIVE:${i+1}`,
      lineage:{flowDefinitionId:ids.inventoryTransferFlowDefinitionId,flowInstanceKey:transferNo,stepCode:'transfer-received',
        parentBusinessDataId:issuedFact.id,relationType:'FULFILLS'}
    });
    await runtime.flow.projectCommand(received.commandExecutionId);
    await drainPosting(runtime,ids.enterpriseId);
    const receivedFact=await runtime.db.selectFrom('business_data').select('id')
      .where('command_execution_id','=',received.commandExecutionId).executeTakeFirstOrThrow();
    receiptFactIds.push(receivedFact.id);

    await recalcCost(ids.enterpriseId);

    const a=await inventoryByWarehouse(ids.enterpriseId,productId,sourceWarehouse);
    const b=await inventoryByWarehouse(ids.enterpriseId,productId,destinationWarehouse);
    pending=await pendingTransfer(ids.enterpriseId,transferNo);
    work=await transferWork(ids.enterpriseId,transferNo);
    const e=expected[i]!;

    if(!a.quantity.eq(e.aq)||!a.amount.eq(e.aa)||!b.quantity.eq(e.bq)||!b.amount.eq(e.ba)){
      throw new Error(`Warehouse balances mismatch after receipt ${i+1}: A=${a.quantity}/${a.amount}, B=${b.quantity}/${b.amount}`);
    }
    if(pending===undefined||!new Decimal(pending.quantity).eq(e.pending)||work?.status!==e.status){
      throw new Error(`Pending/Work mismatch after receipt ${i+1}: ${JSON.stringify({pending,work})}`);
    }
    if(!a.quantity.plus(b.quantity).eq(100)||!a.amount.plus(b.amount).eq(1000)){
      throw new Error(`Enterprise inventory conservation failed after receipt ${i+1}.`);
    }

    const cost=await runtime.db.selectFrom('cost_result as c')
      .innerJoin('cost_run as r','r.id','c.cost_run_id')
      .select(['c.quantity','c.total_cost'])
      .where('r.enterprise_id','=',ids.enterpriseId)
      .where('c.business_data_id','=',receivedFact.id)
      .orderBy('r.started_at','desc').executeTakeFirstOrThrow();
    const expectedCost=i===0?150:250;
    if(!new Decimal(cost.total_cost).eq(expectedCost)){
      throw new Error(`Receipt ${i+1} must derive FIFO cost ${expectedCost}, got ${cost.total_cost}`);
    }
  }

  const transferFactIds=[createdFact.id,issuedFact.id,...receiptFactIds];
  const sideEffects=await runtime.db.selectFrom('ledger_entry as e')
    .innerJoin('ledger_definition as d','d.id','e.ledger_definition_id')
    .select(['d.code as ledger','e.business_data_id','e.quantity','e.amount'])
    .where('e.enterprise_id','=',ids.enterpriseId)
    .where('e.business_data_id','in',transferFactIds)
    .execute();
  const forbidden=['revenue','cogs','expense','receivable','payable','cash'];
  const forbiddenRows=sideEffects.filter(r=>forbidden.includes(r.ledger));
  if(forbiddenRows.length>0){
    throw new Error(`Pure transfer created forbidden economic side effects: ${JSON.stringify(forbiddenRows)}`);
  }

  const links=await runtime.db.selectFrom('business_object_link')
    .select(['from_business_data_id','to_business_data_id','relation_type'])
    .where('enterprise_id','=',ids.enterpriseId)
    .where('from_business_data_id','in',[createdFact.id,issuedFact.id])
    .execute();
  const createdToIssue=links.filter(l=>l.from_business_data_id===createdFact.id&&l.to_business_data_id===issuedFact.id&&l.relation_type==='REFERENCES');
  const issueToReceipts=links.filter(l=>l.from_business_data_id===issuedFact.id&&receiptFactIds.includes(l.to_business_data_id)&&l.relation_type==='FULFILLS');
  if(createdToIssue.length!==1||issueToReceipts.length!==2){
    throw new Error(`Transfer lineage mismatch: ${JSON.stringify(links)}`);
  }

  console.log(JSON.stringify({
    status:'PASS',
    packet:'EEL-C05',
    transferNo,
    recognitionPolicy:'DESTINATION_RECEIPT',
    sequence:{
      created:40,
      issued:40,
      received:[15,25],
      pending:[40,25,0],
      work:['OPEN','OPEN','DONE']
    },
    final:{
      source:{quantity:'60',amount:'600'},
      destination:{quantity:'40',amount:'400'},
      enterprise:{quantity:'100',amount:'1000'}
    },
    derivedTransferCosts:['150','250'],
    quantityConserved:true,
    valueConserved:true,
    forbiddenSideEffects:false,
    explicitLineage:true,
    newWmsRuntimeRequired:false
  },null,2));
}finally{
  await database.destroy();
}

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

function orderNoOf(dimensions:unknown):string|undefined{
  if(dimensions===null||typeof dimensions!=='object'||Array.isArray(dimensions)) return undefined;
  const value=(dimensions as Record<string,unknown>).order_no;
  return typeof value==='string'?value:undefined;
}

async function snapshot(
  enterpriseId:string,
  orderNo:string,
  factIds:string[]
){
  const balances=await runtime.db.selectFrom('ledger_balance as b')
    .innerJoin('ledger_definition as d','d.id','b.ledger_definition_id')
    .innerJoin('ledger_dataset as ds','ds.id','b.ledger_dataset_id')
    .select(['d.code as ledger','b.quantity','b.amount','b.dimensions'])
    .where('b.enterprise_id','=',enterpriseId)
    .where('ds.kind','=','CURRENT')
    .where('ds.status','=','ACTIVE')
    .where('d.code','in',[
      'pending_production','pending_shipment','receivable','cash','inventory',
      'sales_invoice_amount','pending_exchange','pending_refund','pending_red_invoice'
    ])
    .execute();
  const scopedBalances=balances
    .filter(r=>orderNoOf(r.dimensions)===orderNo)
    .sort((a,b)=>a.ledger.localeCompare(b.ledger))
    .map(r=>({ledger:r.ledger,quantity:r.quantity,amount:r.amount}));

  const work=(await runtime.db.selectFrom('work_item')
    .select(['work_type','status','source_ledger_code','source_quantity','source_amount','source_dimensions'])
    .where('enterprise_id','=',enterpriseId)
    .execute())
    .filter(r=>orderNoOf(r.source_dimensions)===orderNo)
    .sort((a,b)=>a.source_ledger_code.localeCompare(b.source_ledger_code))
    .map(r=>({
      workType:r.work_type,status:r.status,ledger:r.source_ledger_code,
      quantity:r.source_quantity,amount:r.source_amount
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
    .filter(r=>factIds.includes(r.from_business_data_id)&&factIds.includes(r.to_business_data_id))
    .sort((a,b)=>
      a.from_business_data_id.localeCompare(b.from_business_data_id) ||
      a.to_business_data_id.localeCompare(b.to_business_data_id) ||
      a.relation_type.localeCompare(b.relation_type)
    );

  return {balances:scopedBalances,work,facts,links};
}

type ReverseFlowSnapshot = Awaited<ReturnType<typeof snapshot>>;

function amount(state:ReverseFlowSnapshot,ledger:string){
  const row=state.balances.find(r=>r.ledger===ledger);
  if(row===undefined) throw new Error(`Missing balance ${ledger}`);
  return new Decimal(row.amount);
}
function quantity(state:ReverseFlowSnapshot,ledger:string){
  const row=state.balances.find(r=>r.ledger===ledger);
  if(row===undefined) throw new Error(`Missing balance ${ledger}`);
  return new Decimal(row.quantity);
}

function assertClosed(s:ReverseFlowSnapshot,label:string){
  if(!quantity(s,'pending_production').eq(0)) throw new Error(`${label} pending_production not closed`);
  if(!quantity(s,'pending_shipment').eq(0)) throw new Error(`${label} pending_shipment not closed`);
  if(!amount(s,'receivable').eq(0)) throw new Error(`${label} receivable not closed`);
  if(!amount(s,'cash').eq(600)) throw new Error(`${label} cash must be 600 after 1000 receipt - 400 refund`);
  if(!quantity(s,'inventory').eq(0)) throw new Error(`${label} inventory quantity must return to zero after return+exchange`);
  if(!amount(s,'sales_invoice_amount').eq(600)) throw new Error(`${label} sales invoice balance must be 600`);
  if(!quantity(s,'pending_exchange').eq(0)) throw new Error(`${label} pending_exchange not closed`);
  if(!amount(s,'pending_refund').eq(0)) throw new Error(`${label} pending_refund not closed`);
  if(!amount(s,'pending_red_invoice').eq(0)) throw new Error(`${label} pending_red_invoice not closed`);

  const reverseWork=s.work.filter(r=>['pending_exchange','pending_refund','pending_red_invoice'].includes(r.ledger));
  if(reverseWork.length!==3||reverseWork.some(r=>r.status!=='DONE')){
    throw new Error(`${label} reverse Work must be exactly three DONE items: ${JSON.stringify(reverseWork)}`);
  }

  const types=s.facts.map(f=>f.business_data_type);
  const expected=[
    'sales_order.approved','production.completed','sales_shipment.created','cash.received',
    'sales_invoice.issued','sales_return.received','sales_exchange.created','cash.refunded','sales_red_invoice.issued'
  ];
  for(const type of expected){
    if(types.filter(x=>x===type).length!==1){
      throw new Error(`${label} expected exactly one ${type}: ${JSON.stringify(types)}`);
    }
  }
  if(s.links.filter(l=>l.relation_type==='REFERENCES').length<4){
    throw new Error(`${label} requires at least four explicit REFERENCES links: ${JSON.stringify(s.links)}`);
  }
}

try{
  const ids=await demoIds(runtime);
  const suffix=Date.now();
  const orderNo=`SO-C03-REPLAY-${suffix}`;
  const correlationId=`C03:${orderNo}`;
  const customer='CUSTOMER-C03';
  const project=`PROJECT-${suffix}`;
  const base={orderNo,customer,project,department:'SALES',profitCenter:'PC-C03',costCenter:'CC-SALES'};

  const factIds:string[]=[];

  const order=await runtime.command.execute({
    enterpriseId:ids.enterpriseId,applicationInstanceId:ids.salesAppId,commandCode:'approve-sales-order',
    actor:{type:'AUTOMATION',id:'demo-automation'},requestId:`${orderNo}:order`,correlationId,idempotencyKey:`${orderNo}:order`,
    input:{...base,eventKind:'ORDER',productId:'P-100',quantity:10,unitPrice:'100.00',totalAmount:'1000.00',currency:'CNY',fulfillmentMode:'MAKE'},
    effectiveAt:new Date('2026-09-22T01:00:00.000Z'),businessObjectKey:orderNo
  });
  factIds.push(order.businessDataId);
  await drainPosting(runtime,ids.enterpriseId);

  const production=await runtime.command.execute({
    enterpriseId:ids.enterpriseId,applicationInstanceId:ids.productionAppId,commandCode:'complete-production',
    actor:{type:'AUTOMATION',id:'demo-automation'},requestId:`${orderNo}:production`,correlationId,causationId:order.businessDataId,idempotencyKey:`${orderNo}:production`,
    input:{...base,productId:'P-100',warehouse:'HK',quantity:10,totalCost:'100.00'},
    effectiveAt:new Date('2026-09-22T02:00:00.000Z'),businessObjectKey:`PROD:${orderNo}`
  });
  factIds.push(production.businessDataId);
  await drainPosting(runtime,ids.enterpriseId);

  const shipment=await runtime.command.execute({
    enterpriseId:ids.enterpriseId,applicationInstanceId:ids.inventoryAppId,commandCode:'ship-sales-order',
    actor:{type:'AUTOMATION',id:'demo-automation'},requestId:`${orderNo}:shipment`,correlationId,causationId:order.businessDataId,idempotencyKey:`${orderNo}:shipment`,
    input:{...base,movementType:'SHIP',shipmentNo:`SHIP-${suffix}`,productId:'P-100',warehouse:'HK',quantity:10},
    effectiveAt:new Date('2026-09-22T03:00:00.000Z'),businessObjectKey:`SHIP-${suffix}`
  });
  factIds.push(shipment.businessDataId);
  await drainPosting(runtime,ids.enterpriseId);

  const receipt=await runtime.command.execute({
    enterpriseId:ids.enterpriseId,applicationInstanceId:ids.cashAppId,commandCode:'record-receipt',
    actor:{type:'AUTOMATION',id:'demo-automation'},requestId:`${orderNo}:receipt`,correlationId,causationId:order.businessDataId,idempotencyKey:`${orderNo}:receipt`,
    input:{...base,semanticRole:'CUSTOMER_CASH_RECEIPT',settledAmount:'1000.00',settledCurrency:'CNY',cashAmount:'1000.00',cashCurrency:'CNY'},
    effectiveAt:new Date('2026-09-22T04:00:00.000Z'),businessObjectKey:`RECEIPT:${orderNo}`
  });
  factIds.push(receipt.businessDataId);
  await drainPosting(runtime,ids.enterpriseId);

  const blue=await runtime.command.execute({
    enterpriseId:ids.enterpriseId,applicationInstanceId:ids.salesInvoiceAppId,commandCode:'issue-sales-invoice',
    actor:{type:'AUTOMATION',id:'demo-automation'},requestId:`${orderNo}:blue`,correlationId,causationId:order.businessDataId,idempotencyKey:`${orderNo}:blue`,
    input:{...base,invoiceKind:'BLUE',invoiceNo:`BLUE-${suffix}`,invoiceAmount:'1000.00',currency:'CNY',taxIdentity:'DEMO-TAXPAYER-ID'},
    effectiveAt:new Date('2026-09-22T05:00:00.000Z'),businessObjectKey:`BLUE-${suffix}`,
    lineage:{flowDefinitionId:ids.flowDefinitionId,flowInstanceKey:orderNo,stepCode:'sales-invoice-issued',parentBusinessDataId:order.businessDataId,relationType:'REFERENCES'}
  });
  factIds.push(blue.businessDataId);
  await runtime.flow.projectCommand(blue.commandExecutionId);
  await drainPosting(runtime,ids.enterpriseId);

  const returned=await runtime.command.execute({
    enterpriseId:ids.enterpriseId,applicationInstanceId:ids.salesReturnAppId,commandCode:'receive-sales-return',
    actor:{type:'AUTOMATION',id:'demo-automation'},requestId:`${orderNo}:return`,correlationId,causationId:shipment.businessDataId,idempotencyKey:`${orderNo}:return`,
    input:{...base,returnNo:`RET-${suffix}`,productId:'P-100',warehouse:'HK',quantity:4,returnCost:'40.00',currency:'CNY',
      requiresExchange:true,exchangeQuantity:4,requiresRefund:true,refundAmount:'400.00',requiresRedInvoice:true,redInvoiceAmount:'400.00'},
    effectiveAt:new Date('2026-09-22T06:00:00.000Z'),businessObjectKey:`RET-${suffix}`,
    lineage:{flowDefinitionId:ids.flowDefinitionId,flowInstanceKey:orderNo,stepCode:'sales-return-received',parentBusinessDataId:shipment.businessDataId,relationType:'REFERENCES'}
  });
  factIds.push(returned.businessDataId);
  await runtime.flow.projectCommand(returned.commandExecutionId);
  await drainPosting(runtime,ids.enterpriseId);

  const exchange=await runtime.command.execute({
    enterpriseId:ids.enterpriseId,applicationInstanceId:ids.salesExchangeAppId,commandCode:'create-sales-exchange',
    actor:{type:'AUTOMATION',id:'demo-automation'},requestId:`${orderNo}:exchange`,correlationId,causationId:returned.businessDataId,idempotencyKey:`${orderNo}:exchange`,
    input:{...base,exchangeNo:`EX-${suffix}`,originalProductId:'P-100',replacementProductId:'P-100',warehouse:'HK',replacementQuantity:4,replacementCost:'40.00',currency:'CNY'},
    effectiveAt:new Date('2026-09-22T07:00:00.000Z'),businessObjectKey:`EX-${suffix}`,
    lineage:{flowDefinitionId:ids.flowDefinitionId,flowInstanceKey:orderNo,stepCode:'sales-exchange-created',parentBusinessDataId:returned.businessDataId,relationType:'REFERENCES'}
  });
  factIds.push(exchange.businessDataId);
  await runtime.flow.projectCommand(exchange.commandExecutionId);
  await drainPosting(runtime,ids.enterpriseId);

  const refund=await runtime.command.execute({
    enterpriseId:ids.enterpriseId,applicationInstanceId:ids.cashRefundAppId,commandCode:'record-customer-refund',
    actor:{type:'AUTOMATION',id:'demo-automation'},requestId:`${orderNo}:refund`,correlationId,causationId:receipt.businessDataId,idempotencyKey:`${orderNo}:refund`,
    input:{...base,refundNo:`RF-${suffix}`,refundAmount:'400.00',currency:'CNY',reason:'RETURN'},
    effectiveAt:new Date('2026-09-22T08:00:00.000Z'),businessObjectKey:`RF-${suffix}`,
    lineage:{flowDefinitionId:ids.flowDefinitionId,flowInstanceKey:orderNo,stepCode:'customer-refund',parentBusinessDataId:receipt.businessDataId,relationType:'REFERENCES'}
  });
  factIds.push(refund.businessDataId);
  await runtime.flow.projectCommand(refund.commandExecutionId);
  await drainPosting(runtime,ids.enterpriseId);

  const red=await runtime.command.execute({
    enterpriseId:ids.enterpriseId,applicationInstanceId:ids.salesInvoiceAppId,commandCode:'issue-sales-red-invoice',
    actor:{type:'AUTOMATION',id:'demo-automation'},requestId:`${orderNo}:red`,correlationId,causationId:blue.businessDataId,idempotencyKey:`${orderNo}:red`,
    input:{...base,invoiceKind:'RED',invoiceNo:`RED-${suffix}`,originalInvoiceNo:`BLUE-${suffix}`,invoiceAmount:'400.00',currency:'CNY',
      fullOrPartial:'PARTIAL',taxIdentity:'DEMO-TAXPAYER-ID'},
    effectiveAt:new Date('2026-09-22T09:00:00.000Z'),businessObjectKey:`RED-${suffix}`,
    lineage:{flowDefinitionId:ids.flowDefinitionId,flowInstanceKey:orderNo,stepCode:'sales-red-invoice-issued',parentBusinessDataId:blue.businessDataId,relationType:'REFERENCES'}
  });
  factIds.push(red.businessDataId);
  await runtime.flow.projectCommand(red.commandExecutionId);
  await drainPosting(runtime,ids.enterpriseId);

  const fifoPolicy=await runtime.db.selectFrom('valuation_policy')
    .select(['id','version']).where('enterprise_id','=',ids.enterpriseId).where('method','=','FIFO').where('status','=','ACTIVE')
    .orderBy('version','desc').executeTakeFirstOrThrow();
  const fifoAllocation=await runtime.db.selectFrom('allocation_policy')
    .select(['id','version']).where('enterprise_id','=',ids.enterpriseId).where('code','=','inventory_fifo').where('status','=','PUBLISHED')
    .orderBy('version','desc').executeTakeFirstOrThrow();
  const valuationRule=await runtime.db.selectFrom('valuation_rule')
    .select(['id','version']).where('enterprise_id','=',ids.enterpriseId).where('source_business_data_type','=','sales_shipment.created').where('status','=','PUBLISHED')
    .orderBy('version','desc').executeTakeFirstOrThrow();
  await runtime.cost.recalculate(ids.enterpriseId,'FIFO',{
    valuationPolicyId:fifoPolicy.id,valuationPolicyVersion:fifoPolicy.version,
    allocationPolicyId:fifoAllocation.id,allocationPolicyVersion:fifoAllocation.version,
    valuationRules:{'sales_shipment.created':{id:valuationRule.id,version:valuationRule.version}}
  });
  await runtime.work.refresh(ids.enterpriseId);

  const before=await snapshot(ids.enterpriseId,orderNo,factIds);
  assertClosed(before,'Before replay');

  const state=await runtime.db.selectFrom('enterprise_runtime_state')
    .select(['consistency_domain','next_posting_sequence'])
    .where('enterprise_id','=',ids.enterpriseId).executeTakeFirstOrThrow();
  const boundary=BigInt(state.next_posting_sequence)-1n;
  const beforeInput=await computeReplayInputDigest(runtime.db,ids.enterpriseId,state.consistency_domain,boundary);
  const beforeEconomic=await computeEconomicRuntimeDigest(runtime.db,ids.enterpriseId,state.consistency_domain,boundary);

  const replay=await runtime.replay.prepareFullReplay(ids.enterpriseId);
  if(replay.boundarySequence!==boundary) throw new Error(`Replay boundary changed: expected ${boundary}, got ${replay.boundarySequence}`);

  await drainPosting(runtime,ids.enterpriseId);
  if(replay.costMethod!==null){
    await runtime.cost.recalculate(ids.enterpriseId,replay.costMethod,replay.costPins??undefined);
  }
  await runtime.work.refresh(ids.enterpriseId);

  const after=await snapshot(ids.enterpriseId,orderNo,factIds);
  assertClosed(after,'After replay');

  const afterInput=await computeReplayInputDigest(runtime.db,ids.enterpriseId,state.consistency_domain,boundary);
  const afterEconomic=await computeEconomicRuntimeDigest(runtime.db,ids.enterpriseId,state.consistency_domain,boundary);
  await runtime.replay.completeFullReplay(replay.replayRunId,ids.enterpriseId,afterEconomic);

  if(beforeInput.digest!==afterInput.digest||beforeInput.count!==afterInput.count||beforeInput.lastIncludedFactId!==afterInput.lastIncludedFactId){
    throw new Error(`Canonical replay input changed: before=${JSON.stringify(beforeInput)} after=${JSON.stringify(afterInput)}`);
  }
  if(beforeEconomic!==afterEconomic||replay.beforeDigest!==beforeEconomic){
    throw new Error(`Economic digest mismatch: before=${beforeEconomic} recorded=${replay.beforeDigest} after=${afterEconomic}`);
  }
  if(JSON.stringify(before.facts)!==JSON.stringify(after.facts)){
    throw new Error('Canonical C03 BusinessData changed across Full Replay.');
  }
  if(JSON.stringify(before.links)!==JSON.stringify(after.links)){
    throw new Error('Explicit C03 BusinessObjectLinks changed across Full Replay.');
  }
  if(JSON.stringify(before.balances)!==JSON.stringify(after.balances)){
    throw new Error(`C03 balances changed across Full Replay: before=${JSON.stringify(before.balances)} after=${JSON.stringify(after.balances)}`);
  }
  if(JSON.stringify(before.work)!==JSON.stringify(after.work)){
    throw new Error(`C03 Work changed across Full Replay: before=${JSON.stringify(before.work)} after=${JSON.stringify(after.work)}`);
  }

  const run=await runtime.db.selectFrom('replay_run')
    .select(['status','validation_status','before_digest','after_digest'])
    .where('id','=',replay.replayRunId).executeTakeFirstOrThrow();
  if(run.status!=='COMPLETED'||run.validation_status!=='MATCH'||run.before_digest!==beforeEconomic||run.after_digest!==afterEconomic){
    throw new Error(`Replay run did not persist MATCH evidence: ${JSON.stringify(run)}`);
  }

  console.log(JSON.stringify({
    status:'PASS',packet:'EEL-C03.6',orderNo,
    canonicalFacts:before.facts.map(f=>f.business_data_type),
    explicitRelations:before.links.length,
    balances:after.balances,
    reverseWork:after.work.filter(w=>['pending_exchange','pending_refund','pending_red_invoice'].includes(w.ledger)),
    canonicalHistoryPreserved:true,
    explicitRelationshipsPreserved:true,
    workRebuiltFromBalances:true,
    replayDeterministic:true,
    beforeDigest:beforeEconomic,
    afterDigest:afterEconomic
  },null,2));
}finally{
  await database.destroy();
}

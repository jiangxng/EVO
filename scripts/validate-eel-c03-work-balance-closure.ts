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

async function workFor(orderNo:string){
  const rows=await runtime.db.selectFrom('work_item')
    .select(['work_type','status','source_ledger_code','source_quantity','source_amount','source_dimensions'])
    .where('enterprise_id','=',(await demoIds(runtime)).enterpriseId)
    .execute();
  return rows.filter(r=>orderNoOf(r.source_dimensions)===orderNo)
    .filter(r=>['pending_exchange','pending_refund','pending_red_invoice'].includes(r.source_ledger_code));
}

function assertState(rows:Awaited<ReturnType<typeof workFor>>, ledger:string, status:string, expected:string){
  const row=rows.find(r=>r.source_ledger_code===ledger);
  if(row===undefined) throw new Error(`Missing Work for ${ledger}`);
  if(row.status!==status) throw new Error(`${ledger} expected ${status}, got ${row.status}`);
  const value=ledger==='pending_exchange'?row.source_quantity:row.source_amount;
  if(String(value)!==expected) throw new Error(`${ledger} expected balance ${expected}, got ${value}`);
}

try{
  const ids=await demoIds(runtime);
  const suffix=Date.now();
  const orderNo=`SO-C03-WORK-${suffix}`;
  const customer='CUSTOMER-C03';
  const base={orderNo,customer,project:`PROJECT-${suffix}`,department:'SALES',profitCenter:'PC-C03',costCenter:'CC-SALES'};

  const blue=await runtime.command.execute({
    enterpriseId:ids.enterpriseId,applicationInstanceId:ids.salesInvoiceAppId,
    commandCode:'issue-sales-invoice',actor:{type:'AUTOMATION',id:'demo-automation'},
    requestId:`${orderNo}:blue`,correlationId:`REV:${orderNo}`,idempotencyKey:`${orderNo}:blue`,
    input:{...base,invoiceKind:'BLUE',invoiceNo:`BLUE-${suffix}`,invoiceAmount:'1000.00',currency:'CNY',taxIdentity:'DEMO-TAXPAYER-ID'},
    effectiveAt:new Date('2026-09-22T09:00:00.000Z'),businessObjectKey:`BLUE-${suffix}`
  });
  await drainPosting(runtime,ids.enterpriseId);

  await runtime.command.execute({
    enterpriseId:ids.enterpriseId,applicationInstanceId:ids.salesReturnAppId,
    commandCode:'receive-sales-return',actor:{type:'AUTOMATION',id:'demo-automation'},
    requestId:`${orderNo}:return`,correlationId:`REV:${orderNo}`,idempotencyKey:`${orderNo}:return`,
    input:{...base,returnNo:`RET-${suffix}`,productId:'P-100',warehouse:'HK',quantity:4,returnCost:'40.00',currency:'CNY',
      requiresExchange:true,exchangeQuantity:4,requiresRefund:true,refundAmount:'400.00',requiresRedInvoice:true,redInvoiceAmount:'400.00'},
    effectiveAt:new Date('2026-09-22T10:00:00.000Z'),businessObjectKey:`RET-${suffix}`
  });
  await drainPosting(runtime,ids.enterpriseId);

  let work=await workFor(orderNo);
  assertState(work,'pending_exchange','OPEN','4.000000000000');
  assertState(work,'pending_refund','OPEN','400.000000000000');
  assertState(work,'pending_red_invoice','OPEN','400.000000000000');

  for(const [i,q] of [1,3].entries()){
    await runtime.command.execute({
      enterpriseId:ids.enterpriseId,applicationInstanceId:ids.salesExchangeAppId,
      commandCode:'create-sales-exchange',actor:{type:'AUTOMATION',id:'demo-automation'},
      requestId:`${orderNo}:exchange:${i}`,correlationId:`REV:${orderNo}`,idempotencyKey:`${orderNo}:exchange:${i}`,
      input:{...base,exchangeNo:`EX-${suffix}-${i}`,originalProductId:'P-100',replacementProductId:'P-100',warehouse:'HK',
        replacementQuantity:q,replacementCost:String(q*10)+'.00',currency:'CNY'},
      effectiveAt:new Date(`2026-09-22T1${1+i}:00:00.000Z`),businessObjectKey:`EX-${suffix}-${i}`
    });
    await drainPosting(runtime,ids.enterpriseId);
  }
  work=await workFor(orderNo);
  assertState(work,'pending_exchange','DONE','0.000000000000');

  for(const [i,amount] of ['100.00','300.00'].entries()){
    await runtime.command.execute({
      enterpriseId:ids.enterpriseId,applicationInstanceId:ids.cashRefundAppId,
      commandCode:'record-customer-refund',actor:{type:'AUTOMATION',id:'demo-automation'},
      requestId:`${orderNo}:refund:${i}`,correlationId:`REV:${orderNo}`,idempotencyKey:`${orderNo}:refund:${i}`,
      input:{...base,refundNo:`RF-${suffix}-${i}`,refundAmount:amount,currency:'CNY',reason:'RETURN'},
      effectiveAt:new Date(`2026-09-22T1${3+i}:00:00.000Z`),businessObjectKey:`RF-${suffix}-${i}`
    });
    await drainPosting(runtime,ids.enterpriseId);
    if(i===0){
      const partial=await workFor(orderNo);
      assertState(partial,'pending_refund','OPEN','300.000000000000');
    }
  }
  work=await workFor(orderNo);
  assertState(work,'pending_refund','DONE','0.000000000000');

  for(const [i,amount] of ['150.00','250.00'].entries()){
    await runtime.command.execute({
      enterpriseId:ids.enterpriseId,applicationInstanceId:ids.salesInvoiceAppId,
      commandCode:'issue-sales-red-invoice',actor:{type:'AUTOMATION',id:'demo-automation'},
      requestId:`${orderNo}:red:${i}`,correlationId:`REV:${orderNo}`,idempotencyKey:`${orderNo}:red:${i}`,
      causationId:blue.businessDataId,
      input:{...base,invoiceKind:'RED',invoiceNo:`RED-${suffix}-${i}`,originalInvoiceNo:`BLUE-${suffix}`,
        invoiceAmount:amount,currency:'CNY',fullOrPartial:'PARTIAL',taxIdentity:'DEMO-TAXPAYER-ID'},
      effectiveAt:new Date(`2026-09-22T1${5+i}:00:00.000Z`),businessObjectKey:`RED-${suffix}-${i}`
    });
    await drainPosting(runtime,ids.enterpriseId);
    if(i===0){
      const partial=await workFor(orderNo);
      assertState(partial,'pending_red_invoice','OPEN','250.000000000000');
    }
  }
  work=await workFor(orderNo);
  assertState(work,'pending_red_invoice','DONE','0.000000000000');

  console.log(JSON.stringify({
    status:'PASS',packet:'EEL-C03.5',orderNo,
    work:work.map(r=>({type:r.work_type,ledger:r.source_ledger_code,status:r.status,quantity:r.source_quantity,amount:r.source_amount})),
    balanceDriven:true,eventExistenceShortcut:false,newAfterSalesWorkRuntimeRequired:false
  },null,2));
}finally{
  await database.destroy();
}

import { Decimal } from 'decimal.js';
import { createDatabase } from '../platform/database/src/index.js';
import { loadRuntimeConfig } from '../platform/runtime/src/config.js';
import { createEvoRuntime, demoIds, drainPosting } from '../apps/api/src/evo-runtime.js';

const config = loadRuntimeConfig();
const database = createDatabase(config.databaseUrl);
const runtime = createEvoRuntime(database);

function orderNoOf(dimensions: unknown): string | undefined {
  if (dimensions === null || typeof dimensions !== 'object' || Array.isArray(dimensions)) {
    return undefined;
  }
  const value = (dimensions as Record<string,unknown>).order_no;
  return typeof value === 'string' ? value : undefined;
}

async function workRows(enterpriseId: string, orderNo: string) {
  const rows = await runtime.db.selectFrom('work_item')
    .select([
      'work_type','status','source_ledger_code','source_dimensions',
      'source_quantity','source_amount','completed_at'
    ])
    .where('enterprise_id','=',enterpriseId)
    .execute();
  return rows.filter((row) => orderNoOf(row.source_dimensions) === orderNo);
}

try {
  const ids = await demoIds(runtime);
  const suffix = Date.now();
  const orderNo = `EEL-C01-WORK-${suffix}`;
  const correlationId = `O2C:${orderNo}`;
  const project = `PROJECT-${suffix}`;

  const orderAt = new Date('2026-09-22T05:00:00.000Z');
  const productionAt = new Date('2026-09-22T06:00:00.000Z');
  const shipmentAt = new Date('2026-09-22T07:00:00.000Z');
  const receiptAt = new Date('2026-09-22T08:00:00.000Z');

  const order = await runtime.command.execute({
    enterpriseId: ids.enterpriseId,
    applicationInstanceId: ids.salesAppId,
    commandCode: 'approve-sales-order',
    actor: { type:'AUTOMATION', id:'demo-automation' },
    requestId: `${orderNo}:approve`,
    correlationId,
    idempotencyKey: `${orderNo}:approve`,
    input: {
      eventKind:'ORDER',
      orderNo,
      customer:'EEL-C01-Work-Customer',
      productId:'P-100',
      quantity:10,
      unitPrice:'100.00',
      totalAmount:'1000.00',
      currency:'USD',
      localCarryingAmount:'7200.00',
      localCurrency:'CNY',
      fulfillmentMode:'MAKE',
      project,
      department:'SALES',
      profitCenter:'PC-EEL-C01',
      costCenter:'CC-SALES'
    },
    effectiveAt:orderAt,
    businessObjectKey:orderNo
  });
  await drainPosting(runtime,ids.enterpriseId);

  await runtime.work.refresh(ids.enterpriseId);
  const afterOrder = await workRows(ids.enterpriseId,orderNo);
  const initialOpen = afterOrder.filter((row)=>row.status==='OPEN');
  const initialLedgers = new Set(initialOpen.map((row)=>row.source_ledger_code));
  for (const ledger of ['pending_production','pending_shipment','receivable']) {
    if (!initialLedgers.has(ledger)) {
      throw new Error(
        `Order must create OPEN Work for ${ledger}; got ${JSON.stringify(afterOrder)}`
      );
    }
  }

  const orderBusiness = await runtime.db.selectFrom('business_data')
    .select('id')
    .where('command_execution_id','=',order.commandExecutionId)
    .executeTakeFirstOrThrow();

  const production = await runtime.command.execute({
    enterpriseId:ids.enterpriseId,
    applicationInstanceId:ids.productionAppId,
    commandCode:'complete-production',
    actor:{ type:'AUTOMATION', id:'demo-automation' },
    requestId:`${orderNo}:production`,
    correlationId,
    causationId:orderBusiness.id,
    idempotencyKey:`${orderNo}:production`,
    input:{
      orderNo,
      customer:'EEL-C01-Work-Customer',
      productId:'P-100',
      warehouse:'HK',
      quantity:10,
      totalCost:'100.00',
      project,
      department:'SALES',
      profitCenter:'PC-EEL-C01',
      costCenter:'CC-SALES'
    },
    effectiveAt:productionAt,
    businessObjectKey:`PROD:${orderNo}:P-100`
  });
  await drainPosting(runtime,ids.enterpriseId);

  const shipmentNo = `SHIP-${suffix}`;
  await runtime.command.execute({
    enterpriseId:ids.enterpriseId,
    applicationInstanceId:ids.inventoryAppId,
    commandCode:'ship-sales-order',
    actor:{ type:'AUTOMATION', id:'demo-automation' },
    requestId:`${orderNo}:shipment`,
    correlationId,
    causationId:orderBusiness.id,
    idempotencyKey:shipmentNo,
    input:{
      movementType:'SHIP',
      shipmentNo,
      orderNo,
      customer:'EEL-C01-Work-Customer',
      productId:'P-100',
      warehouse:'HK',
      quantity:10,
      lot:null,
      project,
      department:'SALES',
      profitCenter:'PC-EEL-C01',
      costCenter:'CC-SALES'
    },
    effectiveAt:shipmentAt,
    businessObjectKey:shipmentNo
  });
  await drainPosting(runtime,ids.enterpriseId);

  await runtime.work.refresh(ids.enterpriseId);
  const afterFulfillment = await workRows(ids.enterpriseId,orderNo);
  const productionWork = afterFulfillment.find((row)=>row.source_ledger_code==='pending_production');
  const shipmentWork = afterFulfillment.find((row)=>row.source_ledger_code==='pending_shipment');
  const receivableWorkBeforeReceipt = afterFulfillment.find((row)=>row.source_ledger_code==='receivable');

  if (
    productionWork?.status !== 'DONE' ||
    shipmentWork?.status !== 'DONE' ||
    receivableWorkBeforeReceipt?.status !== 'OPEN' ||
    !new Decimal(receivableWorkBeforeReceipt.source_amount).eq(1000)
  ) {
    throw new Error(
      `Full fulfillment must close production/shipment while collection stays open: ${JSON.stringify(afterFulfillment)}`
    );
  }

  await runtime.command.execute({
    enterpriseId:ids.enterpriseId,
    applicationInstanceId:ids.cashAppId,
    commandCode:'record-receipt',
    actor:{ type:'AUTOMATION', id:'demo-automation' },
    requestId:`${orderNo}:receipt`,
    correlationId,
    causationId:orderBusiness.id,
    idempotencyKey:`${orderNo}:receipt`,
    input:{
      semanticRole:'CUSTOMER_CASH_RECEIPT',
      orderNo,
      customer:'EEL-C01-Work-Customer',
      settledAmount:'1000.00',
      settledCurrency:'USD',
      cashAmount:'7300.00',
      cashCurrency:'CNY',
      project,
      department:'SALES',
      profitCenter:'PC-EEL-C01',
      costCenter:'CC-SALES'
    },
    effectiveAt:receiptAt,
    businessObjectKey:`RECEIPT:${orderNo}`
  });
  await drainPosting(runtime,ids.enterpriseId);

  await runtime.work.refresh(ids.enterpriseId);
  const finalRows = await workRows(ids.enterpriseId,orderNo);
  const finalOpen = finalRows.filter((row)=>row.status==='OPEN' || row.status==='IN_PROGRESS');

  const requiredDone = ['pending_production','pending_shipment','receivable'];
  for (const ledger of requiredDone) {
    const row = finalRows.find((item)=>item.source_ledger_code===ledger);
    if (row === undefined || row.status !== 'DONE' || row.completed_at === null) {
      throw new Error(
        `Final full-closure Work must mark ${ledger} DONE: ${JSON.stringify(finalRows)}`
      );
    }
  }

  if (finalOpen.length !== 0) {
    throw new Error(
      `No O2C Work may remain open after full fulfillment and collection: ${JSON.stringify(finalOpen)}`
    );
  }

  if (finalRows.some((row)=>row.source_ledger_code==='cash')) {
    throw new Error('Cash is a financial position and must not be projected as an O2C WorkItem.');
  }

  const listedOpen = await runtime.work.listOpen(ids.enterpriseId);
  const listedForOrder = listedOpen.filter((item)=>orderNoOf(item.dimensions)===orderNo);
  if (listedForOrder.length !== 0) {
    throw new Error(
      `Default official Work read must expose no open items for the completed order: ${JSON.stringify(listedForOrder)}`
    );
  }

  console.log(JSON.stringify({
    status:'PASS',
    packet:'EEL-C01.4',
    orderNo,
    lifecycle:{
      afterOrder:afterOrder.map((row)=>({
        ledger:row.source_ledger_code,
        workType:row.work_type,
        status:row.status
      })),
      afterFulfillment:afterFulfillment.map((row)=>({
        ledger:row.source_ledger_code,
        workType:row.work_type,
        status:row.status,
        amount:row.source_amount,
        quantity:row.source_quantity
      })),
      afterReceipt:finalRows.map((row)=>({
        ledger:row.source_ledger_code,
        workType:row.work_type,
        status:row.status,
        amount:row.source_amount,
        quantity:row.source_quantity
      }))
    },
    noOpenWorkAfterFullClosure:true,
    cashProjectedAsWork:false
  },null,2));
} finally {
  await database.destroy();
}

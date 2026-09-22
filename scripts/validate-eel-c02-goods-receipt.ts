import { Decimal } from 'decimal.js';
import { createDatabase } from '../platform/database/src/index.js';
import { loadRuntimeConfig } from '../platform/runtime/src/config.js';
import { createEvoRuntime, demoIds, drainPosting } from '../apps/api/src/evo-runtime.js';

const config = loadRuntimeConfig();
const database = createDatabase(config.databaseUrl);
const runtime = createEvoRuntime(database);

function orderNoOf(dimensions: unknown): string | undefined {
  if (dimensions === null || typeof dimensions !== 'object' || Array.isArray(dimensions)) return undefined;
  const value = (dimensions as Record<string, unknown>).order_no;
  return typeof value === 'string' ? value : undefined;
}

async function workForOrder(enterpriseId: string, orderNo: string) {
  const rows = await runtime.db.selectFrom('work_item')
    .select(['work_type','status','source_ledger_code','source_dimensions','source_quantity','source_amount'])
    .where('enterprise_id','=',enterpriseId)
    .execute();
  return rows.filter((row)=>orderNoOf(row.source_dimensions)===orderNo);
}

async function balancesForOrder(enterpriseId: string, orderNo: string) {
  const rows = await runtime.db.selectFrom('ledger_balance as b')
    .innerJoin('ledger_definition as d','d.id','b.ledger_definition_id')
    .innerJoin('ledger_dataset as ds','ds.id','b.ledger_dataset_id')
    .select(['d.code as ledger_code','b.dimensions','b.quantity','b.amount'])
    .where('b.enterprise_id','=',enterpriseId)
    .where('ds.kind','=','CURRENT')
    .where('ds.status','=','ACTIVE')
    .execute();
  return rows.filter((row)=>orderNoOf(row.dimensions)===orderNo);
}

try {
  const ids = await demoIds(runtime);
  const suffix = Date.now();
  const orderNo = `PO-C02-RECEIPT-${suffix}`;
  const correlationId = `P2P:${orderNo}`;
  const supplier = 'SUPPLIER-C02';
  const project = `PROJECT-${suffix}`;

  const order = await runtime.command.execute({
    enterpriseId: ids.enterpriseId,
    applicationInstanceId: ids.procurementAppId,
    commandCode: 'approve-purchase-order',
    actor: { type:'AUTOMATION', id:'demo-automation' },
    requestId: `${orderNo}:approve`,
    correlationId,
    idempotencyKey: `${orderNo}:approve`,
    input: {
      orderNo, supplier, productId:'P-100', warehouse:'HK',
      quantity:100, unitPrice:'12.50', totalAmount:'1250.00', currency:'CNY',
      project, department:'PROCUREMENT', costCenter:'CC-PROCUREMENT'
    },
    effectiveAt:new Date('2026-09-22T09:00:00.000Z'),
    businessObjectKey:orderNo,
    lineage:{
      flowDefinitionId:ids.procureToPayFlowDefinitionId,
      flowInstanceKey:orderNo,
      stepCode:'purchase-order-approved'
    }
  });
  await runtime.flow.projectCommand(order.commandExecutionId);
  await drainPosting(runtime, ids.enterpriseId);

  const orderBusiness = await runtime.db.selectFrom('business_data')
    .select('id')
    .where('command_execution_id','=',order.commandExecutionId)
    .executeTakeFirstOrThrow();

  const receipts = [
    { quantity:30, totalCost:'375.00', at:'2026-09-22T10:00:00.000Z' },
    { quantity:20, totalCost:'250.00', at:'2026-09-22T11:00:00.000Z' },
    { quantity:50, totalCost:'625.00', at:'2026-09-22T12:00:00.000Z' }
  ];

  const expectedPending = [70,50,0];
  const expectedInventory = [30,50,100];

  for (let index=0; index<receipts.length; index+=1) {
    const receipt = receipts[index]!;
    const receiptNo = `GR-${suffix}-${index+1}`;

    const execution = await runtime.command.execute({
      enterpriseId:ids.enterpriseId,
      applicationInstanceId:ids.inventoryAppId,
      commandCode:'receive-purchase-order',
      actor:{ type:'AUTOMATION', id:'demo-automation' },
      requestId:`${orderNo}:receipt:${index+1}`,
      correlationId,
      causationId:orderBusiness.id,
      idempotencyKey:receiptNo,
      input:{
        movementType:'PURCHASE_RECEIPT',
        receiptNo,
        orderNo,
        supplier,
        productId:'P-100',
        warehouse:'HK',
        quantity:receipt.quantity,
        totalCost:receipt.totalCost,
        currency:'CNY',
        project,
        department:'PROCUREMENT',
        costCenter:'CC-PROCUREMENT'
      },
      effectiveAt:new Date(receipt.at),
      businessObjectKey:receiptNo,
      lineage:{
        flowDefinitionId:ids.procureToPayFlowDefinitionId,
        flowInstanceKey:orderNo,
        stepCode:'goods-received',
        parentBusinessDataId:orderBusiness.id,
        relationType:'FULFILLS'
      }
    });
    await runtime.flow.projectCommand(execution.commandExecutionId);
    await drainPosting(runtime, ids.enterpriseId);
    await runtime.work.refresh(ids.enterpriseId);

    const work = await workForOrder(ids.enterpriseId,orderNo);
    const receive = work.find((row)=>row.source_ledger_code==='pending_purchase');
    const pay = work.find((row)=>row.source_ledger_code==='payable');
    if (receive === undefined || pay === undefined) {
      throw new Error(`Expected RECEIVE and PAY work after receipt ${index+1}: ${JSON.stringify(work)}`);
    }

    if (!new Decimal(receive.source_quantity).eq(expectedPending[index]!)) {
      throw new Error(`Pending purchase after receipt ${index+1} must be ${expectedPending[index]}, got ${receive.source_quantity}`);
    }
    if (!new Decimal(pay.source_amount).eq(1250)) {
      throw new Error(`Payable must remain 1250 before payment, got ${pay.source_amount}`);
    }
    if ((index < 2 && receive.status !== 'OPEN') || (index === 2 && receive.status !== 'DONE')) {
      throw new Error(`RECEIVE work status mismatch after receipt ${index+1}: ${receive.status}`);
    }
    if (pay.status !== 'OPEN') {
      throw new Error(`PAY must remain OPEN before payment, got ${pay.status}`);
    }

    const balances = await balancesForOrder(ids.enterpriseId,orderNo);
    const inventory = balances.find((row)=>row.ledger_code==='inventory');
    if (inventory === undefined || !new Decimal(inventory.quantity).eq(expectedInventory[index]!)) {
      throw new Error(`Inventory after receipt ${index+1} must be ${expectedInventory[index]} units: ${JSON.stringify(balances)}`);
    }
  }

  const links = await runtime.db.selectFrom('business_object_link')
    .select(['from_business_data_id','to_business_data_id','relation_type'])
    .where('enterprise_id','=',ids.enterpriseId)
    .where('from_business_data_id','=',orderBusiness.id)
    .where('relation_type','=','FULFILLS')
    .execute();

  if (links.length !== 3) {
    throw new Error(`Expected three explicit FULFILLS links, got ${links.length}`);
  }

  const finalWork = await workForOrder(ids.enterpriseId,orderNo);
  const finalReceive = finalWork.find((row)=>row.source_ledger_code==='pending_purchase');
  const finalPay = finalWork.find((row)=>row.source_ledger_code==='payable');

  console.log(JSON.stringify({
    status:'PASS',
    packet:'EEL-C02.2',
    orderNo,
    receiptSequence:[30,20,50],
    pendingPurchaseSequence:[100,70,50,0],
    inventorySequence:[0,30,50,100],
    final:{
      receiveWork:finalReceive?.status,
      payWork:finalPay?.status,
      payableAmount:finalPay?.source_amount
    },
    explicitFulfillmentLinks:links.length,
    coreRuntimeChangesRequired:false
  },null,2));
} finally {
  await database.destroy();
}

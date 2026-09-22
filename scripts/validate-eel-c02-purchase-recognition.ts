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

try {
  const ids = await demoIds(runtime);
  const suffix = Date.now();
  const orderNo = `PO-C02-${suffix}`;
  const correlationId = `P2P:${orderNo}`;

  const result = await runtime.command.execute({
    enterpriseId: ids.enterpriseId,
    applicationInstanceId: ids.procurementAppId,
    commandCode: 'approve-purchase-order',
    actor: { type:'AUTOMATION', id:'demo-automation' },
    requestId: `${orderNo}:approve`,
    correlationId,
    idempotencyKey: `${orderNo}:approve`,
    input: {
      orderNo,
      supplier: 'SUPPLIER-C02',
      productId: 'P-100',
      warehouse: 'HK',
      quantity: 100,
      unitPrice: '12.50',
      totalAmount: '1250.00',
      currency: 'CNY',
      project: `PROJECT-${suffix}`,
      department: 'PROCUREMENT',
      costCenter: 'CC-PROCUREMENT'
    },
    effectiveAt: new Date('2026-09-22T09:00:00.000Z'),
    businessObjectKey: orderNo
  });

  await drainPosting(runtime, ids.enterpriseId);
  await runtime.work.refresh(ids.enterpriseId);

  const business = await runtime.db.selectFrom('business_data')
    .select(['id','business_data_type','business_object_key','payload'])
    .where('command_execution_id','=',result.commandExecutionId)
    .executeTakeFirstOrThrow();

  if (business.business_data_type !== 'purchase_order.approved') {
    throw new Error(`Expected purchase_order.approved, got ${business.business_data_type}`);
  }

  const rows = await runtime.db.selectFrom('work_item')
    .select([
      'work_type','status','source_ledger_code','source_dimensions',
      'source_quantity','source_amount'
    ])
    .where('enterprise_id','=',ids.enterpriseId)
    .execute();

  const work = rows.filter((row)=>orderNoOf(row.source_dimensions)===orderNo);
  const pendingPurchase = work.find((row)=>row.source_ledger_code==='pending_purchase');
  const payable = work.find((row)=>row.source_ledger_code==='payable');

  if (
    pendingPurchase === undefined ||
    pendingPurchase.work_type !== 'RECEIVE' ||
    pendingPurchase.status !== 'OPEN' ||
    !new Decimal(pendingPurchase.source_quantity).eq(100)
  ) {
    throw new Error(`Purchase approval must open RECEIVE work for 100 units: ${JSON.stringify(work)}`);
  }

  if (
    payable === undefined ||
    payable.work_type !== 'PAY' ||
    payable.status !== 'OPEN' ||
    !new Decimal(payable.source_amount).eq(1250)
  ) {
    throw new Error(`Purchase approval must open PAY work for 1250 CNY: ${JSON.stringify(work)}`);
  }

  const open = await runtime.work.listOpen(ids.enterpriseId);
  const officialForOrder = open.filter((item)=>orderNoOf(item.dimensions)===orderNo);
  const officialLedgers = new Set(officialForOrder.map((item)=>item.sourceLedgerCode));

  if (!officialLedgers.has('pending_purchase') || !officialLedgers.has('payable')) {
    throw new Error(`Official open Work must expose RECEIVE and PAY obligations: ${JSON.stringify(officialForOrder)}`);
  }

  console.log(JSON.stringify({
    status:'PASS',
    packet:'EEL-C02.1',
    orderNo,
    businessDataType:business.business_data_type,
    businessDataId:business.id,
    balances:{
      pendingPurchaseQuantity:pendingPurchase.source_quantity,
      payableAmount:payable.source_amount
    },
    work:work.map((row)=>({
      ledger:row.source_ledger_code,
      workType:row.work_type,
      status:row.status,
      quantity:row.source_quantity,
      amount:row.source_amount
    })),
    implementationSpecialization:{
      singleReceiptAssumption:false,
      singlePaymentAssumption:false,
      note:'C02.1 only recognizes obligations; completion remains balance-driven by future facts.'
    }
  },null,2));
} finally {
  await database.destroy();
}

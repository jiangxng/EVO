import { Decimal } from 'decimal.js';
import { createDatabase } from '../platform/database/src/index.js';
import { loadRuntimeConfig } from '../platform/runtime/src/config.js';
import { createEvoRuntime, demoIds, drainPosting } from '../apps/api/src/evo-runtime.js';

const config = loadRuntimeConfig();
const database = createDatabase(config.databaseUrl);
const runtime = createEvoRuntime(database);

try {
  const ids = await demoIds(runtime);
  if (ids.cashAppId.length === 0) {
    throw new Error('EEL-C01 requires the seeded cash application instance.');
  }

  const suffix = Date.now();
  const orderNo = `EEL-C01-${suffix}`;
  const correlationId = `O2C:${orderNo}`;
  const project = `PROJECT-${suffix}`;
  const orderAt = new Date('2026-09-22T01:00:00.000Z');
  const receiptAt = new Date('2026-09-22T02:00:00.000Z');

  const order = await runtime.command.execute({
    enterpriseId: ids.enterpriseId,
    applicationInstanceId: ids.salesAppId,
    commandCode: 'approve-sales-order',
    actor: { type: 'AUTOMATION', id: 'demo-automation' },
    requestId: `${orderNo}:approve`,
    correlationId,
    idempotencyKey: `${orderNo}:approve`,
    input: {
      eventKind: 'ORDER',
      orderNo,
      customer: 'EEL-C01-Customer',
      productId: 'P-100',
      quantity: 1,
      unitPrice: '1000.00',
      totalAmount: '1000.00',
      currency: 'USD',
      localCarryingAmount: '7200.00',
      localCurrency: 'CNY',
      fulfillmentMode: 'MAKE',
      project,
      department: 'SALES',
      profitCenter: 'PC-EEL-C01',
      costCenter: 'CC-SALES'
    },
    effectiveAt: orderAt,
    businessObjectKey: orderNo
  });
  await drainPosting(runtime,ids.enterpriseId);

  const beforeReceivable = await runtime.db.selectFrom('ledger_balance as b')
    .innerJoin('ledger_definition as d','d.id','b.ledger_definition_id')
    .select(['b.amount','b.dimensions'])
    .where('b.enterprise_id','=',ids.enterpriseId)
    .where('d.code','=','receivable')
    .execute();
  const beforeScoped = beforeReceivable.find((row) =>
    (row.dimensions as Record<string,unknown>).order_no === orderNo
  );
  if (beforeScoped === undefined || !new Decimal(beforeScoped.amount).eq(1000)) {
    throw new Error(`Reference order must create USD 1000 receivable, got ${JSON.stringify(beforeScoped)}`);
  }

  const receipt = await runtime.command.execute({
    enterpriseId: ids.enterpriseId,
    applicationInstanceId: ids.cashAppId,
    commandCode: 'record-receipt',
    actor: { type: 'AUTOMATION', id: 'demo-automation' },
    requestId: `${orderNo}:receipt`,
    correlationId,
    idempotencyKey: `${orderNo}:receipt`,
    input: {
      semanticRole: 'CUSTOMER_CASH_RECEIPT',
      orderNo,
      customer: 'EEL-C01-Customer',
      settledAmount: '1000.00',
      settledCurrency: 'USD',
      cashAmount: '7300.00',
      cashCurrency: 'CNY',
      project,
      department: 'SALES',
      profitCenter: 'PC-EEL-C01',
      costCenter: 'CC-SALES'
    },
    effectiveAt: receiptAt,
    businessObjectKey: `RECEIPT:${orderNo}`
  });
  await drainPosting(runtime,ids.enterpriseId);

  const receiptBusiness = await runtime.db.selectFrom('business_data')
    .select(['id','business_data_type','payload'])
    .where('command_execution_id','=',receipt.commandExecutionId)
    .executeTakeFirstOrThrow();
  if (receiptBusiness.business_data_type !== 'cash.received') {
    throw new Error(`Reference receipt must emit cash.received, got ${receiptBusiness.business_data_type}`);
  }

  const effects = await runtime.db.selectFrom('ledger_entry as e')
    .innerJoin('ledger_definition as d','d.id','e.ledger_definition_id')
    .select(['d.code as ledger','e.amount','e.currency','e.dimensions'])
    .where('e.enterprise_id','=',ids.enterpriseId)
    .where('e.business_data_id','=',receiptBusiness.id)
    .where('e.entry_source_kind','=','POSTING')
    .orderBy('d.code')
    .execute();

  const cashEntry = effects.find((row)=>row.ledger==='cash');
  const receivableEntry = effects.find((row)=>row.ledger==='receivable');
  if (
    effects.length !== 2 ||
    cashEntry === undefined ||
    !new Decimal(cashEntry.amount ?? 0).eq(7300) ||
    cashEntry.currency !== 'CNY' ||
    receivableEntry === undefined ||
    !new Decimal(receivableEntry.amount ?? 0).eq(-1000) ||
    receivableEntry.currency !== 'USD'
  ) {
    throw new Error(`Receipt posting must preserve separate cash/settlement measurements: ${JSON.stringify(effects)}`);
  }

  const balances = await runtime.db.selectFrom('ledger_balance as b')
    .innerJoin('ledger_definition as d','d.id','b.ledger_definition_id')
    .select(['d.code as ledger','b.amount','b.dimensions'])
    .where('b.enterprise_id','=',ids.enterpriseId)
    .where('d.code','in',['cash','receivable'])
    .execute();
  const scoped = balances.filter((row) =>
    (row.dimensions as Record<string,unknown>).order_no === orderNo
  );
  const receivable = scoped.find((row)=>row.ledger==='receivable');
  const cash = scoped.find((row)=>row.ledger==='cash');
  if (
    receivable === undefined ||
    !new Decimal(receivable.amount).eq(0) ||
    cash === undefined ||
    !new Decimal(cash.amount).eq(7300)
  ) {
    throw new Error(`Receipt must close receivable and increase cash: ${JSON.stringify(scoped)}`);
  }

  const legacyDefinition = await runtime.db.selectFrom('command_definition')
    .select('resulting_business_data_type')
    .where('code','=','record-customer-payment')
    .executeTakeFirstOrThrow();
  if (legacyDefinition.resulting_business_data_type !== 'customer_payment.received') {
    throw new Error('EEL-C01 must not rewrite the historical compatibility command type.');
  }

  console.log(JSON.stringify({
    status:'PASS',
    packet:'EEL-C01.1/EEL-C01.2',
    orderNo,
    receiptBusinessDataType:receiptBusiness.business_data_type,
    semanticRole:(receiptBusiness.payload as Record<string,unknown>).semanticRole,
    postingEffects:effects.map((row)=>({
      ledger:row.ledger,
      amount:row.amount,
      currency:row.currency
    })),
    finalBalances:{
      receivable:receivable.amount,
      cash:cash.amount
    },
    historicalCompatibilityType:legacyDefinition.resulting_business_data_type
  },null,2));
} finally {
  await database.destroy();
}

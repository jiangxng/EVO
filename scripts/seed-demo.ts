import { sql } from 'kysely';
import { createDatabase } from '../platform/database/src/index.js';
import { loadRuntimeConfig } from '../platform/runtime/src/config.js';
import { PostgresEnterpriseTemplateService } from '../modules/enterprise-template/infrastructure/postgres-enterprise-template-service.js';
import { enterpriseCoreV1 } from '../modules/enterprise-template/reference/enterprise-core-v1.js';
import { PostgresPositionDefinitionStore } from '../modules/position/infrastructure/postgres-position-definition-store.js';

const config = loadRuntimeConfig();
const database = createDatabase(config.databaseUrl);
const db = database.db;

const jsonArray = (value: readonly unknown[]) =>
  sql<readonly unknown[]>`${JSON.stringify(value)}::jsonb`;

async function one<T>(promise: Promise<T | undefined>, label: string): Promise<T> {
  const value = await promise;
  if (value === undefined) throw new Error(`Seed failed: ${label}`);
  return value;
}

try {
  const enterprise = await one(
    db.insertInto('enterprise')
      .values({
        code: 'EVO_DEMO',
        name: 'EVO Demo Enterprise',
        status: 'ACTIVE',
        default_timezone: 'Asia/Singapore'
      })
      .onConflict((oc) => oc.column('code').doUpdateSet({ name: 'EVO Demo Enterprise' }))
      .returning(['id']).executeTakeFirst(),
    'enterprise'
  );

  const enterpriseTemplates = new PostgresEnterpriseTemplateService(db);
  await enterpriseTemplates.publish({
    templateCode: 'enterprise-core',
    templateName: 'EVO Enterprise Core',
    description: 'Cross-industry reference enterprise template for EVO deterministic runtime certification.',
    version: 1,
    definition: enterpriseCoreV1
  });
  await enterpriseTemplates.bindEnterprise(
    'EVO_DEMO',
    'enterprise-core',
    1,
    'seed-demo',
    'Reference enterprise deterministic runtime certification'
  );

  async function domain(code: string, name: string) {
    return one(
      db.insertInto('domain_definition')
        .values({ code, name, description: `${name} domain` })
        .onConflict((oc) => oc.column('code').doUpdateSet({ name }))
        .returning('id').executeTakeFirst(), `${code} domain`
    );
  }
  const salesDomain = await domain('sales', 'Sales');
  const productionDomain = await domain('production', 'Production');
  const inventoryDomain = await domain('inventory', 'Inventory');
  const valuationDomain = await domain('valuation', 'Valuation');
  const cashDomain = await domain('cash', 'Cash');
  const procurementDomain = await domain('procurement', 'Procurement');

  async function txType(domainId: string, code: string, name: string) {
    return one(
      db.insertInto('transaction_type')
        .values({ domain_id: domainId, code, name, description: null })
        .onConflict((oc) => oc.column('code').doUpdateSet({ name }))
        .returning('id').executeTakeFirst(), `${code} transaction type`
    );
  }
  const salesType = await txType(salesDomain.id, 'sales_order', 'Sales Order');
  const productionType = await txType(productionDomain.id, 'production_completion', 'Production Completion');
  const inventoryType = await txType(inventoryDomain.id, 'inventory_movement', 'Inventory Movement');
  const valuationType = await txType(valuationDomain.id, 'valuation_request', 'Valuation Request');
  const cashReceiptType = await txType(cashDomain.id, 'cash_receipt', 'Cash Receipt');
  const cashPaymentType = await txType(cashDomain.id, 'cash_payment', 'Cash Payment');
  const cashRefundType = await txType(cashDomain.id, 'cash_refund', 'Customer Refund');
  const purchaseType = await txType(procurementDomain.id, 'purchase_order', 'Purchase Order');
  const salesReturnType = await txType(salesDomain.id, 'sales_return', 'Sales Return');
  const salesExchangeType = await txType(salesDomain.id, 'sales_exchange', 'Sales Exchange');
  const salesInvoiceType = await txType(salesDomain.id, 'sales_invoice', 'Sales Invoice');

  async function app(code: string, name: string, typeId: string) {
    return one(
      db.insertInto('application_definition')
        .values({ transaction_type_id: typeId, code, name, description: null })
        .onConflict((oc) => oc.column('code').doUpdateSet({ name }))
        .returning('id').executeTakeFirst(), code
    );
  }
  const salesApp = await app('sales_order', 'Sales Order', salesType.id);
  const productionApp = await app('production_completion', 'Production Completion', productionType.id);
  const inventoryApp = await app('inventory_movement', 'Inventory Movement', inventoryType.id);
  const valuationApp = await app('valuation_request', 'Valuation Request', valuationType.id);
  const cashReceiptApp = await app('cash_receipt', 'Cash Receipt', cashReceiptType.id);
  const cashPaymentApp = await app('cash_payment', 'Cash Payment', cashPaymentType.id);
  const cashRefundApp = await app('cash_refund', 'Customer Refund', cashRefundType.id);
  const purchaseApp = await app('purchase_order', 'Purchase Order', purchaseType.id);
  const salesReturnApp = await app('sales_return', 'Sales Return', salesReturnType.id);
  const salesExchangeApp = await app('sales_exchange', 'Sales Exchange', salesExchangeType.id);
  const salesInvoiceApp = await app('sales_invoice', 'Sales Invoice', salesInvoiceType.id);

  async function version(appId: string) {
    const existing = await db.selectFrom('application_definition_version')
      .select('id').where('application_definition_id','=',appId).where('version','=',1).executeTakeFirst();
    if (existing) return existing;
    return one(
      db.insertInto('application_definition_version').values({
        application_definition_id: appId,
        version: 1,
        status: 'PUBLISHED',
        schema_version: 1,
        base_config: {},
        definition_hash: 'demo-v1-alpha2',
        published_at: new Date()
      }).returning('id').executeTakeFirst(), 'version'
    );
  }
  const salesVersion = await version(salesApp.id);
  const productionVersion = await version(productionApp.id);
  const inventoryVersion = await version(inventoryApp.id);
  const valuationVersion = await version(valuationApp.id);
  const cashReceiptVersion = await version(cashReceiptApp.id);
  const cashPaymentVersion = await version(cashPaymentApp.id);
  const cashRefundVersion = await version(cashRefundApp.id);
  const purchaseVersion = await version(purchaseApp.id);
  const salesReturnVersion = await version(salesReturnApp.id);
  const salesExchangeVersion = await version(salesExchangeApp.id);
  const salesInvoiceVersion = await version(salesInvoiceApp.id);

  async function instance(appId: string, code: string, name: string) {
    return one(
      db.insertInto('application_instance').values({
        enterprise_id: enterprise.id,
        application_definition_id: appId,
        code,
        name,
        pinned_definition_version: 1,
        status: 'ACTIVE',
        config: {}
      }).onConflict((oc) => oc.columns(['enterprise_id','code']).doUpdateSet({ name, pinned_definition_version: 1 }))
        .returning('id').executeTakeFirst(), code
    );
  }
  await instance(salesApp.id, 'sales', 'Sales');
  await instance(productionApp.id, 'production', 'Production');
  await instance(inventoryApp.id, 'inventory', 'Inventory');
  await instance(valuationApp.id, 'valuation', 'Valuation');
  await instance(cashReceiptApp.id, 'cash', 'Cash');
  await instance(cashPaymentApp.id, 'cash-payment', 'Cash Payment');
  await instance(cashRefundApp.id, 'cash-refund', 'Customer Refund');
  await instance(purchaseApp.id, 'procurement', 'Procurement');
  await instance(salesReturnApp.id, 'sales-return', 'Sales Return');
  await instance(salesExchangeApp.id, 'sales-exchange', 'Sales Exchange');
  await instance(salesInvoiceApp.id, 'sales-invoice', 'Sales Invoice');

  await db.insertInto('item_definition').values({
    enterprise_id: enterprise.id,
    code: 'P-100',
    name: 'Demo Finished Good P-100',
    item_type: 'FINISHED_GOOD',
    track_inventory: true,
    default_fulfillment_mode: 'MAKE',
    base_unit: 'EA',
    config: {}
  }).onConflict((oc) => oc.columns(['enterprise_id','code']).doUpdateSet({
    name: 'Demo Finished Good P-100',
    item_type: 'FINISHED_GOOD',
    track_inventory: true,
    default_fulfillment_mode: 'MAKE',
    base_unit: 'EA'
  })).execute();

  async function capability(code: string, name: string) {
    await db.insertInto('capability_definition').values({
      enterprise_id: enterprise.id,
      code, name, description: null, version: 1, status: 'PUBLISHED', config: {}, published_at: new Date()
    }).onConflict((oc) => oc.columns(['enterprise_id','code','version']).doUpdateSet({ name, status: 'PUBLISHED' })).execute();
  }
  await capability('sell', 'Sell');
  await capability('produce', 'Produce');
  await capability('deliver', 'Deliver');
  await capability('collect', 'Collect');
  await capability('procure', 'Procure');
  await capability('pay', 'Pay Supplier');
  await capability('refund-customer', 'Refund Customer');
  await capability('return-sales', 'Return Sales');
  await capability('exchange-sales', 'Exchange Sales');
  await capability('invoice-sales', 'Invoice Sales');

  const flow = await one(
    db.insertInto('flow_definition').values({
      enterprise_id: enterprise.id,
      code: 'order-to-cash',
      name: 'Order to Cash',
      description: 'Reference cross-domain flow for EVO v1 alpha.',
      version: 1,
      status: 'PUBLISHED',
      definition: {
        steps: ['sales-order-approved','production-completed','shipment-created','costed','collection']
      },
      published_at: new Date()
    }).onConflict((oc) => oc.columns(['enterprise_id','code','version']).doUpdateSet({
      name: 'Order to Cash', status: 'PUBLISHED'
    })).returning('id').executeTakeFirst(), 'flow definition'
  );

  const p2pFlow = await one(
    db.insertInto('flow_definition').values({
      enterprise_id: enterprise.id,
      code: 'procure-to-pay',
      name: 'Procure to Pay',
      description: 'Reference supplier-side procure-to-pay flow for EVO Stage E.',
      version: 1,
      status: 'PUBLISHED',
      definition: {
        steps: ['purchase-order-approved','goods-received','supplier-paid']
      },
      published_at: new Date()
    }).onConflict((oc) => oc.columns(['enterprise_id','code','version']).doUpdateSet({
      name: 'Procure to Pay', status: 'PUBLISHED'
    })).returning('id').executeTakeFirst(), 'procure-to-pay flow definition'
  );

  await db.insertInto('metric_definition').values({
    enterprise_id: enterprise.id,
    code: 'order-fulfillment-open-qty',
    name: 'Open Order Fulfillment Quantity',
    description: 'Quantity still pending shipment in the reference flow.',
    version: 1,
    status: 'PUBLISHED',
    value_type: 'DECIMAL',
    definition: { source: 'ledger_balance', ledger: 'pending_shipment', aggregation: 'sum(quantity)' },
    lineage: { sourceLedger: 'pending_shipment' },
    published_at: new Date()
  }).onConflict((oc) => oc.columns(['enterprise_id','code','version']).doUpdateSet({ status: 'PUBLISHED' })).execute();

  const sop = await one(
    db.insertInto('sop_definition').values({
      enterprise_id: enterprise.id,
      code: 'finished-goods-completion',
      name: 'Finished Goods Completion',
      description: 'Reference SOP for production completion.'
    }).onConflict((oc) => oc.columns(['enterprise_id','code']).doUpdateSet({ name: 'Finished Goods Completion' }))
      .returning('id').executeTakeFirst(), 'sop definition'
  );
  const sopVersion = await one(
    db.insertInto('sop_version').values({
      sop_definition_id: sop.id,
      version: 1,
      status: 'PUBLISHED',
      summary: 'Confirm produced quantity, warehouse and total production cost before completion.',
      config: {},
      published_at: new Date()
    }).onConflict((oc) => oc.columns(['sop_definition_id','version']).doUpdateSet({ status: 'PUBLISHED' }))
      .returning('id').executeTakeFirst(), 'sop version'
  );
  await db.insertInto('sop_step').values({
    sop_version_id: sopVersion.id,
    step_no: 1,
    code: 'confirm-completion',
    title: 'Confirm production completion',
    instruction: 'Verify order, item, completed quantity, warehouse and total production cost before issuing the completion Command.',
    evidence_requirement: { requiredFields: ['orderNo','productId','quantity','warehouse','totalCost'] },
    control: { authorization: 'production.complete' }
  }).onConflict((oc) => oc.columns(['sop_version_id','step_no']).doUpdateSet({ title: 'Confirm production completion' })).execute();

  const trueExpr = { type: 'literal', value: true };
  const field = (path: string) => ({ type: 'field', path });
  const eq = (path: string, value: string | boolean | number) => ({
    type: 'eq', left: field(path), right: { type: 'literal', value }
  });
  const neg = (path: string) => ({
    type: 'sub', left: { type: 'literal', value: 0 }, right: field(path)
  });

  async function command(versionId: string, code: string, name: string, resultType: string) {
    await db.insertInto('command_definition').values({
      application_definition_version_id: versionId,
      code, name,
      input_schema: { type: 'object' },
      preconditions: jsonArray([]),
      execution_policy: {},
      resulting_business_data_type: resultType,
      config: {}
    }).onConflict((oc) => oc.columns(['application_definition_version_id','code']).doUpdateSet({
      name,
      resulting_business_data_type: resultType
    })).execute();
  }
  await command(salesVersion.id, 'approve-sales-order', 'Approve Sales Order', 'sales_order.approved');
  await command(salesVersion.id, 'record-customer-payment', 'Record Customer Payment', 'customer_payment.received');
  await command(cashReceiptVersion.id, 'record-receipt', 'Record Cash Receipt', 'cash.received');
  await command(cashPaymentVersion.id, 'record-payment', 'Record Supplier Payment', 'cash.paid');
  await command(cashRefundVersion.id, 'record-customer-refund', 'Record Customer Refund', 'cash.refunded');
  await command(valuationVersion.id, 'request-valuation', 'Request Valuation', 'valuation.requested');
  await command(productionVersion.id, 'complete-production', 'Complete Production', 'production.completed');
  await command(inventoryVersion.id, 'ship-sales-order', 'Ship Sales Order', 'sales_shipment.created');
  // v0.9 compatibility-only technical command. Not part of the v1 semantic reference flow.
  await command(inventoryVersion.id, 'receive-inventory', 'Receive Inventory (Legacy Demo)', 'inventory.received');
  await command(purchaseVersion.id, 'approve-purchase-order', 'Approve Purchase Order', 'purchase_order.approved');
  await command(inventoryVersion.id, 'receive-purchase-order', 'Receive Purchase Order', 'goods_receipt.received');
  await command(salesReturnVersion.id, 'receive-sales-return', 'Receive Sales Return', 'sales_return.received');
  await command(salesExchangeVersion.id, 'create-sales-exchange', 'Create Sales Exchange', 'sales_exchange.created');
  await command(salesInvoiceVersion.id, 'issue-sales-invoice', 'Issue Sales Invoice', 'sales_invoice.issued');
  await command(salesInvoiceVersion.id, 'issue-sales-red-invoice', 'Issue Sales Red Invoice', 'sales_red_invoice.issued');

  for (const [code, name] of [
    ['order_no','Order'],
    ['customer','Customer'],
    ['supplier','Supplier'],
    ['product_id','Product'],
    ['warehouse','Warehouse'],
    ['project','Project'],
    ['department','Department'],
    ['profit_center','Profit Center'],
    ['cost_center','Cost Center']
  ] as const) {
    await db.insertInto('dimension_definition').values({
      enterprise_id: null,
      code,
      name,
      data_type: 'TEXT',
      version: 1,
      status: 'PUBLISHED',
      config: {},
      published_at: new Date()
    }).onConflict((oc) => oc.columns(['enterprise_id','code','version']).doUpdateSet({
      name, status: 'PUBLISHED'
    })).execute();
  }

  async function ledger(code: string, name: string, dimensionSchema: Record<string, unknown>) {
    await db.insertInto('ledger_definition').values({
      code, name,
      quantity_semantics: 'SIGNED',
      amount_semantics: 'SIGNED',
      dimension_schema: dimensionSchema,
      config: {}
    }).onConflict((oc) => oc.column('code').doUpdateSet({ name, dimension_schema: dimensionSchema })).execute();
  }
  const operationalOrderPolicy = {
    required: ['order_no','product_id'],
    optional: ['customer','project','department','profit_center','cost_center']
  };
  const inventoryPolicy = {
    required: ['product_id','warehouse'],
    optional: ['order_no','customer','supplier','project','department','profit_center','cost_center']
  };
  const receivablePolicy = {
    required: ['order_no','customer'],
    optional: ['product_id','project','department','profit_center','cost_center']
  };
  const procurementPolicy = {
    required: ['order_no','supplier','product_id'],
    optional: ['warehouse','project','department','cost_center']
  };
  const payablePolicy = {
    required: ['order_no','supplier'],
    optional: ['product_id','project','department','cost_center']
  };
  const cashPolicy = {
    required: [],
    optional: ['order_no','customer','supplier','project','department','profit_center','cost_center']
  };
  const reverseWorkPolicy = {
    required: ['order_no','customer'],
    optional: ['project','department','profit_center','cost_center']
  };
  await ledger('pending_production','待生产', operationalOrderPolicy);
  await ledger('pending_shipment','待出库/发货', operationalOrderPolicy);
  await ledger('receivable','待收款', receivablePolicy);
  await ledger('pending_purchase','待采购/收货', procurementPolicy);
  await ledger('payable','应付账款', payablePolicy);
  await ledger('cash','现金', cashPolicy);
  await ledger('inventory','库存', inventoryPolicy);
  await ledger('cogs','销售成本', inventoryPolicy);
  await ledger('sales_invoice_amount','销售开票金额', receivablePolicy);
  await ledger('pending_exchange','待换货', reverseWorkPolicy);
  await ledger('pending_refund','待退款', reverseWorkPolicy);
  await ledger('pending_red_invoice','待红字发票', reverseWorkPolicy);

  async function rule(
    versionId: string,
    code: string,
    priority: number,
    condition: Record<string, unknown>,
    effect: Record<string, unknown>
  ) {
    await db.insertInto('posting_rule').values({
      application_definition_version_id: versionId,
      code, priority,
      condition_ast: condition,
      effect_ast: effect,
      rule_schema_version: 1
    }).onConflict((oc) => oc.columns(['application_definition_version_id','code']).doUpdateSet({
      priority, condition_ast: condition, effect_ast: effect, rule_schema_version: 1
    })).execute();
  }

  const orderDims = {
    order_no: field('orderNo'), customer: field('customer'), product_id: field('productId'),
    project: field('project'), department: field('department'),
    profit_center: field('profitCenter'), cost_center: field('costCenter')
  };
  await rule(salesVersion.id,'order-pending-production',10,eq('eventKind','ORDER'),{
    ledgerCode:'pending_production', quantity: field('quantity'), amount: { type:'literal', value:'0' }, dimensions: orderDims
  });
  await rule(salesVersion.id,'order-pending-shipment',20,eq('eventKind','ORDER'),{
    ledgerCode:'pending_shipment', quantity: field('quantity'), amount: { type:'literal', value:'0' }, dimensions: orderDims
  });
  const receivableDims = {
    order_no: field('orderNo'), customer: field('customer'),
    project: field('project'), department: field('department'),
    profit_center: field('profitCenter'), cost_center: field('costCenter')
  };
  await rule(salesVersion.id,'order-receivable',30,eq('eventKind','ORDER'),{
    ledgerCode:'receivable', quantity: { type:'literal', value:0 }, amount: field('totalAmount'), currency: field('currency'), dimensions: receivableDims
  });

  const reverseWorkDims = {
    order_no: field('orderNo'), customer: field('customer'),
    project: field('project'), department: field('department'),
    profit_center: field('profitCenter'), cost_center: field('costCenter')
  };
  const salesInvoiceDims = {
    order_no: field('orderNo'), customer: field('customer'),
    project: field('project'), department: field('department'),
    profit_center: field('profitCenter'), cost_center: field('costCenter')
  };
  await rule(salesInvoiceVersion.id,'sales-invoice-amount-increase',10,eq('invoiceKind','BLUE'),{
    ledgerCode:'sales_invoice_amount', quantity:{type:'literal',value:0}, amount:field('invoiceAmount'), currency:field('currency'), dimensions:salesInvoiceDims
  });
  await rule(salesInvoiceVersion.id,'sales-red-invoice-amount-decrease',20,eq('invoiceKind','RED'),{
    ledgerCode:'sales_invoice_amount', quantity:{type:'literal',value:0}, amount:neg('invoiceAmount'), currency:field('currency'), dimensions:salesInvoiceDims
  });
  await rule(salesInvoiceVersion.id,'sales-red-invoice-close-work',30,eq('invoiceKind','RED'),{
    ledgerCode:'pending_red_invoice', quantity:{type:'literal',value:0}, amount:neg('invoiceAmount'), currency:field('currency'), dimensions:reverseWorkDims
  });

  const purchaseDims = {
    order_no: field('orderNo'), supplier: field('supplier'), product_id: field('productId'),
    warehouse: field('warehouse'), project: field('project'), department: field('department'),
    cost_center: field('costCenter')
  };
  const payableDims = {
    order_no: field('orderNo'), supplier: field('supplier'), product_id: field('productId'),
    project: field('project'), department: field('department'),
    cost_center: field('costCenter')
  };
  await rule(purchaseVersion.id,'purchase-pending-receipt',10,trueExpr,{
    ledgerCode:'pending_purchase', quantity: field('quantity'), amount: { type:'literal', value:'0' }, dimensions: purchaseDims
  });
  await rule(purchaseVersion.id,'purchase-payable',20,trueExpr,{
    ledgerCode:'payable', quantity: { type:'literal', value:0 }, amount: field('totalAmount'), currency: field('currency'), dimensions: payableDims
  });

  const purchaseReceiptInventoryDims = {
    product_id: field('productId'), warehouse: field('warehouse'),
    order_no: field('orderNo'), supplier: field('supplier'),
    project: field('project'), department: field('department'),
    cost_center: field('costCenter')
  };
  await rule(inventoryVersion.id,'purchase-receipt-close-pending',30,eq('movementType','PURCHASE_RECEIPT'),{
    ledgerCode:'pending_purchase', quantity: neg('quantity'), amount: { type:'literal', value:'0' }, dimensions: purchaseDims
  });
  await rule(inventoryVersion.id,'purchase-receipt-inventory',40,eq('movementType','PURCHASE_RECEIPT'),{
    ledgerCode:'inventory', quantity: field('quantity'), amount: field('totalCost'), currency: field('currency'), dimensions: purchaseReceiptInventoryDims
  });

  const salesReturnInventoryDims = {
    product_id: field('productId'), warehouse: field('warehouse'),
    order_no: field('orderNo'), customer: field('customer'),
    project: field('project'), department: field('department'),
    profit_center: field('profitCenter'), cost_center: field('costCenter')
  };
  await rule(salesReturnVersion.id,'sales-return-to-inventory',10,trueExpr,{
    ledgerCode:'inventory', quantity: field('quantity'), amount: field('returnCost'), currency: field('currency'), dimensions: salesReturnInventoryDims
  });

  await rule(salesReturnVersion.id,'sales-return-open-exchange-work',20,eq('requiresExchange',true),{
    ledgerCode:'pending_exchange', quantity:field('exchangeQuantity'), amount:{type:'literal',value:0}, dimensions:reverseWorkDims
  });
  await rule(salesReturnVersion.id,'sales-return-open-refund-work',30,eq('requiresRefund',true),{
    ledgerCode:'pending_refund', quantity:{type:'literal',value:0}, amount:field('refundAmount'), currency:field('currency'), dimensions:reverseWorkDims
  });
  await rule(salesReturnVersion.id,'sales-return-open-red-invoice-work',40,eq('requiresRedInvoice',true),{
    ledgerCode:'pending_red_invoice', quantity:{type:'literal',value:0}, amount:field('redInvoiceAmount'), currency:field('currency'), dimensions:reverseWorkDims
  });

  const salesExchangeInventoryDims = {
    product_id: field('replacementProductId'), warehouse: field('warehouse'),
    order_no: field('orderNo'), customer: field('customer'),
    project: field('project'), department: field('department'),
    profit_center: field('profitCenter'), cost_center: field('costCenter')
  };
  await rule(salesExchangeVersion.id,'sales-exchange-replacement-out',10,trueExpr,{
    ledgerCode:'inventory', quantity: neg('replacementQuantity'), amount: neg('replacementCost'), currency: field('currency'), dimensions: salesExchangeInventoryDims
  });
  await rule(salesExchangeVersion.id,'sales-exchange-close-work',20,trueExpr,{
    ledgerCode:'pending_exchange', quantity:neg('replacementQuantity'), amount:{type:'literal',value:0}, dimensions:reverseWorkDims
  });

  const receiptDims = receivableDims;
  await rule(cashReceiptVersion.id,'receipt-increase-cash',10,trueExpr,{
    ledgerCode:'cash', quantity: { type:'literal', value:0 }, amount: field('cashAmount'), currency: field('cashCurrency'), dimensions: receiptDims
  });
  await rule(cashReceiptVersion.id,'receipt-clear-receivable',20,trueExpr,{
    ledgerCode:'receivable', quantity: { type:'literal', value:0 }, amount: neg('settledAmount'), currency: field('settledCurrency'), dimensions: receiptDims
  });

  const paymentCashDims = {
    order_no: field('orderNo'), supplier: field('supplier'),
    project: field('project'), department: field('department'),
    cost_center: field('costCenter')
  };
  await rule(cashPaymentVersion.id,'payment-decrease-cash',10,trueExpr,{
    ledgerCode:'cash', quantity: { type:'literal', value:0 }, amount: neg('settledAmount'), currency: field('currency'), dimensions: paymentCashDims
  });

  const refundCashDims = {
    order_no: field('orderNo'), customer: field('customer'),
    project: field('project'), department: field('department'),
    profit_center: field('profitCenter'), cost_center: field('costCenter')
  };
  await rule(cashRefundVersion.id,'refund-decrease-cash',10,trueExpr,{
    ledgerCode:'cash', quantity: { type:'literal', value:0 }, amount: neg('refundAmount'), currency: field('currency'), dimensions: refundCashDims
  });
  await rule(cashRefundVersion.id,'refund-close-work',20,trueExpr,{
    ledgerCode:'pending_refund', quantity:{type:'literal',value:0}, amount:neg('refundAmount'), currency:field('currency'), dimensions:reverseWorkDims
  });
  await rule(cashPaymentVersion.id,'payment-clear-payable',20,trueExpr,{
    ledgerCode:'payable', quantity: { type:'literal', value:0 }, amount: neg('settledAmount'), currency: field('currency'), dimensions: payableDims
  });

  const invDims = {
    product_id: field('productId'), warehouse: field('warehouse'),
    order_no: field('orderNo'), customer: field('customer'),
    project: field('project'), department: field('department'),
    profit_center: field('profitCenter'), cost_center: field('costCenter')
  };
  await rule(productionVersion.id,'production-close-demand',10,trueExpr,{
    ledgerCode:'pending_production', quantity: neg('quantity'), amount: { type:'literal', value:'0' }, dimensions: orderDims
  });
  await rule(productionVersion.id,'production-finished-goods',20,trueExpr,{
    ledgerCode:'inventory', quantity: field('quantity'), amount: field('totalCost'), dimensions: invDims
  });

  await rule(inventoryVersion.id,'shipment-inventory',10,eq('movementType','SHIP'),{
    ledgerCode:'inventory', quantity: neg('quantity'), amount: { type:'literal', value:'0' }, dimensions: invDims
  });
  await rule(inventoryVersion.id,'shipment-close-pending',20,eq('movementType','SHIP'),{
    ledgerCode:'pending_shipment', quantity: neg('quantity'), amount: { type:'literal', value:'0' }, dimensions: orderDims
  });

  for (const [actorType, actorId] of [
    ['HUMAN','demo-user'],
    ['AI','demo-agent'],
    ['AUTOMATION','demo-automation']
  ] as const) {
    await db.insertInto('permission_grant').values({
      enterprise_id: enterprise.id,
      actor_type: actorType,
      actor_id: actorId,
      permission_code: '*',
      resource_scope: {}
    }).onConflict((oc) => oc.columns([
      'enterprise_id','actor_type','actor_id','permission_code'
    ]).doNothing()).execute();
  }

  const positionDefinitions = new PostgresPositionDefinitionStore(db);
  await positionDefinitions.publish({
    enterpriseId: enterprise.id,
    code: 'fx_receivable',
    name: 'FX Receivable Position',
    version: 1,
    dimensions: [
      { code: 'order_no', field: 'orderNo' },
      { code: 'customer', field: 'customer' }
    ],
    sourceRules: [{
      businessDataType: 'sales_order.approved',
      direction: 'INCREASE',
      foreign: {
        valueField: 'totalAmount',
        unitField: 'currency',
        role: 'RESOURCE_QUANTITY'
      },
      carrying: {
        valueField: 'localCarryingAmount',
        unitField: 'localCurrency',
        role: 'VALUATION_AMOUNT'
      }
    }],
    config: {
      semantic: 'OPEN_FX_RECEIVABLE',
      settlementBusinessDataType: 'cash.received',
      legacySettlementBusinessDataTypes: ['customer_payment.received']
    }
  });

  await db.insertInto('feature_flag').values({
    code: 'v10_reference_flow',
    enterprise_id: enterprise.id,
    enabled: true,
    config: { flow: 'order-to-cash', alpha: 2, dimensions: true, valuationPosting: true },
    owner: 'flow',
    introduced_in: '1.0.0-alpha.2',
    expires_at: null
  }).onConflict((oc) => oc.columns(['code','enterprise_id']).doUpdateSet({ enabled: true })).execute();

  await db.insertInto('valuation_rule').values({
    enterprise_id: enterprise.id,
    code: 'shipment-inventory-to-cogs',
    name: 'Shipment Inventory Value to COGS',
    source_business_data_type: 'sales_shipment.created',
    inventory_ledger_code: 'inventory',
    cogs_ledger_code: 'cogs',
    dimension_mapping: {
      product_id: field('productId'),
      warehouse: field('warehouse'),
      order_no: field('orderNo'),
      customer: field('customer'),
      project: field('project'),
      department: field('department'),
      profit_center: field('profitCenter'),
      cost_center: field('costCenter')
    },
    version: 1,
    status: 'PUBLISHED',
    published_at: new Date()
  }).onConflict((oc) => oc.columns(['enterprise_id','code','version']).doUpdateSet({
    status: 'PUBLISHED'
  })).execute();

  const costRuntimeConfig = {
    inboundBusinessDataTypes: ['production.completed','inventory.received'],
    outboundBusinessDataTypes: ['sales_shipment.created'],
    quantityField: 'quantity',
    quantityUnit: 'EA',
    basisAmountField: 'totalCost',
    basisUnit: 'CNY',
    specificIdentityField: 'lot'
  };

  const allocationPolicies = [
    ['inventory_fifo','Inventory FIFO Allocation','OLDEST_FIRST'],
    ['inventory_lifo','Inventory LIFO Allocation','NEWEST_FIRST'],
    ['inventory_specific','Inventory Specific Identification','EXPLICIT_ONLY'],
    ['fx_settlement_explicit','FX Settlement Explicit Allocation','EXPLICIT_ONLY'],
    ['ap_settlement_explicit','AP Settlement Explicit Allocation','EXPLICIT_ONLY']
  ] as const;
  for (const [code,name,sourceOrdering] of allocationPolicies) {
    await db.insertInto('allocation_policy').values({
      enterprise_id: enterprise.id,
      code,
      name,
      version: 1,
      status: 'PUBLISHED',
      dimensions: jsonArray(['warehouse','productId']),
      eligibility: code === 'fx_settlement_explicit'
        ? {
            sourceBusinessDataTypes: ['sales_order.approved'],
            consumerBusinessDataTypes: ['customer_payment.received','cash.received']
          }
        : code === 'ap_settlement_explicit'
          ? {
              sourceBusinessDataTypes: ['purchase_order.approved'],
              consumerBusinessDataTypes: ['cash.paid']
            }
          : {
              inboundBusinessDataTypes: costRuntimeConfig.inboundBusinessDataTypes,
              outboundBusinessDataTypes: costRuntimeConfig.outboundBusinessDataTypes
            },
      source_ordering: sourceOrdering,
      allow_partial_allocation: true,
      negative_position_policy: 'REJECT',
      precision_policy: {
        quantityScale: 6,
        amountScale: 6,
        roundingMode: 'HALF_UP',
        residualRecipient: 'FINAL_SOURCE'
      },
      config: {
        specificIdentityField: costRuntimeConfig.specificIdentityField
      },
      published_at: new Date()
    }).onConflict((oc) => oc.columns(['enterprise_id','code','version']).doUpdateSet({
      name,
      status: 'PUBLISHED',
      dimensions: jsonArray(['warehouse','productId']),
      source_ordering: sourceOrdering,
      eligibility: code === 'fx_settlement_explicit'
        ? {
            sourceBusinessDataTypes: ['sales_order.approved'],
            consumerBusinessDataTypes: ['customer_payment.received','cash.received']
          }
        : code === 'ap_settlement_explicit'
          ? {
              sourceBusinessDataTypes: ['purchase_order.approved'],
              consumerBusinessDataTypes: ['cash.paid']
            }
          : {
              inboundBusinessDataTypes: costRuntimeConfig.inboundBusinessDataTypes,
              outboundBusinessDataTypes: costRuntimeConfig.outboundBusinessDataTypes
            },
      precision_policy: {
        quantityScale: 6,
        amountScale: 6,
        roundingMode: 'HALF_UP',
        residualRecipient: 'FINAL_SOURCE'
      }
    })).execute();
  }
  for (const method of ['FIFO','LIFO','MOVING_AVERAGE','SPECIFIC_IDENTIFICATION'] as const) {
    await db.insertInto('valuation_policy').values({
      enterprise_id: enterprise.id,
      code: `inventory_${method.toLowerCase()}`,
      name: `${method} Inventory Cost`,
      method,
      negative_inventory_policy: 'DISALLOW_NEGATIVE',
      pool_dimension_schema: { keys: ['warehouse','productId'] },
      config: costRuntimeConfig,
      version: 1,
      status: 'ACTIVE'
    }).onConflict((oc) => oc.columns(['enterprise_id','code','version']).doUpdateSet({
      status: 'ACTIVE',
      pool_dimension_schema: { keys: ['warehouse','productId'] },
      config: costRuntimeConfig
    })).execute();
  }

  console.log(JSON.stringify({
    status: 'ok',
    enterpriseId: enterprise.id,
    enterpriseCode: 'EVO_DEMO',
    referenceItem: 'P-100',
    referenceFlowId: flow.id,
    procureToPayFlowId: p2pFlow.id
  }, null, 2));
} finally {
  await database.destroy();
}

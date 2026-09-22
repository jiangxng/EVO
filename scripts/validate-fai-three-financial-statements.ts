import { Decimal } from 'decimal.js';
import { createDatabase } from '../platform/database/src/index.js';
import { loadRuntimeConfig } from '../platform/runtime/src/config.js';
import { createEvoRuntime, demoIds, drainPosting } from '../apps/api/src/evo-runtime.js';

const config=loadRuntimeConfig();
const database=createDatabase(config.databaseUrl);
const runtime=createEvoRuntime(database);

async function account(bookId:string,code:string,name:string,type:'ASSET'|'LIABILITY'|'EQUITY'|'REVENUE'|'EXPENSE',normal:'DEBIT'|'CREDIT',cash=false){
  return runtime.db.insertInto('accounting_account').values({accounting_book_id:bookId,code,name,account_type:type,normal_side:normal,status:'ACTIVE',is_cash_equivalent:cash}).returning('id').executeTakeFirstOrThrow();
}

async function rule(input:{enterpriseId:string;bookId:string;code:string;sourceType:string;priority:number;field:string;value:string;accountCode:string;side:'DEBIT'|'CREDIT';amountField:string;currencyField:string}){
  await runtime.db.insertInto('accounting_rule').values({
    enterprise_id:input.enterpriseId,accounting_book_id:input.bookId,code:input.code,name:input.code,source_business_data_type:input.sourceType,priority:input.priority,
    condition_ast:{type:'eq',field:input.field,value:input.value},
    effect_ast:{lines:[{accountCode:input.accountCode,side:input.side,amount:{type:'field',path:input.amountField},currencyField:input.currencyField}]},
    version:1,status:'PUBLISHED',published_at:new Date()
  }).execute();
}

async function statement(enterpriseId:string,bookId:string,code:string,name:string,type:'BALANCE_SHEET'|'INCOME_STATEMENT'|'CASH_FLOW_STATEMENT',version=1){
  return runtime.db.insertInto('statement_definition').values({enterprise_id:enterpriseId,accounting_book_id:bookId,code,name,statement_type:type,version,status:'PUBLISHED',published_at:new Date()}).returning('id').executeTakeFirstOrThrow();
}

function amountByRole(projection:Awaited<ReturnType<typeof runtime.financialStatements.project>>,role:string):Decimal{
  const line=projection.lines.find(x=>x.semanticRole===role);
  if(line===undefined) throw new Error(`Missing role ${role} in ${projection.statementCode}.`);
  return new Decimal(line.amount);
}

try{
  const ids=await demoIds(runtime);
  const suffix=Date.now();
  const book=await runtime.db.insertInto('accounting_book').values({enterprise_id:ids.enterpriseId,code:`FAI07_${suffix}`,name:'FAI-07 Three Statements',accounting_currency:'CNY',amount_scale:2,status:'ACTIVE'}).returning('id').executeTakeFirstOrThrow();
  await account(book.id,'1002','Bank / Cash','ASSET','DEBIT',true);
  await account(book.id,'1122','Accounts Receivable','ASSET','DEBIT');
  await account(book.id,'6001','Revenue','REVENUE','CREDIT');

  const period=await runtime.accountingPeriod.createOpenPeriod({enterpriseId:ids.enterpriseId,accountingBookId:book.id,fiscalYear:2026,periodNo:9,code:'2026-09',name:'September 2026',startsAt:new Date('2026-09-01T00:00:00.000Z'),endsAt:new Date('2026-10-01T00:00:00.000Z')});

  await rule({enterpriseId:ids.enterpriseId,bookId:book.id,code:'invoice-ar-debit',sourceType:'sales_invoice.issued',priority:10,field:'invoiceKind',value:'BLUE',accountCode:'1122',side:'DEBIT',amountField:'invoiceAmount',currencyField:'currency'});
  await rule({enterpriseId:ids.enterpriseId,bookId:book.id,code:'invoice-revenue-credit',sourceType:'sales_invoice.issued',priority:20,field:'invoiceKind',value:'BLUE',accountCode:'6001',side:'CREDIT',amountField:'invoiceAmount',currencyField:'currency'});
  await rule({enterpriseId:ids.enterpriseId,bookId:book.id,code:'receipt-cash-debit',sourceType:'cash.received',priority:10,field:'semanticRole',value:'CUSTOMER_CASH_RECEIPT',accountCode:'1002',side:'DEBIT',amountField:'cashAmount',currencyField:'cashCurrency'});
  await rule({enterpriseId:ids.enterpriseId,bookId:book.id,code:'receipt-ar-credit',sourceType:'cash.received',priority:20,field:'semanticRole',value:'CUSTOMER_CASH_RECEIPT',accountCode:'1122',side:'CREDIT',amountField:'settledAmount',currencyField:'settledCurrency'});

  const orderNo=`FAI07-${suffix}`, correlationId=`FAI07:${orderNo}`;
  const order=await runtime.command.execute({enterpriseId:ids.enterpriseId,applicationInstanceId:ids.salesAppId,commandCode:'approve-sales-order',actor:{type:'AUTOMATION',id:'fai07'},requestId:`${orderNo}:order`,correlationId,idempotencyKey:`${orderNo}:order`,input:{eventKind:'ORDER',orderNo,customer:'FAI07-Customer',productId:'P-100',quantity:1,unitPrice:'1000.00',totalAmount:'1000.00',currency:'CNY',localCarryingAmount:'1000.00',localCurrency:'CNY',fulfillmentMode:'STOCK',project:'FAI07',department:'SALES',profitCenter:'PC-FAI07',costCenter:'CC-FAI07'},effectiveAt:new Date('2026-09-22T01:00:00.000Z'),businessObjectKey:orderNo});
  await drainPosting(runtime,ids.enterpriseId);
  const invoice=await runtime.command.execute({enterpriseId:ids.enterpriseId,applicationInstanceId:ids.salesInvoiceAppId,commandCode:'issue-sales-invoice',actor:{type:'AUTOMATION',id:'fai07'},requestId:`${orderNo}:invoice`,correlationId,causationId:order.businessDataId,idempotencyKey:`${orderNo}:invoice`,input:{invoiceKind:'BLUE',invoiceNo:`INV-${orderNo}`,orderNo,customer:'FAI07-Customer',invoiceAmount:'1000.00',currency:'CNY',taxIdentity:'FAI07-TAX',project:'FAI07',department:'FINANCE',profitCenter:'PC-FAI07',costCenter:'CC-FAI07'},effectiveAt:new Date('2026-09-22T02:00:00.000Z'),businessObjectKey:`INV-${orderNo}`});
  await drainPosting(runtime,ids.enterpriseId);
  const receipt=await runtime.command.execute({enterpriseId:ids.enterpriseId,applicationInstanceId:ids.cashAppId,commandCode:'record-receipt',actor:{type:'AUTOMATION',id:'fai07'},requestId:`${orderNo}:receipt`,correlationId,causationId:invoice.businessDataId,idempotencyKey:`${orderNo}:receipt`,input:{semanticRole:'CUSTOMER_CASH_RECEIPT',orderNo,customer:'FAI07-Customer',settledAmount:'1000.00',settledCurrency:'CNY',cashAmount:'1000.00',cashCurrency:'CNY',project:'FAI07',department:'FINANCE',profitCenter:'PC-FAI07',costCenter:'CC-FAI07'},effectiveAt:new Date('2026-09-22T03:00:00.000Z'),businessObjectKey:`RECEIPT-${orderNo}`});
  await drainPosting(runtime,ids.enterpriseId);
  await runtime.accountingRecognition.recognizeBusinessData(ids.enterpriseId,book.id,invoice.businessDataId);
  await runtime.accountingRecognition.recognizeBusinessData(ids.enterpriseId,book.id,receipt.businessDataId);

  const bs=await statement(ids.enterpriseId,book.id,'BS','Balance Sheet','BALANCE_SHEET');
  const is=await statement(ids.enterpriseId,book.id,'IS','Income Statement','INCOME_STATEMENT');
  const cf=await statement(ids.enterpriseId,book.id,'CF','Cash Flow Statement','CASH_FLOW_STATEMENT');

  await runtime.db.insertInto('statement_line_definition').values([
    {statement_definition_id:bs.id,code:'ASSETS',name:'Total Assets',parent_code:null,sort_order:10,indent:0,aggregation_type:'SUM_CHILDREN',value_semantics:'ENDING_BALANCE',presentation_sign:'1',is_total:true,semantic_role:'BS_ASSETS_TOTAL'},
    {statement_definition_id:bs.id,code:'CASH',name:'Cash and Cash Equivalents',parent_code:'ASSETS',sort_order:11,indent:1,aggregation_type:'ACCOUNT_MAPPING',value_semantics:'ENDING_BALANCE',presentation_sign:'1',is_total:false,semantic_role:'BS_CASH_ENDING'},
    {statement_definition_id:bs.id,code:'AR',name:'Accounts Receivable',parent_code:'ASSETS',sort_order:12,indent:1,aggregation_type:'ACCOUNT_MAPPING',value_semantics:'ENDING_BALANCE',presentation_sign:'1',is_total:false,semantic_role:null},
    {statement_definition_id:bs.id,code:'LE',name:'Liabilities and Equity',parent_code:null,sort_order:20,indent:0,aggregation_type:'SUM_CHILDREN',value_semantics:'ENDING_BALANCE',presentation_sign:'1',is_total:true,semantic_role:'BS_LIABILITIES_EQUITY_TOTAL'},
    {statement_definition_id:bs.id,code:'CURRENT_EARNINGS',name:'Current Period Earnings',parent_code:'LE',sort_order:21,indent:1,aggregation_type:'ACCOUNT_MAPPING',value_semantics:'PERIOD_MOVEMENT',presentation_sign:'1',is_total:false,semantic_role:'BS_CURRENT_PERIOD_EARNINGS'},
    {statement_definition_id:is.id,code:'NET_INCOME',name:'Net Income',parent_code:null,sort_order:10,indent:0,aggregation_type:'SUM_CHILDREN',value_semantics:'PERIOD_MOVEMENT',presentation_sign:'1',is_total:true,semantic_role:'IS_NET_INCOME'},
    {statement_definition_id:is.id,code:'REVENUE',name:'Operating Revenue',parent_code:'NET_INCOME',sort_order:11,indent:1,aggregation_type:'ACCOUNT_MAPPING',value_semantics:'PERIOD_MOVEMENT',presentation_sign:'1',is_total:false,semantic_role:null},
    {statement_definition_id:cf.id,code:'OPENING_CASH',name:'Opening Cash',parent_code:null,sort_order:10,indent:0,aggregation_type:'ACCOUNT_MAPPING',value_semantics:'OPENING_BALANCE',presentation_sign:'1',is_total:false,semantic_role:'CF_OPENING_CASH'},
    {statement_definition_id:cf.id,code:'NET_CHANGE',name:'Net Change in Cash',parent_code:null,sort_order:20,indent:0,aggregation_type:'SUM_CHILDREN',value_semantics:'CASH_FLOW',presentation_sign:'1',is_total:true,semantic_role:'CF_NET_CHANGE'},
    {statement_definition_id:cf.id,code:'CFO_CUSTOMER',name:'Cash Received from Customers',parent_code:'NET_CHANGE',sort_order:21,indent:1,aggregation_type:'CASH_FLOW_CLASSIFICATION',value_semantics:'CASH_FLOW',presentation_sign:'1',is_total:false,semantic_role:null},
    {statement_definition_id:cf.id,code:'CLOSING_CASH',name:'Closing Cash',parent_code:null,sort_order:30,indent:0,aggregation_type:'ACCOUNT_MAPPING',value_semantics:'ENDING_BALANCE',presentation_sign:'1',is_total:false,semantic_role:'CF_CLOSING_CASH'}
  ]).execute();

  await runtime.db.insertInto('account_statement_mapping').values([
    {statement_definition_id:bs.id,statement_line_code:'CASH',accounting_account_code:'1002',balance_basis:'NET_DEBIT',multiplier:'1'},
    {statement_definition_id:bs.id,statement_line_code:'AR',accounting_account_code:'1122',balance_basis:'NET_DEBIT',multiplier:'1'},
    {statement_definition_id:bs.id,statement_line_code:'CURRENT_EARNINGS',accounting_account_code:'6001',balance_basis:'MOVEMENT_CREDIT',multiplier:'1'},
    {statement_definition_id:is.id,statement_line_code:'REVENUE',accounting_account_code:'6001',balance_basis:'MOVEMENT_CREDIT',multiplier:'1'},
    {statement_definition_id:cf.id,statement_line_code:'OPENING_CASH',accounting_account_code:'1002',balance_basis:'NET_DEBIT',multiplier:'1'},
    {statement_definition_id:cf.id,statement_line_code:'CLOSING_CASH',accounting_account_code:'1002',balance_basis:'NET_DEBIT',multiplier:'1'}
  ]).execute();
  await runtime.db.insertInto('cash_flow_classification_rule').values({enterprise_id:ids.enterpriseId,accounting_book_id:book.id,statement_definition_id:cf.id,code:'customer-receipt-operating',name:'Customer receipt operating cash flow',source_business_data_type:'cash.received',condition_ast:{type:'eq',field:'semanticRole',value:'CUSTOMER_CASH_RECEIPT'},cash_flow_category:'OPERATING',statement_line_code:'CFO_CUSTOMER',direction:'INFLOW',priority:10,version:1,status:'PUBLISHED',published_at:new Date()}).execute();

  const core=await runtime.financialStatements.reconcileCoreStatements(ids.enterpriseId,book.id,period.periodId,bs.id,is.id,cf.id);
  if(core.status!=='MATCH'||core.checks.some(check=>check.matched!==true)) throw new Error(`Core statements must reconcile: ${JSON.stringify(core.checks)}`);
  if(!amountByRole(core.balanceSheet,'BS_ASSETS_TOTAL').eq(1000)||!amountByRole(core.balanceSheet,'BS_LIABILITIES_EQUITY_TOTAL').eq(1000)||!amountByRole(core.incomeStatement,'IS_NET_INCOME').eq(1000)||!amountByRole(core.cashFlowStatement,'CF_OPENING_CASH').eq(0)||!amountByRole(core.cashFlowStatement,'CF_NET_CHANGE').eq(1000)||!amountByRole(core.cashFlowStatement,'CF_CLOSING_CASH').eq(1000)) throw new Error('Core statement amounts do not match reference economics.');

  const [bsReplay,isReplay,cfReplay]=await Promise.all([
    runtime.financialStatements.replay(ids.enterpriseId,book.id,period.periodId,bs.id),
    runtime.financialStatements.replay(ids.enterpriseId,book.id,period.periodId,is.id),
    runtime.financialStatements.replay(ids.enterpriseId,book.id,period.periodId,cf.id)
  ]);
  if([bsReplay,isReplay,cfReplay].some(x=>x.validationStatus!=='MATCH'||x.beforeDigest!==x.afterDigest)) throw new Error(`Statement replay must be deterministic: ${JSON.stringify({bsReplay,isReplay,cfReplay})}`);

  const broken=await statement(ids.enterpriseId,book.id,'BS_BROKEN','Broken Balance Sheet','BALANCE_SHEET');
  await runtime.db.insertInto('statement_line_definition').values([
    {statement_definition_id:broken.id,code:'ASSETS',name:'Total Assets',parent_code:null,sort_order:10,indent:0,aggregation_type:'SUM_CHILDREN',value_semantics:'ENDING_BALANCE',presentation_sign:'1',is_total:true,semantic_role:'BS_ASSETS_TOTAL'},
    {statement_definition_id:broken.id,code:'CASH',name:'Cash',parent_code:'ASSETS',sort_order:11,indent:1,aggregation_type:'ACCOUNT_MAPPING',value_semantics:'ENDING_BALANCE',presentation_sign:'1',is_total:false,semantic_role:'BS_CASH_ENDING'},
    {statement_definition_id:broken.id,code:'LE',name:'Liabilities and Equity',parent_code:null,sort_order:20,indent:0,aggregation_type:'SUM_CHILDREN',value_semantics:'ENDING_BALANCE',presentation_sign:'1',is_total:true,semantic_role:'BS_LIABILITIES_EQUITY_TOTAL'},
    {statement_definition_id:broken.id,code:'CURRENT_EARNINGS',name:'Current Earnings',parent_code:'LE',sort_order:21,indent:1,aggregation_type:'ACCOUNT_MAPPING',value_semantics:'PERIOD_MOVEMENT',presentation_sign:'1',is_total:false,semantic_role:'BS_CURRENT_PERIOD_EARNINGS'}
  ]).execute();
  await runtime.db.insertInto('account_statement_mapping').values([
    {statement_definition_id:broken.id,statement_line_code:'CASH',accounting_account_code:'1002',balance_basis:'NET_DEBIT',multiplier:'2'},
    {statement_definition_id:broken.id,statement_line_code:'CURRENT_EARNINGS',accounting_account_code:'6001',balance_basis:'MOVEMENT_CREDIT',multiplier:'1'}
  ]).execute();
  const brokenCheck=await runtime.financialStatements.reconcileCoreStatements(ids.enterpriseId,book.id,period.periodId,broken.id,is.id,cf.id);
  if(brokenCheck.status!=='MISMATCH'||brokenCheck.checks.every(check=>check.matched===true)) throw new Error('Broken report mapping must be detected by cross-statement reconciliation.');

  console.log(JSON.stringify({status:'PASS',packet:'FAI-07',balanceSheet:{assets:'1000.00',liabilitiesAndEquity:'1000.00',cash:'1000.00',currentEarnings:'1000.00'},incomeStatement:{netIncome:'1000.00'},cashFlowStatement:{openingCash:'0.00',netChange:'1000.00',closingCash:'1000.00',classification:'OPERATING / customer receipt'},crossStatement:{status:core.status,checks:core.checks.map(x=>({code:x.code,matched:x.matched}))},replay:{balanceSheet:bsReplay.validationStatus,incomeStatement:isReplay.validationStatus,cashFlowStatement:cfReplay.validationStatus},brokenMappingDetection:brokenCheck.status,principle:'statements are deterministic projections of authoritative GL and BusinessData lineage'},null,2));
}finally{await database.destroy();}

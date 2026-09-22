import { Decimal } from 'decimal.js';
import { createDatabase } from '../platform/database/src/index.js';
import { loadRuntimeConfig } from '../platform/runtime/src/config.js';
import { AppError } from '../platform/contracts/src/index.js';
import { createEvoRuntime, demoIds, drainPosting } from '../apps/api/src/evo-runtime.js';

const config=loadRuntimeConfig();
const database=createDatabase(config.databaseUrl);
const runtime=createEvoRuntime(database);

async function addAccount(bookId:string,code:string,name:string,type:'ASSET'|'LIABILITY'|'EQUITY'|'REVENUE'|'EXPENSE',normal:'DEBIT'|'CREDIT'){
  return runtime.db.insertInto('accounting_account').values({
    accounting_book_id:bookId,code,name,account_type:type,normal_side:normal,status:'ACTIVE'
  }).returning('id').executeTakeFirstOrThrow();
}

async function addRule(input:{enterpriseId:string;bookId:string;code:string;sourceType:string;priority:number;conditionField:string;conditionValue:string;accountCode:string;side:'DEBIT'|'CREDIT';amountField:string;currencyField:string}){
  return runtime.db.insertInto('accounting_rule').values({
    enterprise_id:input.enterpriseId, accounting_book_id:input.bookId, code:input.code, name:input.code,
    source_business_data_type:input.sourceType, priority:input.priority,
    condition_ast:{type:'eq',field:input.conditionField,value:input.conditionValue},
    effect_ast:{lines:[{accountCode:input.accountCode,side:input.side,amount:{type:'field',path:input.amountField},currencyField:input.currencyField}]},
    version:1,status:'PUBLISHED',published_at:new Date()
  }).returning('id').executeTakeFirstOrThrow();
}

try{
  const ids=await demoIds(runtime);
  const suffix=Date.now();
  const book=await runtime.db.insertInto('accounting_book').values({
    enterprise_id:ids.enterpriseId,code:`FAI06_${suffix}`,name:'FAI-06 Readiness Book',accounting_currency:'CNY',amount_scale:2,status:'ACTIVE'
  }).returning('id').executeTakeFirstOrThrow();

  const cash=await addAccount(book.id,'1002','Bank / Cash','ASSET','DEBIT');
  const ar=await addAccount(book.id,'1122','Accounts Receivable','ASSET','DEBIT');
  const revenue=await addAccount(book.id,'6001','Revenue','REVENUE','CREDIT');

  const period=await runtime.accountingPeriod.createOpenPeriod({
    enterpriseId:ids.enterpriseId,accountingBookId:book.id,fiscalYear:2026,periodNo:9,code:'2026-09',name:'September 2026',
    startsAt:new Date('2026-09-01T00:00:00.000Z'),endsAt:new Date('2026-10-01T00:00:00.000Z')
  });

  await addRule({enterpriseId:ids.enterpriseId,bookId:book.id,code:'invoice-ar-debit',sourceType:'sales_invoice.issued',priority:10,conditionField:'invoiceKind',conditionValue:'BLUE',accountCode:'1122',side:'DEBIT',amountField:'invoiceAmount',currencyField:'currency'});
  await addRule({enterpriseId:ids.enterpriseId,bookId:book.id,code:'invoice-revenue-credit',sourceType:'sales_invoice.issued',priority:20,conditionField:'invoiceKind',conditionValue:'BLUE',accountCode:'6001',side:'CREDIT',amountField:'invoiceAmount',currencyField:'currency'});
  await addRule({enterpriseId:ids.enterpriseId,bookId:book.id,code:'receipt-cash-debit',sourceType:'cash.received',priority:10,conditionField:'semanticRole',conditionValue:'CUSTOMER_CASH_RECEIPT',accountCode:'1002',side:'DEBIT',amountField:'cashAmount',currencyField:'cashCurrency'});
  await addRule({enterpriseId:ids.enterpriseId,bookId:book.id,code:'receipt-ar-credit',sourceType:'cash.received',priority:20,conditionField:'semanticRole',conditionValue:'CUSTOMER_CASH_RECEIPT',accountCode:'1122',side:'CREDIT',amountField:'settledAmount',currencyField:'settledCurrency'});

  const orderNo=`FAI06-${suffix}`;
  const correlationId=`FAI06:${orderNo}`;
  const order=await runtime.command.execute({
    enterpriseId:ids.enterpriseId,applicationInstanceId:ids.salesAppId,commandCode:'approve-sales-order',
    actor:{type:'AUTOMATION',id:'fai06'},requestId:`${orderNo}:order`,correlationId,idempotencyKey:`${orderNo}:order`,
    input:{eventKind:'ORDER',orderNo,customer:'FAI06-Customer',productId:'P-100',quantity:1,unitPrice:'1000.00',totalAmount:'1000.00',currency:'CNY',localCarryingAmount:'1000.00',localCurrency:'CNY',fulfillmentMode:'STOCK',project:'FAI06',department:'SALES',profitCenter:'PC-FAI06',costCenter:'CC-FAI06'},
    effectiveAt:new Date('2026-09-22T01:00:00.000Z'),businessObjectKey:orderNo
  });
  await drainPosting(runtime,ids.enterpriseId);

  const invoice=await runtime.command.execute({
    enterpriseId:ids.enterpriseId,applicationInstanceId:ids.salesInvoiceAppId,commandCode:'issue-sales-invoice',
    actor:{type:'AUTOMATION',id:'fai06'},requestId:`${orderNo}:invoice`,correlationId,causationId:order.businessDataId,idempotencyKey:`${orderNo}:invoice`,
    input:{invoiceKind:'BLUE',invoiceNo:`INV-${orderNo}`,orderNo,customer:'FAI06-Customer',invoiceAmount:'1000.00',currency:'CNY',taxIdentity:'FAI06-TAX',project:'FAI06',department:'FINANCE',profitCenter:'PC-FAI06',costCenter:'CC-FAI06'},
    effectiveAt:new Date('2026-09-22T02:00:00.000Z'),businessObjectKey:`INV-${orderNo}`
  });
  await drainPosting(runtime,ids.enterpriseId);

  const receipt=await runtime.command.execute({
    enterpriseId:ids.enterpriseId,applicationInstanceId:ids.cashAppId,commandCode:'record-receipt',
    actor:{type:'AUTOMATION',id:'fai06'},requestId:`${orderNo}:receipt`,correlationId,causationId:invoice.businessDataId,idempotencyKey:`${orderNo}:receipt`,
    input:{semanticRole:'CUSTOMER_CASH_RECEIPT',orderNo,customer:'FAI06-Customer',settledAmount:'1000.00',settledCurrency:'CNY',cashAmount:'1000.00',cashCurrency:'CNY',project:'FAI06',department:'FINANCE',profitCenter:'PC-FAI06',costCenter:'CC-FAI06'},
    effectiveAt:new Date('2026-09-22T03:00:00.000Z'),businessObjectKey:`RECEIPT-${orderNo}`
  });
  await drainPosting(runtime,ids.enterpriseId);

  await runtime.accountingRecognition.recognizeBusinessData(ids.enterpriseId,book.id,invoice.businessDataId);
  await runtime.accountingRecognition.recognizeBusinessData(ids.enterpriseId,book.id,receipt.businessDataId);

  await runtime.db.insertInto('account_reconciliation_rule').values([
    {enterprise_id:ids.enterpriseId,accounting_book_id:book.id,code:'cash-to-gl',name:'Cash economic ledger to GL cash',source_ledger_code:'cash',source_measure:'AMOUNT',source_multiplier:'1',target_account_code:'1002',target_basis:'NET_DEBIT',tolerance:'0',version:1,status:'PUBLISHED',published_at:new Date()},
    {enterprise_id:ids.enterpriseId,accounting_book_id:book.id,code:'receivable-to-gl',name:'Receivable economic ledger to GL AR',source_ledger_code:'receivable',source_measure:'AMOUNT',source_multiplier:'1',target_account_code:'1122',target_basis:'NET_DEBIT',tolerance:'0',version:1,status:'PUBLISHED',published_at:new Date()}
  ]).execute();

  const matched=await runtime.accountingReconciliation.run(ids.enterpriseId,book.id,period.periodId);
  if(matched.status!=='MATCH'||matched.mismatchCount!==0||matched.checkedRuleCount!==2){
    throw new Error(`Expected initial GL/economic reconciliation MATCH: ${JSON.stringify(matched)}`);
  }

  const replayClosedCandidate=await runtime.accountingReplay.replay(ids.enterpriseId,book.id);
  if(replayClosedCandidate.validationStatus!=='MATCH') throw new Error(`Open-period GL replay must match: ${JSON.stringify(replayClosedCandidate)}`);

  await runtime.accountingPeriod.closePeriod(ids.enterpriseId,book.id,period.periodId,'fai06','September close proof');
  try{
    await runtime.accounting.post({
      enterpriseId:ids.enterpriseId,accountingBookId:book.id,journalNo:`CLOSED-${suffix}`,effectiveAt:new Date('2026-09-22T04:00:00.000Z'),accountingCurrency:'CNY',
      lines:[{accountId:cash.id,side:'DEBIT',amount:'10.00',currency:'CNY'},{accountId:revenue.id,side:'CREDIT',amount:'10.00',currency:'CNY'}]
    });
    throw new Error('Closed period must reject a new Journal.');
  }catch(error){
    if(!(error instanceof AppError)||error.code!=='JOURNAL_PERIOD_CLOSED') throw error;
  }
  const closedRows=await runtime.db.selectFrom('accounting_journal').select('id').where('journal_no','=',`CLOSED-${suffix}`).execute();
  if(closedRows.length!==0) throw new Error('Closed-period rejection must commit zero Journal rows.');

  const replayClosed=await runtime.accountingReplay.replay(ids.enterpriseId,book.id);
  if(replayClosed.validationStatus!=='MATCH') throw new Error(`Replay must rebuild closed periods: ${JSON.stringify(replayClosed)}`);

  await runtime.accountingPeriod.reopenPeriod(ids.enterpriseId,book.id,period.periodId);
  await runtime.accounting.post({
    enterpriseId:ids.enterpriseId,accountingBookId:book.id,journalNo:`BALANCED-BUT-WRONG-${suffix}`,effectiveAt:new Date('2026-09-22T04:30:00.000Z'),accountingCurrency:'CNY',
    lines:[{accountId:cash.id,side:'DEBIT',amount:'10.00',currency:'CNY'},{accountId:revenue.id,side:'CREDIT',amount:'10.00',currency:'CNY'}]
  });
  const mismatched=await runtime.accountingReconciliation.run(ids.enterpriseId,book.id,period.periodId);
  const cashMismatch=mismatched.results.find(r=>r.ruleCode==='cash-to-gl');
  if(mismatched.status!=='MISMATCH'||cashMismatch===undefined||cashMismatch.matched!==false||!new Decimal(cashMismatch.difference).eq(-10)){
    throw new Error(`Balanced-but-wrong GL entry must be caught by reconciliation: ${JSON.stringify(mismatched)}`);
  }

  const balanceSheet=await runtime.db.insertInto('statement_definition').values({enterprise_id:ids.enterpriseId,accounting_book_id:book.id,code:'BS',name:'Balance Sheet',statement_type:'BALANCE_SHEET',version:1,status:'PUBLISHED',published_at:new Date()}).returning('id').executeTakeFirstOrThrow();
  const incomeStatement=await runtime.db.insertInto('statement_definition').values({enterprise_id:ids.enterpriseId,accounting_book_id:book.id,code:'IS',name:'Income Statement',statement_type:'INCOME_STATEMENT',version:1,status:'PUBLISHED',published_at:new Date()}).returning('id').executeTakeFirstOrThrow();
  const cashFlow=await runtime.db.insertInto('statement_definition').values({enterprise_id:ids.enterpriseId,accounting_book_id:book.id,code:'CF',name:'Cash Flow Statement',statement_type:'CASH_FLOW_STATEMENT',version:1,status:'PUBLISHED',published_at:new Date()}).returning('id').executeTakeFirstOrThrow();

  await runtime.db.insertInto('statement_line_definition').values([
    {statement_definition_id:balanceSheet.id,code:'CASH',name:'Cash and Cash Equivalents',parent_code:null,sort_order:10,indent:0,aggregation_type:'ACCOUNT_MAPPING',value_semantics:'ENDING_BALANCE',presentation_sign:'1',is_total:false},
    {statement_definition_id:balanceSheet.id,code:'AR',name:'Accounts Receivable',parent_code:null,sort_order:20,indent:0,aggregation_type:'ACCOUNT_MAPPING',value_semantics:'ENDING_BALANCE',presentation_sign:'1',is_total:false},
    {statement_definition_id:incomeStatement.id,code:'REVENUE',name:'Operating Revenue',parent_code:null,sort_order:10,indent:0,aggregation_type:'ACCOUNT_MAPPING',value_semantics:'PERIOD_MOVEMENT',presentation_sign:'1',is_total:false},
    {statement_definition_id:cashFlow.id,code:'CFO_CUSTOMER',name:'Cash received from customers',parent_code:null,sort_order:10,indent:1,aggregation_type:'CASH_FLOW_CLASSIFICATION',value_semantics:'CASH_FLOW',presentation_sign:'1',is_total:false}
  ]).execute();
  await runtime.db.insertInto('account_statement_mapping').values([
    {statement_definition_id:balanceSheet.id,statement_line_code:'CASH',accounting_account_code:'1002',balance_basis:'NET_DEBIT',multiplier:'1'},
    {statement_definition_id:balanceSheet.id,statement_line_code:'AR',accounting_account_code:'1122',balance_basis:'NET_DEBIT',multiplier:'1'},
    {statement_definition_id:incomeStatement.id,statement_line_code:'REVENUE',accounting_account_code:'6001',balance_basis:'MOVEMENT_CREDIT',multiplier:'1'}
  ]).execute();
  await runtime.db.insertInto('cash_flow_classification_rule').values({
    enterprise_id:ids.enterpriseId,accounting_book_id:book.id,statement_definition_id:cashFlow.id,code:'customer-receipt-operating',name:'Customer receipt operating cash flow',
    source_business_data_type:'cash.received',condition_ast:{type:'eq',field:'semanticRole',value:'CUSTOMER_CASH_RECEIPT'},cash_flow_category:'OPERATING',statement_line_code:'CFO_CUSTOMER',direction:'INFLOW',priority:10,version:1,status:'PUBLISHED',published_at:new Date()
  }).execute();

  const defs=await runtime.db.selectFrom('statement_definition').select(['statement_type','status']).where('accounting_book_id','=',book.id).execute();
  const maps=await runtime.db.selectFrom('account_statement_mapping').select('id').where('statement_definition_id','in',[balanceSheet.id,incomeStatement.id]).execute();
  const cashRules=await runtime.db.selectFrom('cash_flow_classification_rule').select(['cash_flow_category','direction','statement_line_code']).where('statement_definition_id','=',cashFlow.id).execute();
  if(defs.length!==3||defs.some(d=>d.status!=='PUBLISHED')||maps.length!==3||cashRules.length!==1||cashRules[0]?.cash_flow_category!=='OPERATING'||cashRules[0]?.direction!=='INFLOW'){
    throw new Error(`Statement projection metadata is incomplete: ${JSON.stringify({defs,maps,cashRules})}`);
  }

  console.log(JSON.stringify({
    status:'PASS',packet:'FAI-06',
    period:{openPosting:true,closedPostingRejected:true,replayAcrossClosedPeriod:true,reopenSupported:true},
    reconciliation:{initial:'MATCH',balancedButWrong:'MISMATCH',cashDifference:'-10'},
    statementMetadata:{definitions:['BALANCE_SHEET','INCOME_STATEMENT','CASH_FLOW_STATEMENT'],accountMappings:3,cashFlowClassification:{category:'OPERATING',direction:'INFLOW',line:'CFO_CUSTOMER'}},
    principle:'financial statements are versioned projections of authoritative ledger/GL state, not independent facts'
  },null,2));
}finally{
  await database.destroy();
}

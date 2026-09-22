import { Decimal } from 'decimal.js';
import { createDatabase } from '../platform/database/src/index.js';
import { loadRuntimeConfig } from '../platform/runtime/src/config.js';
import { AppError } from '../platform/contracts/src/index.js';
import { createEvoRuntime, demoIds, drainPosting } from '../apps/api/src/evo-runtime.js';

const config=loadRuntimeConfig();
const database=createDatabase(config.databaseUrl);
const runtime=createEvoRuntime(database);

async function createBook(
  enterpriseId:string,
  code:string,
  name:string
){
  return runtime.db.insertInto('accounting_book').values({
    enterprise_id:enterpriseId,
    code,name,
    accounting_currency:'CNY',
    amount_scale:2,
    status:'ACTIVE'
  }).returning('id').executeTakeFirstOrThrow();
}

async function account(
  bookId:string,
  code:string,
  name:string,
  type:'ASSET'|'LIABILITY'|'EQUITY'|'REVENUE'|'EXPENSE',
  normal:'DEBIT'|'CREDIT'
){
  return runtime.db.insertInto('accounting_account').values({
    accounting_book_id:bookId,
    code,name,
    account_type:type,
    normal_side:normal,
    status:'ACTIVE'
  }).returning('id').executeTakeFirstOrThrow();
}

async function rule(input:{
  enterpriseId:string;
  bookId:string;
  code:string;
  name:string;
  sourceType:string;
  priority:number;
  field:string;
  value:string;
  accountCode:string;
  side:'DEBIT'|'CREDIT';
  amountField:string;
  currencyField:string;
}){
  return runtime.db.insertInto('accounting_rule').values({
    enterprise_id:input.enterpriseId,
    accounting_book_id:input.bookId,
    code:input.code,
    name:input.name,
    source_business_data_type:input.sourceType,
    priority:input.priority,
    condition_ast:{type:'eq',field:input.field,value:input.value},
    effect_ast:{
      lines:[{
        accountCode:input.accountCode,
        side:input.side,
        amount:{type:'field',path:input.amountField},
        currencyField:input.currencyField
      }]
    },
    version:1,
    status:'PUBLISHED',
    published_at:new Date()
  }).returning('id').executeTakeFirstOrThrow();
}

function row(
  rows:Awaited<ReturnType<typeof runtime.trialBalance.compute>>['rows'],
  code:string
){
  const found=rows.find(item=>item.accountCode===code);
  if(found===undefined) throw new Error(`Missing trial-balance account ${code}.`);
  return found;
}

try{
  const ids=await demoIds(runtime);
  const suffix=Date.now();

  const mainBook=await createBook(ids.enterpriseId,`FAI_MAIN_${suffix}`,'FAI Main Book');
  await account(mainBook.id,'1002','Bank / Cash','ASSET','DEBIT');
  await account(mainBook.id,'1122','Accounts Receivable','ASSET','DEBIT');
  await account(mainBook.id,'6001','Revenue','REVENUE','CREDIT');

  // Split debit and credit across separate rules on purpose.
  // The recognition service must aggregate them into one Accounting Plan / Journal.
  await rule({
    enterpriseId:ids.enterpriseId,bookId:mainBook.id,
    code:'sales-invoice-ar-debit',name:'Sales invoice AR debit',
    sourceType:'sales_invoice.issued',priority:10,
    field:'invoiceKind',value:'BLUE',
    accountCode:'1122',side:'DEBIT',
    amountField:'invoiceAmount',currencyField:'currency'
  });
  await rule({
    enterpriseId:ids.enterpriseId,bookId:mainBook.id,
    code:'sales-invoice-revenue-credit',name:'Sales invoice revenue credit',
    sourceType:'sales_invoice.issued',priority:20,
    field:'invoiceKind',value:'BLUE',
    accountCode:'6001',side:'CREDIT',
    amountField:'invoiceAmount',currencyField:'currency'
  });
  await rule({
    enterpriseId:ids.enterpriseId,bookId:mainBook.id,
    code:'cash-receipt-cash-debit',name:'Cash receipt cash debit',
    sourceType:'cash.received',priority:10,
    field:'semanticRole',value:'CUSTOMER_CASH_RECEIPT',
    accountCode:'1002',side:'DEBIT',
    amountField:'cashAmount',currencyField:'cashCurrency'
  });
  await rule({
    enterpriseId:ids.enterpriseId,bookId:mainBook.id,
    code:'cash-receipt-ar-credit',name:'Cash receipt AR credit',
    sourceType:'cash.received',priority:20,
    field:'semanticRole',value:'CUSTOMER_CASH_RECEIPT',
    accountCode:'1122',side:'CREDIT',
    amountField:'settledAmount',currencyField:'settledCurrency'
  });

  const invoiceNo=`FAI-INV-${suffix}`;
  const invoice=await runtime.command.execute({
    enterpriseId:ids.enterpriseId,
    applicationInstanceId:ids.salesInvoiceAppId,
    commandCode:'issue-sales-invoice',
    actor:{type:'AUTOMATION',id:'fai-validator'},
    requestId:invoiceNo,
    correlationId:`FAI:${suffix}`,
    idempotencyKey:invoiceNo,
    input:{
      invoiceKind:'BLUE',
      invoiceNo,
      orderNo:`FAI-ORDER-${suffix}`,
      customer:'FAI-CUSTOMER',
      invoiceAmount:'1000.00',
      currency:'CNY',
      taxIdentity:'FAI-TAX',
      project:'FAI',
      department:'FINANCE',
      profitCenter:'PC-FAI',
      costCenter:'CC-FAI'
    },
    effectiveAt:new Date('2026-09-22T12:00:00.000Z'),
    businessObjectKey:invoiceNo
  });
  await drainPosting(runtime,ids.enterpriseId);

  const receiptNo=`FAI-RCPT-${suffix}`;
  const receipt=await runtime.command.execute({
    enterpriseId:ids.enterpriseId,
    applicationInstanceId:ids.cashAppId,
    commandCode:'record-receipt',
    actor:{type:'AUTOMATION',id:'fai-validator'},
    requestId:receiptNo,
    correlationId:`FAI:${suffix}`,
    causationId:invoice.businessDataId,
    idempotencyKey:receiptNo,
    input:{
      semanticRole:'CUSTOMER_CASH_RECEIPT',
      orderNo:`FAI-ORDER-${suffix}`,
      customer:'FAI-CUSTOMER',
      settledAmount:'1000.00',
      settledCurrency:'CNY',
      cashAmount:'1000.00',
      cashCurrency:'CNY',
      project:'FAI',
      department:'FINANCE',
      profitCenter:'PC-FAI',
      costCenter:'CC-FAI'
    },
    effectiveAt:new Date('2026-09-22T13:00:00.000Z'),
    businessObjectKey:receiptNo
  });
  await drainPosting(runtime,ids.enterpriseId);

  const invoiceRecognition=await runtime.accountingRecognition.recognizeBusinessData(
    ids.enterpriseId,mainBook.id,invoice.businessDataId
  );
  const receiptRecognition=await runtime.accountingRecognition.recognizeBusinessData(
    ids.enterpriseId,mainBook.id,receipt.businessDataId
  );

  if(invoiceRecognition.length!==2||invoiceRecognition.some(r=>r.status!=='POSTED')){
    throw new Error(`Invoice recognition must post both split rules: ${JSON.stringify(invoiceRecognition)}`);
  }
  if(receiptRecognition.length!==2||receiptRecognition.some(r=>r.status!=='POSTED')){
    throw new Error(`Receipt recognition must post both split rules: ${JSON.stringify(receiptRecognition)}`);
  }
  const invoiceJournalIds=new Set(invoiceRecognition.map(r=>r.journalId));
  if(invoiceJournalIds.size!==1){
    throw new Error('Split invoice rules must aggregate into one Journal.');
  }

  const trial=await runtime.trialBalance.compute(ids.enterpriseId,mainBook.id);
  if(!trial.balanced||!new Decimal(trial.debitTotal).eq(2000)||!new Decimal(trial.creditTotal).eq(2000)){
    throw new Error(`Trial Balance must be 2000 / 2000: ${JSON.stringify(trial)}`);
  }
  const cash=row(trial.rows,'1002');
  const ar=row(trial.rows,'1122');
  const revenue=row(trial.rows,'6001');
  if(!new Decimal(cash.netDebit).eq(1000)||
    !new Decimal(ar.netDebit).eq(0)||!new Decimal(ar.netCredit).eq(0)||
    !new Decimal(revenue.netCredit).eq(1000)){
    throw new Error(`Trial Balance account nets mismatch: ${JSON.stringify({cash,ar,revenue})}`);
  }

  // Broken configuration proof: debit condition matches BLUE, credit condition wrongly expects RED.
  const brokenBook=await createBook(ids.enterpriseId,`FAI_BROKEN_${suffix}`,'FAI Broken Rule Diagnostic Book');
  await account(brokenBook.id,'1122','Accounts Receivable','ASSET','DEBIT');
  await account(brokenBook.id,'6001','Revenue','REVENUE','CREDIT');
  await rule({
    enterpriseId:ids.enterpriseId,bookId:brokenBook.id,
    code:'broken-ar-debit',name:'Broken test AR debit',
    sourceType:'sales_invoice.issued',priority:10,
    field:'invoiceKind',value:'BLUE',
    accountCode:'1122',side:'DEBIT',
    amountField:'invoiceAmount',currencyField:'currency'
  });
  await rule({
    enterpriseId:ids.enterpriseId,bookId:brokenBook.id,
    code:'broken-revenue-credit',name:'Broken test revenue credit',
    sourceType:'sales_invoice.issued',priority:20,
    field:'invoiceKind',value:'RED',
    accountCode:'6001',side:'CREDIT',
    amountField:'invoiceAmount',currencyField:'currency'
  });

  try{
    await runtime.accountingRecognition.recognizeBusinessData(
      ids.enterpriseId,brokenBook.id,invoice.businessDataId
    );
    throw new Error('Broken accounting rule set must reject the Journal.');
  }catch(error){
    if(!(error instanceof AppError)||error.code!=='JOURNAL_MISSING_CREDIT'){
      throw error;
    }
  }

  const brokenJournals=await runtime.db.selectFrom('accounting_journal')
    .select('id')
    .where('accounting_book_id','=',brokenBook.id)
    .execute();
  if(brokenJournals.length!==0){
    throw new Error('Broken rule configuration must commit zero Journals.');
  }

  const brokenTrace=await runtime.db.selectFrom('accounting_rule_execution as x')
    .innerJoin('accounting_rule as r','r.id','x.accounting_rule_id')
    .select(['r.code','x.matched','x.status','x.error_code','x.condition_trace','x.generated_effects'])
    .where('x.accounting_book_id','=',brokenBook.id)
    .where('x.business_data_id','=',invoice.businessDataId)
    .orderBy('r.priority')
    .execute();

  const debitTrace=brokenTrace.find(x=>x.code==='broken-ar-debit');
  const creditTrace=brokenTrace.find(x=>x.code==='broken-revenue-credit');
  if(debitTrace?.matched!==true||debitTrace.status!=='REJECTED'||debitTrace.error_code!=='JOURNAL_MISSING_CREDIT'){
    throw new Error(`Matched debit rule must be marked REJECTED: ${JSON.stringify(brokenTrace)}`);
  }
  if(creditTrace?.matched!==false||creditTrace.status!=='NOT_MATCHED'){
    throw new Error(`Wrong-condition credit rule must be explicitly NOT_MATCHED: ${JSON.stringify(brokenTrace)}`);
  }
  const creditCondition=creditTrace.condition_trace as Record<string,unknown>;
  if(creditCondition.expected!=='RED'||creditCondition.actual!=='BLUE'||creditCondition.matched!==false){
    throw new Error(`Condition trace must explain expected RED / actual BLUE: ${JSON.stringify(creditCondition)}`);
  }

  const diagnostic=await runtime.db.selectFrom('accounting_journal_diagnostic')
    .select(['failure_code','debit_total','credit_total','difference','details'])
    .where('accounting_book_id','=',brokenBook.id)
    .where('source_business_data_id','=',invoice.businessDataId)
    .orderBy('created_at','desc')
    .executeTakeFirstOrThrow();
  if(diagnostic.failure_code!=='JOURNAL_MISSING_CREDIT'||
    !new Decimal(diagnostic.debit_total).eq(1000)||
    !new Decimal(diagnostic.credit_total).eq(0)||
    !new Decimal(diagnostic.difference).eq(1000)){
    throw new Error(`Broken rule diagnostic mismatch: ${JSON.stringify(diagnostic)}`);
  }

  const canonicalBefore=JSON.stringify(await runtime.db.selectFrom('business_data')
    .select(['id','business_data_type','business_object_key','effective_at','payload'])
    .where('id','in',[invoice.businessDataId,receipt.businessDataId])
    .orderBy('effective_at').execute());

  const replay=await runtime.accountingReplay.replay(ids.enterpriseId,mainBook.id);
  if(replay.validationStatus!=='MATCH'||replay.beforeDigest!==replay.afterDigest||
    replay.journalCountBefore!==2||replay.journalCountAfter!==2){
    throw new Error(`GL Replay must MATCH with two journals: ${JSON.stringify(replay)}`);
  }

  const canonicalAfter=JSON.stringify(await runtime.db.selectFrom('business_data')
    .select(['id','business_data_type','business_object_key','effective_at','payload'])
    .where('id','in',[invoice.businessDataId,receipt.businessDataId])
    .orderBy('effective_at').execute());
  if(canonicalBefore!==canonicalAfter){
    throw new Error('GL Replay must not change canonical BusinessData.');
  }

  const trialAfter=await runtime.trialBalance.compute(ids.enterpriseId,mainBook.id);
  if(JSON.stringify(trial)!==JSON.stringify(trialAfter)){
    throw new Error(`Trial Balance changed after GL Replay: before=${JSON.stringify(trial)} after=${JSON.stringify(trialAfter)}`);
  }

  const rebuiltTrace=await runtime.db.selectFrom('accounting_rule_execution')
    .select(['status','matched','journal_id'])
    .where('accounting_book_id','=',mainBook.id)
    .execute();
  if(rebuiltTrace.length!==4||rebuiltTrace.some(x=>x.status!=='POSTED'||x.matched!==true||x.journal_id===null)){
    throw new Error(`Rule execution trace must rebuild after Replay: ${JSON.stringify(rebuiltTrace)}`);
  }

  console.log(JSON.stringify({
    status:'PASS',
    packet:'FAI-03-05',
    accountingRecognition:{
      invoiceRules:invoiceRecognition.map(r=>({rule:r.ruleCode,status:r.status,journalId:r.journalId})),
      receiptRules:receiptRecognition.map(r=>({rule:r.ruleCode,status:r.status,journalId:r.journalId}))
    },
    ruleDiagnosis:{
      failure:'JOURNAL_MISSING_CREDIT',
      debitRule:{matched:true,status:'REJECTED'},
      creditRule:{matched:false,status:'NOT_MATCHED',expected:'RED',actual:'BLUE'},
      zeroJournalCommit:true
    },
    trialBalance:{
      debitTotal:trial.debitTotal,
      creditTotal:trial.creditTotal,
      balanced:trial.balanced,
      cashNetDebit:cash.netDebit,
      arNet:'0',
      revenueNetCredit:revenue.netCredit
    },
    replay:{
      validationStatus:replay.validationStatus,
      journalCountBefore:replay.journalCountBefore,
      journalCountAfter:replay.journalCountAfter,
      digestEqual:replay.beforeDigest===replay.afterDigest,
      canonicalBusinessDataPreserved:true,
      ruleTraceRebuilt:true
    }
  },null,2));
}finally{
  await database.destroy();
}

import { createDatabase, createTransactionRunner } from '../platform/database/src/index.js';
import { loadRuntimeConfig } from '../platform/runtime/src/config.js';
import { PostgresAccountingJournalService } from '../modules/accounting/infrastructure/postgres-accounting-journal-service.js';
import { AppError } from '../platform/contracts/src/index.js';

const config=loadRuntimeConfig();
const database=createDatabase(config.databaseUrl);
const service=new PostgresAccountingJournalService(database.db,createTransactionRunner(database.db));

async function expectReject(
  code:string,
  request:Parameters<typeof service.post>[0]
):Promise<void>{
  const beforeJournals=await database.db.selectFrom('accounting_journal')
    .select(({fn})=>fn.countAll<string>().as('count')).executeTakeFirstOrThrow();
  const beforeLines=await database.db.selectFrom('accounting_journal_line')
    .select(({fn})=>fn.countAll<string>().as('count')).executeTakeFirstOrThrow();

  try{
    await service.post(request);
    throw new Error(`Expected ${code} rejection.`);
  }catch(error){
    if(!(error instanceof AppError)||error.code!==code){
      throw error;
    }
  }

  const afterJournals=await database.db.selectFrom('accounting_journal')
    .select(({fn})=>fn.countAll<string>().as('count')).executeTakeFirstOrThrow();
  const afterLines=await database.db.selectFrom('accounting_journal_line')
    .select(({fn})=>fn.countAll<string>().as('count')).executeTakeFirstOrThrow();

  if(beforeJournals.count!==afterJournals.count||beforeLines.count!==afterLines.count){
    throw new Error(`${code} must commit zero Journal/JournalLine rows.`);
  }

  const diagnostic=await database.db.selectFrom('accounting_journal_diagnostic')
    .select(['failure_code','debit_total','credit_total','difference','accounting_rule_code','details'])
    .where('journal_no','=',request.journalNo)
    .orderBy('created_at','desc')
    .executeTakeFirstOrThrow();

  if(diagnostic.failure_code!==code){
    throw new Error(`Expected diagnostic ${code}, got ${diagnostic.failure_code}.`);
  }
}

try{
  const enterprise=await database.db.selectFrom('enterprise')
    .select('id').where('code','=','EVO_DEMO').executeTakeFirstOrThrow();

  const book=await database.db.insertInto('accounting_book').values({
    enterprise_id:enterprise.id,
    code:'PRC_GAAP_MAIN',
    name:'PRC GAAP Main Book',
    accounting_currency:'CNY',
    amount_scale:2,
    status:'ACTIVE'
  }).returning('id').executeTakeFirstOrThrow();

  async function account(
    code:string,
    name:string,
    type:'ASSET'|'LIABILITY'|'EQUITY'|'REVENUE'|'EXPENSE',
    normal:'DEBIT'|'CREDIT'
  ){
    return database.db.insertInto('accounting_account').values({
      accounting_book_id:book.id,
      code,name,account_type:type,normal_side:normal,status:'ACTIVE'
    }).returning('id').executeTakeFirstOrThrow();
  }

  const ar=await account('1122','Accounts Receivable','ASSET','DEBIT');
  const revenue=await account('6001','Revenue','REVENUE','CREDIT');
  const ap=await account('2202','Accounts Payable','LIABILITY','CREDIT');
  const inventory=await account('1405','Inventory','ASSET','DEBIT');
  const expense=await account('6601','Operating Expense','EXPENSE','DEBIT');

  const balanced=await service.post({
    enterpriseId:enterprise.id,
    accountingBookId:book.id,
    journalNo:'FAI-BALANCED-001',
    effectiveAt:new Date('2026-09-22T10:00:00.000Z'),
    accountingCurrency:'CNY',
    accountingRuleCode:'sales-revenue-recognition',
    accountingRuleVersion:1,
    diagnosticContext:{
      matchedRules:['sales-revenue-recognition'],
      conditionTrace:{recognitionReady:{expected:true,actual:true,matched:true}}
    },
    lines:[
      {accountId:ar.id,side:'DEBIT',amount:'1000.00',currency:'CNY',memo:'Recognize receivable'},
      {accountId:revenue.id,side:'CREDIT',amount:'1000.00',currency:'CNY',memo:'Recognize revenue'}
    ]
  });

  if(balanced.debitTotal!=='1000.00'||balanced.creditTotal!=='1000.00'||balanced.lineCount!==2){
    throw new Error(`Balanced journal result mismatch: ${JSON.stringify(balanced)}`);
  }

  const persisted=await database.db.selectFrom('accounting_journal_line')
    .select(['side','amount']).where('journal_id','=',balanced.journalId)
    .orderBy('line_no').execute();
  if(persisted.length!==2||persisted[0]?.side!=='DEBIT'||persisted[1]?.side!=='CREDIT'){
    throw new Error(`Balanced journal lines mismatch: ${JSON.stringify(persisted)}`);
  }

  await expectReject('JOURNAL_MISSING_CREDIT',{
    enterpriseId:enterprise.id,
    accountingBookId:book.id,
    journalNo:'FAI-MISSING-CREDIT-001',
    effectiveAt:new Date('2026-09-22T10:01:00.000Z'),
    accountingCurrency:'CNY',
    accountingRuleCode:'sales-revenue-recognition',
    accountingRuleVersion:2,
    diagnosticContext:{
      suspectedCategory:'EXPECTED_RULE_NOT_MATCHED',
      conditionTrace:{
        creditRevenueEffect:{
          expectedCondition:'recognitionReady == true',
          configuredCondition:'recognitionReady == false',
          actualValue:true
        }
      }
    },
    lines:[
      {accountId:ar.id,side:'DEBIT',amount:'1000.00',currency:'CNY'}
    ]
  });

  await expectReject('JOURNAL_UNBALANCED',{
    enterpriseId:enterprise.id,
    accountingBookId:book.id,
    journalNo:'FAI-EXTRA-DEBIT-001',
    effectiveAt:new Date('2026-09-22T10:02:00.000Z'),
    accountingCurrency:'CNY',
    accountingRuleCode:'purchase-recognition',
    accountingRuleVersion:4,
    diagnosticContext:{
      suspectedCategory:'EXTRA_ACCOUNTING_EFFECT',
      ruleEffects:[
        {effect:1,target:'inventory',side:'DEBIT',amount:'1000'},
        {effect:2,target:'expense',side:'DEBIT',amount:'200'},
        {effect:3,target:'accounts-payable',side:'CREDIT',amount:'1000'}
      ]
    },
    lines:[
      {accountId:inventory.id,side:'DEBIT',amount:'1000.00',currency:'CNY'},
      {accountId:expense.id,side:'DEBIT',amount:'200.00',currency:'CNY'},
      {accountId:ap.id,side:'CREDIT',amount:'1000.00',currency:'CNY'}
    ]
  });

  const diagnostics=await database.db.selectFrom('accounting_journal_diagnostic')
    .select(['journal_no','failure_code','debit_total','credit_total','difference','details'])
    .where('enterprise_id','=',enterprise.id)
    .where('journal_no','in',['FAI-MISSING-CREDIT-001','FAI-EXTRA-DEBIT-001'])
    .orderBy('journal_no').execute();

  if(diagnostics.length!==2){
    throw new Error(`Expected two durable rejection diagnostics: ${JSON.stringify(diagnostics)}`);
  }

  console.log(JSON.stringify({
    status:'PASS',
    packet:'FAI-01-02',
    balancedJournal:{
      debit:'1000.00',
      credit:'1000.00',
      committed:true
    },
    missingCredit:{
      rejected:true,
      journalRowsCommitted:0,
      diagnostic:'JOURNAL_MISSING_CREDIT',
      ruleDiagnosisPriority:'EXPECTED_RULE_NOT_MATCHED / RULE_CONDITION_MISCONFIGURED'
    },
    extraDebit:{
      rejected:true,
      journalRowsCommitted:0,
      diagnostic:'JOURNAL_UNBALANCED',
      debit:'1200',
      credit:'1000',
      difference:'200',
      ruleDiagnosisPriority:'EXTRA_ACCOUNTING_EFFECT'
    },
    invariant:'有借必有贷、借贷必相等',
    atomicReject:true,
    sourceDataIsNotDefaultSuspect:true
  },null,2));
}finally{
  await database.destroy();
}

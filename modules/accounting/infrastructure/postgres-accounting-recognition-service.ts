import { Decimal } from 'decimal.js';
import type { Kysely } from 'kysely';
import { AppError } from '../../../platform/contracts/src/index.js';
import type { Database } from '../../../platform/database/src/types.js';
import type {
  AccountingJsonObject,
  AccountingJsonValue,
  AccountingRecognitionService,
  RecognitionResult,
  JournalLineInput
} from '../api/contracts.js';
import type { PostgresAccountingJournalService } from './postgres-accounting-journal-service.js';

type Trace = {
  readonly matched: boolean;
  readonly trace: AccountingJsonObject;
};

function isObject(value:unknown):value is Record<string,unknown>{
  return typeof value==='object'&&value!==null&&!Array.isArray(value);
}
function jsonObject(value:unknown,label:string):AccountingJsonObject{
  if(!isObject(value)){
    throw new AppError({code:'ACCOUNTING_RULE_JSON_INVALID',message:`${label} must be an object.`,module:'accounting',operation:'recognize'});
  }
  return value as AccountingJsonObject;
}
function valueAt(payload:Record<string,unknown>,path:string):unknown{
  let current:unknown=payload;
  for(const part of path.split('.')){
    if(!isObject(current)) return undefined;
    current=current[part];
  }
  return current;
}
function evaluateCondition(ast:AccountingJsonObject,payload:Record<string,unknown>):Trace{
  const type=ast.type;
  if(type==='literal'){
    const matched=ast.value===true;
    return {matched,trace:{type:'literal',expected:true,actual:ast.value??null,matched}};
  }
  if(type==='eq'){
    const field=typeof ast.field==='string'?ast.field:null;
    if(field===null){
      throw new AppError({code:'ACCOUNTING_CONDITION_INVALID',message:'eq condition requires field.',module:'accounting',operation:'recognize'});
    }
    const actual=valueAt(payload,field);
    const expected=ast.value;
    const matched=actual===expected;
    return {matched,trace:{type:'eq',field,expected:expected??null,actual:(actual??null) as AccountingJsonValue,matched}};
  }
  if(type==='and'){
    const conditions=Array.isArray(ast.conditions)?ast.conditions:[];
    const traces:AccountingJsonValue[]=[];
    let matched=true;
    for(const condition of conditions){
      const result=evaluateCondition(jsonObject(condition,'and condition'),payload);
      traces.push(result.trace);
      matched=matched&&result.matched;
    }
    return {matched,trace:{type:'and',matched,conditions:traces}};
  }
  if(type==='or'){
    const conditions=Array.isArray(ast.conditions)?ast.conditions:[];
    const traces:AccountingJsonValue[]=[];
    let matched=false;
    for(const condition of conditions){
      const result=evaluateCondition(jsonObject(condition,'or condition'),payload);
      traces.push(result.trace);
      matched=matched||result.matched;
    }
    return {matched,trace:{type:'or',matched,conditions:traces}};
  }
  throw new AppError({
    code:'ACCOUNTING_CONDITION_UNSUPPORTED',
    message:`Unsupported accounting condition type ${String(type)}.`,
    module:'accounting',
    operation:'recognize'
  });
}
function resolveAmount(ast:AccountingJsonObject,payload:Record<string,unknown>):string{
  const type=ast.type;
  if(type==='literal'){
    const amount=new Decimal(String(ast.value));
    if(!amount.isFinite()) throw new Error('Accounting literal amount is not finite.');
    return amount.toString();
  }
  if(type==='field'){
    const path=typeof ast.path==='string'?ast.path:'';
    const raw=valueAt(payload,path);
    const amount=new Decimal(String(raw));
    if(!amount.isFinite()){
      throw new AppError({
        code:'ACCOUNTING_AMOUNT_SOURCE_INVALID',
        message:`Accounting amount field ${path} is missing or non-numeric.`,
        module:'accounting',
        operation:'recognize',
        details:{path,actual:(raw??null) as AccountingJsonValue}
      });
    }
    return amount.toString();
  }
  throw new AppError({
    code:'ACCOUNTING_AMOUNT_EXPRESSION_UNSUPPORTED',
    message:`Unsupported accounting amount expression ${String(type)}.`,
    module:'accounting',
    operation:'recognize'
  });
}

export class PostgresAccountingRecognitionService implements AccountingRecognitionService {
  constructor(
    private readonly db:Kysely<Database>,
    private readonly journals:PostgresAccountingJournalService
  ){}

  async recognizeBusinessData(
    enterpriseId:string,
    accountingBookId:string,
    businessDataId:string
  ):Promise<readonly RecognitionResult[]>{
    const business=await this.db.selectFrom('business_data')
      .select(['id','business_data_type','effective_at','payload'])
      .where('enterprise_id','=',enterpriseId)
      .where('id','=',businessDataId)
      .executeTakeFirst();

    if(business===undefined){
      throw new AppError({code:'ACCOUNTING_SOURCE_NOT_FOUND',message:'BusinessData not found for accounting recognition.',module:'accounting',operation:'recognize',details:{businessDataId}});
    }

    const rules=await this.db.selectFrom('accounting_rule')
      .selectAll()
      .where('enterprise_id','=',enterpriseId)
      .where('accounting_book_id','=',accountingBookId)
      .where('source_business_data_type','=',business.business_data_type)
      .where('status','=','PUBLISHED')
      .orderBy('priority')
      .orderBy('code')
      .orderBy('version')
      .execute();

    const payload=business.payload as unknown as Record<string,unknown>;
    const results:RecognitionResult[]=[];

    for(const rule of rules){
      const existing=await this.db.selectFrom('accounting_rule_execution')
        .select(['matched','condition_trace','generated_effects','journal_id','status','error_code'])
        .where('accounting_rule_id','=',rule.id)
        .where('business_data_id','=',business.id)
        .executeTakeFirst();

      if(existing!==undefined){
        results.push({
          businessDataId:business.id,
          ruleCode:rule.code,
          ruleVersion:rule.version,
          matched:existing.matched,
          status:existing.status,
          ...(existing.journal_id!==null?{journalId:existing.journal_id}:{}),
          conditionTrace:existing.condition_trace as unknown as AccountingJsonObject,
          generatedEffects:existing.generated_effects as unknown as AccountingJsonObject[]
        });
        continue;
      }

      const condition=evaluateCondition(rule.condition_ast as unknown as AccountingJsonObject,payload);
      if(!condition.matched){
        await this.db.insertInto('accounting_rule_execution').values({
          enterprise_id:enterpriseId,
          accounting_book_id:accountingBookId,
          accounting_rule_id:rule.id,
          accounting_rule_version:rule.version,
          business_data_id:business.id,
          matched:false,
          condition_trace:condition.trace as unknown as Record<string,unknown>,
          generated_effects:[],
          journal_id:null,
          status:'NOT_MATCHED',
          error_code:null
        }).execute();
        results.push({
          businessDataId:business.id,ruleCode:rule.code,ruleVersion:rule.version,
          matched:false,status:'NOT_MATCHED',conditionTrace:condition.trace,generatedEffects:[]
        });
        continue;
      }

      const effectRoot=rule.effect_ast as unknown as AccountingJsonObject;
      const rawLines=Array.isArray(effectRoot.lines)?effectRoot.lines:[];
      const accountCodes=[...new Set(rawLines.map(line=>isObject(line)&&typeof line.accountCode==='string'?line.accountCode:'').filter(Boolean))];
      const accounts=await this.db.selectFrom('accounting_account')
        .select(['id','code'])
        .where('accounting_book_id','=',accountingBookId)
        .where('code','in',accountCodes)
        .where('status','=','ACTIVE')
        .execute();
      const accountMap=new Map(accounts.map(a=>[a.code,a.id]));

      const lines:JournalLineInput[]=[];
      const trace:AccountingJsonObject[]=[];
      for(const [index,raw] of rawLines.entries()){
        const effect=jsonObject(raw,`effect line ${index}`);
        const accountCode=typeof effect.accountCode==='string'?effect.accountCode:'';
        const side=effect.side==='DEBIT'||effect.side==='CREDIT'?effect.side:null;
        if(accountCode.length===0||side===null){
          throw new AppError({code:'ACCOUNTING_EFFECT_INVALID',message:'Accounting effect requires accountCode and DEBIT/CREDIT side.',module:'accounting',operation:'recognize',details:{ruleCode:rule.code,effectIndex:index}});
        }
        const accountId=accountMap.get(accountCode);
        if(accountId===undefined){
          throw new AppError({code:'ACCOUNTING_TARGET_ACCOUNT_NOT_FOUND',message:`Accounting rule targets unknown account ${accountCode}.`,module:'accounting',operation:'recognize',details:{ruleCode:rule.code,effectIndex:index,accountCode}});
        }
        const amount=resolveAmount(jsonObject(effect.amount,`effect amount ${index}`),payload);
        const currencyField=typeof effect.currencyField==='string'?effect.currencyField:null;
        const currency=currencyField===null
          ?(typeof effect.currency==='string'?effect.currency:'')
          :String(valueAt(payload,currencyField)??'');
        lines.push({
          accountId,side,amount,currency,
          memo:typeof effect.memo==='string'?effect.memo:undefined
        });
        trace.push({effectIndex:index,accountCode,accountId,side,amount,currency});
      }

      try{
        const journal=await this.journals.post({
          enterpriseId,
          accountingBookId,
          journalNo:`GL:${rule.code}:v${rule.version}:${business.id}`,
          effectiveAt:new Date(business.effective_at),
          accountingCurrency:lines[0]?.currency??'',
          sourceBusinessDataId:business.id,
          accountingRuleCode:rule.code,
          accountingRuleVersion:rule.version,
          diagnosticContext:{
            conditionTrace:condition.trace,
            generatedEffects:trace,
            diagnosisPriority:[
              'RULE_CONDITION_MISCONFIGURED',
              'EXPECTED_RULE_NOT_MATCHED',
              'UNEXPECTED_RULE_MATCHED',
              'MISSING_ACCOUNTING_EFFECT',
              'EXTRA_ACCOUNTING_EFFECT',
              'WRONG_TARGET_ACCOUNT',
              'WRONG_DEBIT_CREDIT_SIDE'
            ]
          },
          lines
        });

        await this.db.insertInto('accounting_rule_execution').values({
          enterprise_id:enterpriseId,
          accounting_book_id:accountingBookId,
          accounting_rule_id:rule.id,
          accounting_rule_version:rule.version,
          business_data_id:business.id,
          matched:true,
          condition_trace:condition.trace as unknown as Record<string,unknown>,
          generated_effects:trace as unknown as readonly unknown[],
          journal_id:journal.journalId,
          status:'POSTED',
          error_code:null
        }).execute();

        results.push({
          businessDataId:business.id,ruleCode:rule.code,ruleVersion:rule.version,
          matched:true,status:'POSTED',journalId:journal.journalId,
          conditionTrace:condition.trace,generatedEffects:trace
        });
      }catch(error){
        const code=error instanceof AppError?error.code:'ACCOUNTING_RECOGNITION_FAILED';
        await this.db.insertInto('accounting_rule_execution').values({
          enterprise_id:enterpriseId,
          accounting_book_id:accountingBookId,
          accounting_rule_id:rule.id,
          accounting_rule_version:rule.version,
          business_data_id:business.id,
          matched:true,
          condition_trace:condition.trace as unknown as Record<string,unknown>,
          generated_effects:trace as unknown as readonly unknown[],
          journal_id:null,
          status:'REJECTED',
          error_code:code
        }).execute();
        throw error;
      }
    }

    return results;
  }
}

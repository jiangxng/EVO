import { Decimal } from 'decimal.js';
import { sql, type Kysely } from 'kysely';
import { AppError } from '../../../platform/contracts/src/index.js';
import type { Database } from '../../../platform/database/src/types.js';
import type { AccountingJsonObject, StatementProjection, StatementProjectionLine } from '../api/contracts.js';
import { evaluateStatementCondition, statementDigest } from '../domain/statement-projection-utils.js';

type StatementContext = {
  period:{id:string;code:string;starts_at:Date;ends_at:Date};
  definition:{id:string;code:string;name:string;statement_type:'BALANCE_SHEET'|'INCOME_STATEMENT'|'CASH_FLOW_STATEMENT';version:number};
  amountScale:number;
};

export class PostgresStatementProjectionService {
  constructor(private readonly db:Kysely<Database>){}

  private async context(enterpriseId:string,accountingBookId:string,accountingPeriodId:string,statementDefinitionId:string):Promise<StatementContext>{
    const book=await this.db.selectFrom('accounting_book').select(['id','amount_scale'])
      .where('id','=',accountingBookId).where('enterprise_id','=',enterpriseId).executeTakeFirstOrThrow();
    const period=await this.db.selectFrom('accounting_period').select(['id','code','starts_at','ends_at'])
      .where('id','=',accountingPeriodId).where('enterprise_id','=',enterpriseId).where('accounting_book_id','=',accountingBookId).executeTakeFirstOrThrow();
    const definition=await this.db.selectFrom('statement_definition').select(['id','code','name','statement_type','version'])
      .where('id','=',statementDefinitionId).where('enterprise_id','=',enterpriseId).where('accounting_book_id','=',accountingBookId).where('status','=','PUBLISHED').executeTakeFirstOrThrow();
    return {period,definition,amountScale:book.amount_scale};
  }

  private async accountAmount(
    enterpriseId:string, accountingBookId:string,
    semantics:'OPENING_BALANCE'|'ENDING_BALANCE'|'PERIOD_MOVEMENT'|'CASH_FLOW',
    period:{starts_at:Date;ends_at:Date},
    mapping:{accounting_account_code:string;balance_basis:'NET_DEBIT'|'NET_CREDIT'|'MOVEMENT_DEBIT'|'MOVEMENT_CREDIT'|'MOVEMENT_NET_DEBIT'|'MOVEMENT_NET_CREDIT';multiplier:string}
  ):Promise<{amount:Decimal;component:AccountingJsonObject}>{
    const account=await this.db.selectFrom('accounting_account').select(['id','code','name'])
      .where('accounting_book_id','=',accountingBookId).where('code','=',mapping.accounting_account_code).where('status','=','ACTIVE').executeTakeFirst();
    if(account===undefined) throw new AppError({code:'STATEMENT_ACCOUNT_MAPPING_INVALID',message:'Unknown active mapped account '+mapping.accounting_account_code+'.',module:'accounting',operation:'projectStatement'});

    let query=this.db.selectFrom('accounting_journal_line as l')
      .innerJoin('accounting_journal as j','j.id','l.journal_id')
      .select([
        sql<string>`coalesce(sum(case when l.side='DEBIT' then l.amount else 0 end),0)`.as('debit'),
        sql<string>`coalesce(sum(case when l.side='CREDIT' then l.amount else 0 end),0)`.as('credit')
      ])
      .where('j.enterprise_id','=',enterpriseId).where('j.accounting_book_id','=',accountingBookId).where('l.accounting_account_id','=',account.id);
    if(semantics==='OPENING_BALANCE') query=query.where('j.effective_at','<',period.starts_at);
    else if(semantics==='ENDING_BALANCE') query=query.where('j.effective_at','<',period.ends_at);
    else query=query.where('j.effective_at','>=',period.starts_at).where('j.effective_at','<',period.ends_at);

    const row=await query.executeTakeFirstOrThrow();
    const debit=new Decimal(row.debit), credit=new Decimal(row.credit);
    let basis:Decimal;
    switch(mapping.balance_basis){
      case 'NET_DEBIT': basis=Decimal.max(debit.minus(credit),0); break;
      case 'NET_CREDIT': basis=Decimal.max(credit.minus(debit),0); break;
      case 'MOVEMENT_DEBIT': basis=debit; break;
      case 'MOVEMENT_CREDIT': basis=credit; break;
      case 'MOVEMENT_NET_DEBIT': basis=Decimal.max(debit.minus(credit),0); break;
      case 'MOVEMENT_NET_CREDIT': basis=Decimal.max(credit.minus(debit),0); break;
    }
    const amount=basis.times(mapping.multiplier);
    return {amount,component:{source:'ACCOUNT',accountCode:account.code,accountName:account.name,basis:mapping.balance_basis,debit:debit.toString(),credit:credit.toString(),multiplier:mapping.multiplier,amount:amount.toString()}};
  }

  private async cashFlowAmounts(enterpriseId:string,accountingBookId:string,statementDefinitionId:string,period:{starts_at:Date;ends_at:Date}){
    const rules=await this.db.selectFrom('cash_flow_classification_rule')
      .select(['code','version','source_business_data_type','condition_ast','cash_flow_category','statement_line_code','direction','priority'])
      .where('enterprise_id','=',enterpriseId).where('accounting_book_id','=',accountingBookId).where('statement_definition_id','=',statementDefinitionId).where('status','=','PUBLISHED')
      .orderBy('priority').orderBy('code').orderBy('version').execute();
    const cashLines=await this.db.selectFrom('accounting_journal_line as l')
      .innerJoin('accounting_journal as j','j.id','l.journal_id').innerJoin('accounting_account as a','a.id','l.accounting_account_id')
      .select(['j.journal_no','j.source_business_data_id','a.code as account_code','l.side','l.amount'])
      .where('j.enterprise_id','=',enterpriseId).where('j.accounting_book_id','=',accountingBookId)
      .where('j.effective_at','>=',period.starts_at).where('j.effective_at','<',period.ends_at).where('a.is_cash_equivalent','=',true)
      .orderBy('j.journal_no').orderBy('l.line_no').execute();

    const bySource=new Map<string,{journalNos:Set<string>;movement:Decimal;accounts:Set<string>}>();
    for(const line of cashLines){
      if(line.source_business_data_id===null) throw new AppError({code:'CASH_FLOW_UNCLASSIFIED_MANUAL_MOVEMENT',message:'Cash movement without BusinessData lineage cannot be classified.',module:'accounting',operation:'projectStatement',details:{journalNo:line.journal_no}});
      const current=bySource.get(line.source_business_data_id)??{journalNos:new Set<string>(),movement:new Decimal(0),accounts:new Set<string>()};
      current.journalNos.add(line.journal_no); current.accounts.add(line.account_code);
      current.movement=current.movement.plus(line.side==='DEBIT'?line.amount:new Decimal(line.amount).negated());
      bySource.set(line.source_business_data_id,current);
    }

    const result=new Map<string,{amount:Decimal;components:AccountingJsonObject[]}>();
    for(const [businessDataId,cash] of bySource){
      const fact=await this.db.selectFrom('business_data').select(['business_data_type','payload'])
        .where('id','=',businessDataId).where('enterprise_id','=',enterpriseId).executeTakeFirstOrThrow();
      const payload=fact.payload as unknown as Record<string,unknown>;
      const matched=rules.filter(rule=>rule.source_business_data_type===fact.business_data_type&&evaluateStatementCondition(rule.condition_ast as unknown as Record<string,unknown>,payload));
      if(matched.length===0) throw new AppError({code:'CASH_FLOW_UNCLASSIFIED_MOVEMENT',message:'Cash movement has no matching CashFlowClassificationRule.',module:'accounting',operation:'projectStatement',details:{businessDataId,businessDataType:fact.business_data_type}});
      if(matched.length>1) throw new AppError({code:'CASH_FLOW_CLASSIFICATION_AMBIGUOUS',message:'Cash movement matches multiple CashFlowClassificationRules.',module:'accounting',operation:'projectStatement',details:{businessDataId,matchedRuleCodes:matched.map(rule=>rule.code)}});
      const rule=matched[0]!;
      if(rule.direction==='INFLOW'&&!cash.movement.gt(0)) throw new AppError({code:'CASH_FLOW_DIRECTION_MISMATCH',message:'INFLOW rule matched non-positive cash movement.',module:'accounting',operation:'projectStatement'});
      if(rule.direction==='OUTFLOW'&&!cash.movement.lt(0)) throw new AppError({code:'CASH_FLOW_DIRECTION_MISMATCH',message:'OUTFLOW rule matched non-negative cash movement.',module:'accounting',operation:'projectStatement'});
      const target=result.get(rule.statement_line_code)??{amount:new Decimal(0),components:[]};
      target.amount=target.amount.plus(cash.movement);
      target.components.push({source:'CASH_FLOW_CLASSIFICATION',businessDataId,businessDataType:fact.business_data_type,ruleCode:rule.code,ruleVersion:rule.version,category:rule.cash_flow_category,direction:rule.direction,journalNos:[...cash.journalNos].sort(),cashAccounts:[...cash.accounts].sort(),amount:cash.movement.toString()});
      result.set(rule.statement_line_code,target);
    }
    return result;
  }

  async project(enterpriseId:string,accountingBookId:string,accountingPeriodId:string,statementDefinitionId:string):Promise<StatementProjection>{
    const context=await this.context(enterpriseId,accountingBookId,accountingPeriodId,statementDefinitionId);
    const run=await this.db.insertInto('statement_projection_run').values({enterprise_id:enterpriseId,accounting_book_id:accountingBookId,accounting_period_id:accountingPeriodId,statement_definition_id:statementDefinitionId,status:'PROCESSING',semantic_digest:null,error:null,completed_at:null}).returning('id').executeTakeFirstOrThrow();
    try{
      const lines=await this.db.selectFrom('statement_line_definition').selectAll().where('statement_definition_id','=',statementDefinitionId).orderBy('sort_order').orderBy('code').execute();
      const roles=lines.map(x=>x.semantic_role).filter((x):x is string=>x!==null);
      if(new Set(roles).size!==roles.length) throw new AppError({code:'STATEMENT_SEMANTIC_ROLE_DUPLICATE',message:'semantic_role must be unique within a statement.',module:'accounting',operation:'projectStatement'});
      const mappings=await this.db.selectFrom('account_statement_mapping').select(['statement_line_code','accounting_account_code','balance_basis','multiplier']).where('statement_definition_id','=',statementDefinitionId).orderBy('statement_line_code').orderBy('accounting_account_code').execute();
      const byLine=new Map<string,typeof mappings>();
      for(const mapping of mappings){const group=byLine.get(mapping.statement_line_code)??[];group.push(mapping);byLine.set(mapping.statement_line_code,group);}
      const amounts=new Map<string,Decimal>(), components=new Map<string,AccountingJsonObject[]>();
      const cash=context.definition.statement_type==='CASH_FLOW_STATEMENT'?await this.cashFlowAmounts(enterpriseId,accountingBookId,statementDefinitionId,context.period):new Map<string,{amount:Decimal;components:AccountingJsonObject[]}>();

      for(const line of lines){
        if(line.aggregation_type==='ACCOUNT_MAPPING'){
          let total=new Decimal(0); const parts:AccountingJsonObject[]=[];
          for(const mapping of byLine.get(line.code)??[]){const resolved=await this.accountAmount(enterpriseId,accountingBookId,line.value_semantics,context.period,mapping);total=total.plus(resolved.amount);parts.push(resolved.component);}
          amounts.set(line.code,total.times(line.presentation_sign));components.set(line.code,parts);
        }else if(line.aggregation_type==='CASH_FLOW_CLASSIFICATION'){
          const classified=cash.get(line.code)??{amount:new Decimal(0),components:[]};
          amounts.set(line.code,classified.amount.times(line.presentation_sign));components.set(line.code,classified.components);
        }
      }

      const lineByCode=new Map(lines.map(line=>[line.code,line])); const resolving=new Set<string>();
      const resolve=(code:string):Decimal=>{
        const existing=amounts.get(code); if(existing!==undefined) return existing;
        const line=lineByCode.get(code); if(line===undefined) throw new Error('Unknown statement line '+code+'.');
        if(line.aggregation_type!=='SUM_CHILDREN'){amounts.set(code,new Decimal(0));components.set(code,[]);return new Decimal(0);}
        if(resolving.has(code)) throw new AppError({code:'STATEMENT_LINE_CYCLE',message:'Statement hierarchy contains a cycle.',module:'accounting',operation:'projectStatement',details:{lineCode:code}});
        resolving.add(code); let total=new Decimal(0); const parts:AccountingJsonObject[]=[];
        for(const child of lines.filter(x=>x.parent_code===code)){const amount=resolve(child.code);total=total.plus(amount);parts.push({source:'CHILD_LINE',lineCode:child.code,amount:amount.toString()});}
        resolving.delete(code); total=total.times(line.presentation_sign);amounts.set(code,total);components.set(code,parts);return total;
      };
      for(const line of lines) resolve(line.code);

      const projected:StatementProjectionLine[]=lines.map(line=>{const base={code:line.code,name:line.name,amount:(amounts.get(line.code)??new Decimal(0)).toFixed(context.amountScale),components:components.get(line.code)??[]};return line.semantic_role===null?base:{...base,semanticRole:line.semantic_role};});
      const semanticDigest=statementDigest({statement:{code:context.definition.code,type:context.definition.statement_type,version:context.definition.version},period:{code:context.period.code,startsAt:context.period.starts_at.toISOString(),endsAt:context.period.ends_at.toISOString()},lines:projected});
      for(const line of projected) await this.db.insertInto('statement_projection_line').values({statement_projection_run_id:run.id,statement_line_code:line.code,amount:line.amount,components:sql<readonly unknown[]>`${JSON.stringify(line.components)}::jsonb`}).execute();
      await this.db.updateTable('statement_projection_run').set({status:'COMPLETED',semantic_digest:semanticDigest,completed_at:new Date(),error:null}).where('id','=',run.id).execute();
      return {runId:run.id,statementDefinitionId,statementType:context.definition.statement_type,statementCode:context.definition.code,statementVersion:context.definition.version,accountingPeriodId,digest:semanticDigest,lines:projected};
    }catch(error){
      await this.db.updateTable('statement_projection_run').set({status:'FAILED',completed_at:new Date(),error:{message:error instanceof Error?error.message:String(error)}}).where('id','=',run.id).execute();throw error;
    }
  }
}

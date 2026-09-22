import { Decimal } from 'decimal.js';
import { sql, type Kysely } from 'kysely';
import type { Database } from '../../../platform/database/src/types.js';
import type { AccountingReconciliationService, ReconciliationRunResult, ReconciliationRuleResult } from '../api/contracts.js';

export class PostgresAccountingReconciliationService implements AccountingReconciliationService {
  constructor(private readonly db:Kysely<Database>){}

  async run(enterpriseId:string,accountingBookId:string,accountingPeriodId?:string):Promise<ReconciliationRunResult>{
    const period=accountingPeriodId===undefined ? undefined : await this.db.selectFrom('accounting_period')
      .select(['id','starts_at','ends_at'])
      .where('id','=',accountingPeriodId)
      .where('enterprise_id','=',enterpriseId)
      .where('accounting_book_id','=',accountingBookId)
      .executeTakeFirstOrThrow();

    const rules=await this.db.selectFrom('account_reconciliation_rule').selectAll()
      .where('enterprise_id','=',enterpriseId)
      .where('accounting_book_id','=',accountingBookId)
      .where('status','=','PUBLISHED')
      .orderBy('code').orderBy('version').execute();

    const results:ReconciliationRuleResult[]=[];
    for(const rule of rules){
      let ledgerQuery=this.db.selectFrom('ledger_entry as e')
        .innerJoin('ledger_definition as d','d.id','e.ledger_definition_id')
        .select(sql<string>`coalesce(sum(e.amount),0)`.as('amount'))
        .where('e.enterprise_id','=',enterpriseId)
        .where('d.code','=',rule.source_ledger_code);
      if(period!==undefined) ledgerQuery=ledgerQuery.where('e.effective_at','<',period.ends_at);
      const ledger=await ledgerQuery.executeTakeFirstOrThrow();
      const sourceAmount=new Decimal(ledger.amount).times(rule.source_multiplier);

      let journalQuery=this.db.selectFrom('accounting_journal_line as l')
        .innerJoin('accounting_journal as j','j.id','l.journal_id')
        .innerJoin('accounting_account as a','a.id','l.accounting_account_id')
        .select([
          sql<string>`coalesce(sum(case when l.side='DEBIT' then l.amount else 0 end),0)`.as('debit'),
          sql<string>`coalesce(sum(case when l.side='CREDIT' then l.amount else 0 end),0)`.as('credit')
        ])
        .where('j.enterprise_id','=',enterpriseId)
        .where('j.accounting_book_id','=',accountingBookId)
        .where('a.code','=',rule.target_account_code);
      if(period!==undefined) journalQuery=journalQuery.where('j.effective_at','<',period.ends_at);
      const gl=await journalQuery.executeTakeFirstOrThrow();
      const debit=new Decimal(gl.debit);
      const credit=new Decimal(gl.credit);
      const targetAmount=rule.target_basis==='NET_DEBIT' ? Decimal.max(debit.minus(credit),0) : Decimal.max(credit.minus(debit),0);
      const difference=sourceAmount.minus(targetAmount);
      const matched=difference.abs().lte(new Decimal(rule.tolerance));
      results.push({
        ruleCode:rule.code, sourceLedgerCode:rule.source_ledger_code, sourceAmount:sourceAmount.toString(),
        targetAccountCode:rule.target_account_code, targetAmount:targetAmount.toString(),
        difference:difference.toString(), matched
      });
    }

    const mismatchCount=results.filter(row=>!row.matched).length;
    const run=await this.db.insertInto('account_reconciliation_run').values({
      enterprise_id:enterpriseId, accounting_book_id:accountingBookId, accounting_period_id:accountingPeriodId??null,
      status:mismatchCount===0?'MATCH':'MISMATCH', checked_rule_count:results.length, mismatch_count:mismatchCount,
      results:sql<readonly unknown[]>`${JSON.stringify(results)}::jsonb`
    }).returning('id').executeTakeFirstOrThrow();

    return {runId:run.id,status:mismatchCount===0?'MATCH':'MISMATCH',checkedRuleCount:results.length,mismatchCount,results};
  }
}

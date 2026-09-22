import { Decimal } from 'decimal.js';
import { sql, type Kysely } from 'kysely';
import { AppError } from '../../../platform/contracts/src/index.js';
import type { Database } from '../../../platform/database/src/types.js';
import type { AccountingJsonObject, CoreStatementReconciliationResult, StatementProjection } from '../api/contracts.js';
import type { PostgresStatementProjectionService } from './postgres-statement-projection-service.js';

export class PostgresCoreStatementReconciliationService {
  constructor(private readonly db:Kysely<Database>,private readonly projection:PostgresStatementProjectionService){}

  async reconcile(enterpriseId:string,accountingBookId:string,accountingPeriodId:string,balanceSheetDefinitionId:string,incomeStatementDefinitionId:string,cashFlowDefinitionId:string):Promise<CoreStatementReconciliationResult>{
    const [balanceSheet,incomeStatement,cashFlowStatement]=await Promise.all([
      this.projection.project(enterpriseId,accountingBookId,accountingPeriodId,balanceSheetDefinitionId),
      this.projection.project(enterpriseId,accountingBookId,accountingPeriodId,incomeStatementDefinitionId),
      this.projection.project(enterpriseId,accountingBookId,accountingPeriodId,cashFlowDefinitionId)
    ]);
    if(balanceSheet.statementType!=='BALANCE_SHEET'||incomeStatement.statementType!=='INCOME_STATEMENT'||cashFlowStatement.statementType!=='CASH_FLOW_STATEMENT')
      throw new AppError({code:'CORE_STATEMENT_TYPE_MISMATCH',message:'Core reconciliation requires BS, IS and CF definitions.',module:'accounting',operation:'reconcileCoreStatements'});

    const byRole=(projection:StatementProjection,role:string):Decimal=>{
      const line=projection.lines.find(item=>item.semanticRole===role);
      if(line===undefined) throw new AppError({code:'CORE_STATEMENT_SEMANTIC_ROLE_MISSING',message:'Missing required statement semantic role '+role+'.',module:'accounting',operation:'reconcileCoreStatements',details:{statementCode:projection.statementCode,role}});
      return new Decimal(line.amount);
    };
    const assets=byRole(balanceSheet,'BS_ASSETS_TOTAL');
    const liabilitiesEquity=byRole(balanceSheet,'BS_LIABILITIES_EQUITY_TOTAL');
    const bsCash=byRole(balanceSheet,'BS_CASH_ENDING');
    const bsCurrentEarnings=byRole(balanceSheet,'BS_CURRENT_PERIOD_EARNINGS');
    const netIncome=byRole(incomeStatement,'IS_NET_INCOME');
    const openingCash=byRole(cashFlowStatement,'CF_OPENING_CASH');
    const netCashChange=byRole(cashFlowStatement,'CF_NET_CHANGE');
    const closingCash=byRole(cashFlowStatement,'CF_CLOSING_CASH');
    const book=await this.db.selectFrom('accounting_book').select('amount_scale').where('id','=',accountingBookId).executeTakeFirstOrThrow();
    const tolerance=new Decimal(1).div(new Decimal(10).pow(book.amount_scale));
    const checks:AccountingJsonObject[]=[
      {code:'BALANCE_SHEET_EQUATION',left:assets.toString(),right:liabilitiesEquity.toString(),difference:assets.minus(liabilitiesEquity).toString(),matched:assets.minus(liabilitiesEquity).abs().lt(tolerance)},
      {code:'NET_INCOME_TO_CURRENT_EARNINGS',left:netIncome.toString(),right:bsCurrentEarnings.toString(),difference:netIncome.minus(bsCurrentEarnings).toString(),matched:netIncome.minus(bsCurrentEarnings).abs().lt(tolerance)},
      {code:'CASH_FLOW_ROLL_FORWARD',opening:openingCash.toString(),netChange:netCashChange.toString(),closing:closingCash.toString(),difference:openingCash.plus(netCashChange).minus(closingCash).toString(),matched:openingCash.plus(netCashChange).minus(closingCash).abs().lt(tolerance)},
      {code:'CASH_FLOW_TO_BALANCE_SHEET_CASH',left:closingCash.toString(),right:bsCash.toString(),difference:closingCash.minus(bsCash).toString(),matched:closingCash.minus(bsCash).abs().lt(tolerance)}
    ];
    const mismatch=checks.filter(check=>check.matched!==true).length;
    const row=await this.db.insertInto('financial_statement_reconciliation_run').values({
      enterprise_id:enterpriseId,accounting_book_id:accountingBookId,accounting_period_id:accountingPeriodId,
      balance_sheet_projection_run_id:balanceSheet.runId,income_statement_projection_run_id:incomeStatement.runId,cash_flow_projection_run_id:cashFlowStatement.runId,
      status:mismatch===0?'MATCH':'MISMATCH',results:sql<readonly unknown[]>`${JSON.stringify(checks)}::jsonb`
    }).returning('id').executeTakeFirstOrThrow();
    return {runId:row.id,status:mismatch===0?'MATCH':'MISMATCH',checks,balanceSheet,incomeStatement,cashFlowStatement};
  }
}

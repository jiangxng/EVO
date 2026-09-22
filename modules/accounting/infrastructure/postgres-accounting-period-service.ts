import type { Kysely } from 'kysely';
import { AppError } from '../../../platform/contracts/src/index.js';
import type { Database } from '../../../platform/database/src/types.js';
import type { AccountingPeriodInput, AccountingPeriodService } from '../api/contracts.js';

export class PostgresAccountingPeriodService implements AccountingPeriodService {
  constructor(private readonly db:Kysely<Database>){}

  async createOpenPeriod(input:AccountingPeriodInput):Promise<{readonly periodId:string}>{
    if(input.endsAt<=input.startsAt){
      throw new AppError({code:'ACCOUNTING_PERIOD_RANGE_INVALID',message:'Accounting period end must be after start.',module:'accounting',operation:'createPeriod'});
    }
    const overlap=await this.db.selectFrom('accounting_period')
      .select('id')
      .where('accounting_book_id','=',input.accountingBookId)
      .where('starts_at','<',input.endsAt)
      .where('ends_at','>',input.startsAt)
      .executeTakeFirst();
    if(overlap!==undefined){
      throw new AppError({code:'ACCOUNTING_PERIOD_OVERLAP',message:'Accounting periods may not overlap within one accounting book.',module:'accounting',operation:'createPeriod',details:{conflictingPeriodId:overlap.id}});
    }
    const row=await this.db.insertInto('accounting_period').values({
      enterprise_id:input.enterpriseId, accounting_book_id:input.accountingBookId,
      fiscal_year:input.fiscalYear, period_no:input.periodNo, code:input.code, name:input.name,
      starts_at:input.startsAt, ends_at:input.endsAt, status:'OPEN',
      closed_at:null, closed_by:null, close_reason:null
    }).returning('id').executeTakeFirstOrThrow();
    return {periodId:row.id};
  }

  async closePeriod(enterpriseId:string,accountingBookId:string,periodId:string,closedBy:string,reason:string):Promise<void>{
    const updated=await this.db.updateTable('accounting_period').set({
      status:'CLOSED', closed_at:new Date(), closed_by:closedBy, close_reason:reason
    }).where('id','=',periodId).where('enterprise_id','=',enterpriseId).where('accounting_book_id','=',accountingBookId).where('status','=','OPEN').returning('id').executeTakeFirst();
    if(updated===undefined){
      throw new AppError({code:'ACCOUNTING_PERIOD_NOT_OPEN',message:'Accounting period is not open or does not exist.',module:'accounting',operation:'closePeriod',details:{periodId}});
    }
  }

  async reopenPeriod(enterpriseId:string,accountingBookId:string,periodId:string):Promise<void>{
    const updated=await this.db.updateTable('accounting_period').set({
      status:'OPEN', closed_at:null, closed_by:null, close_reason:null
    }).where('id','=',periodId).where('enterprise_id','=',enterpriseId).where('accounting_book_id','=',accountingBookId).where('status','=','CLOSED').returning('id').executeTakeFirst();
    if(updated===undefined){
      throw new AppError({code:'ACCOUNTING_PERIOD_NOT_CLOSED',message:'Accounting period is not closed or does not exist.',module:'accounting',operation:'reopenPeriod',details:{periodId}});
    }
  }
}

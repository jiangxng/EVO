import { Decimal } from 'decimal.js';
import type { Kysely } from 'kysely';
import type { Database } from '../../../platform/database/src/types.js';
import type {
  TrialBalance,
  TrialBalanceRow,
  TrialBalanceService
} from '../api/contracts.js';

export class PostgresTrialBalanceService implements TrialBalanceService {
  constructor(private readonly db:Kysely<Database>){}

  async compute(enterpriseId:string,accountingBookId:string):Promise<TrialBalance>{
    const book=await this.db.selectFrom('accounting_book')
      .select(['id','accounting_currency','amount_scale'])
      .where('id','=',accountingBookId)
      .where('enterprise_id','=',enterpriseId)
      .executeTakeFirstOrThrow();

    const rows=await this.db.selectFrom('accounting_account as a')
      .leftJoin('accounting_journal_line as l','l.accounting_account_id','a.id')
      .leftJoin('accounting_journal as j',(join)=>join
        .onRef('j.id','=','l.journal_id')
        .on('j.enterprise_id','=',enterpriseId)
        .on('j.accounting_book_id','=',accountingBookId))
      .select([
        'a.id as account_id',
        'a.code as account_code',
        'a.name as account_name',
        'l.side',
        'l.amount'
      ])
      .where('a.accounting_book_id','=',accountingBookId)
      .where('a.status','=','ACTIVE')
      .orderBy('a.code')
      .execute();

    const grouped=new Map<string,{
      code:string;
      name:string;
      debit:Decimal;
      credit:Decimal;
    }>();

    for(const row of rows){
      const current=grouped.get(row.account_id)??{
        code:row.account_code,
        name:row.account_name,
        debit:new Decimal(0),
        credit:new Decimal(0)
      };
      if(row.side==='DEBIT'&&row.amount!==null) current.debit=current.debit.plus(row.amount);
      if(row.side==='CREDIT'&&row.amount!==null) current.credit=current.credit.plus(row.amount);
      grouped.set(row.account_id,current);
    }

    let debitTotal=new Decimal(0);
    let creditTotal=new Decimal(0);
    const resultRows:TrialBalanceRow[]=[];
    for(const [accountId,row] of grouped){
      debitTotal=debitTotal.plus(row.debit);
      creditTotal=creditTotal.plus(row.credit);
      const net=row.debit.minus(row.credit);
      resultRows.push({
        accountId,
        accountCode:row.code,
        accountName:row.name,
        debitTotal:row.debit.toFixed(book.amount_scale),
        creditTotal:row.credit.toFixed(book.amount_scale),
        netDebit:(net.gt(0)?net:new Decimal(0)).toFixed(book.amount_scale),
        netCredit:(net.lt(0)?net.abs():new Decimal(0)).toFixed(book.amount_scale)
      });
    }

    return {
      enterpriseId,
      accountingBookId,
      currency:book.accounting_currency,
      rows:resultRows,
      debitTotal:debitTotal.toFixed(book.amount_scale),
      creditTotal:creditTotal.toFixed(book.amount_scale),
      balanced:debitTotal.eq(creditTotal)
    };
  }
}

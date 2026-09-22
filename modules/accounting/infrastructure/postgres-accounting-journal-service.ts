import { Decimal } from 'decimal.js';
import type { Kysely } from 'kysely';
import { AppError } from '../../../platform/contracts/src/index.js';
import type { Database } from '../../../platform/database/src/types.js';
import type { DatabaseTransactionRunner } from '../../../platform/database/src/transaction.js';
import type {
  AccountingJournalService,
  AccountingAccountingJsonObject,
  PostJournalRequest,
  PostJournalResult
} from '../api/contracts.js';

type Totals = {
  readonly debit: Decimal;
  readonly credit: Decimal;
  readonly debitLines: number;
  readonly creditLines: number;
};

function fail(code:string,message:string,details?:AccountingJsonObject):never{
  throw new AppError({
    code,
    message,
    module:'accounting',
    operation:'postJournal',
    ...(details!==undefined?{details}: {})
  });
}

function totals(request:PostJournalRequest):Totals{
  let debit=new Decimal(0);
  let credit=new Decimal(0);
  let debitLines=0;
  let creditLines=0;

  for(const [index,line] of request.lines.entries()){
    const amount=new Decimal(line.amount);
    if(!amount.isFinite()||amount.lte(0)){
      fail('JOURNAL_LINE_AMOUNT_INVALID','Journal line amount must be finite and greater than zero.',{
        lineIndex:index,
        amount:line.amount
      });
    }
    if(line.currency!==request.accountingCurrency){
      fail('JOURNAL_LINE_CURRENCY_MISMATCH','Journal line currency must equal the accounting-book journal currency.',{
        lineIndex:index,
        lineCurrency:line.currency,
        journalCurrency:request.accountingCurrency
      });
    }
    if(line.side==='DEBIT'){
      debit=debit.plus(amount);
      debitLines+=1;
    }else{
      credit=credit.plus(amount);
      creditLines+=1;
    }
  }

  return {debit,credit,debitLines,creditLines};
}

export class PostgresAccountingJournalService implements AccountingJournalService {
  constructor(
    private readonly db:Kysely<Database>,
    private readonly transactions:DatabaseTransactionRunner
  ){}

  async post(request:PostJournalRequest):Promise<PostJournalResult>{
    let computed:Totals|undefined;
    try{
      if(request.journalNo.trim().length===0){
        fail('JOURNAL_NO_REQUIRED','Journal number is required.');
      }
      if(request.lines.length===0){
        fail('JOURNAL_LINES_REQUIRED','Journal must contain lines.');
      }

      computed=totals(request);

      if(computed.debitLines===0){
        fail('JOURNAL_MISSING_DEBIT','Journal must contain at least one DEBIT line.',{
          debitLineCount:0,
          creditLineCount:computed.creditLines
        });
      }
      if(computed.creditLines===0){
        fail('JOURNAL_MISSING_CREDIT','Journal must contain at least one CREDIT line.',{
          debitLineCount:computed.debitLines,
          creditLineCount:0
        });
      }
      if(!computed.debit.eq(computed.credit)){
        fail('JOURNAL_UNBALANCED','Journal debit and credit totals must be equal.',{
          debitTotal:computed.debit.toString(),
          creditTotal:computed.credit.toString(),
          difference:computed.debit.minus(computed.credit).toString(),
          likelyCauses:[
            'RULE_CONDITION_MISCONFIGURED',
            'EXPECTED_RULE_NOT_MATCHED',
            'UNEXPECTED_RULE_MATCHED',
            'MISSING_ACCOUNTING_EFFECT',
            'EXTRA_ACCOUNTING_EFFECT',
            'WRONG_TARGET_ACCOUNT',
            'WRONG_DEBIT_CREDIT_SIDE',
            'DUPLICATE_ACCOUNTING_EFFECT',
            'AMOUNT_EXPRESSION_ERROR'
          ]
        });
      }

      const result=await this.transactions.run(async trx=>{
        const book=await trx.selectFrom('accounting_book')
          .select(['id','enterprise_id','accounting_currency','amount_scale','status'])
          .where('id','=',request.accountingBookId)
          .where('enterprise_id','=',request.enterpriseId)
          .executeTakeFirst();

        if(book===undefined||book.status!=='ACTIVE'){
          fail('ACCOUNTING_BOOK_NOT_ACTIVE','Accounting book does not exist or is not active.',{
            accountingBookId:request.accountingBookId
          });
        }
        if(book.accounting_currency!==request.accountingCurrency){
          fail('ACCOUNTING_BOOK_CURRENCY_MISMATCH','Journal currency must match accounting book currency.',{
            bookCurrency:book.accounting_currency,
            journalCurrency:request.accountingCurrency
          });
        }

        const quantizer=new Decimal(1).div(new Decimal(10).pow(book.amount_scale));
        const roundedDebit=computed!.debit.toDecimalPlaces(book.amount_scale);
        const roundedCredit=computed!.credit.toDecimalPlaces(book.amount_scale);
        if(!roundedDebit.eq(roundedCredit)||
          computed!.debit.minus(roundedDebit).abs().gte(quantizer)||
          computed!.credit.minus(roundedCredit).abs().gte(quantizer)){
          fail('JOURNAL_PRECISION_VIOLATION','Journal violates accounting book precision policy.',{
            amountScale:book.amount_scale,
            debitTotal:computed!.debit.toString(),
            creditTotal:computed!.credit.toString()
          });
        }

        const accountIds=[...new Set(request.lines.map(line=>line.accountId))];
        const accounts=await trx.selectFrom('accounting_account')
          .select(['id','accounting_book_id','status'])
          .where('id','in',accountIds)
          .execute();

        if(accounts.length!==accountIds.length){
          fail('JOURNAL_ACCOUNT_NOT_FOUND','One or more journal accounts do not exist.',{
            requestedAccountIds:accountIds,
            foundAccountIds:accounts.map(a=>a.id)
          });
        }
        const invalid=accounts.find(a=>a.accounting_book_id!==book.id||a.status!=='ACTIVE');
        if(invalid!==undefined){
          fail('JOURNAL_ACCOUNT_NOT_ACTIVE','Journal account is not active in the selected accounting book.',{
            accountId:invalid.id
          });
        }

        const journal=await trx.insertInto('accounting_journal').values({
          enterprise_id:request.enterpriseId,
          accounting_book_id:book.id,
          journal_no:request.journalNo,
          effective_at:request.effectiveAt,
          accounting_currency:request.accountingCurrency,
          source_business_data_id:request.sourceBusinessDataId??null,
          accounting_rule_code:request.accountingRuleCode??null,
          accounting_rule_version:request.accountingRuleVersion??null,
          debit_total:roundedDebit.toFixed(book.amount_scale),
          credit_total:roundedCredit.toFixed(book.amount_scale),
          status:'POSTED'
        }).returning('id').executeTakeFirstOrThrow();

        for(const [index,line] of request.lines.entries()){
          const amount=new Decimal(line.amount).toDecimalPlaces(book.amount_scale);
          await trx.insertInto('accounting_journal_line').values({
            journal_id:journal.id,
            line_no:index+1,
            accounting_account_id:line.accountId,
            side:line.side,
            amount:amount.toFixed(book.amount_scale),
            currency:line.currency,
            dimensions:line.dimensions??{},
            memo:line.memo??null
          }).execute();
        }

        return {
          journalId:journal.id,
          debitTotal:roundedDebit.toFixed(book.amount_scale),
          creditTotal:roundedCredit.toFixed(book.amount_scale),
          lineCount:request.lines.length
        };
      });

      return result;
    }catch(error){
      const appError=error instanceof AppError
        ?error
        :new AppError({
            code:'JOURNAL_UNEXPECTED_FAILURE',
            message:error instanceof Error?error.message:String(error),
            module:'accounting',
            operation:'postJournal'
          });

      const debit=computed?.debit??new Decimal(0);
      const credit=computed?.credit??new Decimal(0);
      await this.db.insertInto('accounting_journal_diagnostic').values({
        enterprise_id:request.enterpriseId,
        accounting_book_id:request.accountingBookId||null,
        source_business_data_id:request.sourceBusinessDataId??null,
        journal_no:request.journalNo||null,
        accounting_rule_code:request.accountingRuleCode??null,
        accounting_rule_version:request.accountingRuleVersion??null,
        failure_code:appError.code,
        debit_total:debit.toString(),
        credit_total:credit.toString(),
        difference:debit.minus(credit).toString(),
        details:{
          message:appError.message,
          errorDetails:(appError.details??{}) as AccountingJsonObject,
          diagnosticContext:request.diagnosticContext??{},
          linePlan:request.lines.map((line,index)=>({
            index,
            accountId:line.accountId,
            side:line.side,
            amount:line.amount,
            currency:line.currency
          }))
        }
      }).execute();

      throw appError;
    }
  }
}

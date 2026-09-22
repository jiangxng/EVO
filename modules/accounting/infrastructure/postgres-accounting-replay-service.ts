import { createHash } from 'node:crypto';
import type { Kysely } from 'kysely';
import type { Database } from '../../../platform/database/src/types.js';
import type {
  AccountingReplayResult,
  AccountingReplayService,
  TrialBalance
} from '../api/contracts.js';
import type { PostgresAccountingRecognitionService } from './postgres-accounting-recognition-service.js';
import type { PostgresTrialBalanceService } from './postgres-trial-balance-service.js';

function canonical(value:unknown):string{
  if(value===null||typeof value==='boolean'||typeof value==='number'||typeof value==='string'){
    return JSON.stringify(value);
  }
  if(Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if(typeof value==='object'){
    const object=value as Record<string,unknown>;
    return `{${Object.keys(object).sort().map(key=>`${JSON.stringify(key)}:${canonical(object[key])}`).join(',')}}`;
  }
  return JSON.stringify(String(value));
}
function digest(value:unknown):string{
  return createHash('sha256').update(canonical(value)).digest('hex');
}

export class PostgresAccountingReplayService implements AccountingReplayService {
  constructor(
    private readonly db:Kysely<Database>,
    private readonly recognition:PostgresAccountingRecognitionService,
    private readonly trialBalance:PostgresTrialBalanceService
  ){}

  private async snapshot(
    enterpriseId:string,
    accountingBookId:string
  ):Promise<{digest:string;journalCount:number;trialBalance:TrialBalance}>{
    const journals=await this.db.selectFrom('accounting_journal')
      .select([
        'id','journal_no','effective_at','accounting_currency',
        'source_business_data_id','accounting_rule_code','accounting_rule_version',
        'debit_total','credit_total'
      ])
      .where('enterprise_id','=',enterpriseId)
      .where('accounting_book_id','=',accountingBookId)
      .orderBy('effective_at')
      .orderBy('journal_no')
      .execute();

    const journalIds=journals.map(j=>j.id);
    const lines=journalIds.length===0?[]:await this.db.selectFrom('accounting_journal_line as l')
      .innerJoin('accounting_journal as j','j.id','l.journal_id')
      .innerJoin('accounting_account as a','a.id','l.accounting_account_id')
      .select([
        'j.journal_no','l.line_no','a.code as account_code','l.side',
        'l.amount','l.currency','l.dimensions','l.memo'
      ])
      .where('l.journal_id','in',journalIds)
      .orderBy('j.journal_no')
      .orderBy('l.line_no')
      .execute();

    const trialBalance=await this.trialBalance.compute(enterpriseId,accountingBookId);
    return {
      digest:digest({
        journals:journals.map(({id,...j})=>j),
        lines,
        trialBalance
      }),
      journalCount:journals.length,
      trialBalance
    };
  }

  async replay(
    enterpriseId:string,
    accountingBookId:string
  ):Promise<AccountingReplayResult>{
    const before=await this.snapshot(enterpriseId,accountingBookId);
    const run=await this.db.insertInto('accounting_replay_run').values({
      enterprise_id:enterpriseId,
      accounting_book_id:accountingBookId,
      status:'PREPARING',
      before_digest:before.digest,
      after_digest:null,
      validation_status:'NOT_VALIDATED',
      journal_count_before:before.journalCount,
      journal_count_after:0,
      completed_at:null,
      error:null
    }).returning('id').executeTakeFirstOrThrow();

    try{
      await this.db.updateTable('accounting_replay_run')
        .set({status:'REBUILDING'})
        .where('id','=',run.id).execute();

      const journalIds=(await this.db.selectFrom('accounting_journal')
        .select('id')
        .where('enterprise_id','=',enterpriseId)
        .where('accounting_book_id','=',accountingBookId)
        .execute()).map(row=>row.id);

      await this.db.deleteFrom('accounting_rule_execution')
        .where('enterprise_id','=',enterpriseId)
        .where('accounting_book_id','=',accountingBookId)
        .execute();

      if(journalIds.length>0){
        await this.db.deleteFrom('accounting_journal_line')
          .where('journal_id','in',journalIds)
          .execute();
      }
      await this.db.deleteFrom('accounting_journal')
        .where('enterprise_id','=',enterpriseId)
        .where('accounting_book_id','=',accountingBookId)
        .execute();

      const sourceTypes=(await this.db.selectFrom('accounting_rule')
        .select('source_business_data_type')
        .distinct()
        .where('enterprise_id','=',enterpriseId)
        .where('accounting_book_id','=',accountingBookId)
        .where('status','=','PUBLISHED')
        .execute()).map(row=>row.source_business_data_type);

      if(sourceTypes.length>0){
        const business=await this.db.selectFrom('business_data')
          .select(['id','effective_at'])
          .where('enterprise_id','=',enterpriseId)
          .where('business_data_type','in',sourceTypes)
          .orderBy('effective_at')
          .orderBy('id')
          .execute();
        for(const fact of business){
          await this.recognition.recognizeBusinessData(enterpriseId,accountingBookId,fact.id);
        }
      }

      await this.db.updateTable('accounting_replay_run')
        .set({status:'VALIDATING'})
        .where('id','=',run.id).execute();

      const after=await this.snapshot(enterpriseId,accountingBookId);
      const validationStatus=before.digest===after.digest?'MATCH':'MISMATCH';

      await this.db.updateTable('accounting_replay_run').set({
        status:validationStatus==='MATCH'?'COMPLETED':'FAILED',
        after_digest:after.digest,
        validation_status:validationStatus,
        journal_count_after:after.journalCount,
        completed_at:new Date(),
        error:validationStatus==='MATCH'?null:{beforeDigest:before.digest,afterDigest:after.digest}
      }).where('id','=',run.id).execute();

      return {
        replayRunId:run.id,
        beforeDigest:before.digest,
        afterDigest:after.digest,
        journalCountBefore:before.journalCount,
        journalCountAfter:after.journalCount,
        validationStatus
      };
    }catch(error){
      await this.db.updateTable('accounting_replay_run').set({
        status:'FAILED',
        validation_status:'NOT_VALIDATED',
        completed_at:new Date(),
        error:{message:error instanceof Error?error.message:String(error)}
      }).where('id','=',run.id).execute();
      throw error;
    }
  }
}

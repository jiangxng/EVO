import type { Kysely } from 'kysely';
import type { Database } from '../../../platform/database/src/types.js';
import type { StatementReplayResult } from '../api/contracts.js';
import type { PostgresStatementProjectionService } from './postgres-statement-projection-service.js';

export class PostgresStatementReplayService {
  constructor(private readonly db:Kysely<Database>,private readonly projection:PostgresStatementProjectionService){}

  async replay(enterpriseId:string,accountingBookId:string,accountingPeriodId:string,statementDefinitionId:string):Promise<StatementReplayResult>{
    let before=await this.db.selectFrom('statement_projection_run').select(['id','semantic_digest'])
      .where('enterprise_id','=',enterpriseId).where('accounting_book_id','=',accountingBookId).where('accounting_period_id','=',accountingPeriodId).where('statement_definition_id','=',statementDefinitionId)
      .where('status','=','COMPLETED').where('semantic_digest','is not',null).orderBy('started_at','desc').executeTakeFirst();
    if(before===undefined){
      const baseline=await this.projection.project(enterpriseId,accountingBookId,accountingPeriodId,statementDefinitionId);
      before={id:baseline.runId,semantic_digest:baseline.digest};
    }
    const after=await this.projection.project(enterpriseId,accountingBookId,accountingPeriodId,statementDefinitionId);
    const beforeDigest=before.semantic_digest!;
    const validationStatus=beforeDigest===after.digest?'MATCH':'MISMATCH';
    const row=await this.db.insertInto('statement_replay_run').values({
      enterprise_id:enterpriseId,accounting_book_id:accountingBookId,accounting_period_id:accountingPeriodId,statement_definition_id:statementDefinitionId,
      before_projection_run_id:before.id,after_projection_run_id:after.runId,before_digest:beforeDigest,after_digest:after.digest,validation_status:validationStatus
    }).returning('id').executeTakeFirstOrThrow();
    return {replayRunId:row.id,beforeProjectionRunId:before.id,afterProjectionRunId:after.runId,beforeDigest,afterDigest:after.digest,validationStatus};
  }
}

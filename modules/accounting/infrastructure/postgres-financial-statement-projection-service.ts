import type { CoreStatementReconciliationResult, FinancialStatementProjectionService, StatementProjection, StatementReplayResult } from '../api/contracts.js';
import type { PostgresStatementProjectionService } from './postgres-statement-projection-service.js';
import type { PostgresStatementReplayService } from './postgres-statement-replay-service.js';
import type { PostgresCoreStatementReconciliationService } from './postgres-core-statement-reconciliation-service.js';

export class PostgresFinancialStatementProjectionService implements FinancialStatementProjectionService {
  constructor(
    private readonly projection:PostgresStatementProjectionService,
    private readonly replayService:PostgresStatementReplayService,
    private readonly reconciliation:PostgresCoreStatementReconciliationService
  ){}

  project(enterpriseId:string,accountingBookId:string,accountingPeriodId:string,statementDefinitionId:string):Promise<StatementProjection>{
    return this.projection.project(enterpriseId,accountingBookId,accountingPeriodId,statementDefinitionId);
  }

  replay(enterpriseId:string,accountingBookId:string,accountingPeriodId:string,statementDefinitionId:string):Promise<StatementReplayResult>{
    return this.replayService.replay(enterpriseId,accountingBookId,accountingPeriodId,statementDefinitionId);
  }

  reconcileCoreStatements(enterpriseId:string,accountingBookId:string,accountingPeriodId:string,balanceSheetDefinitionId:string,incomeStatementDefinitionId:string,cashFlowDefinitionId:string):Promise<CoreStatementReconciliationResult>{
    return this.reconciliation.reconcile(enterpriseId,accountingBookId,accountingPeriodId,balanceSheetDefinitionId,incomeStatementDefinitionId,cashFlowDefinitionId);
  }
}

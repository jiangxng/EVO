import type { DatabaseHandle } from '../../../platform/database/src/index.js';
import { createTransactionRunner } from '../../../platform/database/src/index.js';
import { MetadataCommandCapabilityResolver } from '../../../modules/command/application/metadata-command-capability-resolver.js';
import { CommandService } from '../../../modules/command/application/command-service.js';
import { PostgresCommandTransaction } from '../../../modules/command/infrastructure/postgres-command-transaction.js';
import { PostgresMetadataRepository } from '../../../modules/metadata/infrastructure/postgres-metadata-repository.js';
import { PostgresPostingMetadataReader } from '../../../modules/metadata/infrastructure/postgres-posting-metadata-reader.js';
import { PostgresBusinessDataReader } from '../../../modules/business-data/infrastructure/postgres-business-data-reader.js';
import { PostgresPostingStateStore } from '../../../modules/posting/infrastructure/postgres-posting-state-store.js';
import { PostingService } from '../../../modules/posting/application/posting-service.js';
import { PostgresCandidatePostingReplayService } from '../../../modules/posting/infrastructure/postgres-candidate-posting-replay-service.js';
import { PostgresLedgerWriter } from '../../../modules/ledger/infrastructure/postgres-ledger-writer.js';
import { PostgresLedgerReader } from '../../../modules/ledger/infrastructure/postgres-ledger-reader.js';
import { PostgresWorkProjection } from '../../../modules/workflow/infrastructure/postgres-work-projection.js';
import { PostgresAuthorizationService } from '../../../modules/identity/infrastructure/postgres-authorization-service.js';
import { PostgresReplayService } from '../../../modules/replay/infrastructure/postgres-replay-service.js';
import { PostgresCostEngine } from '../../../modules/cost/infrastructure/postgres-cost-engine.js';
import { PostgresValuationPostingService } from '../../../modules/valuation/infrastructure/postgres-valuation-posting-service.js';
import { PostgresEnterpriseQuery } from '../../../modules/query/infrastructure/postgres-enterprise-query.js';
import { PostgresCurrentEconomicRuntimeViewService } from '../../../modules/query/infrastructure/postgres-current-economic-runtime-view.js';
import { PostgresAiCapabilityCatalog } from '../../../modules/ai/infrastructure/postgres-ai-capability-catalog.js';
import { PostgresFlowProjection } from '../../../modules/flow/infrastructure/postgres-flow-projection.js';
import { PostgresEnterpriseTemplateService } from '../../../modules/enterprise-template/infrastructure/postgres-enterprise-template-service.js';
import { PostgresAllocationStore } from '../../../modules/allocation/infrastructure/postgres-allocation-store.js';
import { PostgresRateDatasetStore } from '../../../modules/economic/infrastructure/postgres-rate-dataset-store.js';
import { PostgresReplayTopologyStore } from '../../../modules/replay/infrastructure/postgres-replay-topology-store.js';
import { PostgresReplayCheckpointService } from '../../../modules/replay/infrastructure/postgres-replay-checkpoint-service.js';
import { PostgresReplayCoverageCertificationService } from '../../../modules/replay/infrastructure/postgres-replay-coverage-certification-service.js';
import { PostgresReplayCheckpointPromotionService } from '../../../modules/replay/infrastructure/postgres-replay-checkpoint-promotion-service.js';
import { PostgresEconomicRuntimeDatasetService } from '../../../modules/materialization/infrastructure/postgres-economic-runtime-dataset-service.js';
import { PostgresRuntimeEquivalenceCertificationService } from '../../../modules/materialization/infrastructure/postgres-runtime-equivalence-certification-service.js';
import { PostgresMaterializationContextResolver } from '../../../modules/materialization/infrastructure/postgres-materialization-context-resolver.js';
import { PostgresDependencyGraphRebuilder } from '../../../modules/lineage/infrastructure/postgres-dependency-graph-rebuilder.js';
import { DefaultIncrementalReplayPlanner } from '../../../modules/replay/application/incremental-replay-planner.js';
import { PostgresValuationInputReader } from '../../../modules/cost/infrastructure/postgres-valuation-input-reader.js';
import { DefaultCostCheckpointStateProjector } from '../../../modules/cost/application/default-checkpoint-state-projector.js';
import { PostgresCostCheckpointStateBuilder } from '../../../modules/cost/infrastructure/postgres-cost-checkpoint-state-builder.js';
import { PostgresReplayCheckpointMaterializationService } from '../../../modules/replay/infrastructure/postgres-replay-checkpoint-materialization-service.js';
import { PostgresCandidateEconomicRuntimeDigestService } from '../../../modules/replay/infrastructure/postgres-candidate-economic-runtime-digest-service.js';
import { PostgresOracleEconomicRuntimeDigestService } from '../../../modules/replay/infrastructure/postgres-oracle-economic-runtime-digest-service.js';
import { PostgresValuationStore } from '../../../modules/valuation/infrastructure/postgres-valuation-store.js';
import { DefaultFxValuationService } from '../../../modules/valuation/application/fx-valuation-service.js';
import { DefaultFxSettlementService } from '../../../modules/valuation/application/fx-settlement-service.js';
import { PostgresPositionDefinitionStore } from '../../../modules/position/infrastructure/postgres-position-definition-store.js';
import { PostgresFxPositionResolver } from '../../../modules/valuation/infrastructure/postgres-fx-position-resolver.js';
import { DefaultValuationRequestInterpreter } from '../../../modules/valuation/application/valuation-request-interpreter.js';
import { PostgresValuationRequestReplayService } from '../../../modules/valuation/infrastructure/postgres-valuation-request-replay-service.js';

export function createEvoRuntime(database: DatabaseHandle) {
  const db = database.db;
  const metadata = new PostgresMetadataRepository(db);
  const capabilities = new MetadataCommandCapabilityResolver(metadata);
  const command = new CommandService(capabilities,new PostgresCommandTransaction(db));
  const state = new PostgresPostingStateStore(db);
  const businessData = new PostgresBusinessDataReader(db);
  const postingMetadata = new PostgresPostingMetadataReader(db);
  const ledgerWriter = new PostgresLedgerWriter();
  const transactions = createTransactionRunner(db);
  const posting = new PostingService(
    state,
    state,
    businessData,
    postingMetadata,
    ledgerWriter,
    transactions
  );
  const candidatePostingReplay = new PostgresCandidatePostingReplayService(
    db,
    businessData,
    postingMetadata,
    ledgerWriter,
    transactions
  );
  const valuation = new PostgresValuationPostingService(db);
  const valuationStore = new PostgresValuationStore(db);
  const allocation = new PostgresAllocationStore(db);
  const rates = new PostgresRateDatasetStore(db);
  const positions = new PostgresPositionDefinitionStore(db);
  const fxPositionResolver = new PostgresFxPositionResolver(db,positions);
  const valuationInputs = new PostgresValuationInputReader(db);
  const costCheckpointProjector = new DefaultCostCheckpointStateProjector();
  const costCheckpointStates = new PostgresCostCheckpointStateBuilder(
    db,
    valuationInputs,
    costCheckpointProjector
  );
  const replayTopology = new PostgresReplayTopologyStore(db);
  const dependencyGraph = new PostgresDependencyGraphRebuilder(db,replayTopology);
  const replayCheckpoint = new PostgresReplayCheckpointService(db,replayTopology);
  const replayCheckpointMaterialization = new PostgresReplayCheckpointMaterializationService(
    db,
    costCheckpointStates
  );
  const candidateEconomicRuntimeDigest = new PostgresCandidateEconomicRuntimeDigestService(db);
  const oracleEconomicRuntimeDigest = new PostgresOracleEconomicRuntimeDigestService(db);
  const replayCoverage = new PostgresReplayCoverageCertificationService(db,dependencyGraph);
  const replayPromotion = new PostgresReplayCheckpointPromotionService(db);
  const runtimeDatasets = new PostgresEconomicRuntimeDatasetService(db);
  const runtimeEquivalence = new PostgresRuntimeEquivalenceCertificationService(
    db,
    candidateEconomicRuntimeDigest,
    oracleEconomicRuntimeDigest
  );
  const materializationContexts = new PostgresMaterializationContextResolver(
    db,
    runtimeDatasets
  );
  const fxValuation = new DefaultFxValuationService(rates,valuationStore,replayTopology);
  const fxSettlement = new DefaultFxSettlementService(allocation,valuationStore,replayTopology);
  const valuationRequests = new DefaultValuationRequestInterpreter(
    fxPositionResolver,
    fxValuation,
    fxSettlement,
    businessData,
    allocation
  );
  const valuationReplay = new PostgresValuationRequestReplayService(db,valuationRequests);
  const incrementalReplayPlanner = new DefaultIncrementalReplayPlanner(replayTopology);
  const currentEconomicRuntimeView = new PostgresCurrentEconomicRuntimeViewService(db);
  return { db, command, posting, candidatePostingReplay, ledger:new PostgresLedgerReader(db), work:new PostgresWorkProjection(db), auth:new PostgresAuthorizationService(db), replay:new PostgresReplayService(db), replayTopology, dependencyGraph, replayCheckpoint, replayCheckpointMaterialization, candidateEconomicRuntimeDigest, oracleEconomicRuntimeDigest, replayCoverage, replayPromotion, runtimeDatasets, runtimeEquivalence, materializationContexts, incrementalReplayPlanner, valuationRequests, valuationReplay, valuation, valuationStore, fxValuation, fxSettlement, cost:new PostgresCostEngine(db,valuation,allocation,valuationInputs,replayTopology), allocation, rates, positions, query:new PostgresEnterpriseQuery(db,currentEconomicRuntimeView), currentEconomicRuntimeView, ai:new PostgresAiCapabilityCatalog(db), flow:new PostgresFlowProjection(db), enterpriseTemplates:new PostgresEnterpriseTemplateService(db) };
}

export async function demoIds(runtime: ReturnType<typeof createEvoRuntime>) {
  const enterprise = await runtime.db.selectFrom('enterprise').select(['id']).where('code','=','EVO_DEMO').executeTakeFirstOrThrow();
  const apps = await runtime.db.selectFrom('application_instance').select(['id','code']).where('enterprise_id','=',enterprise.id).execute();
  return { enterpriseId:enterprise.id, salesAppId:apps.find(x=>x.code==='sales')?.id??'', productionAppId:apps.find(x=>x.code==='production')?.id??'', inventoryAppId:apps.find(x=>x.code==='inventory')?.id??'', valuationAppId:apps.find(x=>x.code==='valuation')?.id??'', cashAppId:apps.find(x=>x.code==='cash')?.id??'', cashPaymentAppId:apps.find(x=>x.code==='cash-payment')?.id??'', salesReturnAppId:apps.find(x=>x.code==='sales-return')?.id??'', procurementAppId:apps.find(x=>x.code==='procurement')?.id??'', flowDefinitionId:(await runtime.db.selectFrom('flow_definition').select('id').where('enterprise_id','=',enterprise.id).where('code','=','order-to-cash').where('version','=',1).executeTakeFirstOrThrow()).id, procureToPayFlowDefinitionId:(await runtime.db.selectFrom('flow_definition').select('id').where('enterprise_id','=',enterprise.id).where('code','=','procure-to-pay').where('version','=',1).executeTakeFirstOrThrow()).id };
}

export async function drainPosting(runtime:ReturnType<typeof createEvoRuntime>,enterpriseId:string):Promise<number>{
 let count=0; for(let i=0;i<10000;i+=1){const result=await runtime.posting.processNext(enterpriseId);if(result.status==='IDLE'||result.status==='BLOCKED_REPLAY_REQUIRED')break;if(result.status==='RACE_RETRY')continue;if(result.status==='FAILED')throw new Error(`Posting failed: ${result.errorCode}`);count+=1;} await runtime.work.refresh(enterpriseId); return count;
}

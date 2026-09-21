import { createHash } from 'node:crypto';
import { sql } from 'kysely';
import { createDatabase } from '../platform/database/src/index.js';
import { loadRuntimeConfig } from '../platform/runtime/src/config.js';
import { createEvoRuntime, demoIds } from '../apps/api/src/evo-runtime.js';
import { PostgresRuntimeEquivalenceCertificationService } from '../modules/materialization/infrastructure/postgres-runtime-equivalence-certification-service.js';
import type {
  CandidateRuntimeDigestPort,
  OracleRuntimeDigestPort,
  RuntimeSemanticDigestResult
} from '../modules/materialization/api/runtime-equivalence-certification.js';

const config = loadRuntimeConfig();
const database = createDatabase(config.databaseUrl);
const runtime = createEvoRuntime(database);

const emptyCounts = {
  ledgerEntries: 0,
  ledgerBalances: 0,
  costResults: 0,
  allocationRelations: 0,
  valuationPositions: 0,
  valuationResults: 0,
  workItems: 0
} as const;

function sha(label: string): string {
  return createHash('sha256').update(label).digest('hex');
}

function result(digest: string): RuntimeSemanticDigestResult {
  return { digest, familyCounts: emptyCounts };
}

function gate(digestValue: string) {
  const candidatePort: CandidateRuntimeDigestPort = {
    async compute() { return result(digestValue); }
  };
  const oraclePort: OracleRuntimeDigestPort = {
    async compute() { return result(digestValue); }
  };
  return new PostgresRuntimeEquivalenceCertificationService(
    runtime.db,
    candidatePort,
    oraclePort
  );
}

let triggerInstalled = false;

try {
  const ids = await demoIds(runtime);
  const runtimeBefore = await runtime.db.selectFrom('enterprise_runtime_state')
    .selectAll()
    .where('enterprise_id','=',ids.enterpriseId)
    .executeTakeFirstOrThrow();
  if (runtimeBefore.last_posted_sequence === null) {
    throw new Error('Crash/retry E2E requires an existing posting cursor.');
  }
  const consistencyDomain = runtimeBefore.consistency_domain;
  const boundary = BigInt(runtimeBefore.last_posted_sequence);

  const activeBefore = await runtime.runtimeDatasets.getActive(
    ids.enterpriseId,
    consistencyDomain
  );
  if (
    activeBefore.kind !== 'CURRENT' ||
    activeBefore.status !== 'ACTIVE'
  ) {
    throw new Error('Crash/retry E2E requires one CURRENT/ACTIVE runtime dataset.');
  }

  const activeLedgerBefore = await runtime.db.selectFrom('ledger_dataset')
    .select(['id','kind','status'])
    .where('enterprise_id','=',ids.enterpriseId)
    .where('consistency_domain','=',consistencyDomain)
    .where('status','=','ACTIVE')
    .executeTakeFirstOrThrow();

  const promotion = await runtime.db.selectFrom('replay_checkpoint_promotion as p')
    .innerJoin('replay_checkpoint as c','c.id','p.checkpoint_id')
    .select(['p.id as promotion_id','c.id as checkpoint_id'])
    .where('p.enterprise_id','=',ids.enterpriseId)
    .where('p.status','=','ACTIVE')
    .where('c.status','=','ACTIVE')
    .orderBy('p.promoted_at','desc')
    .executeTakeFirstOrThrow();

  const digestValue = sha('b4.4b-crash-retry');
  const candidate = await runtime.runtimeDatasets.createCandidate({
    enterpriseId: ids.enterpriseId,
    consistencyDomain,
    parentDatasetId: activeBefore.id,
    sourceCheckpointId: promotion.checkpoint_id,
    sourcePromotionId: promotion.promotion_id,
    incrementalPlanDigest: sha('b4.4b-crash-retry-plan'),
    startSequence: boundary,
    boundarySequence: boundary
  });
  const oracle = await runtime.runtimeDatasets.createOracle({
    enterpriseId: ids.enterpriseId,
    consistencyDomain,
    parentDatasetId: activeBefore.id,
    oracleOfDatasetId: candidate.id,
    boundarySequence: boundary
  });
  const verifiedOracle = await runtime.runtimeDatasets.markOracleVerified(
    oracle.id,
    digestValue
  );

  const candidateLedger = await runtime.db.insertInto('ledger_dataset')
    .values({
      enterprise_id: ids.enterpriseId,
      consistency_domain: consistencyDomain,
      economic_runtime_dataset_id: candidate.id,
      kind: 'CANDIDATE',
      status: 'BUILDING',
      posting_boundary_sequence: boundary,
      activated_at: null
    })
    .returning('id')
    .executeTakeFirstOrThrow();

  const certificationCountBefore = await runtime.db
    .selectFrom('runtime_equivalence_certification')
    .select(({fn})=>fn.countAll<number>().as('count'))
    .where('candidate_dataset_id','=',candidate.id)
    .executeTakeFirstOrThrow();

  await sql.raw(`
    create or replace function evo_test_fail_candidate_activation()
    returns trigger
    language plpgsql
    as $$
    begin
      if old.kind = 'CANDIDATE'
         and old.status = 'VERIFIED'
         and new.kind = 'CURRENT'
         and new.status = 'ACTIVE' then
        raise exception 'EVO_TEST_ACTIVATION_CRASH';
      end if;
      return new;
    end;
    $$
  `).execute(runtime.db);
  await sql.raw(`
    create trigger evo_test_fail_candidate_activation_trigger
    before update on economic_runtime_dataset
    for each row
    execute function evo_test_fail_candidate_activation()
  `).execute(runtime.db);
  triggerInstalled = true;

  let crashMessage = '';
  try {
    await gate(digestValue).certifyAndActivate({
      candidateDatasetId: candidate.id,
      oracleDatasetId: verifiedOracle.id,
      certifiedBy: 'evo-crash-retry-e2e',
      reason: 'Inject a PostgreSQL failure at final Candidate activation to prove atomic rollback.'
    });
    throw new Error('Injected activation crash did not abort the transaction.');
  } catch (error) {
    crashMessage = error instanceof Error ? error.message : String(error);
    if (!crashMessage.includes('EVO_TEST_ACTIVATION_CRASH')) {
      throw error;
    }
  }

  await sql.raw(
    'drop trigger if exists evo_test_fail_candidate_activation_trigger on economic_runtime_dataset'
  ).execute(runtime.db);
  await sql.raw(
    'drop function if exists evo_test_fail_candidate_activation()'
  ).execute(runtime.db);
  triggerInstalled = false;

  const [
    runtimeAfterCrash,
    parentAfterCrash,
    candidateAfterCrash,
    activeLedgerAfterCrash,
    candidateLedgerAfterCrash,
    certificationAfterCrash
  ] = await Promise.all([
    runtime.db.selectFrom('enterprise_runtime_state').selectAll()
      .where('enterprise_id','=',ids.enterpriseId).executeTakeFirstOrThrow(),
    runtime.db.selectFrom('economic_runtime_dataset').select(['kind','status'])
      .where('id','=',activeBefore.id).executeTakeFirstOrThrow(),
    runtime.db.selectFrom('economic_runtime_dataset').select(['kind','status','semantic_digest'])
      .where('id','=',candidate.id).executeTakeFirstOrThrow(),
    runtime.db.selectFrom('ledger_dataset').select(['id','kind','status'])
      .where('id','=',activeLedgerBefore.id).executeTakeFirstOrThrow(),
    runtime.db.selectFrom('ledger_dataset').select(['id','kind','status'])
      .where('id','=',candidateLedger.id).executeTakeFirstOrThrow(),
    runtime.db.selectFrom('runtime_equivalence_certification')
      .select(({fn})=>fn.countAll<number>().as('count'))
      .where('candidate_dataset_id','=',candidate.id).executeTakeFirstOrThrow()
  ]);

  if (
    parentAfterCrash.kind !== 'CURRENT' ||
    parentAfterCrash.status !== 'ACTIVE' ||
    candidateAfterCrash.kind !== 'CANDIDATE' ||
    candidateAfterCrash.status !== 'BUILDING' ||
    candidateAfterCrash.semantic_digest !== null ||
    activeLedgerAfterCrash.kind !== 'CURRENT' ||
    activeLedgerAfterCrash.status !== 'ACTIVE' ||
    candidateLedgerAfterCrash.kind !== 'CANDIDATE' ||
    candidateLedgerAfterCrash.status !== 'BUILDING' ||
    Number(certificationAfterCrash.count) !== Number(certificationCountBefore.count) ||
    String(runtimeAfterCrash.last_posted_sequence) !== String(runtimeBefore.last_posted_sequence) ||
    runtimeAfterCrash.posting_mode !== runtimeBefore.posting_mode ||
    runtimeAfterCrash.replay_required !== runtimeBefore.replay_required
  ) {
    throw new Error(
      'Injected activation crash left a partial cutover state instead of rolling back atomically.'
    );
  }

  const retry = await gate(digestValue).certifyAndActivate({
    candidateDatasetId: candidate.id,
    oracleDatasetId: verifiedOracle.id,
    certifiedBy: 'evo-crash-retry-e2e',
    reason: 'Retry the same governed Candidate after injected transaction rollback.'
  });
  if (
    retry.certification.status !== 'CERTIFIED' ||
    retry.activatedDataset?.id !== candidate.id ||
    retry.activatedDataset.kind !== 'CURRENT' ||
    retry.activatedDataset.status !== 'ACTIVE'
  ) {
    throw new Error('Retry after rolled-back activation did not activate the same Candidate.');
  }

  const duplicateRetry = await gate(digestValue).certifyAndActivate({
    candidateDatasetId: candidate.id,
    oracleDatasetId: verifiedOracle.id,
    certifiedBy: 'evo-crash-retry-e2e',
    reason: 'Idempotent post-recovery retry.'
  });

  const [
    activeRuntimeRows,
    activeLedgerRows,
    parentAfterRetry,
    candidateLedgerAfterRetry,
    certificationAfterRetry
  ] = await Promise.all([
    runtime.db.selectFrom('economic_runtime_dataset').select(['id','kind','status'])
      .where('enterprise_id','=',ids.enterpriseId)
      .where('consistency_domain','=',consistencyDomain)
      .where('status','=','ACTIVE').execute(),
    runtime.db.selectFrom('ledger_dataset').select(['id','kind','status'])
      .where('enterprise_id','=',ids.enterpriseId)
      .where('consistency_domain','=',consistencyDomain)
      .where('status','=','ACTIVE').execute(),
    runtime.db.selectFrom('economic_runtime_dataset').select(['kind','status'])
      .where('id','=',activeBefore.id).executeTakeFirstOrThrow(),
    runtime.db.selectFrom('ledger_dataset').select(['kind','status'])
      .where('id','=',candidateLedger.id).executeTakeFirstOrThrow(),
    runtime.db.selectFrom('runtime_equivalence_certification').selectAll()
      .where('candidate_dataset_id','=',candidate.id).execute()
  ]);

  if (
    activeRuntimeRows.length !== 1 ||
    activeRuntimeRows[0]?.id !== candidate.id ||
    activeRuntimeRows[0]?.kind !== 'CURRENT' ||
    activeLedgerRows.length !== 1 ||
    activeLedgerRows[0]?.id !== candidateLedger.id ||
    activeLedgerRows[0]?.kind !== 'CURRENT' ||
    parentAfterRetry.kind !== 'ARCHIVED' ||
    parentAfterRetry.status !== 'ARCHIVED' ||
    candidateLedgerAfterRetry.kind !== 'CURRENT' ||
    candidateLedgerAfterRetry.status !== 'ACTIVE' ||
    certificationAfterRetry.length !== 1 ||
    duplicateRetry.certification.id !== retry.certification.id
  ) {
    throw new Error('Crash recovery retry did not converge to one idempotent CURRENT activation.');
  }

  console.log(JSON.stringify({
    status:'PASS',
    evidence:'DATABASE E2E VERIFIED',
    injectedFailure:'EVO_TEST_ACTIVATION_CRASH',
    crashObserved:crashMessage,
    rollback:{
      parentStayedCurrent:true,
      candidateStayedBuilding:true,
      activeLedgerStayedCurrent:true,
      candidateLedgerStayedBuilding:true,
      certificationInsertRolledBack:true,
      runtimeCursorRolledBack:true
    },
    retry:{
      certificationId:retry.certification.id,
      activatedDatasetId:retry.activatedDataset.id,
      duplicateRetrySameCertification:duplicateRetry.certification.id === retry.certification.id,
      uniqueCurrent:true,
      uniqueActiveLedger:true
    }
  },null,2));
} finally {
  if (triggerInstalled) {
    await sql.raw(
      'drop trigger if exists evo_test_fail_candidate_activation_trigger on economic_runtime_dataset'
    ).execute(runtime.db).catch(()=>undefined);
    await sql.raw(
      'drop function if exists evo_test_fail_candidate_activation()'
    ).execute(runtime.db).catch(()=>undefined);
  }
  await database.destroy();
}

import { createHash } from 'node:crypto';
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

function gate(candidateDigest: string, oracleDigest: string) {
  const candidatePort: CandidateRuntimeDigestPort = {
    async compute() { return result(candidateDigest); }
  };
  const oraclePort: OracleRuntimeDigestPort = {
    async compute() { return result(oracleDigest); }
  };
  return new PostgresRuntimeEquivalenceCertificationService(
    runtime.db,
    candidatePort,
    oraclePort
  );
}

try {
  const ids = await demoIds(runtime);
  const runtimeState = await runtime.db.selectFrom('enterprise_runtime_state')
    .select('consistency_domain')
    .where('enterprise_id','=',ids.enterpriseId)
    .executeTakeFirstOrThrow();
  const consistencyDomain = runtimeState.consistency_domain;
  const originalCurrent = await runtime.runtimeDatasets.getActive(
    ids.enterpriseId,
    consistencyDomain
  );
  if (
    originalCurrent.kind !== 'CURRENT' ||
    originalCurrent.status !== 'ACTIVE' ||
    originalCurrent.boundarySequence === undefined
  ) {
    throw new Error('Failure-matrix validation requires an activated CURRENT generation.');
  }

  const promotion = await runtime.db.selectFrom('replay_checkpoint_promotion as p')
    .innerJoin('replay_checkpoint as c','c.id','p.checkpoint_id')
    .select([
      'p.id as promotion_id',
      'p.status as promotion_status',
      'c.id as checkpoint_id',
      'c.status as checkpoint_status',
      'c.boundary_sequence'
    ])
    .where('p.enterprise_id','=',ids.enterpriseId)
    .where('p.status','=','ACTIVE')
    .where('c.status','=','ACTIVE')
    .orderBy('p.promoted_at','desc')
    .executeTakeFirstOrThrow();

  const nextBoundary = originalCurrent.boundarySequence + 1n;

  async function createSyntheticPair(label: string, oracleDigest: string) {
    const candidate = await runtime.runtimeDatasets.createCandidate({
      enterpriseId: ids.enterpriseId,
      consistencyDomain,
      parentDatasetId: originalCurrent.id,
      sourceCheckpointId: promotion.checkpoint_id,
      sourcePromotionId: promotion.promotion_id,
      incrementalPlanDigest: sha(`failure-matrix:${label}`),
      startSequence: nextBoundary,
      boundarySequence: nextBoundary
    });
    const oracle = await runtime.runtimeDatasets.createOracle({
      enterpriseId: ids.enterpriseId,
      consistencyDomain,
      parentDatasetId: originalCurrent.id,
      oracleOfDatasetId: candidate.id,
      boundarySequence: nextBoundary
    });
    const verifiedOracle = await runtime.runtimeDatasets.markOracleVerified(
      oracle.id,
      oracleDigest
    );
    return { candidate, oracle: verifiedOracle };
  }

  // 1) Semantic mismatch must persist rejection evidence and leave CURRENT untouched.
  const mismatchOracleDigest = sha('failure-matrix:mismatch:oracle');
  const mismatchCandidateDigest = sha('failure-matrix:mismatch:candidate');
  const mismatchPair = await createSyntheticPair('mismatch',mismatchOracleDigest);
  const mismatch = await gate(
    mismatchCandidateDigest,
    mismatchOracleDigest
  ).certifyAndActivate({
    candidateDatasetId: mismatchPair.candidate.id,
    oracleDatasetId: mismatchPair.oracle.id,
    certifiedBy: 'evo-failure-matrix',
    reason: 'Database E2E semantic mismatch rejection fixture.'
  });
  if (
    mismatch.certification.status !== 'REJECTED' ||
    !mismatch.certification.blockers.includes('SEMANTIC_DIGEST_MISMATCH') ||
    mismatch.activatedDataset !== undefined
  ) {
    throw new Error('Semantic mismatch must be rejected without activation.');
  }

  const currentAfterMismatch = await runtime.runtimeDatasets.getActive(
    ids.enterpriseId,
    consistencyDomain
  );
  if (currentAfterMismatch.id !== originalCurrent.id) {
    throw new Error('Semantic mismatch rejection changed CURRENT.');
  }

  // 2) A Candidate computed against an old parent must fail after CURRENT moves.
  const staleDigest = sha('failure-matrix:stale');
  const stalePair = await createSyntheticPair('stale-parent',staleDigest);

  await runtime.db.updateTable('economic_runtime_dataset')
    .set({ kind:'ARCHIVED', status:'ARCHIVED' })
    .where('id','=',originalCurrent.id)
    .where('kind','=','CURRENT')
    .where('status','=','ACTIVE')
    .executeTakeFirstOrThrow();

  const syntheticCurrent = await runtime.db.insertInto('economic_runtime_dataset')
    .values({
      enterprise_id: ids.enterpriseId,
      consistency_domain: consistencyDomain,
      kind: 'CURRENT',
      status: 'ACTIVE',
      parent_dataset_id: originalCurrent.id,
      source_checkpoint_id: null,
      source_promotion_id: null,
      oracle_of_dataset_id: null,
      incremental_plan_digest: null,
      start_sequence: null,
      boundary_sequence: originalCurrent.boundarySequence,
      semantic_digest: originalCurrent.semanticDigest ?? null,
      failure_reason: null,
      verified_at: null,
      activated_at: new Date()
    })
    .returning('id')
    .executeTakeFirstOrThrow();

  const stale = await gate(staleDigest,staleDigest).certifyAndActivate({
    candidateDatasetId: stalePair.candidate.id,
    oracleDatasetId: stalePair.oracle.id,
    certifiedBy: 'evo-failure-matrix',
    reason: 'Database E2E stale active parent rejection fixture.'
  });
  if (
    stale.certification.status !== 'REJECTED' ||
    !stale.certification.blockers.includes('STALE_ACTIVE_PARENT') ||
    stale.activatedDataset !== undefined
  ) {
    throw new Error('Stale-parent Candidate must be rejected without activation.');
  }

  await runtime.db.deleteFrom('economic_runtime_dataset')
    .where('id','=',syntheticCurrent.id)
    .executeTakeFirstOrThrow();
  await runtime.db.updateTable('economic_runtime_dataset')
    .set({ kind:'CURRENT', status:'ACTIVE' })
    .where('id','=',originalCurrent.id)
    .where('kind','=','ARCHIVED')
    .where('status','=','ARCHIVED')
    .executeTakeFirstOrThrow();

  // 3) Invalidated checkpoint must fail closed even when Candidate/Oracle digests match.
  const invalidatedDigest = sha('failure-matrix:invalidated-checkpoint');
  const invalidatedPair = await createSyntheticPair(
    'invalidated-checkpoint',
    invalidatedDigest
  );
  await runtime.db.updateTable('replay_checkpoint')
    .set({
      status: 'INVALIDATED',
      invalidated_at: new Date(),
      invalidation_reason: 'Database E2E checkpoint invalidation fixture.'
    })
    .where('id','=',promotion.checkpoint_id)
    .where('status','=','ACTIVE')
    .executeTakeFirstOrThrow();

  const invalidated = await gate(
    invalidatedDigest,
    invalidatedDigest
  ).certifyAndActivate({
    candidateDatasetId: invalidatedPair.candidate.id,
    oracleDatasetId: invalidatedPair.oracle.id,
    certifiedBy: 'evo-failure-matrix',
    reason: 'Database E2E invalidated checkpoint rejection fixture.'
  });
  if (
    invalidated.certification.status !== 'REJECTED' ||
    !invalidated.certification.blockers.includes('CHECKPOINT_NOT_ACTIVE') ||
    invalidated.activatedDataset !== undefined
  ) {
    throw new Error('Candidate governed by an invalidated checkpoint must be rejected.');
  }

  // Restore the governance fixture so the next independent failure case can
  // prove Promotion revocation rather than inheriting CHECKPOINT_NOT_ACTIVE.
  await runtime.db.updateTable('replay_checkpoint')
    .set({
      status: 'ACTIVE',
      invalidated_at: null,
      invalidation_reason: null
    })
    .where('id','=',promotion.checkpoint_id)
    .where('status','=','INVALIDATED')
    .executeTakeFirstOrThrow();

  // 4) Revoked promotion must fail closed even with matching digests.
  const revokedDigest = sha('failure-matrix:revoked-promotion');
  const revokedPair = await createSyntheticPair('revoked-promotion',revokedDigest);
  await runtime.replayPromotion.revoke(
    promotion.promotion_id,
    'evo-failure-matrix',
    'Database E2E revocation fixture after Candidate/Oracle computation.'
  );
  const revoked = await gate(revokedDigest,revokedDigest).certifyAndActivate({
    candidateDatasetId: revokedPair.candidate.id,
    oracleDatasetId: revokedPair.oracle.id,
    certifiedBy: 'evo-failure-matrix',
    reason: 'Database E2E revoked promotion rejection fixture.'
  });
  if (
    revoked.certification.status !== 'REJECTED' ||
    !revoked.certification.blockers.includes('PROMOTION_NOT_ACTIVE') ||
    revoked.activatedDataset !== undefined
  ) {
    throw new Error('Candidate governed by a revoked promotion must be rejected.');
  }

  const finalCurrent = await runtime.db.selectFrom('economic_runtime_dataset')
    .select(['id','kind','status'])
    .where('enterprise_id','=',ids.enterpriseId)
    .where('consistency_domain','=',consistencyDomain)
    .where('status','=','ACTIVE')
    .execute();
  if (
    finalCurrent.length !== 1 ||
    finalCurrent[0]?.id !== originalCurrent.id ||
    finalCurrent[0]?.kind !== 'CURRENT'
  ) {
    throw new Error('Failure matrix must preserve exactly one original CURRENT generation.');
  }

  console.log(JSON.stringify({
    status:'PASS',
    currentDatasetId:originalCurrent.id,
    semanticMismatch:{
      certificationId:mismatch.certification.id,
      blockers:mismatch.certification.blockers
    },
    staleParent:{
      certificationId:stale.certification.id,
      blockers:stale.certification.blockers
    },
    invalidatedCheckpoint:{
      certificationId:invalidated.certification.id,
      blockers:invalidated.certification.blockers
    },
    revokedPromotion:{
      certificationId:revoked.certification.id,
      blockers:revoked.certification.blockers
    },
    uniqueCurrentPreserved:true
  },null,2));
} finally {
  await database.destroy();
}

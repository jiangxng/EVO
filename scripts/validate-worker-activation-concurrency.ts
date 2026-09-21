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
const gateDatabase = createDatabase(config.databaseUrl);
const observerDatabase = createDatabase(config.databaseUrl);
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

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

async function holdRuntimeCutoverLock(
  enterpriseId: string,
  consistencyDomain: string
): Promise<{ release: () => void; done: Promise<void> }> {
  const acquired = deferred();
  const releaseSignal = deferred();
  const done = gateDatabase.db.transaction().execute(async (trx) => {
    await trx.selectFrom('enterprise_runtime_state')
      .select('enterprise_id')
      .where('enterprise_id','=',enterpriseId)
      .where('consistency_domain','=',consistencyDomain)
      .forUpdate()
      .executeTakeFirstOrThrow();
    acquired.resolve();
    await releaseSignal.promise;
  });
  await acquired.promise;
  return { release: releaseSignal.resolve, done };
}

async function waitForRuntimeLockWaiters(
  expected: number,
  timeoutMs = 10000
): Promise<number> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const rows = await sql<{ count: string }>`
      select count(*)::text as count
      from pg_stat_activity
      where datname = current_database()
        and wait_event_type = 'Lock'
        and query ilike '%enterprise_runtime_state%'
    `.execute(observerDatabase.db);
    const count = Number(rows.rows[0]?.count ?? '0');
    if (count >= expected) return count;
    await new Promise((resolve) => setTimeout(resolve,50));
  }
  throw new Error(
    `Expected at least ${expected} PostgreSQL runtime cutover lock waiters.`
  );
}

async function createSyntheticPair(input: {
  enterpriseId: string;
  consistencyDomain: string;
  parentDatasetId: string;
  checkpointId: string;
  promotionId: string;
  boundarySequence: bigint;
  label: string;
  oracleDigest: string;
}) {
  const candidate = await runtime.runtimeDatasets.createCandidate({
    enterpriseId: input.enterpriseId,
    consistencyDomain: input.consistencyDomain,
    parentDatasetId: input.parentDatasetId,
    sourceCheckpointId: input.checkpointId,
    sourcePromotionId: input.promotionId,
    incrementalPlanDigest: sha(`worker-concurrency:${input.label}`),
    startSequence: input.boundarySequence,
    boundarySequence: input.boundarySequence
  });
  const oracle = await runtime.runtimeDatasets.createOracle({
    enterpriseId: input.enterpriseId,
    consistencyDomain: input.consistencyDomain,
    parentDatasetId: input.parentDatasetId,
    oracleOfDatasetId: candidate.id,
    boundarySequence: input.boundarySequence
  });
  return {
    candidate,
    oracle: await runtime.runtimeDatasets.markOracleVerified(
      oracle.id,
      input.oracleDigest
    )
  };
}

async function queueOrder(
  ids: Awaited<ReturnType<typeof demoIds>>,
  label: string,
  effectiveAt: Date
) {
  const orderNo = `CONCURRENCY-${label}-${Date.now()}`;
  const result = await runtime.command.execute({
    enterpriseId: ids.enterpriseId,
    applicationInstanceId: ids.salesAppId,
    commandCode: 'approve-sales-order',
    actor: { type: 'AUTOMATION', id: 'b4.4b-concurrency-e2e' },
    requestId: `${orderNo}:approve`,
    correlationId: `O2C:${orderNo}`,
    idempotencyKey: `${orderNo}:approve`,
    input: {
      eventKind: 'ORDER',
      orderNo,
      customer: 'Concurrency Validation',
      productId: 'P-100',
      quantity: 1,
      unitPrice: '10.00',
      totalAmount: '10.00',
      currency: 'USD',
      localCarryingAmount: '70.00',
      localCurrency: 'CNY',
      fulfillmentMode: 'MAKE',
      project: 'PROJECT-CONCURRENCY',
      department: 'SALES',
      profitCenter: 'PC-PROJECT',
      costCenter: 'CC-SALES'
    },
    effectiveAt,
    businessObjectKey: orderNo,
    lineage: {
      flowDefinitionId: ids.flowDefinitionId,
      flowInstanceKey: orderNo,
      stepCode: 'sales-order-approved'
    }
  });
  await runtime.flow.projectCommand(result.commandExecutionId);
  const business = await runtime.db.selectFrom('business_data')
    .select('id')
    .where('command_execution_id','=',result.commandExecutionId)
    .executeTakeFirstOrThrow();
  const posting = await runtime.db.selectFrom('posting_input')
    .select(['id','posting_sequence','status'])
    .where('business_data_id','=',business.id)
    .executeTakeFirstOrThrow();
  return { businessDataId: business.id, posting };
}

try {
  const ids = await demoIds(runtime);
  const runtimeState = await runtime.db.selectFrom('enterprise_runtime_state')
    .select(['consistency_domain','last_posted_sequence','last_posted_effective_at'])
    .where('enterprise_id','=',ids.enterpriseId)
    .executeTakeFirstOrThrow();
  if (
    runtimeState.last_posted_sequence === null ||
    runtimeState.last_posted_effective_at === null
  ) {
    throw new Error('Concurrency E2E requires an existing posted CURRENT history.');
  }
  const consistencyDomain = runtimeState.consistency_domain;
  const initialBoundary = BigInt(runtimeState.last_posted_sequence);
  const active = await runtime.runtimeDatasets.getActive(
    ids.enterpriseId,
    consistencyDomain
  );
  if (
    active.kind !== 'CURRENT' ||
    active.status !== 'ACTIVE' ||
    active.boundarySequence === undefined
  ) {
    throw new Error('Concurrency E2E requires an activated CURRENT generation.');
  }

  const promotion = await runtime.db.selectFrom('replay_checkpoint_promotion as p')
    .innerJoin('replay_checkpoint as c','c.id','p.checkpoint_id')
    .select(['p.id as promotion_id','c.id as checkpoint_id'])
    .where('p.enterprise_id','=',ids.enterpriseId)
    .where('p.status','=','ACTIVE')
    .where('c.status','=','ACTIVE')
    .orderBy('p.promoted_at','desc')
    .executeTakeFirstOrThrow();

  // Scenario A — Worker waits first, Activation waits second.
  // After the gate releases, PostgreSQL must serialize Worker first.
  const matchingDigest = sha('worker-concurrency:worker-first');
  const workerFirstPair = await createSyntheticPair({
    enterpriseId: ids.enterpriseId,
    consistencyDomain,
    parentDatasetId: active.id,
    checkpointId: promotion.checkpoint_id,
    promotionId: promotion.promotion_id,
    boundarySequence: initialBoundary,
    label: 'worker-first',
    oracleDigest: matchingDigest
  });

  const firstEffectiveAt = new Date(
    new Date(runtimeState.last_posted_effective_at).getTime() + 60_000
  );
  const firstOrder = await queueOrder(ids,'WORKER-FIRST',firstEffectiveAt);
  if (BigInt(firstOrder.posting.posting_sequence) <= initialBoundary) {
    throw new Error('Worker-first fixture must allocate a posting sequence after Candidate boundary.');
  }

  const firstGate = await holdRuntimeCutoverLock(ids.enterpriseId,consistencyDomain);
  const firstWorker = runtime.posting.processNext(ids.enterpriseId);
  const firstWaiters = await waitForRuntimeLockWaiters(1);
  const firstActivation = gate(matchingDigest,matchingDigest).certifyAndActivate({
    candidateDatasetId: workerFirstPair.candidate.id,
    oracleDatasetId: workerFirstPair.oracle.id,
    certifiedBy: 'evo-worker-concurrency-e2e',
    reason: 'Worker-first cutover serialization evidence.'
  });
  const twoWaitersWorkerFirst = await waitForRuntimeLockWaiters(2);
  firstGate.release();
  await firstGate.done;

  const firstWorkerResult = await firstWorker;
  const firstActivationResult = await firstActivation;
  if (
    firstWorkerResult.status !== 'POSTED' ||
    firstActivationResult.certification.status !== 'REJECTED' ||
    !firstActivationResult.certification.blockers.includes(
      'POSTING_CURSOR_AHEAD_OF_CANDIDATE'
    ) ||
    firstActivationResult.activatedDataset !== undefined
  ) {
    throw new Error(
      'Worker-first cutover must post Worker input and reject the now-stale Candidate.'
    );
  }

  await runtime.work.refresh(ids.enterpriseId);
  const afterWorkerFirst = await runtime.currentEconomicRuntimeView.read(
    ids.enterpriseId,
    consistencyDomain
  );
  if (
    !afterWorkerFirst.hasLiveTail ||
    afterWorkerFirst.currentBoundarySequence !== firstWorkerResult.postingSequence ||
    afterWorkerFirst.currentBoundarySequence <= afterWorkerFirst.certifiedBoundarySequence
  ) {
    throw new Error(
      'CURRENT overlay must expose the normal-posting live tail after activation boundary.'
    );
  }
  const liveTailEntries = Array.isArray(afterWorkerFirst.semantic.ledgerEntries)
    ? afterWorkerFirst.semantic.ledgerEntries as Array<Record<string,unknown>>
    : [];
  if (!liveTailEntries.some((row) => row.businessDataId === firstOrder.businessDataId)) {
    throw new Error('CURRENT live-tail overlay did not include the Worker-posted business fact.');
  }

  const activeAfterWorkerFirst = await runtime.runtimeDatasets.getActive(
    ids.enterpriseId,
    consistencyDomain
  );
  if (activeAfterWorkerFirst.id !== active.id) {
    throw new Error('Rejected worker-first activation changed CURRENT.');
  }

  // Scenario B — Activation waits first, Worker waits second.
  // A controlled semantic rejection is enough here: the purpose is to prove
  // Worker cannot cross the same cutover lock while Activation owns it.
  const secondState = await runtime.db.selectFrom('enterprise_runtime_state')
    .select(['last_posted_sequence','last_posted_effective_at'])
    .where('enterprise_id','=',ids.enterpriseId)
    .executeTakeFirstOrThrow();
  if (
    secondState.last_posted_sequence === null ||
    secondState.last_posted_effective_at === null
  ) {
    throw new Error('Second concurrency fixture lacks runtime cursor state.');
  }
  const secondBoundary = BigInt(secondState.last_posted_sequence);
  const secondOracleDigest = sha('worker-concurrency:activation-first:oracle');
  const secondCandidateDigest = sha('worker-concurrency:activation-first:candidate');
  const activationFirstPair = await createSyntheticPair({
    enterpriseId: ids.enterpriseId,
    consistencyDomain,
    parentDatasetId: active.id,
    checkpointId: promotion.checkpoint_id,
    promotionId: promotion.promotion_id,
    boundarySequence: secondBoundary,
    label: 'activation-first',
    oracleDigest: secondOracleDigest
  });

  const secondEffectiveAt = new Date(
    new Date(secondState.last_posted_effective_at).getTime() + 60_000
  );
  const secondOrder = await queueOrder(ids,'ACTIVATION-FIRST',secondEffectiveAt);

  const secondGate = await holdRuntimeCutoverLock(ids.enterpriseId,consistencyDomain);
  const secondActivation = gate(
    secondCandidateDigest,
    secondOracleDigest
  ).certifyAndActivate({
    candidateDatasetId: activationFirstPair.candidate.id,
    oracleDatasetId: activationFirstPair.oracle.id,
    certifiedBy: 'evo-worker-concurrency-e2e',
    reason: 'Activation-first cutover serialization evidence.'
  });
  const firstActivationWaiter = await waitForRuntimeLockWaiters(1);
  const secondWorker = runtime.posting.processNext(ids.enterpriseId);
  const twoWaitersActivationFirst = await waitForRuntimeLockWaiters(2);
  secondGate.release();
  await secondGate.done;

  const secondActivationResult = await secondActivation;
  const secondWorkerResult = await secondWorker;
  if (
    secondActivationResult.certification.status !== 'REJECTED' ||
    !secondActivationResult.certification.blockers.includes('SEMANTIC_DIGEST_MISMATCH') ||
    secondWorkerResult.status !== 'POSTED'
  ) {
    throw new Error(
      'Activation-first serialization must complete Activation transaction before Worker posting.'
    );
  }

  await runtime.work.refresh(ids.enterpriseId);
  const finalView = await runtime.currentEconomicRuntimeView.read(
    ids.enterpriseId,
    consistencyDomain
  );
  const finalEntries = Array.isArray(finalView.semantic.ledgerEntries)
    ? finalView.semantic.ledgerEntries as Array<Record<string,unknown>>
    : [];
  if (
    !finalView.hasLiveTail ||
    !finalEntries.some((row) => row.businessDataId === firstOrder.businessDataId) ||
    !finalEntries.some((row) => row.businessDataId === secondOrder.businessDataId)
  ) {
    throw new Error('Final CURRENT live-tail overlay is missing serialized Worker facts.');
  }

  const finalActive = await runtime.runtimeDatasets.getActive(
    ids.enterpriseId,
    consistencyDomain
  );
  if (finalActive.id !== active.id) {
    throw new Error('Concurrency rejection scenarios must preserve the original CURRENT.');
  }

  console.log(JSON.stringify({
    status: 'PASS',
    evidence: 'DATABASE E2E VERIFIED',
    currentDatasetId: active.id,
    workerFirst: {
      lockWaitersBeforeRelease: twoWaitersWorkerFirst,
      initialLockWaiters: firstWaiters,
      workerPostingSequence: firstWorkerResult.postingSequence.toString(),
      activationStatus: firstActivationResult.certification.status,
      blockers: firstActivationResult.certification.blockers,
      currentHasLiveTail: afterWorkerFirst.hasLiveTail,
      currentBoundarySequence: afterWorkerFirst.currentBoundarySequence.toString(),
      certifiedBoundarySequence: afterWorkerFirst.certifiedBoundarySequence.toString()
    },
    activationFirst: {
      initialLockWaiters: firstActivationWaiter,
      lockWaitersBeforeRelease: twoWaitersActivationFirst,
      activationStatus: secondActivationResult.certification.status,
      blockers: secondActivationResult.certification.blockers,
      workerPostingSequence: secondWorkerResult.postingSequence.toString()
    },
    sharedCutoverLockVerified: true,
    liveTailVerified: true,
    uniqueCurrentPreserved: true
  },null,2));
} finally {
  await Promise.all([
    database.destroy(),
    gateDatabase.destroy(),
    observerDatabase.destroy()
  ]);
}

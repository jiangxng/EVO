import { createDatabase, createTransactionRunner } from '../platform/database/src/index.js';
import { loadRuntimeConfig } from '../platform/runtime/src/config.js';
import { createEvoRuntime, demoIds, drainPosting } from '../apps/api/src/evo-runtime.js';

const config = loadRuntimeConfig();
const database = createDatabase(config.databaseUrl);
const runtime = createEvoRuntime(database);

try {
  const ids = await demoIds(runtime);
  const orderNo = `VALIDATE-${Date.now()}`;
  await runtime.command.execute({
    enterpriseId: ids.enterpriseId,
    applicationInstanceId: ids.salesAppId,
    commandCode: 'approve-sales-order',
    actor: { type: 'AUTOMATION', id: 'demo-automation' },
    requestId: orderNo,
    correlationId: orderNo,
    idempotencyKey: orderNo,
    input: {
      orderNo,
      customer: 'Validation',
      totalQuantity: 3,
      totalAmount: '99.00',
      currency: 'USD'
    },
    effectiveAt: new Date(),
    businessObjectKey: orderNo
  });
  await drainPosting(runtime, ids.enterpriseId);

  const before = await runtime.query.balanceDigest(ids.enterpriseId);
  const replay = await runtime.replay.prepareFullReplay(ids.enterpriseId);
  await drainPosting(runtime, ids.enterpriseId);
  const after = await runtime.query.balanceDigest(ids.enterpriseId);
  await runtime.replay.completeFullReplay(replay.replayRunId, ids.enterpriseId, after);

  if (before !== after) {
    throw new Error(`Replay digest mismatch: ${before} != ${after}`);
  }

  console.log(JSON.stringify({
    status: 'PASS',
    replayDeterministic: true,
    beforeDigest: before,
    afterDigest: after
  }, null, 2));
} finally {
  await database.destroy();
}

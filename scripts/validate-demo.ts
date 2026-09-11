import { createDatabase } from '../platform/database/src/index.js';
import { loadRuntimeConfig } from '../platform/runtime/src/config.js';
import { createEvoRuntime, demoIds, drainPosting } from '../apps/api/src/evo-runtime.js';

const config = loadRuntimeConfig();
const database = createDatabase(config.databaseUrl);
const runtime = createEvoRuntime(database);

try {
  const ids = await demoIds(runtime);
  const orderNo = `VALIDATE-${Date.now()}`;
  const command = await runtime.command.execute({
    enterpriseId: ids.enterpriseId,
    applicationInstanceId: ids.salesAppId,
    commandCode: 'approve-sales-order',
    actor: { type: 'AUTOMATION', id: 'demo-automation' },
    requestId: orderNo,
    correlationId: `O2C:${orderNo}`,
    idempotencyKey: orderNo,
    input: {
      orderNo,
      customer: 'Validation',
      productId: 'P-100',
      quantity: 3,
      unitPrice: '33.00',
      totalAmount: '99.00',
      currency: 'USD',
      fulfillmentMode: 'MAKE'
    },
    effectiveAt: new Date(),
    businessObjectKey: orderNo,
    lineage: {
      flowDefinitionId: ids.flowDefinitionId,
      flowInstanceKey: orderNo,
      stepCode: 'sales-order-approved'
    }
  });
  await runtime.flow.projectCommand(command.commandExecutionId);
  await drainPosting(runtime, ids.enterpriseId);

  const before = await runtime.query.balanceDigest(ids.enterpriseId);
  const replay = await runtime.replay.prepareFullReplay(ids.enterpriseId);
  await drainPosting(runtime, ids.enterpriseId);
  const after = await runtime.query.balanceDigest(ids.enterpriseId);
  await runtime.replay.completeFullReplay(replay.replayRunId, ids.enterpriseId, after);

  if (before !== after || replay.beforeDigest !== before) {
    throw new Error(`Replay digest mismatch: query=${before}, replay=${replay.beforeDigest}, after=${after}`);
  }

  console.log(JSON.stringify({
    status: 'PASS',
    replayDeterministic: true,
    beforeDigest: before,
    afterDigest: after,
    contextContractVersion: '1.0'
  }, null, 2));
} finally {
  await database.destroy();
}

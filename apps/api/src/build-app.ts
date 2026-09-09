import Fastify, { type FastifyInstance } from 'fastify';
import type { DatabaseHandle } from '../../../platform/database/src/index.js';
import { AppError } from '../../../platform/contracts/src/index.js';
import { createEvoRuntime, demoIds, drainPosting } from './evo-runtime.js';
import { demoConsoleHtml } from './demo-console.js';

export interface BuildAppOptions {
  readonly database?: DatabaseHandle;
  readonly loggerLevel?: string;
}

export function buildApp(options: BuildAppOptions = {}): FastifyInstance {
  const app = Fastify({
    logger: { level: options.loggerLevel ?? 'info' },
    requestIdHeader: 'x-request-id'
  });

  app.get('/health/live', async () => ({ status: 'ok', service: 'evo-api', version: '0.9.0' }));

  app.get('/health/ready', async (_request, reply) => {
    if (options.database === undefined) {
      return reply.code(503).send({ status: 'not_ready', reason: 'database_not_configured' });
    }
    try {
      await options.database.ping();
      return { status: 'ready', version: '0.9.0' };
    } catch {
      return reply.code(503).send({ status: 'not_ready', reason: 'database_unavailable' });
    }
  });

  if (options.database !== undefined) {
    const runtime = createEvoRuntime(options.database);

    app.get('/', async (_request, reply) =>
      reply.type('text/html; charset=utf-8').send(demoConsoleHtml)
    );

    app.get('/api/v1/demo/dashboard', async () => {
      const ids = await demoIds(runtime);
      return runtime.query.dashboard(ids.enterpriseId);
    });

    app.get('/api/v1/demo/ai/catalog', async () => {
      const ids = await demoIds(runtime);
      return {
        actorBoundary: 'AI uses the same Command boundary as Human/Automation.',
        tools: await runtime.ai.list(ids.enterpriseId)
      };
    });

    app.post('/api/v1/demo/sales-orders/approve', async (request) => {
      const ids = await demoIds(runtime);
      const body = request.body as {
        actor?: { type?: 'HUMAN'|'AI'; id?: string };
        orderNo: string; customer: string; totalQuantity: number;
        totalAmount: string; currency: string;
      };
      const actor = body.actor?.type === 'AI'
        ? { type: 'AI' as const, id: body.actor.id ?? 'demo-agent' }
        : { type: 'HUMAN' as const, id: body.actor?.id ?? 'demo-user' };

      await runtime.auth.require({
        enterpriseId: ids.enterpriseId,
        actorType: actor.type,
        actorId: actor.id,
        permissionCode: 'sales.approve'
      });

      const result = await runtime.command.execute({
        enterpriseId: ids.enterpriseId,
        applicationInstanceId: ids.salesAppId,
        commandCode: 'approve-sales-order',
        actor,
        requestId: request.id,
        correlationId: request.id,
        idempotencyKey: `approve:${body.orderNo}`,
        input: {
          orderNo: body.orderNo,
          customer: body.customer,
          totalQuantity: body.totalQuantity,
          totalAmount: body.totalAmount,
          currency: body.currency
        },
        effectiveAt: new Date(),
        businessObjectKey: body.orderNo
      });
      const posted = await drainPosting(runtime, ids.enterpriseId);
      return { command: result, posted };
    });

    app.post('/api/v1/demo/inventory/receive', async (request) => {
      const ids = await demoIds(runtime);
      const body = request.body as {
        actor?: { type?: 'HUMAN'|'AI'; id?: string };
        productId: string; warehouse: string; quantity: number; totalCost: string;
      };
      const actor = body.actor?.type === 'AI'
        ? { type: 'AI' as const, id: body.actor.id ?? 'demo-agent' }
        : { type: 'HUMAN' as const, id: body.actor?.id ?? 'demo-user' };
      await runtime.auth.require({
        enterpriseId: ids.enterpriseId, actorType: actor.type, actorId: actor.id,
        permissionCode: 'inventory.receive'
      });
      const result = await runtime.command.execute({
        enterpriseId: ids.enterpriseId,
        applicationInstanceId: ids.inventoryAppId,
        commandCode: 'receive-inventory',
        actor,
        requestId: request.id,
        correlationId: request.id,
        idempotencyKey: `receive:${body.productId}:${body.warehouse}:${request.id}`,
        input: {
          movementType: 'RECEIVE',
          productId: body.productId,
          warehouse: body.warehouse,
          quantity: body.quantity,
          totalCost: body.totalCost
        },
        effectiveAt: new Date(),
        businessObjectKey: `INV:${body.warehouse}:${body.productId}`
      });
      const posted = await drainPosting(runtime, ids.enterpriseId);
      return { command: result, posted };
    });

    app.post('/api/v1/demo/inventory/ship', async (request) => {
      const ids = await demoIds(runtime);
      const body = request.body as {
        actor?: { type?: 'HUMAN'|'AI'; id?: string };
        productId: string; warehouse: string; quantity: number; lot?: string;
      };
      const actor = body.actor?.type === 'AI'
        ? { type: 'AI' as const, id: body.actor.id ?? 'demo-agent' }
        : { type: 'HUMAN' as const, id: body.actor?.id ?? 'demo-user' };
      await runtime.auth.require({
        enterpriseId: ids.enterpriseId, actorType: actor.type, actorId: actor.id,
        permissionCode: 'inventory.ship'
      });
      const result = await runtime.command.execute({
        enterpriseId: ids.enterpriseId,
        applicationInstanceId: ids.inventoryAppId,
        commandCode: 'ship-inventory',
        actor,
        requestId: request.id,
        correlationId: request.id,
        idempotencyKey: `ship:${body.productId}:${body.warehouse}:${request.id}`,
        input: {
          movementType: 'SHIP',
          productId: body.productId,
          warehouse: body.warehouse,
          quantity: body.quantity,
          lot: body.lot ?? null
        },
        effectiveAt: new Date(),
        businessObjectKey: `INV:${body.warehouse}:${body.productId}`
      });
      const posted = await drainPosting(runtime, ids.enterpriseId);
      return { command: result, posted };
    });

    app.post('/api/v1/demo/cost/recalculate', async (request) => {
      const ids = await demoIds(runtime);
      const body = request.body as { method?: 'FIFO'|'LIFO'|'MOVING_AVERAGE'|'SPECIFIC_IDENTIFICATION' };
      return runtime.cost.recalculate(ids.enterpriseId, body.method ?? 'FIFO');
    });

    app.post('/api/v1/demo/replay', async () => {
      const ids = await demoIds(runtime);
      const beforeDigest = await runtime.query.balanceDigest(ids.enterpriseId);
      const replay = await runtime.replay.prepareFullReplay(ids.enterpriseId);
      const posted = await drainPosting(runtime, ids.enterpriseId);
      const afterDigest = await runtime.query.balanceDigest(ids.enterpriseId);
      await runtime.replay.completeFullReplay(
        replay.replayRunId, ids.enterpriseId, afterDigest
      );
      return {
        replayRunId: replay.replayRunId,
        boundarySequence: replay.boundarySequence.toString(),
        posted,
        beforeDigest,
        afterDigest,
        deterministic: beforeDigest === afterDigest
      };
    });
  }

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      return reply.code(422).send({
        error: {
          code: error.code,
          message: error.message,
          retryable: error.retryable,
          details: error.details,
          correlation_id: request.id
        }
      });
    }
    request.log.error({ err: error }, 'Unhandled request error.');
    return reply.code(500).send({
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Internal server error.',
        retryable: false,
        correlation_id: request.id
      }
    });
  });

  return app;
}

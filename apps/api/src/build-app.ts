import Fastify, { type FastifyInstance } from 'fastify';
import type { DatabaseHandle } from '../../../platform/database/src/index.js';
import { AppError } from '../../../platform/contracts/src/index.js';
import { createEvoRuntime, demoIds, drainPosting } from './evo-runtime.js';
import { demoConsoleHtml } from './demo-console.js';

export interface BuildAppOptions {
  readonly database?: DatabaseHandle;
  readonly loggerLevel?: string;
}

type DemoActorBody = { actor?: { type?: 'HUMAN'|'AI'; id?: string } };

function resolveActor(body: DemoActorBody) {
  return body.actor?.type === 'AI'
    ? { type: 'AI' as const, id: body.actor.id ?? 'demo-agent' }
    : { type: 'HUMAN' as const, id: body.actor?.id ?? 'demo-user' };
}

export function buildApp(options: BuildAppOptions = {}): FastifyInstance {
  const app = Fastify({
    logger: { level: options.loggerLevel ?? 'info' },
    requestIdHeader: 'x-request-id'
  });

  app.get('/health/live', async () => ({ status: 'ok', service: 'evo-api', version: '1.0.0-alpha.2' }));

  app.get('/health/ready', async (_request, reply) => {
    if (options.database === undefined) {
      return reply.code(503).send({ status: 'not_ready', reason: 'database_not_configured' });
    }
    try {
      await options.database.ping();
      return { status: 'ready', version: '1.0.0-alpha.2' };
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
        contextContract: 'LLM.md + context.manifest.json',
        tools: await runtime.ai.list(ids.enterpriseId)
      };
    });

    app.post('/api/v1/demo/sales-orders/approve', async (request) => {
      const ids = await demoIds(runtime);
      const body = request.body as DemoActorBody & {
        orderNo: string;
        customer: string;
        productId: string;
        quantity: number;
        unitPrice: string;
        totalAmount: string;
        currency: string;
        project?: string;
        department?: string;
        profitCenter?: string;
        costCenter?: string;
      };
      const actor = resolveActor(body);

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
        correlationId: `O2C:${body.orderNo}`,
        idempotencyKey: `approve:${body.orderNo}`,
        input: {
          orderNo: body.orderNo,
          customer: body.customer,
          productId: body.productId,
          quantity: body.quantity,
          unitPrice: body.unitPrice,
          totalAmount: body.totalAmount,
          currency: body.currency,
          fulfillmentMode: 'MAKE',
          project: body.project ?? null,
          department: body.department ?? null,
          profitCenter: body.profitCenter ?? null,
          costCenter: body.costCenter ?? null
        },
        effectiveAt: new Date(),
        businessObjectKey: body.orderNo,
        lineage: {
          flowDefinitionId: ids.flowDefinitionId,
          flowInstanceKey: body.orderNo,
          stepCode: 'sales-order-approved'
        }
      });
      await runtime.flow.projectCommand(result.commandExecutionId);
      const posted = await drainPosting(runtime, ids.enterpriseId);
      return { command: result, posted };
    });

    app.post('/api/v1/demo/production/complete', async (request) => {
      const ids = await demoIds(runtime);
      const body = request.body as DemoActorBody & {
        orderNo: string;
        customer: string;
        productId: string;
        warehouse: string;
        quantity: number;
        totalCost: string;
        project?: string;
        department?: string;
        profitCenter?: string;
        costCenter?: string;
      };
      const actor = resolveActor(body);

      await runtime.auth.require({
        enterpriseId: ids.enterpriseId,
        actorType: actor.type,
        actorId: actor.id,
        permissionCode: 'production.complete'
      });

      const parent = await runtime.db.selectFrom('business_data')
        .select(['id','payload'])
        .where('enterprise_id','=',ids.enterpriseId)
        .where('business_data_type','=','sales_order.approved')
        .where('business_object_key','=',body.orderNo)
        .orderBy('business_object_version','desc')
        .executeTakeFirstOrThrow();

      const result = await runtime.command.execute({
        enterpriseId: ids.enterpriseId,
        applicationInstanceId: ids.productionAppId,
        commandCode: 'complete-production',
        actor,
        requestId: request.id,
        correlationId: `O2C:${body.orderNo}`,
        causationId: parent.id,
        idempotencyKey: `production-complete:${body.orderNo}:${body.productId}:${request.id}`,
        input: {
          orderNo: body.orderNo,
          customer: body.customer,
          productId: body.productId,
          warehouse: body.warehouse,
          quantity: body.quantity,
          totalCost: body.totalCost,
          project: body.project ?? (parent.payload as Record<string, unknown>).project ?? null,
          department: body.department ?? (parent.payload as Record<string, unknown>).department ?? null,
          profitCenter: body.profitCenter ?? (parent.payload as Record<string, unknown>).profitCenter ?? null,
          costCenter: body.costCenter ?? (parent.payload as Record<string, unknown>).costCenter ?? null
        },
        effectiveAt: new Date(),
        businessObjectKey: `PROD:${body.orderNo}:${body.productId}`,
        lineage: {
          flowDefinitionId: ids.flowDefinitionId,
          flowInstanceKey: body.orderNo,
          stepCode: 'production-completed',
          parentBusinessDataId: parent.id,
          relationType: 'FULFILLS'
        }
      });
      await runtime.flow.projectCommand(result.commandExecutionId);
      const posted = await drainPosting(runtime, ids.enterpriseId);
      return { command: result, posted };
    });

    app.post('/api/v1/demo/shipments/create', async (request) => {
      const ids = await demoIds(runtime);
      const body = request.body as DemoActorBody & {
        shipmentNo: string;
        orderNo: string;
        customer: string;
        productId: string;
        warehouse: string;
        quantity: number;
        lot?: string;
        project?: string;
        department?: string;
        profitCenter?: string;
        costCenter?: string;
      };
      const actor = resolveActor(body);

      await runtime.auth.require({
        enterpriseId: ids.enterpriseId,
        actorType: actor.type,
        actorId: actor.id,
        permissionCode: 'inventory.ship'
      });

      const parent = await runtime.db.selectFrom('business_data')
        .select(['id','payload'])
        .where('enterprise_id','=',ids.enterpriseId)
        .where('business_data_type','=','sales_order.approved')
        .where('business_object_key','=',body.orderNo)
        .orderBy('business_object_version','desc')
        .executeTakeFirstOrThrow();

      const result = await runtime.command.execute({
        enterpriseId: ids.enterpriseId,
        applicationInstanceId: ids.inventoryAppId,
        commandCode: 'ship-sales-order',
        actor,
        requestId: request.id,
        correlationId: `O2C:${body.orderNo}`,
        causationId: parent.id,
        idempotencyKey: `shipment:${body.shipmentNo}`,
        input: {
          movementType: 'SHIP',
          shipmentNo: body.shipmentNo,
          orderNo: body.orderNo,
          customer: body.customer,
          productId: body.productId,
          warehouse: body.warehouse,
          quantity: body.quantity,
          lot: body.lot ?? null,
          project: body.project ?? (parent.payload as Record<string, unknown>).project ?? null,
          department: body.department ?? (parent.payload as Record<string, unknown>).department ?? null,
          profitCenter: body.profitCenter ?? (parent.payload as Record<string, unknown>).profitCenter ?? null,
          costCenter: body.costCenter ?? (parent.payload as Record<string, unknown>).costCenter ?? null
        },
        effectiveAt: new Date(),
        businessObjectKey: body.shipmentNo,
        lineage: {
          flowDefinitionId: ids.flowDefinitionId,
          flowInstanceKey: body.orderNo,
          stepCode: 'shipment-created',
          parentBusinessDataId: parent.id,
          relationType: 'FULFILLS'
        }
      });
      await runtime.flow.projectCommand(result.commandExecutionId);
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
      const cost = replay.costMethod === null
        ? null
        : await runtime.cost.recalculate(ids.enterpriseId, replay.costMethod, replay.costPins ?? undefined);
      const afterDigest = await runtime.query.balanceDigest(ids.enterpriseId);
      await runtime.replay.completeFullReplay(
        replay.replayRunId, ids.enterpriseId, afterDigest
      );
      return {
        replayRunId: replay.replayRunId,
        boundarySequence: replay.boundarySequence.toString(),
        posted,
        cost,
        beforeDigest,
        replayRecordedBeforeDigest: replay.beforeDigest,
        afterDigest,
        deterministic: beforeDigest === afterDigest && replay.beforeDigest === beforeDigest
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

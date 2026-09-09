import Fastify, { type FastifyInstance } from 'fastify';
import type { DatabaseHandle } from '../../../platform/database/src/index.js';
import { AppError } from '../../../platform/contracts/src/index.js';

export interface BuildAppOptions {
  readonly database?: DatabaseHandle;
  readonly loggerLevel?: string;
}

export function buildApp(options: BuildAppOptions = {}): FastifyInstance {
  const app = Fastify({
    logger: {
      level: options.loggerLevel ?? 'info'
    },
    requestIdHeader: 'x-request-id'
  });

  app.get('/health/live', async () => ({
    status: 'ok',
    service: 'evo-api'
  }));

  app.get('/health/ready', async (_request, reply) => {
    if (options.database === undefined) {
      return reply.code(503).send({
        status: 'not_ready',
        reason: 'database_not_configured'
      });
    }

    try {
      await options.database.ping();
      return { status: 'ready' };
    } catch (cause) {
      app.log.error({ err: cause }, 'Database readiness check failed.');
      return reply.code(503).send({
        status: 'not_ready',
        reason: 'database_unavailable'
      });
    }
  });

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
        message: 'Internal server error.',
        retryable: false,
        correlation_id: request.id
      }
    });
  });

  return app;
}

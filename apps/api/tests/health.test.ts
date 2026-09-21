import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/build-app.js';

let app: FastifyInstance | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe('API health', () => {
  it('reports liveness without requiring the database', async () => {
    app = buildApp({ loggerLevel: 'silent' });

    const response = await app.inject({ method: 'GET', url: '/health/live' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: 'ok',
      service: 'evo-api',
      version: '1.0.0-alpha.2'
    });
  });

  it('does not claim readiness when the database is absent', async () => {
    app = buildApp({ loggerLevel: 'silent' });

    const response = await app.inject({ method: 'GET', url: '/health/ready' });

    expect(response.statusCode).toBe(503);
  });
});

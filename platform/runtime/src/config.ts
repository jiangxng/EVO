export interface RuntimeConfig {
  readonly nodeEnv: string;
  readonly host: string;
  readonly port: number;
  readonly logLevel: string;
  readonly databaseUrl: string;
  readonly workerPollIntervalMs: number;
}

function integerEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined) return fallback;

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Environment variable ${name} must be an integer.`);
  }
  return parsed;
}

export function loadRuntimeConfig(): RuntimeConfig {
  return {
    nodeEnv: process.env.NODE_ENV ?? 'development',
    host: process.env.HOST ?? '0.0.0.0',
    port: integerEnv('PORT', 3000),
    logLevel: process.env.LOG_LEVEL ?? 'info',
    databaseUrl:
      process.env.DATABASE_URL ?? 'postgres://evo:evo@localhost:5432/evo',
    workerPollIntervalMs: integerEnv('WORKER_POLL_INTERVAL_MS', 1000)
  };
}

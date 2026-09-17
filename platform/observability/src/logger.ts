import pino, { type Logger } from 'pino';

export interface LoggerContext {
  readonly service: string;
  readonly module?: string;
  readonly environment: string;
}

export function createLogger(
  context: LoggerContext,
  level = 'info'
): Logger {
  return pino({
    level,
    base: {
      service: context.service,
      module: context.module,
      environment: context.environment
    }
  });
}

export interface AppErrorOptions {
  readonly code: string;
  readonly message: string;
  readonly module: string;
  readonly operation?: string;
  readonly retryable?: boolean;
  readonly details?: Readonly<Record<string, unknown>>;
  readonly cause?: unknown;
}

export class AppError extends Error {
  readonly code: string;
  readonly module: string;
  readonly operation: string | undefined;
  readonly retryable: boolean;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(options: AppErrorOptions) {
    super(options.message, { cause: options.cause });
    this.name = 'AppError';
    this.code = options.code;
    this.module = options.module;
    this.operation = options.operation;
    this.retryable = options.retryable ?? false;
    this.details = options.details ?? {};
  }
}

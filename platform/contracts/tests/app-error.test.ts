import { describe, expect, it } from 'vitest';
import { AppError } from '../src/app-error.js';

describe('AppError', () => {
  it('preserves machine-readable diagnostic fields', () => {
    const error = new AppError({
      code: 'EXAMPLE_FAILURE',
      message: 'Example failure.',
      module: 'testing',
      operation: 'example',
      retryable: true,
      details: { objectId: '123' }
    });

    expect(error.code).toBe('EXAMPLE_FAILURE');
    expect(error.module).toBe('testing');
    expect(error.retryable).toBe(true);
    expect(error.details).toEqual({ objectId: '123' });
  });
});

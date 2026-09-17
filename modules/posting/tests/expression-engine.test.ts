import { describe, expect, it } from 'vitest';
import {
  evaluateBoolean,
  evaluateExpression
} from '../domain/expression-engine.js';

describe('posting expression engine', () => {
  const payload = {
    quantity: 20,
    unitPrice: '12.50',
    product: {
      type: 'SELF_MADE'
    }
  };

  it('evaluates decimal arithmetic without JS floating point', () => {
    const value = evaluateExpression({
      type: 'mul',
      left: { type: 'field', path: 'quantity' },
      right: { type: 'field', path: 'unitPrice' }
    }, { payload });

    expect(value).toBe('250');
  });

  it('evaluates nested conditions', () => {
    const value = evaluateBoolean({
      type: 'and',
      values: [
        {
          type: 'eq',
          left: { type: 'field', path: 'product.type' },
          right: { type: 'literal', value: 'SELF_MADE' }
        },
        {
          type: 'gt',
          left: { type: 'field', path: 'quantity' },
          right: { type: 'literal', value: 0 }
        }
      ]
    }, { payload });

    expect(value).toBe(true);
  });

  it('rejects fractional JS numbers for authoritative arithmetic', () => {
    expect(() => evaluateExpression({
      type: 'add',
      left: { type: 'literal', value: 0.1 },
      right: { type: 'literal', value: 0.2 }
    }, { payload })).toThrowError(
      /decimal strings or safe integers/
    );
  });
});

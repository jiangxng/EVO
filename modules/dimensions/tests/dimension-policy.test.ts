import { describe, expect, it } from 'vitest';
import { validateDimensionPolicy } from '../domain/dimension-policy.js';

describe('ledger dimension policy', () => {
  const known = new Set(['product_id','warehouse','project','profit_center']);

  it('accepts required and optional dimensions', () => {
    expect(() => validateDimensionPolicy('inventory', {
      required: ['product_id','warehouse'], optional: ['project']
    }, { product_id: 'P-100', warehouse: 'HK', project: 'PROJECT-X' }, known)).not.toThrow();
  });

  it('rejects missing required dimensions', () => {
    expect(() => validateDimensionPolicy('inventory', {
      required: ['product_id','warehouse']
    }, { product_id: 'P-100' }, known)).toThrow(/requires dimension warehouse/);
  });

  it('rejects undeclared propagation', () => {
    expect(() => validateDimensionPolicy('inventory', {
      required: ['product_id','warehouse']
    }, { product_id: 'P-100', warehouse: 'HK', profit_center: 'PC-X' }, known)).toThrow(/not allowed/);
  });
});

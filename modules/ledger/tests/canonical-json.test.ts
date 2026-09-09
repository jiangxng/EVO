import { describe, expect, it } from 'vitest';
import {
  canonicalizeJson,
  dimensionHash
} from '../domain/canonical-json.js';

describe('canonical ledger dimensions', () => {
  it('is independent of object key insertion order', () => {
    const left = { warehouse: 'HK', product: 'P1' };
    const right = { product: 'P1', warehouse: 'HK' };

    expect(canonicalizeJson(left)).toBe(canonicalizeJson(right));
    expect(dimensionHash(left)).toBe(dimensionHash(right));
  });

  it('changes hash when semantic dimension value changes', () => {
    expect(
      dimensionHash({ product: 'P1' })
    ).not.toBe(
      dimensionHash({ product: 'P2' })
    );
  });
});

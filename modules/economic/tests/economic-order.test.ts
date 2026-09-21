import { describe, expect, it } from 'vitest';
import { compareEconomicOrderKey } from '../domain/economic-order.js';

describe('economic order', () => {
  it('orders by effective time before physical recording concerns', () => {
    const earlier = {
      effectiveAt: new Date('2026-01-01T00:00:00Z'),
      semanticSequence: 99n,
      stableTieBreaker: 'z'
    };
    const later = {
      effectiveAt: new Date('2026-01-02T00:00:00Z'),
      semanticSequence: 1n,
      stableTieBreaker: 'a'
    };

    expect(compareEconomicOrderKey(earlier, later)).toBeLessThan(0);
  });

  it('uses semantic sequence and then stable tie breaker', () => {
    const effectiveAt = new Date('2026-01-01T00:00:00Z');
    expect(compareEconomicOrderKey(
      { effectiveAt, semanticSequence: 1n, stableTieBreaker: 'z' },
      { effectiveAt, semanticSequence: 2n, stableTieBreaker: 'a' }
    )).toBeLessThan(0);

    expect(compareEconomicOrderKey(
      { effectiveAt, semanticSequence: 2n, stableTieBreaker: 'a' },
      { effectiveAt, semanticSequence: 2n, stableTieBreaker: 'b' }
    )).toBeLessThan(0);
  });
});

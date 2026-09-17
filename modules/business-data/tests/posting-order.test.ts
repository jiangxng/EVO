import { describe, expect, it } from 'vitest';
import {
  comparePostingOrder,
  isRetroactivePostingInput
} from '../domain/posting-order.js';

describe('posting canonical order', () => {
  const highWater = {
    effectiveAt: new Date('2026-09-09T10:00:00Z'),
    postingPriority: 10,
    postingSequence: 100n
  };

  it('orders by effective time before priority and sequence', () => {
    expect(
      comparePostingOrder(
        {
          effectiveAt: new Date('2026-09-09T09:00:00Z'),
          postingPriority: 999,
          postingSequence: 999n
        },
        highWater
      )
    ).toBeLessThan(0);
  });

  it('marks a later-created backdated input as retroactive', () => {
    expect(
      isRetroactivePostingInput(
        {
          effectiveAt: new Date('2026-09-08T10:00:00Z'),
          postingPriority: 0,
          postingSequence: 101n
        },
        highWater
      )
    ).toBe(true);
  });

  it('does not mark a canonically later input as retroactive', () => {
    expect(
      isRetroactivePostingInput(
        {
          effectiveAt: new Date('2026-09-10T10:00:00Z'),
          postingPriority: 0,
          postingSequence: 101n
        },
        highWater
      )
    ).toBe(false);
  });

  it('treats an equal-or-earlier canonical key as requiring replay', () => {
    expect(isRetroactivePostingInput(highWater, highWater)).toBe(true);
  });
});

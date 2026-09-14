import { describe, expect, it } from 'vitest';
import { valuationDelta } from '../domain/valuation-delta.js';

describe('valuation delta', () => {
  it('posts the initial target', () => {
    expect(valuationDelta('0','20').delta.toString()).toBe('20');
  });

  it('is idempotent for an unchanged target', () => {
    expect(valuationDelta('20','20').delta.toString()).toBe('0');
  });

  it('can reverse value when recalculation decreases cost', () => {
    expect(valuationDelta('20','18').delta.toString()).toBe('-2');
  });
});

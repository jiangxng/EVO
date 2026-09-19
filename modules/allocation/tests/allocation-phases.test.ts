import { describe, expect, it } from 'vitest';
import { allocationPhases } from '../domain/allocation-phases.js';

describe('allocation phases', () => {
  it('preserves explicit-only source selection', () => {
    expect(allocationPhases('EXPLICIT')).toEqual(['EXPLICIT']);
  });

  it('keeps automatic allocation separate from explicit business instruction', () => {
    expect(allocationPhases('AUTOMATIC')).toEqual(['AUTOMATIC']);
  });

  it('runs explicit selection before automatic residual allocation', () => {
    expect(allocationPhases('EXPLICIT_THEN_AUTOMATIC')).toEqual([
      'EXPLICIT',
      'AUTOMATIC'
    ]);
  });
});

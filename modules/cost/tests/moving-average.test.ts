import { Decimal } from 'decimal.js';
import { describe, expect, it } from 'vitest';
import {
  addToMovingAverage,
  consumeMovingAverage
} from '../domain/moving-average.js';

describe('moving average cost pool', () => {
  it('preserves the average basis after partial outbound consumption', () => {
    let state = { quantity: new Decimal(0), amount: new Decimal(0) };
    state = addToMovingAverage(state, new Decimal(100), new Decimal(1000));
    state = addToMovingAverage(state, new Decimal(100), new Decimal(1200));

    const first = consumeMovingAverage(state, new Decimal(120));
    expect(first.unitCost.toString()).toBe('11');
    expect(first.totalCost.toString()).toBe('1320');
    expect(first.next.quantity.toString()).toBe('80');
    expect(first.next.amount.toString()).toBe('880');

    const second = consumeMovingAverage(first.next, new Decimal(20));
    expect(second.unitCost.toString()).toBe('11');
    expect(second.totalCost.toString()).toBe('220');
    expect(second.next.quantity.toString()).toBe('60');
    expect(second.next.amount.toString()).toBe('660');
  });

  it('closes residual amount when quantity reaches zero', () => {
    const state = { quantity: new Decimal(3), amount: new Decimal(10) };
    const result = consumeMovingAverage(state, new Decimal(3));

    expect(result.next.quantity.toString()).toBe('0');
    expect(result.next.amount.toString()).toBe('0');
    expect(result.totalCost.toString()).toBe('10');
  });
});

import { Decimal } from 'decimal.js';

export interface ValuationDelta {
  readonly previous: Decimal;
  readonly target: Decimal;
  readonly delta: Decimal;
}

export function valuationDelta(previousTotalCost: string, targetTotalCost: string): ValuationDelta {
  const previous = new Decimal(previousTotalCost);
  const target = new Decimal(targetTotalCost);
  return { previous, target, delta: target.minus(previous) };
}

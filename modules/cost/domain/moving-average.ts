import { Decimal } from 'decimal.js';

export interface MovingAverageState {
  readonly quantity: Decimal;
  readonly amount: Decimal;
}

export interface MovingAverageConsumption {
  readonly next: MovingAverageState;
  readonly totalCost: Decimal;
  readonly unitCost: Decimal;
}

export function addToMovingAverage(
  state: MovingAverageState,
  quantity: Decimal,
  amount: Decimal
): MovingAverageState {
  if (quantity.lte(0)) throw new Error('Moving-average inbound quantity must be positive.');
  return {
    quantity: state.quantity.plus(quantity),
    amount: state.amount.plus(amount)
  };
}

export function consumeMovingAverage(
  state: MovingAverageState,
  quantity: Decimal
): MovingAverageConsumption {
  if (quantity.lte(0)) throw new Error('Moving-average outbound quantity must be positive.');
  if (state.quantity.lt(quantity)) throw new Error('Moving-average pool cannot go negative.');
  if (state.quantity.isZero()) throw new Error('Moving-average pool is empty.');

  const unitCost = state.amount.div(state.quantity);
  const totalCost = quantity.times(unitCost);
  const nextQuantity = state.quantity.minus(quantity);
  const nextAmount = nextQuantity.isZero()
    ? new Decimal(0)
    : state.amount.minus(totalCost);

  return {
    next: { quantity: nextQuantity, amount: nextAmount },
    totalCost,
    unitCost
  };
}

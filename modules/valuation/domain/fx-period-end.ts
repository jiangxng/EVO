import { Decimal } from 'decimal.js';
import type { RateObservation } from '../../economic/api/contracts.js';
import type {
  FxPositionSnapshot,
  FxRevaluationPolicy,
  FxRevaluationResult
} from '../api/fx.js';

function roundingMode(policy: FxRevaluationPolicy): number {
  switch (policy.roundingMode) {
    case 'HALF_UP':
      return Decimal.ROUND_HALF_UP;
  }
}

export function revalueFxPosition(
  position: FxPositionSnapshot,
  rate: RateObservation,
  policy: FxRevaluationPolicy
): FxRevaluationResult {
  if (rate.role !== 'PERIOD_END_VALUATION') {
    throw new Error('FX period-end revaluation requires a PERIOD_END_VALUATION rate.');
  }
  if (rate.convention !== 'TARGET_PER_SOURCE') {
    throw new Error('Unsupported FX rate convention.');
  }
  if (position.foreign.unit !== rate.sourceUnit) {
    throw new Error(
      `FX source unit mismatch: position=${position.foreign.unit}, rate=${rate.sourceUnit}.`
    );
  }
  if (position.carrying.unit !== rate.targetUnit) {
    throw new Error(
      `FX target unit mismatch: carrying=${position.carrying.unit}, rate=${rate.targetUnit}.`
    );
  }
  if (policy.amountScale < 0 || !Number.isInteger(policy.amountScale)) {
    throw new Error('FX amountScale must be a non-negative integer.');
  }

  const foreignAmount = new Decimal(position.foreign.value);
  const carryingBefore = new Decimal(position.carrying.value);
  const carryingAfter = foreignAmount
    .times(new Decimal(rate.rate))
    .toDecimalPlaces(policy.amountScale, roundingMode(policy));
  const delta = carryingAfter.minus(carryingBefore);

  return {
    positionKey: position.positionKey,
    foreign: position.foreign,
    carryingBefore: position.carrying,
    carryingAfter: {
      value: carryingAfter.toString(),
      unit: position.carrying.unit,
      role: 'VALUATION_AMOUNT'
    },
    delta: {
      value: delta.toString(),
      unit: position.carrying.unit,
      role: 'VALUATION_AMOUNT'
    },
    rateObservationId: rate.id,
    rate: rate.rate
  };
}

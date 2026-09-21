import { Decimal } from 'decimal.js';
import type {
  FxPositionSnapshot,
  FxSettlementClosureResult
} from '../api/fx.js';
import type { Measurement } from '../../economic/api/contracts.js';

function requireRole(
  measurement: Measurement,
  expected: Measurement['role'],
  label: string
): void {
  if (measurement.role !== expected) {
    throw new Error(`${label} must have role ${expected}.`);
  }
}

export function closeFxPosition(
  position: FxPositionSnapshot,
  settlementForeign: Measurement,
  settlementLocal: Measurement
): FxSettlementClosureResult {
  requireRole(position.foreign, 'RESOURCE_QUANTITY', 'position.foreign');
  requireRole(position.carrying, 'VALUATION_AMOUNT', 'position.carrying');
  requireRole(settlementForeign, 'SETTLEMENT_QUANTITY', 'settlementForeign');
  requireRole(settlementLocal, 'DIRECT_BUSINESS_AMOUNT', 'settlementLocal');

  if (position.foreign.unit !== settlementForeign.unit) {
    throw new Error(
      `Settlement foreign unit mismatch: position=${position.foreign.unit}, settlement=${settlementForeign.unit}.`
    );
  }
  if (position.carrying.unit !== settlementLocal.unit) {
    throw new Error(
      `Settlement local unit mismatch: carrying=${position.carrying.unit}, settlement=${settlementLocal.unit}.`
    );
  }

  const openForeign = new Decimal(position.foreign.value);
  const settlementForeignAmount = new Decimal(settlementForeign.value);
  const carryingBasis = new Decimal(position.carrying.value);
  const settlementLocalAmount = new Decimal(settlementLocal.value);

  if (!openForeign.isFinite() || !settlementForeignAmount.isFinite()) {
    throw new Error('FX settlement foreign amounts must be finite.');
  }
  if (!carryingBasis.isFinite() || !settlementLocalAmount.isFinite()) {
    throw new Error('FX settlement local amounts must be finite.');
  }
  if (openForeign.lte(0) || settlementForeignAmount.lte(0)) {
    throw new Error('FX settlement closure requires positive foreign amounts.');
  }
  if (!openForeign.eq(settlementForeignAmount)) {
    throw new Error(
      'FX settlement closure must consume the exact remaining foreign position.'
    );
  }

  const realizedDelta = settlementLocalAmount.minus(carryingBasis);

  return {
    positionKey: position.positionKey,
    foreignConsumed: settlementForeign,
    carryingBasis: position.carrying,
    settlementLocal,
    realizedDelta: {
      value: realizedDelta.toString(),
      unit: position.carrying.unit,
      role: 'VALUATION_AMOUNT'
    }
  };
}

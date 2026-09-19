import type { EconomicOrderKey } from '../api/contracts.js';

export function compareEconomicOrderKey(left: EconomicOrderKey, right: EconomicOrderKey): number {
  const time = left.effectiveAt.getTime() - right.effectiveAt.getTime();
  if (time !== 0) return time < 0 ? -1 : 1;

  if (left.semanticSequence !== right.semanticSequence) {
    return left.semanticSequence < right.semanticSequence ? -1 : 1;
  }

  return left.stableTieBreaker.localeCompare(right.stableTieBreaker);
}

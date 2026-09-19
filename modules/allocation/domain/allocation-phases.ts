import type { AllocationMode } from '../api/contracts.js';

export type AllocationPhase = 'EXPLICIT' | 'AUTOMATIC';

export function allocationPhases(mode: AllocationMode): readonly AllocationPhase[] {
  switch (mode) {
    case 'EXPLICIT':
      return ['EXPLICIT'];
    case 'AUTOMATIC':
      return ['AUTOMATIC'];
    case 'EXPLICIT_THEN_AUTOMATIC':
      return ['EXPLICIT', 'AUTOMATIC'];
  }
}

import type { JsonObject } from '../../metadata/api/contracts.js';
import type { CostMethod } from './contracts.js';
import type { ValuationInput } from './valuation-input.js';

export interface CostCheckpointLayer {
  readonly sourceBusinessDataId: string;
  readonly remainingQuantity: string;
  readonly unitCost: string;
  readonly effectiveAt: string;
  readonly semanticSequence: string;
  readonly stableTieBreaker: string;
  readonly specificIdentity?: string;
}

export interface MovingAverageCheckpointState {
  readonly quantity: string;
  readonly amount: string;
  readonly contributorBusinessDataIds: readonly string[];
}

export interface CostPoolCheckpointState {
  readonly schemaVersion: 1;
  readonly method: CostMethod;
  readonly poolKey: string;
  readonly poolDimensions: JsonObject;
  readonly quantityUnit: string;
  readonly basisUnit: string;
  readonly layers: readonly CostCheckpointLayer[];
  readonly movingAverage?: MovingAverageCheckpointState;
}

export function projectCostPoolCheckpointStates(
  method: CostMethod,
  inputs: readonly ValuationInput[]
): readonly CostPoolCheckpointState[];

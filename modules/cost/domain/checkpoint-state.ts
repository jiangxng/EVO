import { Decimal } from 'decimal.js';
import type { JsonObject } from '../../metadata/api/contracts.js';
import type {
  CostCheckpointLayer,
  CostPoolCheckpointState
} from '../api/checkpoint-state.js';
import type { CostMethod } from '../api/contracts.js';
import type { ValuationInput } from '../api/valuation-input.js';
import { addToMovingAverage, consumeMovingAverage } from './moving-average.js';

interface MutableLayer {
  readonly sourceBusinessDataId: string;
  quantity: Decimal;
  readonly unitCost: Decimal;
  readonly effectiveAt: Date;
  readonly semanticSequence: bigint;
  readonly stableTieBreaker: string;
  readonly specificIdentity?: string;
}

interface MutablePool {
  readonly poolKey: string;
  readonly poolDimensions: JsonObject;
  readonly quantityUnit: string;
  readonly basisUnit: string;
  readonly layers: MutableLayer[];
  readonly contributors: Set<string>;
  averageQuantity: Decimal;
  averageAmount: Decimal;
}

function compareInputs(left: ValuationInput, right: ValuationInput): number {
  const time = left.order.effectiveAt.getTime() - right.order.effectiveAt.getTime();
  if (time !== 0) return time;
  if (left.order.semanticSequence < right.order.semanticSequence) return -1;
  if (left.order.semanticSequence > right.order.semanticSequence) return 1;
  return left.order.stableTieBreaker.localeCompare(right.order.stableTieBreaker);
}

function layerState(layer: MutableLayer): CostCheckpointLayer {
  return {
    sourceBusinessDataId: layer.sourceBusinessDataId,
    remainingQuantity: layer.quantity.toString(),
    unitCost: layer.unitCost.toString(),
    effectiveAt: layer.effectiveAt.toISOString(),
    semanticSequence: layer.semanticSequence.toString(),
    stableTieBreaker: layer.stableTieBreaker,
    ...(layer.specificIdentity !== undefined
      ? { specificIdentity: layer.specificIdentity }
      : {})
  };
}

function requirePool(
  pools: Map<string,MutablePool>,
  input: ValuationInput
): MutablePool {
  const existing = pools.get(input.poolKey);
  if (existing !== undefined) {
    if (
      existing.quantityUnit !== input.quantity.unit ||
      (input.basis !== undefined && existing.basisUnit !== input.basis.unit)
    ) {
      throw new Error(`Cost pool ${input.poolKey} mixes incompatible units.`);
    }
    return existing;
  }

  const basisUnit = input.basis?.unit;
  if (basisUnit === undefined && input.direction === 'OUTBOUND') {
    throw new Error(
      `Cost pool ${input.poolKey} cannot start with an outbound movement at checkpoint projection.`
    );
  }
  if (basisUnit === undefined) {
    throw new Error(`Inbound cost input ${input.businessDataId} requires basis.`);
  }

  const created: MutablePool = {
    poolKey: input.poolKey,
    poolDimensions: input.poolDimensions,
    quantityUnit: input.quantity.unit,
    basisUnit,
    layers: [],
    contributors: new Set<string>(),
    averageQuantity: new Decimal(0),
    averageAmount: new Decimal(0)
  };
  pools.set(input.poolKey,created);
  return created;
}

export function projectCostPoolCheckpointStates(
  method: CostMethod,
  inputs: readonly ValuationInput[]
): readonly CostPoolCheckpointState[] {
  const pools = new Map<string,MutablePool>();

  for (const input of [...inputs].sort(compareInputs)) {
    const quantity = new Decimal(input.quantity.value);
    if (!quantity.isFinite() || quantity.lte(0)) {
      throw new Error(`Cost input ${input.businessDataId} has invalid quantity.`);
    }

    let pool = pools.get(input.poolKey);

    if (input.direction === 'INBOUND') {
      if (input.basis === undefined) {
        throw new Error(`Inbound cost input ${input.businessDataId} requires basis.`);
      }
      pool = requirePool(pools,input);
      const amount = new Decimal(input.basis.value);
      if (!amount.isFinite()) {
        throw new Error(`Inbound cost input ${input.businessDataId} has invalid basis.`);
      }

      if (method === 'MOVING_AVERAGE') {
        const next = addToMovingAverage(
          { quantity: pool.averageQuantity, amount: pool.averageAmount },
          quantity,
          amount
        );
        pool.averageQuantity = next.quantity;
        pool.averageAmount = next.amount;
        pool.contributors.add(input.businessDataId);
      } else {
        pool.layers.push({
          sourceBusinessDataId: input.businessDataId,
          quantity,
          unitCost: amount.div(quantity),
          effectiveAt: input.order.effectiveAt,
          semanticSequence: input.order.semanticSequence,
          stableTieBreaker: input.order.stableTieBreaker,
          ...(input.specificIdentity !== undefined
            ? { specificIdentity: input.specificIdentity }
            : {})
        });
      }
      continue;
    }

    if (pool === undefined) {
      throw new Error(`Cost pool ${input.poolKey} is empty at outbound ${input.businessDataId}.`);
    }

    if (method === 'MOVING_AVERAGE') {
      const consumed = consumeMovingAverage(
        { quantity: pool.averageQuantity, amount: pool.averageAmount },
        quantity
      );
      pool.averageQuantity = consumed.next.quantity;
      pool.averageAmount = consumed.next.amount;
      if (pool.averageQuantity.isZero()) pool.contributors.clear();
      continue;
    }

    let remaining = quantity;
    const specificIdentity =
      method === 'SPECIFIC_IDENTIFICATION'
        ? input.specificIdentity
        : undefined;

    if (method === 'SPECIFIC_IDENTIFICATION' && !specificIdentity) {
      throw new Error(
        `Specific-identification outbound ${input.businessDataId} requires an identity.`
      );
    }

    const indices = method === 'LIFO'
      ? pool.layers.map((_,index)=>index).reverse()
      : pool.layers.map((_,index)=>index);

    for (const index of indices) {
      if (remaining.lte(0)) break;
      const layer = pool.layers[index]!;
      if (specificIdentity !== undefined && layer.specificIdentity !== specificIdentity) {
        continue;
      }
      if (layer.quantity.lte(0)) continue;
      const take = Decimal.min(layer.quantity,remaining);
      layer.quantity = layer.quantity.minus(take);
      remaining = remaining.minus(take);
    }

    if (remaining.gt(0)) {
      throw new Error(
        `Cost pool ${input.poolKey} would become negative at ${input.businessDataId}.`
      );
    }
  }

  return [...pools.values()]
    .sort((left,right)=>left.poolKey.localeCompare(right.poolKey))
    .map((pool): CostPoolCheckpointState => ({
      schemaVersion: 1,
      method,
      poolKey: pool.poolKey,
      poolDimensions: pool.poolDimensions,
      quantityUnit: pool.quantityUnit,
      basisUnit: pool.basisUnit,
      layers: method === 'MOVING_AVERAGE'
        ? []
        : pool.layers
            .filter((layer)=>layer.quantity.gt(0))
            .map(layerState),
      ...(method === 'MOVING_AVERAGE'
        ? {
            movingAverage: {
              quantity: pool.averageQuantity.toString(),
              amount: pool.averageAmount.toString(),
              contributorBusinessDataIds: [...pool.contributors].sort()
            }
          }
        : {})
    }));
}

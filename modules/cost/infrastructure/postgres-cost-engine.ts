import { Decimal } from 'decimal.js';
import { sql, type Kysely } from 'kysely';
import { AppError } from '../../../platform/contracts/src/index.js';
import type { Database } from '../../../platform/database/src/types.js';
import type { JsonObject, JsonValue } from '../../metadata/api/contracts.js';
import type { ValuationPostingService } from '../../valuation/api/contracts.js';
import { addToMovingAverage, consumeMovingAverage } from '../domain/moving-average.js';
import type {
  CostEngine,
  CostMethod,
  CostRecalculationResult,
  CostReplayPins
} from '../api/contracts.js';

interface Layer {
  businessDataId: string;
  quantity: Decimal;
  unitCost: Decimal;
  specificIdentity?: string;
}

interface PoolState {
  readonly layers: Layer[];
  averageQuantity: Decimal;
  averageAmount: Decimal;
}

interface RuntimeCostConfig {
  readonly inboundBusinessDataTypes: readonly string[];
  readonly outboundBusinessDataTypes: readonly string[];
  readonly quantityField: string;
  readonly basisAmountField: string;
  readonly specificIdentityField?: string;
  readonly poolDimensions: readonly string[];
}

function fail(code: string, message: string, details?: JsonObject): never {
  throw new AppError({
    code,
    message,
    module: 'cost',
    operation: 'recalculate',
    ...(details !== undefined ? { details } : {})
  });
}

function stringArray(value: JsonValue | undefined, label: string): readonly string[] {
  if (!Array.isArray(value) || value.length === 0 || value.some((item) => typeof item !== 'string' || item.length === 0)) {
    fail('COST_POLICY_RUNTIME_CONFIG_INVALID', `${label} must be a non-empty string array.`);
  }
  return value as readonly string[];
}

function requiredString(value: JsonValue | undefined, label: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    fail('COST_POLICY_RUNTIME_CONFIG_INVALID', `${label} must be a non-empty string.`);
  }
  return value;
}

function optionalString(value: JsonValue | undefined): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function policyConfig(config: JsonObject, poolDimensionSchema: JsonObject): RuntimeCostConfig {
  return {
    inboundBusinessDataTypes: stringArray(config.inboundBusinessDataTypes, 'inboundBusinessDataTypes'),
    outboundBusinessDataTypes: stringArray(config.outboundBusinessDataTypes, 'outboundBusinessDataTypes'),
    quantityField: requiredString(config.quantityField, 'quantityField'),
    basisAmountField: requiredString(config.basisAmountField, 'basisAmountField'),
    ...(optionalString(config.specificIdentityField) !== undefined
      ? { specificIdentityField: optionalString(config.specificIdentityField)! }
      : {}),
    poolDimensions: stringArray(poolDimensionSchema.keys, 'pool_dimension_schema.keys')
  };
}

function payloadValue(payload: JsonObject, path: string): JsonValue | undefined {
  const parts = path.split('.');
  let current: JsonValue = payload;
  for (const part of parts) {
    if (current === null || typeof current !== 'object' || Array.isArray(current)) return undefined;
    current = current[part] ?? null;
  }
  return current;
}

function decimalField(payload: JsonObject, path: string, label: string): Decimal {
  const value = payloadValue(payload, path);
  if (value === null || value === undefined || (typeof value !== 'string' && typeof value !== 'number')) {
    fail('COST_INPUT_FIELD_MISSING', `${label} field ${path} must contain a numeric value.`);
  }
  const decimal = new Decimal(String(value));
  if (!decimal.isFinite()) {
    fail('COST_INPUT_FIELD_INVALID', `${label} field ${path} is not finite.`);
  }
  return decimal;
}

function stringField(payload: JsonObject, path: string): string {
  const value = payloadValue(payload, path);
  return value === null || value === undefined ? '' : String(value);
}

function poolKey(payload: JsonObject, dimensions: readonly string[]): string {
  const parts = dimensions.map((dimension) => {
    const value = payloadValue(payload, dimension);
    if (value === null || value === undefined || value === '') {
      fail('COST_POOL_DIMENSION_MISSING', `Cost pool dimension ${dimension} is required.`);
    }
    return `${dimension}=${String(value)}`;
  });
  return parts.join('|');
}

export class PostgresCostEngine implements CostEngine {
  constructor(
    private readonly db: Kysely<Database>,
    private readonly valuation: ValuationPostingService
  ) {}

  async recalculate(
    enterpriseId: string,
    method: CostMethod,
    pins?: CostReplayPins
  ): Promise<CostRecalculationResult> {
    if (pins?.valuationPolicyId === undefined || pins.valuationPolicyVersion === undefined) {
      fail(
        'COST_VALUATION_POLICY_PIN_REQUIRED',
        'Authoritative cost calculation requires an explicit valuation policy id and version.',
        { enterpriseId, method }
      );
    }

    const policy = await this.db.selectFrom('valuation_policy')
      .select(['id','version','config','pool_dimension_schema'])
      .where('id','=',pins.valuationPolicyId)
      .where('version','=',pins.valuationPolicyVersion)
      .where('method','=',method)
      .executeTakeFirst();

    if (policy === undefined) {
      fail(
        'COST_VALUATION_POLICY_PIN_NOT_FOUND',
        `Pinned valuation policy ${pins.valuationPolicyId} v${pins.valuationPolicyVersion} does not exist for method ${method}.`
      );
    }

    const runtime = policyConfig(
      policy.config as JsonObject,
      policy.pool_dimension_schema as JsonObject
    );

    if (method === 'SPECIFIC_IDENTIFICATION' && runtime.specificIdentityField === undefined) {
      fail(
        'COST_POLICY_RUNTIME_CONFIG_INVALID',
        'SPECIFIC_IDENTIFICATION requires specificIdentityField.'
      );
    }

    const run = await this.db
      .insertInto('cost_run')
      .values({
        enterprise_id: enterpriseId,
        method,
        status: 'PROCESSING',
        completed_at: null,
        error: null,
        valuation_policy_id: policy.id,
        valuation_policy_version: policy.version,
        cost_engine_version: '3'
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    try {
      const movementTypes = [...new Set([
        ...runtime.inboundBusinessDataTypes,
        ...runtime.outboundBusinessDataTypes
      ])];

      const movements = await this.db
        .selectFrom('business_data as b')
        .innerJoin('posting_input as p','p.business_data_id','b.id')
        .select([
          'b.id',
          'b.business_data_type',
          'b.payload',
          'b.effective_at',
          'p.posting_sequence'
        ])
        .where('b.enterprise_id', '=', enterpriseId)
        .where('b.business_data_type', 'in', movementTypes)
        .orderBy('b.effective_at')
        .orderBy('p.posting_sequence')
        .orderBy('b.id')
        .execute();

      const pools = new Map<string, PoolState>();
      let resultCount = 0;
      let valuationPostingCount = 0;

      for (const movement of movements) {
        const payload = movement.payload as JsonObject;
        const key = poolKey(payload, runtime.poolDimensions);
        const quantity = decimalField(payload, runtime.quantityField, 'quantity');
        const state = pools.get(key) ?? {
          layers: [],
          averageQuantity: new Decimal(0),
          averageAmount: new Decimal(0)
        };
        pools.set(key, state);

        if (runtime.inboundBusinessDataTypes.includes(movement.business_data_type)) {
          if (quantity.lte(0)) fail('COST_INBOUND_QUANTITY_INVALID', 'Inbound quantity must be positive.');
          const basisAmount = decimalField(payload, runtime.basisAmountField, 'basis amount');

          if (method === 'MOVING_AVERAGE') {
            const next = addToMovingAverage(
              { quantity: state.averageQuantity, amount: state.averageAmount },
              quantity,
              basisAmount
            );
            state.averageQuantity = next.quantity;
            state.averageAmount = next.amount;
          } else {
            const layer: Layer = {
              businessDataId: movement.id,
              quantity,
              unitCost: basisAmount.div(quantity)
            };
            if (runtime.specificIdentityField !== undefined) {
              const identity = stringField(payload, runtime.specificIdentityField);
              if (identity) layer.specificIdentity = identity;
            }
            state.layers.push(layer);
          }
          continue;
        }

        if (!runtime.outboundBusinessDataTypes.includes(movement.business_data_type)) {
          continue;
        }

        if (quantity.lte(0)) fail('COST_OUTBOUND_QUANTITY_INVALID', 'Outbound quantity must be positive.');

        let total = new Decimal(0);

        if (method === 'MOVING_AVERAGE') {
          try {
            const consumed = consumeMovingAverage(
              { quantity: state.averageQuantity, amount: state.averageAmount },
              quantity
            );
            total = consumed.totalCost;
            state.averageQuantity = consumed.next.quantity;
            state.averageAmount = consumed.next.amount;
          } catch (error) {
            fail(
              state.averageQuantity.isZero() ? 'COST_EMPTY_POOL' : 'COST_NEGATIVE_POSITION',
              `Cannot consume moving-average cost pool ${key}: ${error instanceof Error ? error.message : String(error)}`
            );
          }
        } else {
          let remaining = quantity;
          const ordered = method === 'LIFO' ? [...state.layers].reverse() : state.layers;
          const specificIdentity = method === 'SPECIFIC_IDENTIFICATION'
            ? stringField(payload, runtime.specificIdentityField!)
            : '';

          if (method === 'SPECIFIC_IDENTIFICATION' && !specificIdentity) {
            fail('COST_SPECIFIC_IDENTITY_REQUIRED', `Field ${runtime.specificIdentityField} is required.`);
          }

          for (const layer of ordered) {
            if (remaining.lte(0)) break;
            if (specificIdentity && layer.specificIdentity !== specificIdentity) continue;
            const take = Decimal.min(layer.quantity, remaining);
            if (take.lte(0)) continue;
            total = total.plus(take.times(layer.unitCost));
            layer.quantity = layer.quantity.minus(take);
            remaining = remaining.minus(take);
          }

          if (remaining.gt(0)) {
            fail('COST_NEGATIVE_POSITION', `Negative inventory for cost pool ${key}.`);
          }
        }

        const unitCost = total.div(quantity);
        const pinnedRule = pins.valuationRules?.[movement.business_data_type];
        if (pinnedRule === undefined) {
          fail(
            'VALUATION_RULE_PIN_REQUIRED',
            `Authoritative cost calculation requires a pinned valuation rule for ${movement.business_data_type}.`
          );
        }

        const valuationRule = await this.db.selectFrom('valuation_rule')
          .select(['id','version'])
          .where('id','=',pinnedRule.id)
          .where('version','=',pinnedRule.version)
          .where('source_business_data_type','=',movement.business_data_type)
          .executeTakeFirst();

        if (valuationRule === undefined) {
          fail(
            'VALUATION_RULE_PIN_NOT_FOUND',
            `Pinned valuation rule ${pinnedRule.id} v${pinnedRule.version} is invalid for ${movement.business_data_type}.`
          );
        }

        const result = await this.db
          .insertInto('cost_result')
          .values({
            enterprise_id: enterpriseId,
            cost_run_id: run.id,
            business_data_id: movement.id,
            pool_key: key,
            method,
            quantity: quantity.toString(),
            unit_cost: unitCost.toString(),
            total_cost: total.toString(),
            valuation_rule_id: valuationRule.id,
            valuation_rule_version: valuationRule.version
          })
          .returning('id')
          .executeTakeFirstOrThrow();

        resultCount += 1;
        const valuation = await this.valuation.postCostResult(result.id);
        if (valuation.status === 'POSTED') valuationPostingCount += 1;
      }

      await this.db.updateTable('cost_run')
        .set({ status: 'COMPLETED', completed_at: sql`now()` })
        .where('id', '=', run.id).execute();

      return { costRunId: run.id, method, resultCount, valuationPostingCount };
    } catch (error) {
      await this.db.updateTable('cost_run')
        .set({
          status: 'FAILED',
          error: { message: error instanceof Error ? error.message : String(error) },
          completed_at: sql`now()`
        })
        .where('id', '=', run.id).execute();
      throw error;
    }
  }
}

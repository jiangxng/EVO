import { createHash } from 'node:crypto';
import { Decimal } from 'decimal.js';
import { sql, type Kysely } from 'kysely';
import { AppError } from '../../../platform/contracts/src/index.js';
import type { Database } from '../../../platform/database/src/types.js';
import type { AllocationStore } from '../../allocation/api/store.js';
import type { JsonObject } from '../../metadata/api/contracts.js';
import type { MaterializationContext } from '../../materialization/api/context.js';
import type { CalculationDependencyStore } from '../../lineage/api/contracts.js';
import {
  ECONOMIC_RUNTIME_DEPENDENCY_GRAPH_VERSION,
  versionedDependencyNodeId
} from '../../lineage/domain/node-identity.js';
import type { ValuationPostingService } from '../../valuation/api/contracts.js';
import type { ValuationInputReader } from '../api/valuation-input.js';
import type {
  CostEngine,
  CostIncrementalResume,
  CostMethod,
  CostRecalculationResult,
  CostReplayPins
} from '../api/contracts.js';
import { addToMovingAverage, consumeMovingAverage } from '../domain/moving-average.js';
import { valuationInputDefinition } from '../domain/valuation-input-definition.js';

interface Layer {
  businessDataId: string;
  quantity: Decimal;
  unitCost: Decimal;
  specificIdentity?: string;
}

interface PoolState {
  readonly layers: Layer[];
  readonly averageContributors: Set<string>;
  averageQuantity: Decimal;
  averageAmount: Decimal;
}

function restorePools(
  method: CostMethod,
  resume: CostIncrementalResume | undefined
): Map<string, PoolState> {
  const pools = new Map<string,PoolState>();
  if (resume === undefined) return pools;

  for (const snapshot of resume.poolStates) {
    if (snapshot.method !== method) {
      fail(
        'COST_CHECKPOINT_METHOD_MISMATCH',
        `Checkpoint pool ${snapshot.poolKey} uses ${snapshot.method}, expected ${method}.`
      );
    }
    if (pools.has(snapshot.poolKey)) {
      fail(
        'COST_CHECKPOINT_POOL_DUPLICATE',
        `Checkpoint contains duplicate cost pool ${snapshot.poolKey}.`
      );
    }

    if (method === 'MOVING_AVERAGE') {
      if (snapshot.movingAverage === undefined) {
        fail(
          'COST_CHECKPOINT_MOVING_AVERAGE_STATE_REQUIRED',
          `Checkpoint pool ${snapshot.poolKey} is missing moving-average state.`
        );
      }
      const quantity = new Decimal(snapshot.movingAverage.quantity);
      const amount = new Decimal(snapshot.movingAverage.amount);
      if (!quantity.isFinite() || !amount.isFinite() || quantity.lt(0)) {
        fail(
          'COST_CHECKPOINT_STATE_INVALID',
          `Checkpoint moving-average pool ${snapshot.poolKey} is invalid.`
        );
      }
      pools.set(snapshot.poolKey,{
        layers: [],
        averageContributors: new Set(snapshot.movingAverage.contributorBusinessDataIds),
        averageQuantity: quantity,
        averageAmount: amount
      });
      continue;
    }

    const layers: Layer[] = snapshot.layers.map((layer) => {
      const quantity = new Decimal(layer.remainingQuantity);
      const unitCost = new Decimal(layer.unitCost);
      if (!quantity.isFinite() || quantity.lte(0) || !unitCost.isFinite()) {
        fail(
          'COST_CHECKPOINT_STATE_INVALID',
          `Checkpoint layer ${layer.sourceBusinessDataId} in pool ${snapshot.poolKey} is invalid.`
        );
      }
      return {
        businessDataId: layer.sourceBusinessDataId,
        quantity,
        unitCost,
        ...(layer.specificIdentity !== undefined
          ? { specificIdentity: layer.specificIdentity }
          : {})
      };
    });

    pools.set(snapshot.poolKey,{
      layers,
      averageContributors: new Set<string>(),
      averageQuantity: new Decimal(0),
      averageAmount: new Decimal(0)
    });
  }

  return pools;
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

export class PostgresCostEngine implements CostEngine {
  constructor(
    private readonly db: Kysely<Database>,
    private readonly valuation: ValuationPostingService,
    private readonly allocation: AllocationStore,
    private readonly inputs: ValuationInputReader,
    private readonly dependencies: CalculationDependencyStore
  ) {}

  async recalculate(
    enterpriseId: string,
    method: CostMethod,
    pins?: CostReplayPins,
    materialization?: MaterializationContext,
    resume?: CostIncrementalResume
  ): Promise<CostRecalculationResult> {
    if (materialization?.mode === 'CANDIDATE' && resume === undefined) {
      fail(
        'COST_CANDIDATE_PREFIX_STATE_REQUIRED',
        'Candidate cost recalculation requires checkpoint cost-pool prefix state.',
        {
          enterpriseId,
          runtimeDatasetId: materialization.runtimeDatasetId,
          method
        }
      );
    }
    if (resume !== undefined && materialization?.mode !== 'CANDIDATE') {
      fail(
        'COST_INCREMENTAL_CONTEXT_REQUIRED',
        'Checkpoint-resumed cost recalculation requires a CANDIDATE materialization context.'
      );
    }
    if (
      resume !== undefined &&
      resume.targetBoundarySequence <= resume.checkpointBoundarySequence
    ) {
      fail(
        'COST_INCREMENTAL_BOUNDARY_INVALID',
        'Incremental cost target boundary must be strictly after the checkpoint boundary.'
      );
    }

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

    let inputDefinition;
    try {
      inputDefinition = valuationInputDefinition(
        policy.config as JsonObject,
        policy.pool_dimension_schema as JsonObject
      );
    } catch (error) {
      fail(
        'COST_POLICY_RUNTIME_CONFIG_INVALID',
        error instanceof Error ? error.message : String(error)
      );
    }

    if (method === 'SPECIFIC_IDENTIFICATION' && inputDefinition.specificIdentityField === undefined) {
      fail(
        'COST_POLICY_RUNTIME_CONFIG_INVALID',
        'SPECIFIC_IDENTIFICATION requires specificIdentityField.'
      );
    }

    let allocationPolicy:
      | { id: string; version: number; source_ordering: 'OLDEST_FIRST' | 'NEWEST_FIRST' | 'EXPLICIT_ONLY' | 'POLICY_DEFINED' }
      | undefined;

    if (method !== 'MOVING_AVERAGE') {
      if (pins.allocationPolicyId === undefined || pins.allocationPolicyVersion === undefined) {
        fail(
          'COST_ALLOCATION_POLICY_PIN_REQUIRED',
          `Cost method ${method} requires an explicit allocation policy id and version.`
        );
      }

      allocationPolicy = await this.db.selectFrom('allocation_policy')
        .select(['id','version','source_ordering'])
        .where('id','=',pins.allocationPolicyId)
        .where('version','=',pins.allocationPolicyVersion)
        .where('status','=','PUBLISHED')
        .executeTakeFirst();

      if (allocationPolicy === undefined) {
        fail(
          'COST_ALLOCATION_POLICY_PIN_NOT_FOUND',
          `Pinned allocation policy ${pins.allocationPolicyId} v${pins.allocationPolicyVersion} is not published.`
        );
      }

      const expectedOrdering =
        method === 'FIFO'
          ? 'OLDEST_FIRST'
          : method === 'LIFO'
            ? 'NEWEST_FIRST'
            : 'EXPLICIT_ONLY';

      if (allocationPolicy.source_ordering !== expectedOrdering) {
        fail(
          'COST_ALLOCATION_POLICY_MISMATCH',
          `Cost method ${method} requires source ordering ${expectedOrdering}, got ${allocationPolicy.source_ordering}.`
        );
      }
    }

    const run = await this.db
      .insertInto('cost_run')
      .values({
        enterprise_id: enterpriseId,
        economic_runtime_dataset_id: materialization?.runtimeDatasetId ?? null,
        method,
        status: 'PROCESSING',
        completed_at: null,
        error: null,
        valuation_policy_id: policy.id,
        valuation_policy_version: policy.version,
        allocation_policy_id: allocationPolicy?.id ?? null,
        allocation_policy_version: allocationPolicy?.version ?? null,
        cost_engine_version: '5'
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    let allocationRunId: string | undefined;

    try {
      const movements = await this.inputs.list(
        enterpriseId,
        inputDefinition,
        resume === undefined
          ? undefined
          : {
              afterSequence: resume.checkpointBoundarySequence,
              atOrBeforeSequence: resume.targetBoundarySequence
            }
      );

      if (allocationPolicy !== undefined) {
        const inputDigest = createHash('sha256').update(JSON.stringify({
          enterpriseId,
          method,
          valuationPolicy: { id: policy.id, version: policy.version },
          allocationPolicy: { id: allocationPolicy.id, version: allocationPolicy.version },
          resume: resume === undefined ? null : {
            checkpointBoundarySequence: resume.checkpointBoundarySequence.toString(),
            targetBoundarySequence: resume.targetBoundarySequence.toString(),
            poolStates: resume.poolStates
          },
          movements: movements.map((movement) => ({
            id: movement.businessDataId,
            type: movement.businessDataType,
            direction: movement.direction,
            effectiveAt: movement.order.effectiveAt.toISOString(),
            semanticSequence: movement.order.semanticSequence.toString(),
            stableTieBreaker: movement.order.stableTieBreaker,
            poolKey: movement.poolKey,
            quantity: movement.quantity,
            basis: movement.basis ?? null,
            specificIdentity: movement.specificIdentity ?? null
          }))
        })).digest('hex');

        const allocationRun = await this.allocation.startRun({
          enterpriseId,
          allocationPolicyId: allocationPolicy.id,
          allocationPolicyVersion: allocationPolicy.version,
          inputDigest,
          ...(materialization !== undefined ? { materialization } : {})
        });
        allocationRunId = allocationRun.id;
      }

      const pools = restorePools(method,resume);
      let resultCount = 0;
      let valuationPostingCount = 0;

      for (const movement of movements) {
        const key = movement.poolKey;
        const quantity = new Decimal(movement.quantity.value);
        const state = pools.get(key) ?? {
          layers: [],
          averageContributors: new Set<string>(),
          averageQuantity: new Decimal(0),
          averageAmount: new Decimal(0)
        };
        pools.set(key, state);

        if (movement.direction === 'INBOUND') {
          if (quantity.lte(0)) fail('COST_INBOUND_QUANTITY_INVALID', 'Inbound quantity must be positive.');
          if (movement.basis === undefined) {
            fail('COST_BASIS_MISSING', `Inbound valuation input ${movement.businessDataId} requires basis measurement.`);
          }
          const basisAmount = new Decimal(movement.basis.value);

          if (method === 'MOVING_AVERAGE') {
            state.averageContributors.add(movement.businessDataId);
            const next = addToMovingAverage(
              { quantity: state.averageQuantity, amount: state.averageAmount },
              quantity,
              basisAmount
            );
            state.averageQuantity = next.quantity;
            state.averageAmount = next.amount;
          } else {
            const layer: Layer = {
              businessDataId: movement.businessDataId,
              quantity,
              unitCost: basisAmount.div(quantity),
              ...(movement.specificIdentity !== undefined
                ? { specificIdentity: movement.specificIdentity }
                : {})
            };
            state.layers.push(layer);
          }
          continue;
        }

        if (quantity.lte(0)) fail('COST_OUTBOUND_QUANTITY_INVALID', 'Outbound quantity must be positive.');

        let total = new Decimal(0);

        if (method === 'MOVING_AVERAGE') {
          try {
            for (const sourceBusinessDataId of [...state.averageContributors].sort()) {
              await this.dependencies.recordDependency({
                enterpriseId,
                ...(materialization !== undefined
                  ? { runtimeDatasetId: materialization.runtimeDatasetId }
                  : {}),
                graphVersion: ECONOMIC_RUNTIME_DEPENDENCY_GRAPH_VERSION,
                fromKind: 'BUSINESS_FACT',
                fromId: sourceBusinessDataId,
                toKind: 'BUSINESS_FACT',
                toId: movement.businessDataId,
                edgeKind: 'VALUATION',
                effectiveFrom: movement.order.effectiveAt,
                lineage: {
                  semantic: 'MOVING_AVERAGE_BASIS_DEPENDENCY',
                  poolKey: key,
                  costRunId: run.id
                }
              });
            }

            const consumed = consumeMovingAverage(
              { quantity: state.averageQuantity, amount: state.averageAmount },
              quantity
            );
            total = consumed.totalCost;
            state.averageQuantity = consumed.next.quantity;
            state.averageAmount = consumed.next.amount;
            if (state.averageQuantity.isZero()) {
              state.averageContributors.clear();
            }
          } catch (error) {
            fail(
              state.averageQuantity.isZero() ? 'COST_EMPTY_POOL' : 'COST_NEGATIVE_POSITION',
              `Cannot consume moving-average cost pool ${key}: ${error instanceof Error ? error.message : String(error)}`
            );
          }
        } else {
          let remaining = quantity;
          const ordered = method === 'LIFO' ? [...state.layers].reverse() : state.layers;
          let allocationSequence = 0;
          const specificIdentity =
            method === 'SPECIFIC_IDENTIFICATION'
              ? movement.specificIdentity ?? ''
              : '';

          if (method === 'SPECIFIC_IDENTIFICATION' && !specificIdentity) {
            fail(
              'COST_SPECIFIC_IDENTITY_REQUIRED',
              `Valuation input ${movement.businessDataId} requires a specific source identity.`
            );
          }

          for (const layer of ordered) {
            if (remaining.lte(0)) break;
            if (specificIdentity && layer.specificIdentity !== specificIdentity) continue;
            const take = Decimal.min(layer.quantity, remaining);
            if (take.lte(0)) continue;

            const allocatedCost = take.times(layer.unitCost);
            total = total.plus(allocatedCost);

            if (allocationRunId === undefined || allocationPolicy === undefined) {
              fail('COST_ALLOCATION_RUN_MISSING', 'Layer cost method requires an active allocation run.');
            }

            allocationSequence += 1;
            const relation = await this.allocation.recordRelation({
              enterpriseId,
              allocationRunId,
              sourceBusinessDataId: layer.businessDataId,
              consumerBusinessDataId: movement.businessDataId,
              measurements: [{
                value: take.toString(),
                unit: movement.quantity.unit,
                role: 'RESOURCE_QUANTITY'
              }],
              sequence: allocationSequence,
              allocationPolicyId: allocationPolicy.id,
              allocationPolicyVersion: allocationPolicy.version,
              lineage: {
                costRunId: run.id,
                method,
                poolKey: key,
                sourceUnitCost: layer.unitCost.toString(),
                allocatedCost: allocatedCost.toString(),
                ...(specificIdentity ? { specificIdentity } : {})
              }
            });

            await this.dependencies.recordDependency({
              enterpriseId,
              graphVersion: ECONOMIC_RUNTIME_DEPENDENCY_GRAPH_VERSION,
              fromKind: 'BUSINESS_FACT',
              fromId: layer.businessDataId,
              toKind: 'BUSINESS_FACT',
              toId: movement.businessDataId,
              edgeKind: 'VALUATION',
              effectiveFrom: movement.order.effectiveAt,
              lineage: {
                semantic: 'LAYER_COST_SOURCE_DEPENDENCY',
                allocationRelationId: relation.id,
                costRunId: run.id,
                method,
                poolKey: key
              }
            });

            layer.quantity = layer.quantity.minus(take);
            remaining = remaining.minus(take);
          }

          if (remaining.gt(0)) {
            fail('COST_NEGATIVE_POSITION', `Negative inventory for cost pool ${key}.`);
          }
        }

        const unitCost = total.div(quantity);
        await this.dependencies.recordDependency({
          enterpriseId,
          ...(materialization !== undefined
            ? { runtimeDatasetId: materialization.runtimeDatasetId }
            : {}),
          graphVersion: ECONOMIC_RUNTIME_DEPENDENCY_GRAPH_VERSION,
          fromKind: 'POLICY_VERSION',
          fromId: versionedDependencyNodeId(policy.id,policy.version),
          toKind: 'BUSINESS_FACT',
          toId: movement.businessDataId,
          edgeKind: 'VALUATION',
          effectiveFrom: movement.order.effectiveAt,
          lineage: {
            semantic: 'VALUATION_POLICY_DEPENDENCY',
            costRunId: run.id,
            method
          }
        });

        if (allocationPolicy !== undefined) {
          await this.dependencies.recordDependency({
            enterpriseId,
            ...(materialization !== undefined
              ? { runtimeDatasetId: materialization.runtimeDatasetId }
              : {}),
            graphVersion: ECONOMIC_RUNTIME_DEPENDENCY_GRAPH_VERSION,
            fromKind: 'POLICY_VERSION',
            fromId: versionedDependencyNodeId(allocationPolicy.id,allocationPolicy.version),
            toKind: 'BUSINESS_FACT',
            toId: movement.businessDataId,
            edgeKind: 'ALLOCATION',
            effectiveFrom: movement.order.effectiveAt,
            lineage: {
              semantic: 'ALLOCATION_POLICY_DEPENDENCY',
              costRunId: run.id,
              method
            }
          });
        }

        const pinnedRule = pins.valuationRules?.[movement.businessDataType];
        if (pinnedRule === undefined) {
          fail(
            'VALUATION_RULE_PIN_REQUIRED',
            `Authoritative cost calculation requires a pinned valuation rule for ${movement.businessDataType}.`
          );
        }

        const valuationRule = await this.db.selectFrom('valuation_rule')
          .select(['id','version'])
          .where('id','=',pinnedRule.id)
          .where('version','=',pinnedRule.version)
          .where('source_business_data_type','=',movement.businessDataType)
          .executeTakeFirst();

        if (valuationRule === undefined) {
          fail(
            'VALUATION_RULE_PIN_NOT_FOUND',
            `Pinned valuation rule ${pinnedRule.id} v${pinnedRule.version} is invalid for ${movement.businessDataType}.`
          );
        }

        const result = await this.db
          .insertInto('cost_result')
          .values({
            enterprise_id: enterpriseId,
            cost_run_id: run.id,
            business_data_id: movement.businessDataId,
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
        const valuation = await this.valuation.postCostResult(
          result.id,
          materialization
        );
        if (valuation.status === 'POSTED') valuationPostingCount += 1;
      }

      if (allocationRunId !== undefined) {
        await this.allocation.completeRun(allocationRunId);
      }

      await this.db.updateTable('cost_run')
        .set({ status: 'COMPLETED', completed_at: sql`now()` })
        .where('id', '=', run.id).execute();

      return {
        costRunId: run.id,
        ...(materialization !== undefined
          ? { runtimeDatasetId: materialization.runtimeDatasetId }
          : {}),
        method,
        resultCount,
        valuationPostingCount
      };
    } catch (error) {
      if (allocationRunId !== undefined) {
        await this.allocation.failRun(allocationRunId, error);
      }
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

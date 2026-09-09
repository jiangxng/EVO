import Decimal from 'decimal.js';
import { sql, type Kysely } from 'kysely';
import { AppError } from '../../../platform/contracts/src/index.js';
import type { Database } from '../../../platform/database/src/types.js';
import type { JsonObject } from '../../metadata/api/contracts.js';
import type {
  CostEngine,
  CostMethod,
  CostRecalculationResult
} from '../api/contracts.js';

interface Layer {
  businessDataId: string;
  quantity: Decimal;
  unitCost: Decimal;
  lot?: string;
}

export class PostgresCostEngine implements CostEngine {
  constructor(private readonly db: Kysely<Database>) {}

  async recalculate(
    enterpriseId: string,
    method: CostMethod
  ): Promise<CostRecalculationResult> {
    const run = await this.db
      .insertInto('cost_run')
      .values({
        enterprise_id: enterpriseId,
        method,
        status: 'PROCESSING',
        completed_at: null,
        error: null
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    try {
      const movements = await this.db
        .selectFrom('business_data')
        .select(['id','business_data_type','payload','effective_at','created_at'])
        .where('enterprise_id', '=', enterpriseId)
        .where('business_data_type', 'in', ['inventory.received','inventory.shipped'])
        .orderBy('effective_at')
        .orderBy('created_at')
        .execute();

      const pools = new Map<string, Layer[]>();
      let resultCount = 0;

      for (const movement of movements) {
        const payload = movement.payload as JsonObject;
        const productId = String(payload.productId ?? '');
        const warehouse = String(payload.warehouse ?? '');
        const poolKey = `${warehouse}:${productId}`;
        if (!productId || !warehouse) {
          throw new AppError({
            code: 'COST_POOL_DIMENSION_MISSING',
            message: 'Inventory movement requires productId and warehouse.',
            module: 'cost',
            operation: 'recalculate'
          });
        }

        const quantity = new Decimal(String(payload.quantity ?? '0'));
        const layers = pools.get(poolKey) ?? [];
        pools.set(poolKey, layers);

        if (movement.business_data_type === 'inventory.received') {
          const totalCost = new Decimal(String(payload.totalCost ?? '0'));
          if (quantity.lte(0)) throw new Error('Receipt quantity must be positive.');
          layers.push({
            businessDataId: movement.id,
            quantity,
            unitCost: totalCost.div(quantity),
            lot: payload.lot === undefined ? undefined : String(payload.lot)
          });
          continue;
        }

        let remaining = quantity;
        if (remaining.lte(0)) throw new Error('Shipment quantity must be positive.');

        let total = new Decimal(0);

        if (method === 'MOVING_AVERAGE') {
          const totalQty = layers.reduce((a,l) => a.plus(l.quantity), new Decimal(0));
          const totalValue = layers.reduce((a,l) => a.plus(l.quantity.times(l.unitCost)), new Decimal(0));
          if (totalQty.lt(remaining)) throw new Error(`Negative inventory for ${poolKey}.`);
          const avg = totalValue.div(totalQty);
          total = remaining.times(avg);
          let consume = remaining;
          for (const layer of layers) {
            if (consume.lte(0)) break;
            const take = Decimal.min(layer.quantity, consume);
            layer.quantity = layer.quantity.minus(take);
            consume = consume.minus(take);
          }
        } else {
          const ordered =
            method === 'LIFO' ? [...layers].reverse() : layers;
          let specificLot =
            method === 'SPECIFIC_IDENTIFICATION'
              ? String(payload.lot ?? '')
              : '';

          if (method === 'SPECIFIC_IDENTIFICATION' && !specificLot) {
            throw new Error('SPECIFIC_IDENTIFICATION requires payload.lot.');
          }

          for (const layer of ordered) {
            if (remaining.lte(0)) break;
            if (specificLot && layer.lot !== specificLot) continue;
            const take = Decimal.min(layer.quantity, remaining);
            if (take.gt(0)) {
              total = total.plus(take.times(layer.unitCost));
              layer.quantity = layer.quantity.minus(take);
              remaining = remaining.minus(take);
            }
          }
          if (remaining.gt(0)) throw new Error(`Negative inventory for ${poolKey}.`);
        }

        const unitCost = total.div(quantity);

        await this.db
          .insertInto('cost_result')
          .values({
            enterprise_id: enterpriseId,
            cost_run_id: run.id,
            business_data_id: movement.id,
            pool_key: poolKey,
            method,
            quantity: quantity.toString(),
            unit_cost: unitCost.toString(),
            total_cost: total.toString()
          })
          .execute();
        resultCount += 1;
      }

      await this.db.updateTable('cost_run')
        .set({ status: 'COMPLETED', completed_at: sql`now()` })
        .where('id', '=', run.id).execute();

      return { costRunId: run.id, method, resultCount };
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

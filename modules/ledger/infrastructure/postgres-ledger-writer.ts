import { sql } from 'kysely';
import { AppError } from '../../../platform/contracts/src/index.js';
import type { DatabaseTransaction } from '../../../platform/database/src/transaction.js';
import type {
  LedgerEffect,
  LedgerPostingContext
} from '../api/contracts.js';
import type { LedgerWriter } from '../api/ledger-writer.js';
import { dimensionHash } from '../domain/canonical-json.js';
import { validateDimensionPolicy } from '../../dimensions/domain/dimension-policy.js';
import type { LedgerDimensionPolicy } from '../../dimensions/api/contracts.js';
import type { MaterializationContext } from '../../materialization/api/context.js';

export class PostgresLedgerWriter implements LedgerWriter {
  async applyPosting(
    trx: DatabaseTransaction,
    context: LedgerPostingContext,
    effects: readonly LedgerEffect[]
  ): Promise<void> {
    const datasetId = await this.ensureDataset(
      trx,
      context.enterpriseId,
      context.consistencyDomain,
      context.materialization
    );

    for (const effect of effects) {
      const ledger = await trx
        .selectFrom('ledger_definition')
        .select(['id', 'code', 'dimension_schema'])
        .where('code', '=', effect.ledgerCode)
        .executeTakeFirst();

      if (ledger === undefined) {
        throw new AppError({
          code: 'LEDGER_DEFINITION_NOT_FOUND',
          message: 'Posting effect targets an unknown ledger.',
          module: 'ledger',
          operation: 'applyPosting',
          details: {
            ledgerCode: effect.ledgerCode,
            postingRuleCode: effect.postingRuleCode
          }
        });
      }

      const dimensionRows = await trx
        .selectFrom('dimension_definition')
        .select('code')
        .where('status', '=', 'PUBLISHED')
        .where((eb) => eb.or([
          eb('enterprise_id', 'is', null),
          eb('enterprise_id', '=', context.enterpriseId)
        ]))
        .execute();
      validateDimensionPolicy(
        ledger.code,
        ledger.dimension_schema as unknown as LedgerDimensionPolicy,
        effect.dimensions,
        new Set(dimensionRows.map((row) => row.code))
      );

      const hash = dimensionHash(effect.dimensions);

      await trx
        .insertInto('ledger_entry')
        .values({
          enterprise_id: context.enterpriseId,
          consistency_domain: context.consistencyDomain,
          ledger_dataset_id: datasetId,
          ledger_definition_id: ledger.id,
          posting_run_id: context.postingRunId,
          posting_input_id: context.postingInputId,
          business_data_id: context.businessDataId,
          posting_rule_id: effect.postingRuleId,
          posting_rule_schema_version: effect.postingRuleSchemaVersion,
          effect_index: effect.effectIndex,
          entry_source_kind: 'POSTING',
          quantity: effect.quantity,
          amount: effect.amount,
          unit: effect.unit,
          currency: effect.currency,
          dimensions: effect.dimensions,
          dimension_hash: hash,
          effective_at: context.effectiveAt,
          posting_priority: context.postingPriority,
          posting_sequence: context.postingSequence
        })
        .execute();

      const quantity = effect.quantity ?? '0';
      const amount = effect.amount ?? '0';

      await trx
        .insertInto('ledger_balance')
        .values({
          enterprise_id: context.enterpriseId,
          consistency_domain: context.consistencyDomain,
          ledger_dataset_id: datasetId,
          ledger_definition_id: ledger.id,
          dimension_hash: hash,
          dimensions: effect.dimensions,
          quantity,
          amount,
          last_effective_at: context.effectiveAt,
          last_posting_priority: context.postingPriority,
          last_posting_sequence: context.postingSequence
        })
        .onConflict((oc) =>
          oc.columns([
            'ledger_dataset_id',
            'ledger_definition_id',
            'dimension_hash'
          ]).doUpdateSet({
            quantity: sql`ledger_balance.quantity + excluded.quantity`,
            amount: sql`ledger_balance.amount + excluded.amount`,
            last_effective_at: context.effectiveAt,
            last_posting_priority: context.postingPriority,
            last_posting_sequence: context.postingSequence,
            updated_at: sql`now()`
          })
        )
        .execute();
    }
  }

  private async ensureDataset(
    trx: DatabaseTransaction,
    enterpriseId: string,
    consistencyDomain: string,
    materialization?: MaterializationContext
  ): Promise<string> {
    if (materialization?.mode === 'CANDIDATE') {
      const existing = await trx
        .selectFrom('ledger_dataset')
        .select('id')
        .where('enterprise_id', '=', enterpriseId)
        .where('consistency_domain', '=', consistencyDomain)
        .where('economic_runtime_dataset_id', '=', materialization.runtimeDatasetId)
        .where('kind', '=', 'CANDIDATE')
        .where('status', '=', 'BUILDING')
        .executeTakeFirst();

      if (existing !== undefined) return existing.id;

      return (await trx
        .insertInto('ledger_dataset')
        .values({
          enterprise_id: enterpriseId,
          consistency_domain: consistencyDomain,
          economic_runtime_dataset_id: materialization.runtimeDatasetId,
          kind: 'CANDIDATE',
          status: 'BUILDING',
          posting_boundary_sequence: null,
          activated_at: null
        })
        .returning('id')
        .executeTakeFirstOrThrow()).id;
    }

    const existing = await trx
      .selectFrom('ledger_dataset')
      .select('id')
      .where('enterprise_id', '=', enterpriseId)
      .where('consistency_domain', '=', consistencyDomain)
      .where('status', '=', 'ACTIVE')
      .executeTakeFirst();

    if (existing !== undefined) return existing.id;

    const inserted = await trx
      .insertInto('ledger_dataset')
      .values({
        enterprise_id: enterpriseId,
        consistency_domain: consistencyDomain,
        economic_runtime_dataset_id: materialization?.runtimeDatasetId ?? null,
        kind: 'CURRENT',
        status: 'ACTIVE',
        posting_boundary_sequence: null,
        activated_at: sql`now()`
      })
      .returning('id')
      .executeTakeFirst();

    if (inserted !== undefined) return inserted.id;

    const raced = await trx
      .selectFrom('ledger_dataset')
      .select('id')
      .where('enterprise_id', '=', enterpriseId)
      .where('consistency_domain', '=', consistencyDomain)
      .where('status', '=', 'ACTIVE')
      .executeTakeFirstOrThrow();

    return raced.id;
  }
}

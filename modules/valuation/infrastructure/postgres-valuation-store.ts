import { sql, type Kysely } from 'kysely';
import type { Database } from '../../../platform/database/src/types.js';
import type { JsonObject, JsonValue } from '../../metadata/api/contracts.js';
import type {
  RecordValuationResultInput,
  StartValuationRunInput,
  ValuationStore
} from '../api/store.js';

function errorJson(error: unknown): JsonObject {
  if (error instanceof Error) return { name: error.name, message: error.message };
  return { message: String(error) };
}

export class PostgresValuationStore implements ValuationStore {
  constructor(private readonly db: Kysely<Database>) {}

  async startRun(input: StartValuationRunInput): Promise<string> {
    const row = await this.db.insertInto('valuation_run').values({
      enterprise_id: input.enterpriseId,
      request_business_data_id: input.requestBusinessDataId ?? null,
      valuation_kind: input.valuationKind,
      effective_at: input.effectiveAt,
      input_digest: input.inputDigest,
      rate_dataset_id: input.rateDataset?.datasetId ?? null,
      rate_dataset_version: input.rateDataset?.version ?? null,
      rate_dataset_digest: input.rateDataset?.digest ?? null,
      policy: input.policy,
      status: 'PROCESSING',
      completed_at: null,
      error: null
    }).returning('id').executeTakeFirstOrThrow();
    return row.id;
  }

  async recordResult(input: RecordValuationResultInput): Promise<string> {
    const row = await this.db.insertInto('valuation_result').values({
      enterprise_id: input.enterpriseId,
      valuation_run_id: input.valuationRunId,
      result_kind: input.resultKind,
      position_key: input.positionKey,
      source_business_data_ids: sql<JsonValue>`${JSON.stringify(input.sourceBusinessDataIds)}::jsonb`,
      dimensions: input.dimensions,
      source_measurements: sql<JsonValue>`${JSON.stringify(input.sourceMeasurements)}::jsonb`,
      target_measurements: sql<JsonValue>`${JSON.stringify(input.targetMeasurements)}::jsonb`,
      delta_amount: input.delta.value,
      delta_unit: input.delta.unit,
      lineage: input.lineage
    }).returning('id').executeTakeFirstOrThrow();
    return row.id;
  }

  async completeRun(runId: string): Promise<void> {
    await this.db.updateTable('valuation_run')
      .set({ status: 'COMPLETED', completed_at: sql`now()`, error: null })
      .where('id','=',runId)
      .execute();
  }

  async failRun(runId: string, error: unknown): Promise<void> {
    await this.db.updateTable('valuation_run')
      .set({ status: 'FAILED', completed_at: sql`now()`, error: errorJson(error) })
      .where('id','=',runId)
      .execute();
  }
}

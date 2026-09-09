import type { Kysely } from 'kysely';
import type { Database } from '../../../platform/database/src/types.js';
import type { JsonObject } from '../../metadata/api/contracts.js';
import type { BusinessDataReader } from '../api/business-data-reader.js';
import type { BusinessDataRecord } from '../api/contracts.js';

export class PostgresBusinessDataReader implements BusinessDataReader {
  constructor(private readonly db: Kysely<Database>) {}

  async getBusinessData(
    enterpriseId: string,
    businessDataId: string
  ): Promise<BusinessDataRecord | null> {
    const row = await this.db
      .selectFrom('business_data')
      .selectAll()
      .where('enterprise_id', '=', enterpriseId)
      .where('id', '=', businessDataId)
      .executeTakeFirst();

    if (row === undefined) return null;

    return {
      id: row.id,
      enterpriseId: row.enterprise_id,
      applicationInstanceId: row.application_instance_id,
      commandExecutionId: row.command_execution_id,
      businessDataType: row.business_data_type,
      businessObjectKey: row.business_object_key,
      businessObjectVersion: BigInt(row.business_object_version),
      effectiveAt: new Date(row.effective_at),
      metadataVersion: row.metadata_version,
      payload: row.payload as JsonObject
    };
  }
}

import type { Kysely } from 'kysely';
import type { Database } from '../../../platform/database/src/types.js';
import type { JsonObject } from '../../metadata/api/contracts.js';
import {
  VALUATION_REQUEST_BUSINESS_DATA_TYPE,
  type ValuationRequestInterpreter,
  type ValuationRequestReplayResult,
  type ValuationRequestReplayService
} from '../api/request.js';
import { parseValuationRequestPayload } from '../domain/valuation-request.js';

function asDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date;
  }
  throw new Error('Valuation request replay encountered an invalid effective timestamp.');
}

export class PostgresValuationRequestReplayService
implements ValuationRequestReplayService {
  constructor(
    private readonly db: Kysely<Database>,
    private readonly interpreter: ValuationRequestInterpreter
  ) {}

  async replayAcceptedRequests(
    enterpriseId: string,
    consistencyDomain: string,
    boundarySequence: bigint
  ): Promise<ValuationRequestReplayResult> {
    const rows = await this.db.selectFrom('posting_input as p')
      .innerJoin('business_data as b','b.id','p.business_data_id')
      .select([
        'p.posting_sequence',
        'b.id',
        'b.enterprise_id',
        'b.business_data_type',
        'b.payload',
        'b.effective_at'
      ])
      .where('p.enterprise_id','=',enterpriseId)
      .where('p.consistency_domain','=',consistencyDomain)
      .where('p.posting_sequence','<=',boundarySequence)
      .where('b.business_data_type','=',VALUATION_REQUEST_BUSINESS_DATA_TYPE)
      .orderBy('p.posting_sequence')
      .orderBy('b.id')
      .execute();

    for (const row of rows) {
      await this.interpreter.replayAcceptedRequest({
        businessDataId: row.id,
        enterpriseId: row.enterprise_id,
        effectiveAt: asDate(row.effective_at),
        payload: parseValuationRequestPayload(
          row.business_data_type,
          row.payload as JsonObject
        )
      });
    }

    return { replayedRequestCount: rows.length };
  }
}

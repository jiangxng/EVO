import type { Kysely } from 'kysely';
import type { Database } from '../../../platform/database/src/types.js';
import type {
  MaterializationContext,
  MaterializationContextResolver
} from '../api/context.js';
import type { EconomicRuntimeDatasetService } from '../api/runtime-dataset.js';

export class PostgresMaterializationContextResolver
implements MaterializationContextResolver {
  constructor(
    private readonly db: Kysely<Database>,
    private readonly datasets: EconomicRuntimeDatasetService
  ) {}

  async current(
    enterpriseId: string,
    consistencyDomain: string
  ): Promise<MaterializationContext> {
    const dataset = await this.datasets.getActive(
      enterpriseId,
      consistencyDomain
    );

    if (dataset.kind !== 'CURRENT' || dataset.status !== 'ACTIVE') {
      throw new Error(
        'Current materialization context requires a CURRENT/ACTIVE runtime dataset.'
      );
    }

    return {
      runtimeDatasetId: dataset.id,
      mode: 'CURRENT'
    };
  }

  async candidate(
    runtimeDatasetId: string,
    enterpriseId: string,
    consistencyDomain: string
  ): Promise<MaterializationContext> {
    const row = await this.db.selectFrom('economic_runtime_dataset')
      .select(['id','enterprise_id','consistency_domain','kind','status'])
      .where('id','=',runtimeDatasetId)
      .executeTakeFirstOrThrow();

    if (
      row.enterprise_id !== enterpriseId ||
      row.consistency_domain !== consistencyDomain ||
      row.kind !== 'CANDIDATE' ||
      row.status !== 'BUILDING'
    ) {
      throw new Error(
        'Candidate materialization context requires a BUILDING candidate in the exact enterprise/consistency scope.'
      );
    }

    return {
      runtimeDatasetId: row.id,
      mode: 'CANDIDATE'
    };
  }
}

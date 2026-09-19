import type { Kysely } from 'kysely';
import type { Database } from '../../../platform/database/src/types.js';
import type {
  BuildCostCheckpointStateRequest,
  CostCheckpointStateBuilder
} from '../api/checkpoint-builder.js';
import type { CostCheckpointStateProjector } from '../api/checkpoint-state.js';
import type { ValuationInputReader } from '../api/valuation-input.js';
import { valuationInputDefinition } from '../domain/valuation-input-definition.js';

export class PostgresCostCheckpointStateBuilder
implements CostCheckpointStateBuilder {
  constructor(
    private readonly db: Kysely<Database>,
    private readonly inputs: ValuationInputReader,
    private readonly projector: CostCheckpointStateProjector
  ) {}

  async build(request: BuildCostCheckpointStateRequest) {
    const policy = await this.db.selectFrom('valuation_policy')
      .select(['id','version','config','pool_dimension_schema'])
      .where('id','=',request.valuationPolicyId)
      .where('version','=',request.valuationPolicyVersion)
      .where('method','=',request.method)
      .executeTakeFirst();

    if (policy === undefined) {
      throw new Error(
        `Pinned valuation policy ${request.valuationPolicyId} v${request.valuationPolicyVersion} is not valid for ${request.method}.`
      );
    }

    const definition = valuationInputDefinition(
      policy.config as never,
      policy.pool_dimension_schema as never
    );

    const movements = await this.inputs.list(
      request.enterpriseId,
      definition,
      { atOrBeforeSequence: request.boundarySequence }
    );

    return this.projector.project(request.method,movements);
  }
}

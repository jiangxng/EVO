import type { Kysely } from 'kysely';
import type { Database } from '../../../platform/database/src/types.js';
import type { FlowProjection } from '../api/contracts.js';

interface StoredLineage {
  flowDefinitionId: string;
  flowInstanceKey: string;
  stepCode: string;
  parentBusinessDataId?: string;
  relationType?: 'CAUSES' | 'FULFILLS' | 'ALLOCATES_TO' | 'REFERENCES';
}

export class PostgresFlowProjection implements FlowProjection {
  constructor(private readonly db: Kysely<Database>) {}

  async projectCommand(commandExecutionId: string): Promise<void> {
    const execution = await this.db.selectFrom('command_execution')
      .select(['id','enterprise_id','correlation_id','causation_id','lineage','result'])
      .where('id','=',commandExecutionId)
      .executeTakeFirstOrThrow();

    if (execution.lineage === null || execution.result === null) return;
    const lineage = execution.lineage as unknown as StoredLineage;
    const result = execution.result as unknown as { businessDataId?: string };
    if (!lineage.flowDefinitionId || !lineage.flowInstanceKey || !lineage.stepCode || !result.businessDataId) return;

    const flowInstance = await this.db.insertInto('flow_instance').values({
      enterprise_id: execution.enterprise_id,
      flow_definition_id: lineage.flowDefinitionId,
      instance_key: lineage.flowInstanceKey,
      status: 'ACTIVE',
      completed_at: null
    }).onConflict((oc) => oc.columns(['enterprise_id','flow_definition_id','instance_key'])
      .doUpdateSet({ status: 'ACTIVE' }))
      .returning('id').executeTakeFirstOrThrow();

    await this.db.insertInto('flow_trace').values({
      enterprise_id: execution.enterprise_id,
      flow_definition_id: lineage.flowDefinitionId,
      flow_instance_id: flowInstance.id,
      command_execution_id: execution.id,
      business_data_id: result.businessDataId,
      step_code: lineage.stepCode,
      correlation_id: execution.correlation_id,
      causation_id: execution.causation_id
    }).onConflict((oc) => oc.columns(['flow_instance_id','business_data_id','step_code']).doNothing()).execute();

    if (lineage.parentBusinessDataId !== undefined) {
      await this.db.insertInto('business_object_link').values({
        enterprise_id: execution.enterprise_id,
        from_business_data_id: lineage.parentBusinessDataId,
        to_business_data_id: result.businessDataId,
        relation_type: lineage.relationType ?? 'CAUSES',
        metadata: { flowInstanceKey: lineage.flowInstanceKey, stepCode: lineage.stepCode }
      }).onConflict((oc) => oc.columns([
        'enterprise_id','from_business_data_id','to_business_data_id','relation_type'
      ]).doNothing()).execute();
    }
  }
}

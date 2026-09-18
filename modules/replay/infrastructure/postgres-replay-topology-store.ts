import { sql, type Kysely } from 'kysely';
import type { Database } from '../../../platform/database/src/types.js';
import type { JsonObject } from '../../metadata/api/contracts.js';
import type {
  CalculationDependencyEdge,
  ReplayCheckpointDescriptor
} from '../api/contracts.js';
import type { ReplayTopologyStore } from '../api/topology-store.js';

function asBigInt(value: unknown): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isInteger(value)) return BigInt(value);
  if (typeof value === 'string' && /^\d+$/.test(value)) return BigInt(value);
  throw new Error('Database returned an invalid replay sequence.');
}

function edgeFromRow(row: {
  id:string; enterprise_id:string; graph_version:string; from_kind:string; from_id:string;
  to_kind:string; to_id:string; edge_kind:CalculationDependencyEdge['edgeKind'];
  effective_from: unknown; lineage: JsonObject;
}): CalculationDependencyEdge {
  return {
    id: row.id,
    enterpriseId: row.enterprise_id,
    graphVersion: row.graph_version,
    fromKind: row.from_kind,
    fromId: row.from_id,
    toKind: row.to_kind,
    toId: row.to_id,
    edgeKind: row.edge_kind,
    ...(row.effective_from instanceof Date ? { effectiveFrom: row.effective_from } : {}),
    lineage: row.lineage
  };
}

function checkpointFromRow(row: {
  id:string; enterprise_id:string; consistency_domain:string; boundary_sequence:unknown;
  ordered_input_digest:string; last_included_business_data_id:string|null; template_version:string;
  posting_policy_pins:JsonObject; allocation_policy_pins:JsonObject; valuation_policy_pins:JsonObject;
  reference_dataset_pins:JsonObject; runtime_semantic_version:string; dependency_graph_version:string;
  materialization_digest:string; validity:JsonObject; source_replay_run_id:string|null; parent_checkpoint_id:string|null;
}): ReplayCheckpointDescriptor {
  return {
    id: row.id,
    enterpriseId: row.enterprise_id,
    consistencyDomain: row.consistency_domain,
    boundarySequence: asBigInt(row.boundary_sequence),
    orderedInputDigest: row.ordered_input_digest,
    ...(row.last_included_business_data_id !== null
      ? { lastIncludedFactId: row.last_included_business_data_id }
      : {}),
    templateVersion: row.template_version,
    postingPolicyPins: row.posting_policy_pins,
    allocationPolicyPins: row.allocation_policy_pins,
    valuationPolicyPins: row.valuation_policy_pins,
    referenceDatasetPins: row.reference_dataset_pins,
    runtimeSemanticVersion: row.runtime_semantic_version,
    dependencyGraphVersion: row.dependency_graph_version,
    materializationDigest: row.materialization_digest,
    validity: row.validity,
    ...(row.source_replay_run_id !== null ? { sourceReplayRunId: row.source_replay_run_id } : {}),
    ...(row.parent_checkpoint_id !== null
      ? { parentCheckpointId: row.parent_checkpoint_id }
      : {})
  };
}

export class PostgresReplayTopologyStore implements ReplayTopologyStore {
  constructor(private readonly db: Kysely<Database>) {}

  async recordDependency(
    edge: Omit<CalculationDependencyEdge, 'id'>
  ): Promise<CalculationDependencyEdge> {
    const inserted = await this.db.insertInto('calculation_dependency_edge').values({
      enterprise_id: edge.enterpriseId,
      graph_version: edge.graphVersion,
      from_kind: edge.fromKind,
      from_id: edge.fromId,
      to_kind: edge.toKind,
      to_id: edge.toId,
      edge_kind: edge.edgeKind,
      effective_from: edge.effectiveFrom ?? null,
      lineage: edge.lineage
    }).onConflict((oc) => oc.columns([
      'enterprise_id','graph_version','from_kind','from_id','to_kind','to_id','edge_kind'
    ]).doNothing())
      .returningAll()
      .executeTakeFirst();

    const row = inserted ?? await this.db.selectFrom('calculation_dependency_edge')
      .selectAll()
      .where('enterprise_id','=',edge.enterpriseId)
      .where('graph_version','=',edge.graphVersion)
      .where('from_kind','=',edge.fromKind)
      .where('from_id','=',edge.fromId)
      .where('to_kind','=',edge.toKind)
      .where('to_id','=',edge.toId)
      .where('edge_kind','=',edge.edgeKind)
      .executeTakeFirstOrThrow();

    return edgeFromRow({
      ...row,
      lineage: row.lineage as JsonObject
    });
  }

  async listDependents(
    enterpriseId: string,
    graphVersion: string,
    fromKind: string,
    fromId: string
  ): Promise<readonly CalculationDependencyEdge[]> {
    const rows = await this.db.selectFrom('calculation_dependency_edge')
      .selectAll()
      .where('enterprise_id','=',enterpriseId)
      .where('graph_version','=',graphVersion)
      .where('from_kind','=',fromKind)
      .where('from_id','=',fromId)
      .orderBy('to_kind')
      .orderBy('to_id')
      .execute();

    return rows.map((row) => edgeFromRow({
      ...row,
      lineage: row.lineage as JsonObject
    }));
  }

  async saveCheckpoint(checkpoint: ReplayCheckpointDescriptor): Promise<void> {
    await this.db.insertInto('replay_checkpoint').values({
      id: checkpoint.id,
      enterprise_id: checkpoint.enterpriseId,
      consistency_domain: checkpoint.consistencyDomain,
      boundary_sequence: checkpoint.boundarySequence,
      ordered_input_digest: checkpoint.orderedInputDigest,
      last_included_business_data_id: checkpoint.lastIncludedFactId ?? null,
      template_version: checkpoint.templateVersion,
      posting_policy_pins: checkpoint.postingPolicyPins,
      allocation_policy_pins: checkpoint.allocationPolicyPins,
      valuation_policy_pins: checkpoint.valuationPolicyPins,
      reference_dataset_pins: checkpoint.referenceDatasetPins,
      runtime_semantic_version: checkpoint.runtimeSemanticVersion,
      dependency_graph_version: checkpoint.dependencyGraphVersion,
      materialization_digest: checkpoint.materializationDigest,
      validity: checkpoint.validity,
      status: 'ACTIVE',
      source_replay_run_id: checkpoint.sourceReplayRunId ?? null,
      parent_checkpoint_id: checkpoint.parentCheckpointId ?? null,
      invalidated_at: null,
      invalidation_reason: null
    }).onConflict((oc) => oc.column('id').doNothing()).execute();
  }

  async getCheckpointBySourceReplayRun(
    replayRunId: string
  ): Promise<ReplayCheckpointDescriptor | null> {
    const row = await this.db.selectFrom('replay_checkpoint')
      .selectAll()
      .where('source_replay_run_id','=',replayRunId)
      .executeTakeFirst();

    return row === undefined ? null : checkpointFromRow({
      ...row,
      posting_policy_pins: row.posting_policy_pins as JsonObject,
      allocation_policy_pins: row.allocation_policy_pins as JsonObject,
      valuation_policy_pins: row.valuation_policy_pins as JsonObject,
      reference_dataset_pins: row.reference_dataset_pins as JsonObject,
      validity: row.validity as JsonObject
    });
  }

  async getLatestValidCheckpoint(
    enterpriseId: string,
    consistencyDomain: string,
    atOrBeforeSequence: bigint
  ): Promise<ReplayCheckpointDescriptor | null> {
    const row = await this.db.selectFrom('replay_checkpoint')
      .selectAll()
      .where('enterprise_id','=',enterpriseId)
      .where('consistency_domain','=',consistencyDomain)
      .where('status','=','ACTIVE')
      .where('boundary_sequence','<=',atOrBeforeSequence)
      .orderBy('boundary_sequence','desc')
      .orderBy('created_at','desc')
      .executeTakeFirst();

    return row === undefined ? null : checkpointFromRow({
      ...row,
      posting_policy_pins: row.posting_policy_pins as JsonObject,
      allocation_policy_pins: row.allocation_policy_pins as JsonObject,
      valuation_policy_pins: row.valuation_policy_pins as JsonObject,
      reference_dataset_pins: row.reference_dataset_pins as JsonObject,
      validity: row.validity as JsonObject
    });
  }

  async invalidateCheckpoint(checkpointId: string, reason: string): Promise<void> {
    await this.db.updateTable('replay_checkpoint').set({
      status: 'INVALIDATED',
      invalidated_at: sql`now()`,
      invalidation_reason: reason
    }).where('id','=',checkpointId).execute();
  }
}

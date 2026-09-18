import { randomUUID } from 'node:crypto';
import type { Kysely } from 'kysely';
import type { Database } from '../../../platform/database/src/types.js';
import { ECONOMIC_RUNTIME_SEMANTIC_VERSION } from '../../economic/domain/runtime-version.js';
import {
  ECONOMIC_RUNTIME_DEPENDENCY_GRAPH_VERSION,
  versionedDependencyNodeId
} from '../../lineage/domain/node-identity.js';
import type { JsonObject } from '../../metadata/api/contracts.js';
import type {
  ReplayCheckpointDescriptor
} from '../api/contracts.js';
import type { ReplayCheckpointService } from '../api/checkpoint-service.js';
import type { ReplayTopologyStore } from '../api/topology-store.js';
import { computeReplayInputDigest } from './postgres-replay-digest.js';

function asBigInt(value: unknown): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isInteger(value)) return BigInt(value);
  if (typeof value === 'string' && /^-?\d+$/.test(value)) return BigInt(value);
  throw new Error('Replay checkpoint source contains an invalid sequence.');
}

export class PostgresReplayCheckpointService implements ReplayCheckpointService {
  constructor(
    private readonly db: Kysely<Database>,
    private readonly topology: ReplayTopologyStore
  ) {}

  async createFromVerifiedFullReplay(
    replayRunId: string,
    enterpriseId: string
  ): Promise<ReplayCheckpointDescriptor> {
    const existing = await this.topology.getCheckpointBySourceReplayRun(replayRunId);
    if (existing !== null) {
      if (existing.enterpriseId !== enterpriseId) {
        throw new Error('Replay checkpoint source run belongs to a different enterprise.');
      }
      return existing;
    }

    const run = await this.db.selectFrom('replay_run')
      .selectAll()
      .where('id','=',replayRunId)
      .where('enterprise_id','=',enterpriseId)
      .executeTakeFirstOrThrow();

    if (
      run.mode !== 'FULL' ||
      run.status !== 'COMPLETED' ||
      run.validation_status !== 'MATCH' ||
      run.after_digest === null ||
      run.boundary_sequence === null
    ) {
      throw new Error(
        'Replay checkpoint requires a completed FULL replay with validation_status=MATCH.'
      );
    }

    const boundarySequence = asBigInt(run.boundary_sequence);

    const inputDigest = await computeReplayInputDigest(
      this.db,
      enterpriseId,
      run.consistency_domain,
      boundarySequence
    );

    const orderedInputDigest = inputDigest.digest;
    const lastIncludedFactId = inputDigest.lastIncludedFactId;

    const template = await this.db.selectFrom('enterprise_template_binding as b')
      .innerJoin('enterprise_template as t','t.id','b.enterprise_template_id')
      .innerJoin('enterprise_template_version as v','v.id','b.enterprise_template_version_id')
      .select([
        't.code as template_code',
        'v.version as template_version',
        'v.semantic_digest as semantic_digest'
      ])
      .where('b.enterprise_id','=',enterpriseId)
      .executeTakeFirst();

    const blockers = new Set<string>([
      'DEPENDENCY_GRAPH_COVERAGE_NOT_CERTIFIED',
      'FULL_REPLAY_DERIVED_RUNTIME_COVERAGE_NOT_CERTIFIED',
      'REFERENCE_DATASET_PIN_COVERAGE_NOT_CERTIFIED'
    ]);

    const templateVersion = template === undefined
      ? 'UNBOUND'
      : `${template.template_code}@v${template.template_version}:${template.semantic_digest}`;

    if (template === undefined) {
      blockers.add('ENTERPRISE_TEMPLATE_BINDING_MISSING');
    }

    const postingRows = await this.db.selectFrom('ledger_entry')
      .select(['posting_rule_id','posting_rule_schema_version'])
      .where('enterprise_id','=',enterpriseId)
      .where('consistency_domain','=',run.consistency_domain)
      .where('posting_sequence','<=',boundarySequence)
      .where('posting_rule_id','is not',null)
      .execute();

    const postingRules = [...new Map(
      postingRows
        .filter((row): row is typeof row & { posting_rule_id: string } =>
          row.posting_rule_id !== null
        )
        .map((row) => [
          `${row.posting_rule_id}@v${row.posting_rule_schema_version}`,
          {
            id: row.posting_rule_id,
            schemaVersion: row.posting_rule_schema_version
          }
        ])
    ).values()].sort((a,b) =>
      a.id.localeCompare(b.id) || a.schemaVersion - b.schemaVersion
    );

    const postingMetadataVersions = [...new Set(
      orderedRows.map((row) => row.posting_metadata_version)
    )].sort((a,b) => a-b);

    const postingPolicyPins: JsonObject = {
      rules: postingRules,
      metadataVersions: postingMetadataVersions
    };

    const allocationPolicyPins: JsonObject =
      run.allocation_policy_id !== null && run.allocation_policy_version !== null
        ? {
            primary: {
              id: run.allocation_policy_id,
              version: run.allocation_policy_version,
              nodeId: versionedDependencyNodeId(
                run.allocation_policy_id,
                run.allocation_policy_version
              )
            }
          }
        : {};

    if (
      run.cost_method !== null &&
      (run.allocation_policy_id === null || run.allocation_policy_version === null)
    ) {
      blockers.add('ALLOCATION_POLICY_PIN_MISSING_FOR_COST_REPLAY');
    }

    const valuationPolicyPins: JsonObject = {
      costMethod: run.cost_method,
      valuationPolicy:
        run.valuation_policy_id !== null && run.valuation_policy_version !== null
          ? {
              id: run.valuation_policy_id,
              version: run.valuation_policy_version,
              nodeId: versionedDependencyNodeId(
                run.valuation_policy_id,
                run.valuation_policy_version
              )
            }
          : null,
      valuationRules: run.valuation_rule_pins as JsonObject
    };

    if (
      run.cost_method !== null &&
      (run.valuation_policy_id === null || run.valuation_policy_version === null)
    ) {
      blockers.add('VALUATION_POLICY_PIN_MISSING_FOR_COST_REPLAY');
    }

    const rateRows = await this.db.selectFrom('valuation_run')
      .select([
        'rate_dataset_id',
        'rate_dataset_version',
        'rate_dataset_digest'
      ])
      .where('enterprise_id','=',enterpriseId)
      .where('status','=','COMPLETED')
      .where('rate_dataset_id','is not',null)
      .where('rate_dataset_version','is not',null)
      .where('rate_dataset_digest','is not',null)
      .execute();

    const referenceDatasets = [...new Map(
      rateRows
        .filter((row) =>
          row.rate_dataset_id !== null &&
          row.rate_dataset_version !== null &&
          row.rate_dataset_digest !== null
        )
        .map((row) => [
          `${row.rate_dataset_id}@v${row.rate_dataset_version}`,
          {
            datasetId: row.rate_dataset_id!,
            version: row.rate_dataset_version!,
            digest: row.rate_dataset_digest!
          }
        ])
    ).values()].sort((a,b) =>
      a.datasetId.localeCompare(b.datasetId) || a.version - b.version
    );

    const referenceDatasetPins: JsonObject = {
      datasets: referenceDatasets
    };

    const parent = boundarySequence > 0n
      ? await this.topology.getLatestValidCheckpoint(
          enterpriseId,
          run.consistency_domain,
          boundarySequence - 1n
        )
      : null;

    const sortedBlockers = [...blockers].sort();
    const validity: JsonObject = {
      safeForIncremental: false,
      blockers: sortedBlockers,
      sourceReplayRunId: replayRunId,
      replayValidationStatus: 'MATCH',
      orderedInputCount: inputDigest.count,
      materializationDigestScope: [
        'ledger_entry',
        'ledger_balance',
        'cost_result',
        'allocation_relation',
        'valuation_position',
        'valuation_result',
        'work_item'
      ],
      checkpointPolicyVersion: 1
    };

    const checkpoint: ReplayCheckpointDescriptor = {
      id: randomUUID(),
      enterpriseId,
      consistencyDomain: run.consistency_domain,
      boundarySequence,
      orderedInputDigest,
      ...(lastIncludedFactId !== undefined ? { lastIncludedFactId } : {}),
      templateVersion,
      postingPolicyPins,
      allocationPolicyPins,
      valuationPolicyPins,
      referenceDatasetPins,
      runtimeSemanticVersion: ECONOMIC_RUNTIME_SEMANTIC_VERSION,
      dependencyGraphVersion: ECONOMIC_RUNTIME_DEPENDENCY_GRAPH_VERSION,
      materializationDigest: run.after_digest,
      validity,
      sourceReplayRunId: replayRunId,
      ...(parent !== null ? { parentCheckpointId: parent.id } : {})
    };

    await this.topology.saveCheckpoint(checkpoint);
    return checkpoint;
  }
}

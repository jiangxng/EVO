import { createHash, randomUUID } from 'node:crypto';
import type { Kysely } from 'kysely';
import type { Database } from '../../../platform/database/src/types.js';
import { ECONOMIC_RUNTIME_SEMANTIC_VERSION } from '../../economic/domain/runtime-version.js';
import {
  ECONOMIC_RUNTIME_DEPENDENCY_GRAPH_VERSION,
  versionedDependencyNodeId
} from '../../lineage/domain/node-identity.js';
import type { JsonObject, JsonValue } from '../../metadata/api/contracts.js';
import type {
  ReplayCheckpointDescriptor
} from '../api/contracts.js';
import type { ReplayCheckpointService } from '../api/checkpoint-service.js';
import type { ReplayTopologyStore } from '../api/topology-store.js';

function canonical(value: JsonValue): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const object = value as JsonObject;
  return `{${Object.keys(object).sort().map((key) =>
    `${JSON.stringify(key)}:${canonical(object[key] ?? null)}`
  ).join(',')}}`;
}

function digest(value: JsonValue): string {
  return createHash('sha256').update(canonical(value)).digest('hex');
}

function asBigInt(value: unknown): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isInteger(value)) return BigInt(value);
  if (typeof value === 'string' && /^-?\d+$/.test(value)) return BigInt(value);
  throw new Error('Replay checkpoint source contains an invalid sequence.');
}

function iso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  throw new Error('Replay checkpoint source contains an invalid timestamp.');
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

    const orderedRows = await this.db.selectFrom('posting_input as p')
      .innerJoin('business_data as b','b.id','p.business_data_id')
      .select([
        'p.posting_sequence',
        'p.posting_priority',
        'p.metadata_version as posting_metadata_version',
        'p.application_instance_id',
        'p.effective_at as posting_effective_at',
        'b.id as business_data_id',
        'b.business_data_type',
        'b.business_object_key',
        'b.business_object_version',
        'b.metadata_version as business_metadata_version',
        'b.payload',
        'b.effective_at as business_effective_at'
      ])
      .where('p.enterprise_id','=',enterpriseId)
      .where('p.consistency_domain','=',run.consistency_domain)
      .where('p.posting_sequence','<=',boundarySequence)
      .orderBy('p.posting_sequence')
      .orderBy('b.id')
      .execute();

    const orderedInput: JsonValue = orderedRows.map((row) => ({
      postingSequence: asBigInt(row.posting_sequence).toString(),
      postingPriority: row.posting_priority,
      postingMetadataVersion: row.posting_metadata_version,
      applicationInstanceId: row.application_instance_id,
      postingEffectiveAt: iso(row.posting_effective_at),
      businessDataId: row.business_data_id,
      businessDataType: row.business_data_type,
      businessObjectKey: row.business_object_key,
      businessObjectVersion: asBigInt(row.business_object_version).toString(),
      businessMetadataVersion: row.business_metadata_version,
      businessEffectiveAt: iso(row.business_effective_at),
      payload: row.payload as JsonObject
    }));

    const orderedInputDigest = digest(orderedInput);
    const lastIncludedFactId = orderedRows.at(-1)?.business_data_id;

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
      'MATERIALIZATION_DIGEST_LEDGER_ONLY',
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
      orderedInputCount: orderedRows.length,
      materializationDigestScope: ['ledger_balance'],
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

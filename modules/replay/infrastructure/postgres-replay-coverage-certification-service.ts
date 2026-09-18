import { createHash } from 'node:crypto';
import { sql, type Kysely } from 'kysely';
import type { Database } from '../../../platform/database/src/types.js';
import type { JsonObject, JsonValue } from '../../metadata/api/contracts.js';
import type { DependencyGraphRebuilder } from '../../lineage/api/rebuilder.js';
import type {
  ReplayCoverageCertification,
  ReplayCoverageCertificationService
} from '../api/coverage-certification.js';

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

function datasetPins(value: JsonObject): Map<string,string> {
  const result = new Map<string,string>();
  const rows = value.datasets;
  if (!Array.isArray(rows)) return result;
  for (const row of rows) {
    if (row === null || typeof row !== 'object' || Array.isArray(row)) continue;
    const object = row as JsonObject;
    const id = typeof object.datasetId === 'string' ? object.datasetId : null;
    const version = typeof object.version === 'number' ? object.version : null;
    const rowDigest = typeof object.digest === 'string' ? object.digest : null;
    if (id !== null && version !== null && rowDigest !== null) {
      result.set(`${id}@v${version}`, rowDigest);
    }
  }
  return result;
}

function stringArray(value: JsonValue | undefined): readonly string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

export class PostgresReplayCoverageCertificationService
implements ReplayCoverageCertificationService {
  constructor(
    private readonly db: Kysely<Database>,
    private readonly dependencyGraph: DependencyGraphRebuilder
  ) {}

  async evaluate(
    checkpointId: string,
    certifiedBy: string
  ): Promise<ReplayCoverageCertification> {
    const checkpoint = await this.db.selectFrom('replay_checkpoint')
      .selectAll()
      .where('id','=',checkpointId)
      .where('status','=','ACTIVE')
      .executeTakeFirstOrThrow();

    if (checkpoint.source_replay_run_id === null) {
      throw new Error('Coverage certification requires a checkpoint sourced from a Full Replay run.');
    }

    const replay = await this.db.selectFrom('replay_run')
      .selectAll()
      .where('id','=',checkpoint.source_replay_run_id)
      .where('enterprise_id','=',checkpoint.enterprise_id)
      .executeTakeFirstOrThrow();

    const validity = checkpoint.validity as JsonObject;
    const digestScope = new Set(stringArray(validity.materializationDigestScope as JsonValue | undefined));
    const requiredDigestFamilies = [
      'ledger_entry',
      'ledger_balance',
      'cost_result',
      'allocation_relation',
      'valuation_position',
      'valuation_result',
      'work_item'
    ] as const;

    const materializationDigestComplete =
      replay.mode === 'FULL' &&
      replay.status === 'COMPLETED' &&
      replay.validation_status === 'MATCH' &&
      replay.after_digest !== null &&
      replay.after_digest === checkpoint.materialization_digest &&
      requiredDigestFamilies.every((family) => digestScope.has(family));

    const binding = await this.db.selectFrom('enterprise_template_binding as b')
      .innerJoin('enterprise_template as t','t.id','b.enterprise_template_id')
      .innerJoin('enterprise_template_version as v','v.id','b.enterprise_template_version_id')
      .select([
        't.code as template_code',
        'v.version as template_version',
        'v.semantic_digest as semantic_digest'
      ])
      .where('b.enterprise_id','=',checkpoint.enterprise_id)
      .executeTakeFirst();

    const expectedTemplate = binding === undefined
      ? null
      : `${binding.template_code}@v${binding.template_version}:${binding.semantic_digest}`;

    const templateBindingComplete =
      expectedTemplate !== null &&
      checkpoint.template_version === expectedTemplate;

    const valuationRateRows = await this.db.selectFrom('valuation_run')
      .select([
        'rate_dataset_id',
        'rate_dataset_version',
        'rate_dataset_digest'
      ])
      .where('enterprise_id','=',checkpoint.enterprise_id)
      .where('status','=','COMPLETED')
      .where('rate_dataset_id','is not',null)
      .where('rate_dataset_version','is not',null)
      .where('rate_dataset_digest','is not',null)
      .execute();

    const expectedRatePins = new Map<string,string>();
    for (const row of valuationRateRows) {
      if (
        row.rate_dataset_id !== null &&
        row.rate_dataset_version !== null &&
        row.rate_dataset_digest !== null
      ) {
        expectedRatePins.set(
          `${row.rate_dataset_id}@v${row.rate_dataset_version}`,
          row.rate_dataset_digest
        );
      }
    }

    const actualRatePins = datasetPins(checkpoint.reference_dataset_pins as JsonObject);
    const referenceDatasetPinsComplete =
      expectedRatePins.size === actualRatePins.size &&
      [...expectedRatePins].every(([key,value]) => actualRatePins.get(key) === value);

    const dependencyGraphEvidence = await this.dependencyGraph.rebuildEnterprise(
      checkpoint.enterprise_id
    );
    const dependencyGraphComplete =
      dependencyGraphEvidence.graphVersion === checkpoint.dependency_graph_version &&
      dependencyGraphEvidence.missingFamilies.length === 0;

    // Conservative by design. A successful Full Replay plus complete dependency index
    // still does not prove that every derived runtime family was rebuilt by the replay
    // orchestrator. This remains false until ER-C05B3.2 certifies replay-family execution.
    const derivedRuntimeReplayComplete = false;

    const blockers = [
      ...(dependencyGraphComplete ? [] : ['DEPENDENCY_GRAPH_COVERAGE_NOT_CERTIFIED']),
      ...(materializationDigestComplete ? [] : ['MATERIALIZATION_DIGEST_COVERAGE_NOT_CERTIFIED']),
      ...(derivedRuntimeReplayComplete ? [] : ['FULL_REPLAY_DERIVED_RUNTIME_COVERAGE_NOT_CERTIFIED']),
      ...(referenceDatasetPinsComplete ? [] : ['REFERENCE_DATASET_PIN_COVERAGE_NOT_CERTIFIED']),
      ...(templateBindingComplete ? [] : ['ENTERPRISE_TEMPLATE_BINDING_NOT_CERTIFIED'])
    ].sort();

    const evidence: JsonObject = {
      checkpointId,
      sourceReplayRunId: checkpoint.source_replay_run_id,
      replay: {
        mode: replay.mode,
        status: replay.status,
        validationStatus: replay.validation_status,
        afterDigestMatchesCheckpoint:
          replay.after_digest !== null &&
          replay.after_digest === checkpoint.materialization_digest
      },
      materializationDigest: {
        requiredFamilies: [...requiredDigestFamilies],
        checkpointFamilies: [...digestScope].sort()
      },
      template: {
        checkpointTemplateVersion: checkpoint.template_version,
        expectedTemplateVersion: expectedTemplate
      },
      referenceDatasets: {
        expected: [...expectedRatePins.entries()]
          .sort(([a],[b]) => a.localeCompare(b))
          .map(([nodeId,rowDigest]) => ({ nodeId, digest: rowDigest })),
        checkpoint: [...actualRatePins.entries()]
          .sort(([a],[b]) => a.localeCompare(b))
          .map(([nodeId,rowDigest]) => ({ nodeId, digest: rowDigest }))
      },
      dependencyGraph: {
        graphVersion: dependencyGraphEvidence.graphVersion,
        familyCounts: dependencyGraphEvidence.familyCounts,
        missingFamilies: dependencyGraphEvidence.missingFamilies,
        totalEdgesObserved: dependencyGraphEvidence.totalEdgesObserved
      },
      blockers
    };

    const semanticDigest = digest({
      enterpriseId: checkpoint.enterprise_id,
      consistencyDomain: checkpoint.consistency_domain,
      runtimeSemanticVersion: checkpoint.runtime_semantic_version,
      dependencyGraphVersion: checkpoint.dependency_graph_version,
      dependencyGraphComplete,
      materializationDigestComplete,
      derivedRuntimeReplayComplete,
      referenceDatasetPinsComplete,
      templateBindingComplete,
      evidence
    });

    const latest = await this.db.selectFrom('replay_coverage_certification')
      .select(['id','certification_version','semantic_digest','status'])
      .where('enterprise_id','=',checkpoint.enterprise_id)
      .where('consistency_domain','=',checkpoint.consistency_domain)
      .where('runtime_semantic_version','=',checkpoint.runtime_semantic_version)
      .where('dependency_graph_version','=',checkpoint.dependency_graph_version)
      .orderBy('certification_version','desc')
      .executeTakeFirst();

    if (latest !== undefined && latest.semantic_digest === semanticDigest) {
      const row = await this.db.selectFrom('replay_coverage_certification')
        .selectAll()
        .where('id','=',latest.id)
        .executeTakeFirstOrThrow();
      return {
        id: row.id,
        enterpriseId: row.enterprise_id,
        consistencyDomain: row.consistency_domain,
        runtimeSemanticVersion: row.runtime_semantic_version,
        dependencyGraphVersion: row.dependency_graph_version,
        certificationVersion: row.certification_version,
        status: row.status,
        dependencyGraphComplete: row.dependency_graph_complete,
        materializationDigestComplete: row.materialization_digest_complete,
        derivedRuntimeReplayComplete: row.derived_runtime_replay_complete,
        referenceDatasetPinsComplete: row.reference_dataset_pins_complete,
        templateBindingComplete: row.template_binding_complete,
        evidence: row.evidence as JsonObject,
        semanticDigest: row.semantic_digest,
        blockers
      };
    }

    const allComplete =
      dependencyGraphComplete &&
      materializationDigestComplete &&
      derivedRuntimeReplayComplete &&
      referenceDatasetPinsComplete &&
      templateBindingComplete;

    const version = (latest?.certification_version ?? 0) + 1;
    const row = await this.db.insertInto('replay_coverage_certification')
      .values({
        enterprise_id: checkpoint.enterprise_id,
        consistency_domain: checkpoint.consistency_domain,
        runtime_semantic_version: checkpoint.runtime_semantic_version,
        dependency_graph_version: checkpoint.dependency_graph_version,
        certification_version: version,
        status: allComplete ? 'CERTIFIED' : 'DRAFT',
        dependency_graph_complete: dependencyGraphComplete,
        materialization_digest_complete: materializationDigestComplete,
        derived_runtime_replay_complete: derivedRuntimeReplayComplete,
        reference_dataset_pins_complete: referenceDatasetPinsComplete,
        template_binding_complete: templateBindingComplete,
        evidence,
        semantic_digest: semanticDigest,
        certified_by: allComplete ? certifiedBy : null,
        certified_at: allComplete ? sql`now()` : null,
        revoked_at: null,
        revoke_reason: null
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return {
      id: row.id,
      enterpriseId: row.enterprise_id,
      consistencyDomain: row.consistency_domain,
      runtimeSemanticVersion: row.runtime_semantic_version,
      dependencyGraphVersion: row.dependency_graph_version,
      certificationVersion: row.certification_version,
      status: row.status,
      dependencyGraphComplete: row.dependency_graph_complete,
      materializationDigestComplete: row.materialization_digest_complete,
      derivedRuntimeReplayComplete: row.derived_runtime_replay_complete,
      referenceDatasetPinsComplete: row.reference_dataset_pins_complete,
      templateBindingComplete: row.template_binding_complete,
      evidence: row.evidence as JsonObject,
      semanticDigest: row.semantic_digest,
      blockers
    };
  }
}

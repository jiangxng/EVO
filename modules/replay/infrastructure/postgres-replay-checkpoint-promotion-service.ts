import { createHash } from 'node:crypto';
import { sql, type Kysely } from 'kysely';
import type { Database } from '../../../platform/database/src/types.js';
import { ECONOMIC_RUNTIME_SEMANTIC_VERSION } from '../../economic/domain/runtime-version.js';
import {
  ECONOMIC_RUNTIME_DEPENDENCY_GRAPH_VERSION
} from '../../lineage/domain/node-identity.js';
import type { JsonObject, JsonValue } from '../../metadata/api/contracts.js';
import type {
  PromoteReplayCheckpointRequest,
  ReplayCheckpointPromotion,
  ReplayCheckpointPromotionService
} from '../api/checkpoint-promotion.js';
import { computeReplayInputDigest } from './postgres-replay-digest.js';

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
  throw new Error('Replay checkpoint promotion encountered an invalid sequence.');
}

function asDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date;
  }
  throw new Error('Replay checkpoint promotion encountered an invalid timestamp.');
}

function mapPromotion(row: {
  id:string;
  enterprise_id:string;
  checkpoint_id:string;
  certification_id:string;
  certification_version:number;
  certification_semantic_digest:string;
  status:'ACTIVE'|'REVOKED';
  promoted_by:string;
  reason:string;
  evidence:JsonObject;
  promotion_digest:string;
  promoted_at:unknown;
  revoked_at:unknown|null;
  revoked_by:string|null;
  revoke_reason:string|null;
}): ReplayCheckpointPromotion {
  return {
    id: row.id,
    enterpriseId: row.enterprise_id,
    checkpointId: row.checkpoint_id,
    certificationId: row.certification_id,
    certificationVersion: row.certification_version,
    certificationSemanticDigest: row.certification_semantic_digest,
    status: row.status,
    promotedBy: row.promoted_by,
    reason: row.reason,
    evidence: row.evidence,
    promotionDigest: row.promotion_digest,
    promotedAt: asDate(row.promoted_at),
    ...(row.revoked_at !== null ? { revokedAt: asDate(row.revoked_at) } : {}),
    ...(row.revoked_by !== null ? { revokedBy: row.revoked_by } : {}),
    ...(row.revoke_reason !== null ? { revokeReason: row.revoke_reason } : {})
  };
}

export class PostgresReplayCheckpointPromotionService
implements ReplayCheckpointPromotionService {
  constructor(private readonly db: Kysely<Database>) {}

  async promote(
    request: PromoteReplayCheckpointRequest
  ): Promise<ReplayCheckpointPromotion> {
    if (request.promotedBy.trim().length === 0) {
      throw new Error('Replay checkpoint promotion requires promotedBy.');
    }
    if (request.reason.trim().length === 0) {
      throw new Error('Replay checkpoint promotion requires a reason.');
    }

    const checkpoint = await this.db.selectFrom('replay_checkpoint')
      .selectAll()
      .where('id','=',request.checkpointId)
      .where('status','=','ACTIVE')
      .executeTakeFirstOrThrow();

    const certification = await this.db.selectFrom('replay_coverage_certification')
      .selectAll()
      .where('id','=',request.certificationId)
      .executeTakeFirstOrThrow();

    if (
      certification.status !== 'CERTIFIED' ||
      !certification.dependency_graph_complete ||
      !certification.materialization_digest_complete ||
      !certification.derived_runtime_replay_complete ||
      !certification.reference_dataset_pins_complete ||
      !certification.template_binding_complete
    ) {
      throw new Error(
        'Replay checkpoint promotion requires a fully CERTIFIED coverage certification.'
      );
    }

    if (
      certification.enterprise_id !== checkpoint.enterprise_id ||
      certification.consistency_domain !== checkpoint.consistency_domain ||
      certification.runtime_semantic_version !== checkpoint.runtime_semantic_version ||
      certification.dependency_graph_version !== checkpoint.dependency_graph_version
    ) {
      throw new Error(
        'Replay coverage certification does not match the checkpoint semantic scope.'
      );
    }

    const certificationEvidence = certification.evidence as JsonObject;
    if (certificationEvidence.checkpointId !== checkpoint.id) {
      throw new Error(
        'Replay coverage certification evidence does not identify this checkpoint.'
      );
    }

    if (
      checkpoint.runtime_semantic_version !== ECONOMIC_RUNTIME_SEMANTIC_VERSION ||
      checkpoint.dependency_graph_version !== ECONOMIC_RUNTIME_DEPENDENCY_GRAPH_VERSION
    ) {
      throw new Error(
        'Checkpoint runtime/dependency semantics no longer match the active runtime.'
      );
    }

    const boundarySequence = asBigInt(checkpoint.boundary_sequence);
    const currentInput = await computeReplayInputDigest(
      this.db,
      checkpoint.enterprise_id,
      checkpoint.consistency_domain,
      boundarySequence
    );

    if (currentInput.digest !== checkpoint.ordered_input_digest) {
      throw new Error(
        'Checkpoint canonical input digest drifted after certification; Full Replay is required.'
      );
    }

    const template = await this.db.selectFrom('enterprise_template_binding as b')
      .innerJoin('enterprise_template as t','t.id','b.enterprise_template_id')
      .innerJoin('enterprise_template_version as v','v.id','b.enterprise_template_version_id')
      .select([
        't.code as template_code',
        'v.version as template_version',
        'v.semantic_digest as semantic_digest'
      ])
      .where('b.enterprise_id','=',checkpoint.enterprise_id)
      .executeTakeFirst();

    const currentTemplate = template === undefined
      ? 'UNBOUND'
      : `${template.template_code}@v${template.template_version}:${template.semantic_digest}`;

    if (currentTemplate !== checkpoint.template_version) {
      throw new Error(
        'Enterprise Template binding drifted after checkpoint certification; Full Replay is required.'
      );
    }

    const existing = await this.db.selectFrom('replay_checkpoint_promotion')
      .selectAll()
      .where('checkpoint_id','=',checkpoint.id)
      .where('status','=','ACTIVE')
      .executeTakeFirst();

    if (existing !== undefined) {
      if (
        existing.certification_id !== certification.id ||
        existing.certification_semantic_digest !== certification.semantic_digest
      ) {
        throw new Error(
          'Checkpoint already has an active promotion based on different certification evidence.'
        );
      }
      return mapPromotion({
        ...existing,
        evidence: existing.evidence as JsonObject
      });
    }

    const evidence: JsonObject = {
      checkpointId: checkpoint.id,
      sourceReplayRunId: checkpoint.source_replay_run_id,
      checkpointBoundarySequence: boundarySequence.toString(),
      orderedInputDigest: checkpoint.ordered_input_digest,
      currentOrderedInputDigest: currentInput.digest,
      templateVersion: checkpoint.template_version,
      currentTemplateVersion: currentTemplate,
      runtimeSemanticVersion: checkpoint.runtime_semantic_version,
      dependencyGraphVersion: checkpoint.dependency_graph_version,
      materializationDigest: checkpoint.materialization_digest,
      certificationId: certification.id,
      certificationVersion: certification.certification_version,
      certificationSemanticDigest: certification.semantic_digest,
      certificationStatus: certification.status
    };

    const promotionDigest = digest({
      enterpriseId: checkpoint.enterprise_id,
      checkpointId: checkpoint.id,
      certificationId: certification.id,
      certificationVersion: certification.certification_version,
      certificationSemanticDigest: certification.semantic_digest,
      promotedBy: request.promotedBy,
      reason: request.reason,
      evidence
    });

    const row = await this.db.insertInto('replay_checkpoint_promotion')
      .values({
        enterprise_id: checkpoint.enterprise_id,
        checkpoint_id: checkpoint.id,
        certification_id: certification.id,
        certification_version: certification.certification_version,
        certification_semantic_digest: certification.semantic_digest,
        status: 'ACTIVE',
        promoted_by: request.promotedBy,
        reason: request.reason,
        evidence,
        promotion_digest: promotionDigest,
        revoked_at: null,
        revoked_by: null,
        revoke_reason: null
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return mapPromotion({
      ...row,
      evidence: row.evidence as JsonObject
    });
  }

  async revoke(
    promotionId: string,
    revokedBy: string,
    reason: string
  ): Promise<void> {
    if (revokedBy.trim().length === 0 || reason.trim().length === 0) {
      throw new Error('Replay checkpoint promotion revocation requires actor and reason.');
    }

    const row = await this.db.selectFrom('replay_checkpoint_promotion')
      .select(['id','status'])
      .where('id','=',promotionId)
      .executeTakeFirstOrThrow();

    if (row.status === 'REVOKED') return;

    await this.db.updateTable('replay_checkpoint_promotion')
      .set({
        status: 'REVOKED',
        revoked_at: sql`now()`,
        revoked_by: revokedBy,
        revoke_reason: reason
      })
      .where('id','=',promotionId)
      .where('status','=','ACTIVE')
      .executeTakeFirstOrThrow();
  }
}

import { createHash } from 'node:crypto';
import { sql, type Kysely } from 'kysely';
import type { Database } from '../../../platform/database/src/types.js';
import type { JsonObject, JsonValue } from '../../metadata/api/contracts.js';
import type {
  CandidateRuntimeDigestPort,
  CertifyAndActivateRuntimeCandidateRequest,
  CertifyAndActivateRuntimeCandidateResult,
  OracleRuntimeDigestPort,
  RuntimeEquivalenceBlocker,
  RuntimeEquivalenceCertification,
  RuntimeEquivalenceCertificationService
} from '../api/runtime-equivalence-certification.js';
import type { EconomicRuntimeDataset } from '../api/runtime-dataset.js';
import { evaluateRuntimeEquivalence } from '../domain/runtime-equivalence.js';

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
  throw new Error('Runtime equivalence certification contains an invalid sequence.');
}

function asDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date;
  }
  throw new Error('Runtime equivalence certification contains an invalid timestamp.');
}

function mapDataset(row: {
  id:string; enterprise_id:string; consistency_domain:string;
  kind:'CURRENT'|'CANDIDATE'|'ORACLE'|'ARCHIVED';
  status:'BUILDING'|'ACTIVE'|'VERIFIED'|'FAILED'|'ARCHIVED';
  parent_dataset_id:string|null; source_checkpoint_id:string|null;
  source_promotion_id:string|null; oracle_of_dataset_id:string|null;
  incremental_plan_digest:string|null; start_sequence:unknown|null;
  boundary_sequence:unknown|null; semantic_digest:string|null;
  created_at:unknown; verified_at:unknown|null; activated_at:unknown|null;
}): EconomicRuntimeDataset {
  return {
    id: row.id,
    enterpriseId: row.enterprise_id,
    consistencyDomain: row.consistency_domain,
    kind: row.kind,
    status: row.status,
    ...(row.parent_dataset_id !== null ? { parentDatasetId: row.parent_dataset_id } : {}),
    ...(row.source_checkpoint_id !== null ? { sourceCheckpointId: row.source_checkpoint_id } : {}),
    ...(row.source_promotion_id !== null ? { sourcePromotionId: row.source_promotion_id } : {}),
    ...(row.oracle_of_dataset_id !== null ? { oracleOfDatasetId: row.oracle_of_dataset_id } : {}),
    ...(row.incremental_plan_digest !== null ? { incrementalPlanDigest: row.incremental_plan_digest } : {}),
    ...(row.start_sequence !== null ? { startSequence: asBigInt(row.start_sequence) } : {}),
    ...(row.boundary_sequence !== null ? { boundarySequence: asBigInt(row.boundary_sequence) } : {}),
    ...(row.semantic_digest !== null ? { semanticDigest: row.semantic_digest } : {}),
    createdAt: asDate(row.created_at),
    ...(row.verified_at !== null ? { verifiedAt: asDate(row.verified_at) } : {}),
    ...(row.activated_at !== null ? { activatedAt: asDate(row.activated_at) } : {})
  };
}

function mapCertification(row: {
  id:string; enterprise_id:string; consistency_domain:string;
  candidate_dataset_id:string; oracle_dataset_id:string; parent_dataset_id:string;
  source_checkpoint_id:string; source_promotion_id:string;
  incremental_plan_digest:string; boundary_sequence:unknown;
  candidate_semantic_digest:string; oracle_semantic_digest:string;
  status:'CERTIFIED'|'REJECTED'; blockers:readonly unknown[]; evidence:Record<string,unknown>;
  certification_digest:string; certified_by:string; reason:string;
  certified_at:unknown; activated_at:unknown|null;
}): RuntimeEquivalenceCertification {
  return {
    id: row.id,
    enterpriseId: row.enterprise_id,
    consistencyDomain: row.consistency_domain,
    candidateDatasetId: row.candidate_dataset_id,
    oracleDatasetId: row.oracle_dataset_id,
    parentDatasetId: row.parent_dataset_id,
    sourceCheckpointId: row.source_checkpoint_id,
    sourcePromotionId: row.source_promotion_id,
    incrementalPlanDigest: row.incremental_plan_digest,
    boundarySequence: asBigInt(row.boundary_sequence),
    candidateSemanticDigest: row.candidate_semantic_digest,
    oracleSemanticDigest: row.oracle_semantic_digest,
    status: row.status,
    blockers: row.blockers as RuntimeEquivalenceBlocker[],
    evidence: row.evidence as JsonObject,
    certificationDigest: row.certification_digest,
    certifiedBy: row.certified_by,
    reason: row.reason,
    certifiedAt: asDate(row.certified_at),
    ...(row.activated_at !== null ? { activatedAt: asDate(row.activated_at) } : {})
  };
}

export class PostgresRuntimeEquivalenceCertificationService
implements RuntimeEquivalenceCertificationService {
  constructor(
    private readonly db: Kysely<Database>,
    private readonly candidateDigests: CandidateRuntimeDigestPort,
    private readonly oracleDigests: OracleRuntimeDigestPort
  ) {}

  async certifyAndActivate(
    request: CertifyAndActivateRuntimeCandidateRequest
  ): Promise<CertifyAndActivateRuntimeCandidateResult> {
    if (request.certifiedBy.trim().length === 0) {
      throw new Error('Runtime equivalence certification requires certifiedBy.');
    }
    if (request.reason.trim().length === 0) {
      throw new Error('Runtime equivalence certification requires a reason.');
    }

    const existing = await this.db.selectFrom('runtime_equivalence_certification')
      .selectAll()
      .where('candidate_dataset_id','=',request.candidateDatasetId)
      .where('oracle_dataset_id','=',request.oracleDatasetId)
      .executeTakeFirst();
    if (existing !== undefined) {
      const certification = mapCertification(existing);
      const activated = certification.status === 'CERTIFIED'
        ? await this.db.selectFrom('economic_runtime_dataset')
            .selectAll()
            .where('id','=',request.candidateDatasetId)
            .executeTakeFirstOrThrow()
        : undefined;
      return {
        certification,
        ...(activated !== undefined ? { activatedDataset: mapDataset(activated) } : {})
      };
    }

    const candidateScope = await this.db.selectFrom('economic_runtime_dataset')
      .select(['enterprise_id','consistency_domain','source_checkpoint_id','boundary_sequence'])
      .where('id','=',request.candidateDatasetId)
      .where('kind','=','CANDIDATE')
      .where('status','=','BUILDING')
      .executeTakeFirstOrThrow();
    if (candidateScope.source_checkpoint_id === null || candidateScope.boundary_sequence === null) {
      throw new Error('Candidate is missing checkpoint or boundary scope.');
    }

    const [candidateDigest,oracleDigest] = await Promise.all([
      this.candidateDigests.compute({
        checkpointId: candidateScope.source_checkpoint_id,
        candidateRuntimeDatasetId: request.candidateDatasetId,
        targetBoundarySequence: asBigInt(candidateScope.boundary_sequence)
      }),
      this.oracleDigests.compute(request.oracleDatasetId)
    ]);

    return this.db.transaction().execute(async (trx) => {
      // EVO-INVARIANT: Worker normal posting and Candidate activation share this
      // enterprise runtime row as the first cutover lock.
      const runtime = await trx.selectFrom('enterprise_runtime_state')
        .selectAll()
        .where('enterprise_id','=',candidateScope.enterprise_id)
        .where('consistency_domain','=',candidateScope.consistency_domain)
        .forUpdate()
        .executeTakeFirstOrThrow();

      const candidate = await trx.selectFrom('economic_runtime_dataset')
        .selectAll()
        .where('id','=',request.candidateDatasetId)
        .forUpdate()
        .executeTakeFirstOrThrow();
      const oracle = await trx.selectFrom('economic_runtime_dataset')
        .selectAll()
        .where('id','=',request.oracleDatasetId)
        .forUpdate()
        .executeTakeFirstOrThrow();

      if (
        candidate.parent_dataset_id === null ||
        candidate.source_checkpoint_id === null ||
        candidate.source_promotion_id === null ||
        candidate.incremental_plan_digest === null ||
        candidate.start_sequence === null ||
        candidate.boundary_sequence === null
      ) {
        throw new Error('Candidate is missing governed incremental replay scope.');
      }

      const active = await trx.selectFrom('economic_runtime_dataset')
        .selectAll()
        .where('enterprise_id','=',candidate.enterprise_id)
        .where('consistency_domain','=',candidate.consistency_domain)
        .where('status','=','ACTIVE')
        .forUpdate()
        .executeTakeFirstOrThrow();
      const checkpoint = await trx.selectFrom('replay_checkpoint')
        .select(['id','status'])
        .where('id','=',candidate.source_checkpoint_id)
        .executeTakeFirstOrThrow();
      const promotion = await trx.selectFrom('replay_checkpoint_promotion')
        .select(['id','checkpoint_id','status'])
        .where('id','=',candidate.source_promotion_id)
        .executeTakeFirstOrThrow();

      const runtimePostingSequence = runtime.last_posted_sequence === null
        ? 0n
        : asBigInt(runtime.last_posted_sequence);
      const candidateBoundary = asBigInt(candidate.boundary_sequence);
      const postingCursorWithinCandidate = runtimePostingSequence <= candidateBoundary;

      const semanticScopeMatches = !(
        oracle.enterprise_id !== candidate.enterprise_id ||
        oracle.consistency_domain !== candidate.consistency_domain ||
        oracle.parent_dataset_id !== candidate.parent_dataset_id ||
        oracle.source_checkpoint_id !== candidate.source_checkpoint_id ||
        oracle.source_promotion_id !== candidate.source_promotion_id ||
        oracle.incremental_plan_digest !== candidate.incremental_plan_digest ||
        oracle.boundary_sequence === null ||
        asBigInt(oracle.boundary_sequence) !== asBigInt(candidate.boundary_sequence)
      );
      const blockers = [...evaluateRuntimeEquivalence({
        candidateBuilding: candidate.kind === 'CANDIDATE' && candidate.status === 'BUILDING',
        oracleVerified: oracle.kind === 'ORACLE' && oracle.status === 'VERIFIED',
        oracleBoundToCandidate: oracle.oracle_of_dataset_id === candidate.id,
        semanticScopeMatches,
        activeParentMatches: active.id === candidate.parent_dataset_id,
        checkpointActive: checkpoint.status === 'ACTIVE',
        promotionActive:
          promotion.status === 'ACTIVE' && promotion.checkpoint_id === checkpoint.id,
        postingCursorWithinCandidate,
        oracleStoredDigest: oracle.semantic_digest,
        oracleComputedDigest: oracleDigest.digest,
        candidateComputedDigest: candidateDigest.digest
      })];

      const status = blockers.length === 0 ? 'CERTIFIED' : 'REJECTED';
      const semantic: JsonObject = {
        schemaVersion: 1,
        enterpriseId: candidate.enterprise_id,
        consistencyDomain: candidate.consistency_domain,
        candidateDatasetId: candidate.id,
        oracleDatasetId: oracle.id,
        parentDatasetId: candidate.parent_dataset_id,
        sourceCheckpointId: candidate.source_checkpoint_id,
        sourcePromotionId: candidate.source_promotion_id,
        incrementalPlanDigest: candidate.incremental_plan_digest,
        boundarySequence: asBigInt(candidate.boundary_sequence).toString(),
        candidateSemanticDigest: candidateDigest.digest,
        oracleSemanticDigest: oracleDigest.digest,
        status,
        blockers,
        certifiedBy: request.certifiedBy,
        reason: request.reason
      };
      const evidence: JsonObject = {
        candidateFamilyCounts: {
          ledgerEntries: candidateDigest.familyCounts.ledgerEntries,
          ledgerBalances: candidateDigest.familyCounts.ledgerBalances,
          costResults: candidateDigest.familyCounts.costResults,
          allocationRelations: candidateDigest.familyCounts.allocationRelations,
          valuationPositions: candidateDigest.familyCounts.valuationPositions,
          valuationResults: candidateDigest.familyCounts.valuationResults,
          workItems: candidateDigest.familyCounts.workItems
        },
        oracleFamilyCounts: {
          ledgerEntries: oracleDigest.familyCounts.ledgerEntries,
          ledgerBalances: oracleDigest.familyCounts.ledgerBalances,
          costResults: oracleDigest.familyCounts.costResults,
          allocationRelations: oracleDigest.familyCounts.allocationRelations,
          valuationPositions: oracleDigest.familyCounts.valuationPositions,
          valuationResults: oracleDigest.familyCounts.valuationResults,
          workItems: oracleDigest.familyCounts.workItems
        },
        exactDigestMatch: candidateDigest.digest === oracleDigest.digest,
        activeParentRevalidated: active.id === candidate.parent_dataset_id,
        runtimePostingSequenceAtCutover: runtimePostingSequence.toString(),
        candidateBoundarySequence: candidateBoundary.toString(),
        postingCursorWithinCandidate
      };
      const certificationDigest = digest(semantic);

      const certificationRow = await trx.insertInto('runtime_equivalence_certification')
        .values({
          enterprise_id: candidate.enterprise_id,
          consistency_domain: candidate.consistency_domain,
          candidate_dataset_id: candidate.id,
          oracle_dataset_id: oracle.id,
          parent_dataset_id: candidate.parent_dataset_id,
          source_checkpoint_id: candidate.source_checkpoint_id,
          source_promotion_id: candidate.source_promotion_id,
          incremental_plan_digest: candidate.incremental_plan_digest,
          boundary_sequence: asBigInt(candidate.boundary_sequence),
          candidate_semantic_digest: candidateDigest.digest,
          oracle_semantic_digest: oracleDigest.digest,
          status,
          blockers: sql<readonly unknown[]>`${JSON.stringify(blockers)}::jsonb`,
          evidence,
          certification_digest: certificationDigest,
          certified_by: request.certifiedBy,
          reason: request.reason,
          activated_at: status === 'CERTIFIED' ? sql`now()` : null
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      if (status === 'REJECTED') {
        await trx.updateTable('economic_runtime_dataset')
          .set({
            status: 'FAILED',
            failure_reason: `Runtime equivalence rejected: ${blockers.join(', ')}`
          })
          .where('id','=',candidate.id)
          .where('kind','=','CANDIDATE')
          .where('status','in',['BUILDING','VERIFIED'])
          .execute();
        return { certification: mapCertification(certificationRow) };
      }

      await trx.updateTable('economic_runtime_dataset')
        .set({
          status: 'VERIFIED',
          semantic_digest: candidateDigest.digest,
          verified_at: sql`now()`,
          failure_reason: null
        })
        .where('id','=',candidate.id)
        .where('kind','=','CANDIDATE')
        .where('status','=','BUILDING')
        .executeTakeFirstOrThrow();

      const boundaryInput = await trx.selectFrom('posting_input')
        .select(['effective_at','posting_priority','posting_sequence'])
        .where('enterprise_id','=',candidate.enterprise_id)
        .where('consistency_domain','=',candidate.consistency_domain)
        .where('posting_sequence','=',asBigInt(candidate.boundary_sequence))
        .executeTakeFirstOrThrow();
      await trx.updateTable('posting_input')
        .set({ status: 'POSTED', posted_at: sql`now()` })
        .where('enterprise_id','=',candidate.enterprise_id)
        .where('consistency_domain','=',candidate.consistency_domain)
        .where('posting_sequence','>=',asBigInt(candidate.start_sequence))
        .where('posting_sequence','<=',asBigInt(candidate.boundary_sequence))
        .where('status','=','QUEUED')
        .execute();
      await trx.updateTable('enterprise_runtime_state')
        .set({
          posting_mode: 'NORMAL',
          replay_required: false,
          last_posted_effective_at: boundaryInput.effective_at,
          last_posted_priority: boundaryInput.posting_priority,
          last_posted_sequence: asBigInt(boundaryInput.posting_sequence),
          active_replay_run_id: null,
          updated_at: sql`now()`
        })
        .where('enterprise_id','=',candidate.enterprise_id)
        .where('consistency_domain','=',candidate.consistency_domain)
        .executeTakeFirstOrThrow();

      await trx.updateTable('ledger_dataset')
        .set({ kind: 'ARCHIVED', status: 'ARCHIVED' })
        .where('enterprise_id','=',candidate.enterprise_id)
        .where('consistency_domain','=',candidate.consistency_domain)
        .where('status','=','ACTIVE')
        .execute();
      await trx.updateTable('ledger_dataset')
        .set({ kind: 'CURRENT', status: 'ACTIVE', activated_at: sql`now()` })
        .where('economic_runtime_dataset_id','=',candidate.id)
        .where('kind','=','CANDIDATE')
        .where('status','=','BUILDING')
        .executeTakeFirstOrThrow();

      await trx.updateTable('economic_runtime_dataset')
        .set({ kind: 'ARCHIVED', status: 'ARCHIVED' })
        .where('id','=',active.id)
        .where('status','=','ACTIVE')
        .executeTakeFirstOrThrow();
      const activated = await trx.updateTable('economic_runtime_dataset')
        .set({ kind: 'CURRENT', status: 'ACTIVE', activated_at: sql`now()` })
        .where('id','=',candidate.id)
        .where('status','=','VERIFIED')
        .returningAll()
        .executeTakeFirstOrThrow();

      return {
        certification: mapCertification(certificationRow),
        activatedDataset: mapDataset(activated)
      };
    });
  }
}

import { sql, type Kysely } from 'kysely';
import type { Database } from '../../../platform/database/src/types.js';
import type {
  CreateCandidateRuntimeDatasetRequest,
  EconomicRuntimeDataset,
  EconomicRuntimeDatasetService
} from '../api/runtime-dataset.js';

function asBigInt(value: unknown): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isInteger(value)) return BigInt(value);
  if (typeof value === 'string' && /^-?\d+$/.test(value)) return BigInt(value);
  throw new Error('Economic runtime dataset contains an invalid sequence.');
}

function asDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date;
  }
  throw new Error('Economic runtime dataset contains an invalid timestamp.');
}

function mapRow(row: {
  id:string;
  enterprise_id:string;
  consistency_domain:string;
  kind:'CURRENT'|'CANDIDATE'|'ARCHIVED';
  status:'BUILDING'|'ACTIVE'|'VERIFIED'|'FAILED'|'ARCHIVED';
  parent_dataset_id:string|null;
  source_checkpoint_id:string|null;
  source_promotion_id:string|null;
  incremental_plan_digest:string|null;
  start_sequence:unknown|null;
  boundary_sequence:unknown|null;
  semantic_digest:string|null;
  created_at:unknown;
  verified_at:unknown|null;
  activated_at:unknown|null;
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
    ...(row.incremental_plan_digest !== null ? { incrementalPlanDigest: row.incremental_plan_digest } : {}),
    ...(row.start_sequence !== null ? { startSequence: asBigInt(row.start_sequence) } : {}),
    ...(row.boundary_sequence !== null ? { boundarySequence: asBigInt(row.boundary_sequence) } : {}),
    ...(row.semantic_digest !== null ? { semanticDigest: row.semantic_digest } : {}),
    createdAt: asDate(row.created_at),
    ...(row.verified_at !== null ? { verifiedAt: asDate(row.verified_at) } : {}),
    ...(row.activated_at !== null ? { activatedAt: asDate(row.activated_at) } : {})
  };
}

export class PostgresEconomicRuntimeDatasetService
implements EconomicRuntimeDatasetService {
  constructor(private readonly db: Kysely<Database>) {}

  async getActive(
    enterpriseId: string,
    consistencyDomain: string
  ): Promise<EconomicRuntimeDataset> {
    const existing = await this.db.selectFrom('economic_runtime_dataset')
      .selectAll()
      .where('enterprise_id','=',enterpriseId)
      .where('consistency_domain','=',consistencyDomain)
      .where('status','=','ACTIVE')
      .executeTakeFirst();

    if (existing !== undefined) return mapRow(existing);

    const inserted = await this.db.insertInto('economic_runtime_dataset')
      .values({
        enterprise_id: enterpriseId,
        consistency_domain: consistencyDomain,
        kind: 'CURRENT',
        status: 'ACTIVE',
        parent_dataset_id: null,
        source_checkpoint_id: null,
        source_promotion_id: null,
        incremental_plan_digest: null,
        start_sequence: null,
        boundary_sequence: null,
        semantic_digest: null,
        failure_reason: null,
        verified_at: null,
        activated_at: sql`now()`
      })
      .onConflict((oc) => oc.doNothing())
      .returningAll()
      .executeTakeFirst();

    if (inserted !== undefined) return mapRow(inserted);

    const raced = await this.db.selectFrom('economic_runtime_dataset')
      .selectAll()
      .where('enterprise_id','=',enterpriseId)
      .where('consistency_domain','=',consistencyDomain)
      .where('status','=','ACTIVE')
      .executeTakeFirstOrThrow();

    return mapRow(raced);
  }

  async createCandidate(
    request: CreateCandidateRuntimeDatasetRequest
  ): Promise<EconomicRuntimeDataset> {
    if (request.startSequence < 0n || request.boundarySequence < request.startSequence) {
      throw new Error('Candidate runtime dataset requires a valid sequence range.');
    }
    if (!/^[0-9a-f]{64}$/i.test(request.incrementalPlanDigest)) {
      throw new Error('Candidate runtime dataset requires a SHA-256 incremental plan digest.');
    }

    return this.db.transaction().execute(async (trx) => {
      const parent = await trx.selectFrom('economic_runtime_dataset')
        .selectAll()
        .where('id','=',request.parentDatasetId)
        .where('enterprise_id','=',request.enterpriseId)
        .where('consistency_domain','=',request.consistencyDomain)
        .where('status','=','ACTIVE')
        .forUpdate()
        .executeTakeFirst();

      if (parent === undefined) {
        throw new Error('Candidate runtime dataset requires the current ACTIVE parent dataset.');
      }

      const checkpoint = await trx.selectFrom('replay_checkpoint')
        .select(['id','enterprise_id','consistency_domain','status'])
        .where('id','=',request.sourceCheckpointId)
        .executeTakeFirstOrThrow();

      const promotion = await trx.selectFrom('replay_checkpoint_promotion')
        .select(['id','enterprise_id','checkpoint_id','status'])
        .where('id','=',request.sourcePromotionId)
        .executeTakeFirstOrThrow();

      if (
        checkpoint.status !== 'ACTIVE' ||
        checkpoint.enterprise_id !== request.enterpriseId ||
        checkpoint.consistency_domain !== request.consistencyDomain ||
        promotion.status !== 'ACTIVE' ||
        promotion.enterprise_id !== request.enterpriseId ||
        promotion.checkpoint_id !== checkpoint.id
      ) {
        throw new Error('Candidate runtime dataset requires an active promoted checkpoint in the same semantic scope.');
      }

      const existing = await trx.selectFrom('economic_runtime_dataset')
        .selectAll()
        .where('enterprise_id','=',request.enterpriseId)
        .where('consistency_domain','=',request.consistencyDomain)
        .where('kind','=','CANDIDATE')
        .where('source_checkpoint_id','=',request.sourceCheckpointId)
        .where('source_promotion_id','=',request.sourcePromotionId)
        .where('incremental_plan_digest','=',request.incrementalPlanDigest)
        .where('status','in',['BUILDING','VERIFIED'])
        .executeTakeFirst();

      if (existing !== undefined) return mapRow(existing);

      const row = await trx.insertInto('economic_runtime_dataset')
        .values({
          enterprise_id: request.enterpriseId,
          consistency_domain: request.consistencyDomain,
          kind: 'CANDIDATE',
          status: 'BUILDING',
          parent_dataset_id: parent.id,
          source_checkpoint_id: request.sourceCheckpointId,
          source_promotion_id: request.sourcePromotionId,
          incremental_plan_digest: request.incrementalPlanDigest,
          start_sequence: request.startSequence,
          boundary_sequence: request.boundarySequence,
          semantic_digest: null,
          failure_reason: null,
          verified_at: null,
          activated_at: null
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      return mapRow(row);
    });
  }

  async markVerified(
    datasetId: string,
    semanticDigest: string
  ): Promise<EconomicRuntimeDataset> {
    if (!/^[0-9a-f]{64}$/i.test(semanticDigest)) {
      throw new Error('Verified runtime dataset requires a SHA-256 semantic digest.');
    }

    const row = await this.db.updateTable('economic_runtime_dataset')
      .set({
        status: 'VERIFIED',
        semantic_digest: semanticDigest,
        verified_at: sql`now()`,
        failure_reason: null
      })
      .where('id','=',datasetId)
      .where('kind','=','CANDIDATE')
      .where('status','=','BUILDING')
      .returningAll()
      .executeTakeFirstOrThrow();

    return mapRow(row);
  }

  async activateVerified(datasetId: string): Promise<EconomicRuntimeDataset> {
    return this.db.transaction().execute(async (trx) => {
      const candidate = await trx.selectFrom('economic_runtime_dataset')
        .selectAll()
        .where('id','=',datasetId)
        .where('kind','=','CANDIDATE')
        .where('status','=','VERIFIED')
        .forUpdate()
        .executeTakeFirstOrThrow();

      if (candidate.semantic_digest === null) {
        throw new Error('Verified candidate is missing semantic digest.');
      }

      const active = await trx.selectFrom('economic_runtime_dataset')
        .selectAll()
        .where('enterprise_id','=',candidate.enterprise_id)
        .where('consistency_domain','=',candidate.consistency_domain)
        .where('status','=','ACTIVE')
        .forUpdate()
        .executeTakeFirstOrThrow();

      if (candidate.parent_dataset_id !== active.id) {
        throw new Error('Candidate parent is no longer the current ACTIVE runtime dataset.');
      }

      await trx.updateTable('economic_runtime_dataset')
        .set({
          kind: 'ARCHIVED',
          status: 'ARCHIVED'
        })
        .where('id','=',active.id)
        .where('status','=','ACTIVE')
        .executeTakeFirstOrThrow();

      const activated = await trx.updateTable('economic_runtime_dataset')
        .set({
          kind: 'CURRENT',
          status: 'ACTIVE',
          activated_at: sql`now()`
        })
        .where('id','=',candidate.id)
        .where('status','=','VERIFIED')
        .returningAll()
        .executeTakeFirstOrThrow();

      return mapRow(activated);
    });
  }

  async markFailed(datasetId: string, reason: string): Promise<void> {
    if (reason.trim().length === 0) {
      throw new Error('Failed runtime dataset requires a reason.');
    }

    await this.db.updateTable('economic_runtime_dataset')
      .set({
        status: 'FAILED',
        failure_reason: reason
      })
      .where('id','=',datasetId)
      .where('kind','=','CANDIDATE')
      .where('status','in',['BUILDING','VERIFIED'])
      .execute();
  }
}

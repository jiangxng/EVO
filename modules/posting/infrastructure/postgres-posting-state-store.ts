import { sql, type Kysely } from 'kysely';
import type { Database } from '../../../platform/database/src/types.js';
import type { DatabaseTransaction } from '../../../platform/database/src/transaction.js';
import type { PostingCandidate, PostingFailureInfo } from '../api/contracts.js';
import type {
  LockedPostingState,
  PostingQueueReader,
  PostingStateStore
} from '../application/posting-state-store.js';

export class PostgresPostingStateStore
  implements PostingQueueReader, PostingStateStore
{
  constructor(private readonly db: Kysely<Database>) {}

  async peekNext(enterpriseId: string): Promise<PostingCandidate | null> {
    const row = await this.baseCandidateQuery(this.db, enterpriseId)
      .where('pi.status', '=', 'QUEUED')
      .orderBy('pi.effective_at')
      .orderBy('pi.posting_priority')
      .orderBy('pi.posting_sequence')
      .executeTakeFirst();

    return row === undefined ? null : this.mapCandidate(row);
  }

  async lockForCommit(
    trx: DatabaseTransaction,
    enterpriseId: string,
    expectedPostingInputId: string
  ): Promise<LockedPostingState> {
    const runtime = await trx
      .selectFrom('enterprise_runtime_state')
      .selectAll()
      .where('enterprise_id', '=', enterpriseId)
      .forUpdate()
      .executeTakeFirst();

    if (runtime === undefined) return { state: 'IDLE' };

    if (runtime.replay_required || runtime.posting_mode !== 'NORMAL') {
      return { state: 'BLOCKED_REPLAY_REQUIRED' };
    }

    const row = await this.baseCandidateQuery(trx, enterpriseId)
      .where('pi.status', '=', 'QUEUED')
      .orderBy('pi.effective_at')
      .orderBy('pi.posting_priority')
      .orderBy('pi.posting_sequence')
      .forUpdate()
      .skipLocked()
      .executeTakeFirst();

    if (row === undefined) return { state: 'IDLE' };

    const candidate = this.mapCandidate(row);
    if (candidate.id !== expectedPostingInputId) {
      return { state: 'RACE_RETRY' };
    }

    return { state: 'READY', candidate };
  }

  async createPostingRun(
    trx: DatabaseTransaction,
    candidate: PostingCandidate
  ): Promise<string> {
    const run = await trx
      .insertInto('posting_run')
      .values({
        enterprise_id: candidate.enterpriseId,
        consistency_domain: candidate.consistencyDomain,
        posting_input_id: candidate.id,
        mode: 'NORMAL',
        metadata_version: candidate.metadataVersion,
        status: 'PROCESSING',
        completed_at: null,
        error: null
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    return run.id;
  }

  async completePosting(
    trx: DatabaseTransaction,
    candidate: PostingCandidate,
    postingRunId: string
  ): Promise<void> {
    await trx
      .updateTable('posting_input')
      .set({
        status: 'POSTED',
        posted_at: sql`now()`
      })
      .where('id', '=', candidate.id)
      .where('status', '=', 'QUEUED')
      .executeTakeFirstOrThrow();

    await trx
      .updateTable('posting_run')
      .set({
        status: 'COMPLETED',
        completed_at: sql`now()`
      })
      .where('id', '=', postingRunId)
      .execute();

    await trx
      .updateTable('enterprise_runtime_state')
      .set({
        last_posted_effective_at: candidate.effectiveAt,
        last_posted_priority: candidate.postingPriority,
        last_posted_sequence: candidate.postingSequence,
        updated_at: sql`now()`
      })
      .where('enterprise_id', '=', candidate.enterpriseId)
      .execute();
  }

  async markFailed(
    enterpriseId: string,
    postingInputId: string,
    failure: PostingFailureInfo
  ): Promise<void> {
    await this.db.transaction().execute(async (trx) => {
      await trx
        .updateTable('posting_input')
        .set({ status: 'FAILED' })
        .where('enterprise_id', '=', enterpriseId)
        .where('id', '=', postingInputId)
        .where('status', '=', 'QUEUED')
        .execute();

      await trx
        .insertInto('posting_failure')
        .values({
          enterprise_id: enterpriseId,
          posting_input_id: postingInputId,
          error_code: failure.code,
          error_message: failure.message,
          error_context: failure.context,
          retryable: failure.retryable
        })
        .execute();
    });
  }

  private baseCandidateQuery(
    db: Kysely<Database> | DatabaseTransaction,
    enterpriseId: string
  ) {
    return db
      .selectFrom('posting_input as pi')
      .innerJoin(
        'application_instance as ai',
        'ai.id',
        'pi.application_instance_id'
      )
      .select([
        'pi.id',
        'pi.enterprise_id',
        'pi.consistency_domain',
        'pi.business_data_id',
        'pi.application_instance_id',
        'ai.application_definition_id',
        'pi.effective_at',
        'pi.posting_priority',
        'pi.posting_sequence',
        'pi.metadata_version'
      ])
      .where('pi.enterprise_id', '=', enterpriseId);
  }

  private mapCandidate(row: {
    readonly id: string;
    readonly enterprise_id: string;
    readonly consistency_domain: string;
    readonly business_data_id: string;
    readonly application_instance_id: string;
    readonly application_definition_id: string;
    readonly effective_at: Date;
    readonly posting_priority: number;
    readonly posting_sequence: bigint;
    readonly metadata_version: number;
  }): PostingCandidate {
    return {
      id: row.id,
      enterpriseId: row.enterprise_id,
      consistencyDomain: row.consistency_domain,
      businessDataId: row.business_data_id,
      applicationInstanceId: row.application_instance_id,
      applicationDefinitionId: row.application_definition_id,
      effectiveAt: new Date(row.effective_at),
      postingPriority: row.posting_priority,
      postingSequence: BigInt(row.posting_sequence),
      metadataVersion: row.metadata_version
    };
  }
}

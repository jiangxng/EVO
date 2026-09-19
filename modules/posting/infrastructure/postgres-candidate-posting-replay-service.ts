import { sql, type Kysely } from 'kysely';
import type { Database } from '../../../platform/database/src/types.js';
import type { DatabaseTransactionRunner } from '../../../platform/database/src/transaction.js';
import type { BusinessDataReader } from '../../business-data/api/business-data-reader.js';
import type { LedgerWriter } from '../../ledger/api/ledger-writer.js';
import type { PostingMetadataReader } from '../../metadata/api/posting-metadata-reader.js';
import type { MaterializationContext } from '../../materialization/api/context.js';
import type {
  CandidatePostingReplayResult,
  CandidatePostingReplayService
} from '../api/candidate-replay.js';
import { evaluatePostingRules } from '../domain/posting-rule-evaluator.js';

export class PostgresCandidatePostingReplayService
implements CandidatePostingReplayService {
  constructor(
    private readonly db: Kysely<Database>,
    private readonly businessData: BusinessDataReader,
    private readonly metadata: PostingMetadataReader,
    private readonly ledger: LedgerWriter,
    private readonly transactions: DatabaseTransactionRunner
  ) {}

  async replayRange(
    enterpriseId: string,
    afterSequence: bigint,
    atOrBeforeSequence: bigint,
    materialization: MaterializationContext
  ): Promise<CandidatePostingReplayResult> {
    if (materialization.mode === 'CURRENT') {
      throw new Error('Isolated posting replay requires a CANDIDATE or ORACLE materialization context.');
    }
    if (atOrBeforeSequence <= afterSequence) {
      throw new Error('Candidate posting replay requires a non-empty sequence range.');
    }

    const rows = await this.db.selectFrom('posting_input as p')
      .innerJoin('application_instance as ai','ai.id','p.application_instance_id')
      .select([
        'p.id',
        'p.enterprise_id',
        'p.consistency_domain',
        'p.business_data_id',
        'p.application_instance_id',
        'ai.application_definition_id',
        'p.effective_at',
        'p.posting_priority',
        'p.posting_sequence',
        'p.metadata_version'
      ])
      .where('p.enterprise_id','=',enterpriseId)
      .where('p.posting_sequence','>',afterSequence)
      .where('p.posting_sequence','<=',atOrBeforeSequence)
      .orderBy('p.effective_at')
      .orderBy('p.posting_priority')
      .orderBy('p.posting_sequence')
      .execute();

    const postingRunIds:string[] = [];
    let ledgerEffectCount = 0;

    for (const row of rows) {
      const fact = await this.businessData.getBusinessData(
        enterpriseId,
        row.business_data_id
      );
      if (fact === null) {
        throw new Error(
          `Candidate posting input ${row.id} references missing BusinessData.`
        );
      }

      const snapshot = await this.metadata.loadPostingMetadata(
        row.application_definition_id,
        row.metadata_version
      );
      const effects = evaluatePostingRules(fact.payload,snapshot.postingRules);

      const postingRunId = await this.transactions.run(async (trx) => {
        const run = await trx.insertInto('posting_run')
          .values({
            enterprise_id: enterpriseId,
            consistency_domain: row.consistency_domain,
            posting_input_id: row.id,
            economic_runtime_dataset_id: materialization.runtimeDatasetId,
            mode: 'REPLAY',
            metadata_version: row.metadata_version,
            status: 'PROCESSING',
            completed_at: null,
            error: null
          })
          .returning('id')
          .executeTakeFirstOrThrow();

        await this.ledger.applyPosting(
          trx,
          {
            enterpriseId,
            consistencyDomain: row.consistency_domain,
            postingRunId: run.id,
            postingInputId: row.id,
            businessDataId: row.business_data_id,
            effectiveAt: new Date(row.effective_at),
            postingPriority: row.posting_priority,
            postingSequence: BigInt(row.posting_sequence),
            materialization
          },
          effects
        );

        await trx.updateTable('posting_run')
          .set({
            status: 'COMPLETED',
            completed_at: sql`now()`
          })
          .where('id','=',run.id)
          .executeTakeFirstOrThrow();

        return run.id;
      });

      postingRunIds.push(postingRunId);
      ledgerEffectCount += effects.length;
    }

    return {
      postingInputCount: rows.length,
      postingRunIds,
      ledgerEffectCount
    };
  }
}

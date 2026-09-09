import { AppError } from '../../../platform/contracts/src/index.js';
import type {
  DatabaseTransactionRunner
} from '../../../platform/database/src/transaction.js';
import type { BusinessDataReader } from '../../business-data/api/business-data-reader.js';
import type { LedgerWriter } from '../../ledger/api/ledger-writer.js';
import type { PostingMetadataReader } from '../../metadata/api/posting-metadata-reader.js';
import type { PostingProcessor } from '../api/posting-processor.js';
import type {
  PostingFailureInfo,
  PostingProcessResult
} from '../api/contracts.js';
import { evaluatePostingRules } from '../domain/posting-rule-evaluator.js';
import type {
  PostingQueueReader,
  PostingStateStore
} from './posting-state-store.js';

export class PostingService implements PostingProcessor {
  constructor(
    private readonly queue: PostingQueueReader,
    private readonly state: PostingStateStore,
    private readonly businessData: BusinessDataReader,
    private readonly metadata: PostingMetadataReader,
    private readonly ledger: LedgerWriter,
    private readonly transactions: DatabaseTransactionRunner
  ) {}

  async processNext(
    enterpriseId: string
  ): Promise<PostingProcessResult> {
    const candidate = await this.queue.peekNext(enterpriseId);
    if (candidate === null) return { status: 'IDLE' };

    try {
      const businessData = await this.businessData.getBusinessData(
        enterpriseId,
        candidate.businessDataId
      );

      if (businessData === null) {
        throw new AppError({
          code: 'POSTING_BUSINESS_DATA_NOT_FOUND',
          message: 'PostingInput references missing BusinessData.',
          module: 'posting',
          operation: 'processNext',
          details: { postingInputId: candidate.id }
        });
      }

      const metadata = await this.metadata.loadPostingMetadata(
        candidate.applicationDefinitionId,
        candidate.metadataVersion
      );

      const effects = evaluatePostingRules(
        businessData.payload,
        metadata.postingRules
      );

      return await this.transactions.run(async (trx) => {
        const locked = await this.state.lockForCommit(
          trx,
          enterpriseId,
          candidate.id
        );

        if (locked.state !== 'READY' || locked.candidate === undefined) {
          return { status: locked.state };
        }

        const current = locked.candidate;
        const postingRunId = await this.state.createPostingRun(
          trx,
          current
        );

        await this.ledger.applyPosting(
          trx,
          {
            enterpriseId: current.enterpriseId,
            consistencyDomain: current.consistencyDomain,
            postingRunId,
            postingInputId: current.id,
            businessDataId: current.businessDataId,
            effectiveAt: current.effectiveAt,
            postingPriority: current.postingPriority,
            postingSequence: current.postingSequence
          },
          effects
        );

        await this.state.completePosting(
          trx,
          current,
          postingRunId
        );

        return {
          status: 'POSTED',
          postingInputId: current.id,
          postingRunId,
          ledgerEffectCount: effects.length,
          postingSequence: current.postingSequence
        };
      });
    } catch (error) {
      const failure = this.failureInfo(error);
      await this.state.markFailed(
        enterpriseId,
        candidate.id,
        failure
      );

      return {
        status: 'FAILED',
        postingInputId: candidate.id,
        errorCode: failure.code,
        retryable: failure.retryable
      };
    }
  }

  private failureInfo(error: unknown): PostingFailureInfo {
    if (error instanceof AppError) {
      return {
        code: error.code,
        message: error.message,
        retryable: error.retryable,
        context: error.details as PostingFailureInfo['context']
      };
    }

    return {
      code: 'POSTING_UNEXPECTED_FAILURE',
      message: error instanceof Error
        ? error.message
        : 'Unexpected posting failure.',
      retryable: false,
      context: {}
    };
  }
}

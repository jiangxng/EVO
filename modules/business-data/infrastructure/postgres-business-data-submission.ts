import { createHash } from 'node:crypto';
import { sql, type Kysely } from 'kysely';
import { AppError } from '../../../platform/contracts/src/index.js';
import type { Database } from '../../../platform/database/src/types.js';
import type { JsonObject } from '../../metadata/api/contracts.js';
import type {
  BusinessDataSubmissionPortV010,
  BusinessDataSubmissionResultV010,
  BusinessDataSubmissionV010
} from '../api/contracts.js';
import type {
  ApplicationAnchorReaderV010
} from '../api/application-anchor.js';
import {
  writeBusinessDataAndPostingInputV010
} from '../application/atomic-business-data-write.js';

export interface BusinessDataScopeResolverV010 {
  resolveEnterpriseId(scopeKey: string): Promise<string>;
}

type ReceiptJson = Record<string, unknown>;

type ReceiptRow = {
  id: string;
  scope_key: string;
  request_digest: string;
  status: 'PROCESSING' | 'COMPLETED' | 'FAILED';
  result: ReceiptJson | null;
  error: ReceiptJson | null;
};

const BUSINESS_DATA_RELATION_TYPES = new Set([
  'CAUSES',
  'FULFILLS',
  'ALLOCATES_TO',
  'DERIVES_FROM',
  'REFERENCES'
] as const);

function normalizedRelation(
  value: BusinessDataSubmissionV010['relation']
): BusinessDataSubmissionV010['relation'] {
  if (value === undefined) return undefined;
  const fromBusinessDataId = requiredText(
    value.fromBusinessDataId,
    'BUSINESS_DATA_RELATION_SOURCE_REQUIRED'
  );
  if (!BUSINESS_DATA_RELATION_TYPES.has(value.relationType)) {
    throw new AppError({
      code: 'BUSINESS_DATA_RELATION_TYPE_INVALID',
      message: 'BusinessData relation type is invalid.',
      module: 'business-data',
      operation: 'submit'
    });
  }
  return {
    fromBusinessDataId,
    relationType: value.relationType
  };
}

function requiredText(value: string, code: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AppError({
      code,
      message: code,
      module: 'business-data',
      operation: 'submit'
    });
  }
  return value.trim();
}

function canonicalValue(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new AppError({
        code: 'BUSINESS_DATA_SUBMISSION_JSON_INVALID',
        message: 'Submission payload contains a non-finite number.',
        module: 'business-data',
        operation: 'requestDigest'
      });
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return '[' + value.map(canonicalValue).join(',') + ']';
  }
  if (typeof value === 'object' && value !== undefined) {
    const object = value as Record<string, unknown>;
    return '{' + Object.keys(object)
      .sort()
      .map((key) => JSON.stringify(key) + ':' + canonicalValue(object[key]))
      .join(',') + '}';
  }
  throw new AppError({
    code: 'BUSINESS_DATA_SUBMISSION_JSON_INVALID',
    message: 'Submission contains a non-JSON value.',
    module: 'business-data',
    operation: 'requestDigest'
  });
}

export function businessDataSubmissionRequestDigestV010(
  request: BusinessDataSubmissionV010
): string {
  const canonical = canonicalValue({
    contractVersion: request.contractVersion,
    scopeKey: request.scopeKey,
    applicationId: request.applicationId,
    businessDataType: request.businessDataType,
    businessObjectKey: request.businessObjectKey,
    effectiveAt: request.effectiveAt.toISOString(),
    payload: request.payload,
    correlationId: request.correlationId,
    idempotencyKey: request.idempotencyKey,
    causationId: request.causationId ?? null,
    relation: request.relation ?? null,
    expectedBusinessVersion:
      request.expectedBusinessVersion?.toString() ?? null,
    postingPriority: request.postingPriority ?? null
  });
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

function parseCompletedResult(
  value: ReceiptJson | null
): BusinessDataSubmissionResultV010 {
  if (
    value === null
    || typeof value.businessDataId !== 'string'
    || typeof value.businessObjectVersion !== 'string'
    || typeof value.postingInputId !== 'string'
    || typeof value.postingSequence !== 'string'
    || (
      value.postingStatus !== 'QUEUED'
      && value.postingStatus !== 'BLOCKED_REPLAY_REQUIRED'
    )
    || typeof value.retroactive !== 'boolean'
    || typeof value.replayRequired !== 'boolean'
  ) {
    throw new AppError({
      code: 'BUSINESS_DATA_SUBMISSION_RECEIPT_INVALID',
      message: 'Stored direct-submission receipt is invalid.',
      module: 'business-data',
      operation: 'parseCompletedResult'
    });
  }

  return {
    contractVersion: '0.1.0',
    businessDataId: value.businessDataId,
    businessObjectVersion: BigInt(value.businessObjectVersion),
    postingInputId: value.postingInputId,
    postingSequence: BigInt(value.postingSequence),
    postingStatus: value.postingStatus,
    retroactive: value.retroactive,
    replayRequired: value.replayRequired,
    idempotentReplay: true
  };
}

function errorPayload(error: unknown): JsonObject {
  if (error instanceof AppError) {
    return {
      code: error.code,
      message: error.message,
      retryable: error.retryable
    };
  }
  return {
    code: 'BUSINESS_DATA_SUBMISSION_FAILED',
    message: error instanceof Error ? error.message : String(error),
    retryable: false
  };
}

function previousFailure(value: ReceiptJson | null): AppError {
  return new AppError({
    code:
      value !== null && typeof value.code === 'string'
        ? value.code
        : 'BUSINESS_DATA_SUBMISSION_PREVIOUSLY_FAILED',
    message:
      value !== null && typeof value.message === 'string'
        ? value.message
        : 'A previous direct submission with this idempotency key failed.',
    module: 'business-data',
    operation: 'submit',
    retryable:
      value !== null && typeof value.retryable === 'boolean'
        ? value.retryable
        : false
  });
}

export class PostgresBusinessDataSubmissionPortV010
  implements BusinessDataSubmissionPortV010
{
  constructor(
    private readonly db: Kysely<Database>,
    private readonly scopeResolver: BusinessDataScopeResolverV010,
    private readonly applicationAnchors: ApplicationAnchorReaderV010
  ) {}

  async submit(
    request: BusinessDataSubmissionV010
  ): Promise<BusinessDataSubmissionResultV010> {
    if (request.contractVersion !== '0.1.0') {
      throw new AppError({
        code: 'BUSINESS_DATA_SUBMISSION_VERSION_UNSUPPORTED',
        message: 'Unsupported BusinessDataSubmission contract version.',
        module: 'business-data',
        operation: 'submit'
      });
    }
    if (!(request.effectiveAt instanceof Date) || Number.isNaN(request.effectiveAt.getTime())) {
      throw new AppError({
        code: 'BUSINESS_DATA_EFFECTIVE_AT_INVALID',
        message: 'effectiveAt must be a valid Date.',
        module: 'business-data',
        operation: 'submit'
      });
    }

    const scopeKey = requiredText(
      request.scopeKey,
      'BUSINESS_DATA_SCOPE_KEY_REQUIRED'
    );
    const applicationId = requiredText(
      request.applicationId,
      'APPLICATION_ID_REQUIRED'
    );
    const businessDataType = requiredText(
      request.businessDataType,
      'BUSINESS_DATA_TYPE_REQUIRED'
    );
    const businessObjectKey = requiredText(
      request.businessObjectKey,
      'BUSINESS_OBJECT_KEY_REQUIRED'
    );
    const correlationId = requiredText(
      request.correlationId,
      'CORRELATION_ID_REQUIRED'
    );
    const idempotencyKey = requiredText(
      request.idempotencyKey,
      'IDEMPOTENCY_KEY_REQUIRED'
    );

    const enterpriseId = requiredText(
      await this.scopeResolver.resolveEnterpriseId(scopeKey),
      'BUSINESS_DATA_SCOPE_NOT_FOUND'
    );
    await this.applicationAnchors.require(applicationId);
    const relation = normalizedRelation(request.relation);

    const digest = businessDataSubmissionRequestDigestV010({
      ...request,
      scopeKey,
      applicationId,
      businessDataType,
      businessObjectKey,
      correlationId,
      idempotencyKey,
      ...(relation === undefined ? {} : { relation })
    });

    const claim = await this.claimReceipt({
      enterpriseId,
      scopeKey,
      applicationId,
      idempotencyKey,
      correlationId,
      ...(request.causationId === undefined
        ? {}
        : { causationId: request.causationId }),
      digest
    });

    if (!claim.created) {
      this.assertReceiptMatches(claim.receipt, scopeKey, digest);
      if (claim.receipt.status === 'COMPLETED') {
        return parseCompletedResult(claim.receipt.result);
      }
      if (claim.receipt.status === 'FAILED') {
        throw previousFailure(claim.receipt.error);
      }
      throw new AppError({
        code: 'BUSINESS_DATA_SUBMISSION_IN_PROGRESS',
        message: 'A direct submission with this idempotency key is in progress.',
        module: 'business-data',
        operation: 'submit',
        retryable: true
      });
    }

    try {
      return await this.db.transaction().execute(async (trx) => {
        const receipt = await trx
          .selectFrom('business_data_submission_receipt')
          .select(['id', 'scope_key', 'request_digest', 'status', 'result', 'error'])
          .where('id', '=', claim.receipt.id)
          .forUpdate()
          .executeTakeFirstOrThrow();

        this.assertReceiptMatches(receipt, scopeKey, digest);
        if (receipt.status !== 'PROCESSING') {
          if (receipt.status === 'COMPLETED') {
            return parseCompletedResult(receipt.result);
          }
          throw previousFailure(receipt.error);
        }

        if (relation !== undefined) {
          const source = await trx
            .selectFrom('business_data')
            .select(['id', 'enterprise_id'])
            .where('id', '=', relation.fromBusinessDataId)
            .executeTakeFirst();
          if (source === undefined || source.enterprise_id !== enterpriseId) {
            throw new AppError({
              code: 'BUSINESS_DATA_RELATION_SOURCE_NOT_FOUND',
              message:
                'Relation source BusinessData was not found in the resolved scope.',
              module: 'business-data',
              operation: 'submit'
            });
          }
        }

        const written = await writeBusinessDataAndPostingInputV010(trx, {
          enterpriseId,
          applicationId,
          businessDataType,
          businessObjectKey,
          ...(request.expectedBusinessVersion === undefined
            ? {}
            : { expectedBusinessVersion: request.expectedBusinessVersion }),
          effectiveAt: request.effectiveAt,
          payload: request.payload,
          ...(request.postingPriority === undefined
            ? {}
            : { postingPriority: request.postingPriority }),
          correlationId,
          ...(request.causationId === undefined
            ? {}
            : { causationId: request.causationId })
        });

        if (relation !== undefined) {
          await trx
            .insertInto('business_object_link')
            .values({
              enterprise_id: enterpriseId,
              from_business_data_id: relation.fromBusinessDataId,
              to_business_data_id: written.businessDataId,
              relation_type: relation.relationType,
              metadata: {}
            })
            .execute();
        }

        const stored: JsonObject = {
          businessDataId: written.businessDataId,
          businessObjectVersion: written.businessObjectVersion.toString(),
          postingInputId: written.postingInputId,
          postingSequence: written.postingSequence.toString(),
          postingStatus: written.postingStatus,
          retroactive: written.retroactive,
          replayRequired: written.replayRequired
        };

        await trx
          .updateTable('business_data_submission_receipt')
          .set({
            status: 'COMPLETED',
            result: stored,
            error: null,
            completed_at: sql`now()`
          })
          .where('id', '=', receipt.id)
          .execute();

        return {
          contractVersion: '0.1.0',
          businessDataId: written.businessDataId,
          businessObjectVersion: written.businessObjectVersion,
          postingInputId: written.postingInputId,
          postingSequence: written.postingSequence,
          postingStatus: written.postingStatus,
          retroactive: written.retroactive,
          replayRequired: written.replayRequired,
          idempotentReplay: false
        };
      });
    } catch (error) {
      await this.db
        .updateTable('business_data_submission_receipt')
        .set({
          status: 'FAILED',
          error: errorPayload(error),
          completed_at: sql`now()`
        })
        .where('id', '=', claim.receipt.id)
        .where('status', '=', 'PROCESSING')
        .execute();
      throw error;
    }
  }

  private async claimReceipt(input: {
    enterpriseId: string;
    scopeKey: string;
    applicationId: string;
    idempotencyKey: string;
    correlationId: string;
    causationId?: string;
    digest: string;
  }): Promise<{ created: boolean; receipt: ReceiptRow }> {
    const inserted = await this.db
      .insertInto('business_data_submission_receipt')
      .values({
        enterprise_id: input.enterpriseId,
        scope_key: input.scopeKey,
        application_id: input.applicationId,
        idempotency_key: input.idempotencyKey,
        correlation_id: input.correlationId,
        causation_id: input.causationId ?? null,
        request_digest: input.digest,
        status: 'PROCESSING',
        result: null,
        error: null,
        completed_at: null
      })
      .onConflict((oc) =>
        oc.columns([
          'enterprise_id',
          'application_id',
          'idempotency_key'
        ]).doNothing()
      )
      .returning(['id', 'scope_key', 'request_digest', 'status', 'result', 'error'])
      .executeTakeFirst();

    if (inserted !== undefined) {
      return { created: true, receipt: inserted };
    }

    const existing = await this.db
      .selectFrom('business_data_submission_receipt')
      .select(['id', 'scope_key', 'request_digest', 'status', 'result', 'error'])
      .where('enterprise_id', '=', input.enterpriseId)
      .where('application_id', '=', input.applicationId)
      .where('idempotency_key', '=', input.idempotencyKey)
      .executeTakeFirstOrThrow();

    return { created: false, receipt: existing };
  }

  private assertReceiptMatches(
    receipt: Pick<ReceiptRow, 'scope_key' | 'request_digest'>,
    scopeKey: string,
    digest: string
  ): void {
    if (
      receipt.scope_key !== scopeKey
      || receipt.request_digest !== digest
    ) {
      throw new AppError({
        code: 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST',
        message: 'Idempotency key was already used for a different request.',
        module: 'business-data',
        operation: 'submit'
      });
    }
  }
}

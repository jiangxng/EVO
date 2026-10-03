import { sql, type Transaction } from 'kysely';
import { AppError } from '../../../platform/contracts/src/index.js';
import type { Database } from '../../../platform/database/src/types.js';
import type { JsonObject } from '../../metadata/api/contracts.js';
import {
  isRetroactivePostingInput
} from '../domain/posting-order.js';

export interface AtomicBusinessDataWriteInputV010 {
  readonly enterpriseId: string;
  readonly applicationId: string;
  readonly legacyApplicationInstanceId?: string;
  readonly legacyCommandExecutionId?: string;
  readonly legacyMetadataVersion?: number;
  readonly businessDataType: string;
  readonly businessObjectKey: string;
  readonly expectedBusinessVersion?: bigint;
  readonly effectiveAt: Date;
  readonly payload: JsonObject;
  readonly postingPriority?: number;
  readonly correlationId: string;
  readonly causationId?: string;
}

export interface AtomicBusinessDataWriteResultV010 {
  readonly businessDataId: string;
  readonly businessObjectVersion: bigint;
  readonly postingInputId: string;
  readonly postingSequence: bigint;
  readonly postingStatus: 'QUEUED' | 'BLOCKED_REPLAY_REQUIRED';
  readonly retroactive: boolean;
  readonly replayRequired: boolean;
}

type DbTransaction = Transaction<Database>;

export async function writeBusinessDataAndPostingInputV010(
  trx: DbTransaction,
  input: AtomicBusinessDataWriteInputV010
): Promise<AtomicBusinessDataWriteResultV010> {
  const businessObjectVersion = await allocateBusinessObjectVersion(
    trx,
    input
  );

  const businessData = await trx
    .insertInto('business_data')
    .values({
      enterprise_id: input.enterpriseId,
      application_instance_id: input.legacyApplicationInstanceId ?? null,
      application_id: input.applicationId,
      command_execution_id: input.legacyCommandExecutionId ?? null,
      business_data_type: input.businessDataType,
      business_object_key: input.businessObjectKey,
      business_object_version: businessObjectVersion,
      effective_at: input.effectiveAt,
      metadata_version: input.legacyMetadataVersion ?? null,
      payload: input.payload
    })
    .returning('id')
    .executeTakeFirstOrThrow();

  const runtime = await lockRuntimeState(
    trx,
    input.enterpriseId
  );

  const postingSequence = BigInt(runtime.next_posting_sequence);
  const postingPriority = input.postingPriority ?? 0;
  const candidate = {
    effectiveAt: input.effectiveAt,
    postingPriority,
    postingSequence
  };

  const highWater =
    runtime.last_posted_effective_at === null ||
    runtime.last_posted_priority === null ||
    runtime.last_posted_sequence === null
      ? null
      : {
          effectiveAt: new Date(runtime.last_posted_effective_at),
          postingPriority: runtime.last_posted_priority,
          postingSequence: BigInt(runtime.last_posted_sequence)
        };

  const retroactive = isRetroactivePostingInput(candidate, highWater);
  const replayRequired = runtime.replay_required || retroactive;
  const postingStatus =
    replayRequired || runtime.posting_mode !== 'NORMAL'
      ? 'BLOCKED_REPLAY_REQUIRED'
      : 'QUEUED';

  const postingInput = await trx
    .insertInto('posting_input')
    .values({
      enterprise_id: input.enterpriseId,
      consistency_domain: runtime.consistency_domain,
      business_data_id: businessData.id,
      application_instance_id: input.legacyApplicationInstanceId ?? null,
      application_id: input.applicationId,
      effective_at: input.effectiveAt,
      posting_priority: postingPriority,
      posting_sequence: postingSequence,
      metadata_version: input.legacyMetadataVersion ?? null,
      status: postingStatus,
      retroactive,
      posted_at: null
    })
    .returning('id')
    .executeTakeFirstOrThrow();

  await trx
    .updateTable('enterprise_runtime_state')
    .set({
      next_posting_sequence: postingSequence + 1n,
      replay_required: replayRequired,
      updated_at: sql`now()`
    })
    .where('enterprise_id', '=', input.enterpriseId)
    .execute();

  await trx
    .insertInto('outbox_event')
    .values({
      enterprise_id: input.enterpriseId,
      event_type: 'business_data.created',
      event_version: 1,
      aggregate_type: 'BusinessData',
      aggregate_id: businessData.id,
      correlation_id: input.correlationId,
      causation_id:
        input.causationId ?? input.legacyCommandExecutionId ?? null,
      payload: {
        businessDataId: businessData.id,
        postingInputId: postingInput.id,
        postingSequence: postingSequence.toString(),
        postingStatus,
        retroactive
      },
      status: 'PENDING',
      attempts: 0,
      available_at: sql`now()`,
      published_at: null
    })
    .execute();

  return {
    businessDataId: businessData.id,
    businessObjectVersion,
    postingInputId: postingInput.id,
    postingSequence,
    postingStatus,
    retroactive,
    replayRequired
  };
}

async function allocateBusinessObjectVersion(
  trx: DbTransaction,
  input: AtomicBusinessDataWriteInputV010
): Promise<bigint> {
  const lockKey = [
    input.enterpriseId,
    input.applicationId,
    input.businessObjectKey
  ].join(':');

  await sql`select pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`
    .execute(trx);

  const latest = await trx
    .selectFrom('business_data')
    .select('business_object_version')
    .where('enterprise_id', '=', input.enterpriseId)
    .where('application_id', '=', input.applicationId)
    .where('business_object_key', '=', input.businessObjectKey)
    .orderBy('business_object_version', 'desc')
    .forUpdate()
    .executeTakeFirst();

  const current =
    latest === undefined ? 0n : BigInt(latest.business_object_version);

  if (
    input.expectedBusinessVersion !== undefined
    && input.expectedBusinessVersion !== current
  ) {
    throw new AppError({
      code: 'BUSINESS_VERSION_CONFLICT',
      message: 'Business object version does not match the expected version.',
      module: 'business-data',
      operation: 'allocateBusinessObjectVersion',
      details: {
        businessObjectKey: input.businessObjectKey,
        applicationId: input.applicationId,
        expectedBusinessVersion:
          input.expectedBusinessVersion.toString(),
        actualBusinessVersion: current.toString()
      }
    });
  }

  return current + 1n;
}

async function lockRuntimeState(
  trx: DbTransaction,
  enterpriseId: string
) {
  await trx
    .insertInto('enterprise_runtime_state')
    .values({
      enterprise_id: enterpriseId,
      consistency_domain: 'enterprise',
      posting_mode: 'NORMAL',
      replay_required: false,
      next_posting_sequence: 1n,
      last_posted_effective_at: null,
      last_posted_priority: null,
      last_posted_sequence: null,
      active_replay_run_id: null
    })
    .onConflict((oc) => oc.column('enterprise_id').doNothing())
    .execute();

  return trx
    .selectFrom('enterprise_runtime_state')
    .selectAll()
    .where('enterprise_id', '=', enterpriseId)
    .forUpdate()
    .executeTakeFirstOrThrow();
}

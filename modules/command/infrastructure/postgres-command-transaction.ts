import { sql, type Kysely, type Transaction } from 'kysely';
import { AppError } from '../../../platform/contracts/src/index.js';
import type { Database } from '../../../platform/database/src/types.js';
import type { JsonObject } from '../../metadata/api/contracts.js';
import {
  isRetroactivePostingInput
} from '../../business-data/domain/posting-order.js';
import type { ExecuteCommandResult } from '../api/contracts.js';
import type {
  CommandTransactionPort,
  CommitCommandInput
} from '../application/command-transaction-port.js';

type DbTransaction = Transaction<Database>;

export class PostgresCommandTransaction
  implements CommandTransactionPort
{
  constructor(private readonly db: Kysely<Database>) {}

  async commit(input: CommitCommandInput): Promise<ExecuteCommandResult> {
    return this.db.transaction().execute(async (trx) => {
      const existing = await trx
        .selectFrom('command_execution')
        .select(['id', 'result', 'status'])
        .where('enterprise_id', '=', input.request.enterpriseId)
        .where('idempotency_scope', '=', input.idempotencyScope)
        .where('idempotency_key', '=', input.request.idempotencyKey)
        .executeTakeFirst();

      if (existing !== undefined) {
        if (existing.status !== 'COMPLETED' || existing.result === null) {
          throw new AppError({
            code: 'IDEMPOTENT_COMMAND_IN_PROGRESS',
            message: 'An execution with this idempotency key already exists.',
            module: 'command',
            operation: 'commit',
            retryable: true,
            details: { commandExecutionId: existing.id }
          });
        }

        const stored = existing.result as unknown as {
          businessDataId: string;
          businessObjectVersion: string;
          postingInputId: string;
          postingSequence: string;
          postingStatus: 'QUEUED' | 'BLOCKED_REPLAY_REQUIRED';
          retroactive: boolean;
          replayRequired: boolean;
        };

        return {
          commandExecutionId: existing.id,
          businessDataId: stored.businessDataId,
          businessObjectVersion: BigInt(stored.businessObjectVersion),
          postingInputId: stored.postingInputId,
          postingSequence: BigInt(stored.postingSequence),
          postingStatus: stored.postingStatus,
          retroactive: stored.retroactive,
          replayRequired: stored.replayRequired,
          idempotentReplay: true
        };
      }

      const execution = await trx
        .insertInto('command_execution')
        .values({
          enterprise_id: input.request.enterpriseId,
          application_instance_id: input.request.applicationInstanceId,
          command_definition_id: input.capability.commandDefinitionId,
          actor_type: input.request.actor.type,
          actor_id: input.request.actor.id,
          request_id: input.request.requestId,
          correlation_id: input.request.correlationId,
          causation_id: input.request.causationId ?? null,
          idempotency_scope: input.idempotencyScope,
          idempotency_key: input.request.idempotencyKey,
          input: input.request.input,
          lineage: input.request.lineage === undefined ? null : {
            flowDefinitionId: input.request.lineage.flowDefinitionId,
            flowInstanceKey: input.request.lineage.flowInstanceKey,
            stepCode: input.request.lineage.stepCode,
            ...(input.request.lineage.parentBusinessDataId === undefined ? {} : { parentBusinessDataId: input.request.lineage.parentBusinessDataId }),
            ...(input.request.lineage.relationType === undefined ? {} : { relationType: input.request.lineage.relationType })
          },
          status: 'PROCESSING',
          result: null,
          error: null,
          completed_at: null
        })
        .returning('id')
        .executeTakeFirstOrThrow();

      const businessObjectVersion = await this.allocateBusinessObjectVersion(
        trx,
        input
      );

      const businessData = await trx
        .insertInto('business_data')
        .values({
          enterprise_id: input.request.enterpriseId,
          application_instance_id: input.request.applicationInstanceId,
          command_execution_id: execution.id,
          business_data_type: input.capability.resultingBusinessDataType,
          business_object_key: input.request.businessObjectKey,
          business_object_version: businessObjectVersion,
          effective_at: input.request.effectiveAt,
          metadata_version: input.capability.metadataVersion,
          payload: input.request.input
        })
        .returning('id')
        .executeTakeFirstOrThrow();

      const runtime = await this.lockRuntimeState(
        trx,
        input.request.enterpriseId
      );

      const postingSequence = BigInt(runtime.next_posting_sequence);
      const postingPriority = input.request.postingPriority ?? 0;
      const candidate = {
        effectiveAt: input.request.effectiveAt,
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
          enterprise_id: input.request.enterpriseId,
          consistency_domain: runtime.consistency_domain,
          business_data_id: businessData.id,
          application_instance_id: input.request.applicationInstanceId,
          effective_at: input.request.effectiveAt,
          posting_priority: postingPriority,
          posting_sequence: postingSequence,
          metadata_version: input.capability.metadataVersion,
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
        .where('enterprise_id', '=', input.request.enterpriseId)
        .execute();

      await trx
        .insertInto('outbox_event')
        .values({
          enterprise_id: input.request.enterpriseId,
          event_type: 'business_data.created',
          event_version: 1,
          aggregate_type: 'BusinessData',
          aggregate_id: businessData.id,
          correlation_id: input.request.correlationId,
          causation_id: input.request.causationId ?? execution.id,
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

      const storedResult: JsonObject = {
        businessDataId: businessData.id,
        businessObjectVersion: businessObjectVersion.toString(),
        postingInputId: postingInput.id,
        postingSequence: postingSequence.toString(),
        postingStatus,
        retroactive,
        replayRequired
      };

      await trx
        .updateTable('command_execution')
        .set({
          status: 'COMPLETED',
          result: storedResult,
          completed_at: sql`now()`
        })
        .where('id', '=', execution.id)
        .execute();

      return {
        commandExecutionId: execution.id,
        businessDataId: businessData.id,
        businessObjectVersion,
        postingInputId: postingInput.id,
        postingSequence,
        postingStatus,
        retroactive,
        replayRequired,
        idempotentReplay: false
      };
    });
  }

  private async allocateBusinessObjectVersion(
    trx: DbTransaction,
    input: CommitCommandInput
  ): Promise<bigint> {
    const latest = await trx
      .selectFrom('business_data')
      .select('business_object_version')
      .where('enterprise_id', '=', input.request.enterpriseId)
      .where(
        'application_instance_id',
        '=',
        input.request.applicationInstanceId
      )
      .where('business_object_key', '=', input.request.businessObjectKey)
      .orderBy('business_object_version', 'desc')
      .forUpdate()
      .executeTakeFirst();

    const current =
      latest === undefined ? 0n : BigInt(latest.business_object_version);

    if (
      input.request.expectedBusinessVersion !== undefined &&
      input.request.expectedBusinessVersion !== current
    ) {
      throw new AppError({
        code: 'BUSINESS_VERSION_CONFLICT',
        message: 'Business object version does not match the expected version.',
        module: 'command',
        operation: 'allocateBusinessObjectVersion',
        details: {
          businessObjectKey: input.request.businessObjectKey,
          expectedBusinessVersion:
            input.request.expectedBusinessVersion.toString(),
          actualBusinessVersion: current.toString()
        }
      });
    }

    return current + 1n;
  }

  private async lockRuntimeState(
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
}

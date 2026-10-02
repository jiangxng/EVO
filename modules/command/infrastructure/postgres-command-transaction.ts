import { sql, type Kysely, type Transaction } from 'kysely';
import { AppError } from '../../../platform/contracts/src/index.js';
import type { Database } from '../../../platform/database/src/types.js';
import type { JsonObject } from '../../metadata/api/contracts.js';
import {
  writeBusinessDataAndPostingInputV010
} from '../../business-data/application/atomic-business-data-write.js';
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
          written.postingStatus: 'QUEUED' | 'BLOCKED_REPLAY_REQUIRED';
          written.retroactive: boolean;
          written.replayRequired: boolean;
        };

        return {
          commandExecutionId: existing.id,
          businessDataId: stored.businessDataId,
          businessObjectVersion: BigInt(stored.businessObjectVersion),
          postingInputId: stored.postingInputId,
          postingSequence: BigInt(stored.postingSequence),
          written.postingStatus: stored.written.postingStatus,
          written.retroactive: stored.written.retroactive,
          written.replayRequired: stored.written.replayRequired,
          idempotentReplay: true
        };
      }

      const applicationId = await this.resolveCompatibilityApplicationId(
        trx,
        input.request.enterpriseId,
        input.request.applicationInstanceId
      );

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

      const written = await writeBusinessDataAndPostingInputV010(
        trx,
        {
          enterpriseId: input.request.enterpriseId,
          applicationId,
          legacyApplicationInstanceId: input.request.applicationInstanceId,
          legacyCommandExecutionId: execution.id,
          legacyMetadataVersion: input.capability.metadataVersion,
          businessDataType: input.capability.resultingBusinessDataType,
          businessObjectKey: input.request.businessObjectKey,
          ...(input.request.expectedBusinessVersion === undefined
            ? {}
            : {
                expectedBusinessVersion:
                  input.request.expectedBusinessVersion
              }),
          effectiveAt: input.request.effectiveAt,
          payload: input.request.input,
          ...(input.request.postingPriority === undefined
            ? {}
            : { postingPriority: input.request.postingPriority }),
          correlationId: input.request.correlationId,
          ...(input.request.causationId === undefined
            ? {}
            : { causationId: input.request.causationId })
        }
      );

      const storedResult: JsonObject = {
        businessDataId: written.businessDataId,
        businessObjectVersion: written.businessObjectVersion.toString(),
        postingInputId: written.postingInputId,
        postingSequence: written.postingSequence.toString(),
        written.postingStatus,
        written.retroactive,
        written.replayRequired
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
        businessDataId: written.businessDataId,
        businessObjectVersion: written.businessObjectVersion,
        postingInputId: written.postingInputId,
        postingSequence: written.postingSequence,
        written.postingStatus,
        written.retroactive,
        written.replayRequired,
        idempotentReplay: false
      };
    });
  }

  private async resolveCompatibilityApplicationId(
    trx: DbTransaction,
    enterpriseId: string,
    applicationInstanceId: string
  ): Promise<string> {
    const row = await trx
      .selectFrom('application_instance as ai')
      .innerJoin(
        'application_definition as ad',
        'ad.id',
        'ai.application_definition_id'
      )
      .select([
        'ai.config',
        'ad.code as application_definition_code'
      ])
      .where('ai.id', '=', applicationInstanceId)
      .where('ai.enterprise_id', '=', enterpriseId)
      .executeTakeFirstOrThrow();

    const configured = row.config.sourceApplicationId;
    if (typeof configured === 'string' && configured.trim().length > 0) {
      return configured.trim();
    }

    return row.application_definition_code;
  }


}

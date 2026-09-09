import type { ActorType } from '../../../platform/contracts/src/index.js';
import type { JsonObject } from '../../metadata/api/contracts.js';

export interface CommandActor {
  readonly type: ActorType;
  readonly id: string;
}

export interface ExecuteCommandRequest {
  readonly enterpriseId: string;
  readonly applicationInstanceId: string;
  readonly commandCode: string;
  readonly actor: CommandActor;
  readonly requestId: string;
  readonly correlationId: string;
  readonly causationId?: string;
  readonly idempotencyKey: string;
  readonly input: JsonObject;
  readonly effectiveAt: Date;
  readonly postingPriority?: number;
  readonly businessObjectKey: string;
  readonly expectedBusinessVersion?: bigint;
}

export interface ExecuteCommandResult {
  readonly commandExecutionId: string;
  readonly businessDataId: string;
  readonly businessObjectVersion: bigint;
  readonly postingInputId: string;
  readonly postingSequence: bigint;
  readonly postingStatus: 'QUEUED' | 'BLOCKED_REPLAY_REQUIRED';
  readonly retroactive: boolean;
  readonly replayRequired: boolean;
  readonly idempotentReplay: boolean;
}

export interface CommandCapability {
  readonly commandDefinitionId: string;
  readonly commandCode: string;
  readonly resultingBusinessDataType: string;
  readonly metadataVersion: number;
}

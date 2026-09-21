import type { ActorType } from '../../../platform/contracts/src/index.js';
import type { JsonObject } from '../../metadata/api/contracts.js';

export interface CommandActor { readonly type: ActorType; readonly id: string; }
export interface CommandLineage {
  readonly flowDefinitionId: string; readonly flowInstanceKey: string; readonly stepCode: string;
  readonly parentBusinessDataId?: string;
  readonly relationType?: 'CAUSES' | 'FULFILLS' | 'ALLOCATES_TO' | 'DERIVES_FROM' | 'REFERENCES';
}
export interface ExecuteCommandRequest {
  readonly enterpriseId: string; readonly applicationInstanceId: string; readonly commandCode: string;
  readonly actor: CommandActor; readonly requestId: string; readonly correlationId: string; readonly causationId?: string;
  readonly idempotencyKey: string; readonly input: JsonObject; readonly effectiveAt: Date; readonly postingPriority?: number;
  readonly businessObjectKey: string; readonly expectedBusinessVersion?: bigint; readonly lineage?: CommandLineage;
}
export interface ExecuteCommandResult {
  readonly commandExecutionId: string; readonly businessDataId: string; readonly businessObjectVersion: bigint;
  readonly postingInputId: string; readonly postingSequence: bigint; readonly postingStatus: 'QUEUED' | 'BLOCKED_REPLAY_REQUIRED';
  readonly retroactive: boolean; readonly replayRequired: boolean; readonly idempotentReplay: boolean;
}
export interface CommandCapability {
  readonly commandDefinitionId: string;
  readonly commandCode: string;
  readonly resultingBusinessDataType: string;
  readonly metadataVersion: number;
  /** EVO-owned published schema pinned by metadataVersion. */
  readonly inputSchema: JsonObject;
}

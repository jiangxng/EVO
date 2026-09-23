import type { JsonObject } from '../../metadata/api/contracts.js';
import type { CommandActor, ExecuteCommandResult } from './contracts.js';

export interface InvokePublicCommandRequest {
  readonly enterpriseId: string;
  readonly capabilityCode: string;
  readonly actor: CommandActor;
  readonly requestId: string;
  readonly correlationId: string;
  readonly idempotencyKey: string;
  readonly effectiveAt: Date;
  readonly businessObjectKey: string;
  readonly input: JsonObject;
}

export interface InvokePublicCommandResult {
  readonly capabilityCode: string;
  readonly command: ExecuteCommandResult;
}

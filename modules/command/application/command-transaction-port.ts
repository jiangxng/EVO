import type {
  ExecuteCommandRequest,
  ExecuteCommandResult,
  CommandCapability
} from '../api/contracts.js';

export interface CommitCommandInput {
  readonly request: ExecuteCommandRequest;
  readonly capability: CommandCapability;
  readonly idempotencyScope: string;
}

export interface CommandTransactionPort {
  commit(input: CommitCommandInput): Promise<ExecuteCommandResult>;
}

import type {
  ExecuteCommandRequest,
  ExecuteCommandResult
} from './contracts.js';

export interface CommandExecutor {
  execute(request: ExecuteCommandRequest): Promise<ExecuteCommandResult>;
}

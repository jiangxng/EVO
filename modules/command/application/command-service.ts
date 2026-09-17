import { AppError } from '../../../platform/contracts/src/index.js';
import type { CommandCapabilityResolver } from '../api/command-capability-resolver.js';
import type { CommandExecutor } from '../api/command-executor.js';
import type { ExecuteCommandRequest, ExecuteCommandResult } from '../api/contracts.js';
import type { CommandTransactionPort } from './command-transaction-port.js';
import { validateCommandInput } from './json-schema-input-validator.js';

export class CommandService implements CommandExecutor {
  constructor(private readonly capabilities: CommandCapabilityResolver, private readonly transaction: CommandTransactionPort) {}
  async execute(request: ExecuteCommandRequest): Promise<ExecuteCommandResult> {
    this.validateRequest(request);
    const capability = await this.capabilities.resolve(request.enterpriseId, request.applicationInstanceId, request.commandCode);
    validateCommandInput(request.input, capability.inputSchema);
    const idempotencyScope = [request.actor.type, request.actor.id, request.applicationInstanceId, request.commandCode].join(':');
    return this.transaction.commit({ request, capability, idempotencyScope });
  }
  private validateRequest(request: ExecuteCommandRequest): void {
    if (request.idempotencyKey.trim().length === 0) throw new AppError({ code: 'IDEMPOTENCY_KEY_REQUIRED', message: 'Command idempotency key is required.', module: 'command', operation: 'execute' });
    if (request.businessObjectKey.trim().length === 0) throw new AppError({ code: 'BUSINESS_OBJECT_KEY_REQUIRED', message: 'Business object key is required.', module: 'command', operation: 'execute' });
    if (Number.isNaN(request.effectiveAt.getTime())) throw new AppError({ code: 'INVALID_EFFECTIVE_TIME', message: 'Command effective time is invalid.', module: 'command', operation: 'execute' });
  }
}

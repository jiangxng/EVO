import { AppError } from '../../../platform/contracts/src/index.js';
import type { EffectiveCapabilityDiscovery } from '../../../modules/capability/api/contracts.js';
import type { AuthorizationService } from '../../../modules/identity/api/authorization.js';
import type { CommandExecutor } from '../../../modules/command/api/command-executor.js';
import type { CommandActor, ExecuteCommandResult } from '../../../modules/command/api/contracts.js';
import type { JsonObject } from '../../../modules/metadata/api/contracts.js';

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

export class PublicCommandInvoker {
  constructor(
    private readonly discovery: EffectiveCapabilityDiscovery,
    private readonly authorization: AuthorizationService,
    private readonly commands: CommandExecutor
  ) {}

  async invoke(request: InvokePublicCommandRequest): Promise<InvokePublicCommandResult> {
    const catalog = await this.discovery.listCapabilities(request.enterpriseId);
    const capability = catalog.capabilities.find(
      (item) => item.code === request.capabilityCode
    );

    if (capability === undefined || capability.kind !== 'COMMAND' || capability.commandCode === undefined) {
      throw new AppError({
        code: 'CAPABILITY_NOT_AVAILABLE',
        message: 'The requested command capability is not currently available.',
        module: 'api',
        operation: 'invokePublicCommand',
        details: {
          enterpriseId: request.enterpriseId,
          capabilityCode: request.capabilityCode
        }
      });
    }

    if (capability.permissionCode === undefined) {
      throw new AppError({
        code: 'CAPABILITY_AUTHORIZATION_POLICY_MISSING',
        message: 'The command capability does not declare an authorization policy.',
        module: 'api',
        operation: 'invokePublicCommand',
        details: {
          enterpriseId: request.enterpriseId,
          capabilityCode: request.capabilityCode
        }
      });
    }

    await this.authorization.require({
      enterpriseId: request.enterpriseId,
      actorType: request.actor.type,
      actorId: request.actor.id,
      permissionCode: capability.permissionCode
    });

    const command = await this.commands.execute({
      enterpriseId: request.enterpriseId,
      applicationInstanceId: capability.applicationInstanceId,
      commandCode: capability.commandCode,
      actor: request.actor,
      requestId: request.requestId,
      correlationId: request.correlationId,
      idempotencyKey: request.idempotencyKey,
      input: request.input,
      effectiveAt: request.effectiveAt,
      businessObjectKey: request.businessObjectKey
    });

    return {
      capabilityCode: request.capabilityCode,
      command
    };
  }
}

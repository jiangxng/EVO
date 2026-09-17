import { AppError } from '../../../platform/contracts/src/index.js';
import type { MetadataReader } from '../../metadata/api/metadata-reader.js';
import type { CommandCapabilityResolver } from '../api/command-capability-resolver.js';
import type { CommandCapability } from '../api/contracts.js';

export class MetadataCommandCapabilityResolver implements CommandCapabilityResolver {
  constructor(private readonly metadata: MetadataReader) {}
  async resolve(enterpriseId: string, applicationInstanceId: string, commandCode: string): Promise<CommandCapability> {
    const instance = await this.metadata.getApplicationInstance(enterpriseId, applicationInstanceId);
    if (instance === null || instance.status !== 'ACTIVE') throw new AppError({ code: 'COMMAND_APPLICATION_NOT_AVAILABLE', message: 'Application instance is not available.', module: 'command', operation: 'resolveCommandCapability', details: { enterpriseId, applicationInstanceId } });
    const version = instance.pinnedDefinitionVersion === null
      ? await this.metadata.getPublishedApplicationDefinitionVersion(instance.applicationDefinitionId)
      : await this.metadata.getApplicationDefinitionVersion(instance.applicationDefinitionId, instance.pinnedDefinitionVersion);
    if (version === null || version.status !== 'PUBLISHED') throw new AppError({ code: 'COMMAND_METADATA_NOT_PUBLISHED', message: 'Command metadata is not available from a published definition.', module: 'command', operation: 'resolveCommandCapability', details: { applicationInstanceId, commandCode } });
    const commands = await this.metadata.getCommands(version.id);
    const command = commands.find((item) => item.code === commandCode);
    if (command === undefined) throw new AppError({ code: 'COMMAND_NOT_FOUND', message: 'Command is not defined for this application.', module: 'command', operation: 'resolveCommandCapability', details: { applicationInstanceId, commandCode } });
    return { commandDefinitionId: command.id, commandCode: command.code, resultingBusinessDataType: command.resultingBusinessDataType, metadataVersion: version.version, inputSchema: command.inputSchema };
  }
}

import { createHash } from 'node:crypto';
import { AppError } from '../../../platform/contracts/src/index.js';
import type { MetadataReader } from '../../metadata/api/metadata-reader.js';
import { EffectiveDefinitionResolver } from '../../metadata/application/effective-definition-resolver.js';
import type {
  EffectiveApplicationCatalog,
  EffectiveApplicationSummary,
  EffectiveCapability,
  EffectiveCapabilityCatalog,
  EffectiveCapabilityDiscovery
} from '../api/contracts.js';

function stableCapabilitySetVersion(
  enterpriseId: string,
  capabilities: readonly EffectiveCapability[]
): string {
  const canonical = JSON.stringify({
    enterpriseId,
    capabilities: capabilities.map((capability) => ({
      code: capability.code,
      kind: capability.kind,
      applicationCode: capability.applicationCode,
      applicationInstanceId: capability.applicationInstanceId,
      applicationVersion: capability.applicationVersion,
      contractVersion: capability.contractVersion,
      commandCode: capability.commandCode ?? null,
      resultingBusinessDataType: capability.resultingBusinessDataType ?? null
    }))
  });

  return `sha256:${createHash('sha256').update(canonical).digest('hex')}`;
}

export class DefaultEffectiveCapabilityDiscovery
  implements EffectiveCapabilityDiscovery
{
  private readonly resolver: EffectiveDefinitionResolver;

  constructor(private readonly metadata: MetadataReader) {
    this.resolver = new EffectiveDefinitionResolver(metadata);
  }

  async listApplications(
    enterpriseId: string
  ): Promise<EffectiveApplicationCatalog> {
    await this.requireActiveEnterprise(enterpriseId);
    const instances = await this.metadata.listApplicationInstances(enterpriseId);

    const applications: EffectiveApplicationSummary[] = [];
    for (const instance of instances) {
      if (instance.status !== 'ACTIVE') continue;

      const [application, effective] = await Promise.all([
        this.metadata.getApplicationDefinition(instance.applicationDefinitionId),
        this.resolver.resolve(enterpriseId, instance.id)
      ]);

      if (application === null) {
        throw new AppError({
          code: 'APPLICATION_DEFINITION_NOT_FOUND',
          message: 'Application definition was not found for an active application instance.',
          module: 'capability',
          operation: 'listApplications',
          details: {
            enterpriseId,
            applicationInstanceId: instance.id,
            applicationDefinitionId: instance.applicationDefinitionId
          }
        });
      }

      applications.push({
        applicationCode: application.code,
        applicationName: application.name,
        applicationInstanceId: instance.id,
        instanceCode: instance.code,
        instanceName: instance.name,
        status: 'ACTIVE',
        definitionVersion: effective.definitionVersion,
        schemaVersion: effective.schemaVersion
      });
    }

    applications.sort((a, b) =>
      a.applicationCode.localeCompare(b.applicationCode) ||
      a.instanceCode.localeCompare(b.instanceCode) ||
      a.applicationInstanceId.localeCompare(b.applicationInstanceId)
    );

    return { enterpriseId, applications };
  }

  async listCapabilities(
    enterpriseId: string
  ): Promise<EffectiveCapabilityCatalog> {
    await this.requireActiveEnterprise(enterpriseId);
    const instances = await this.metadata.listApplicationInstances(enterpriseId);

    const capabilities: EffectiveCapability[] = [];
    for (const instance of instances) {
      if (instance.status !== 'ACTIVE') continue;

      const [application, effective] = await Promise.all([
        this.metadata.getApplicationDefinition(instance.applicationDefinitionId),
        this.resolver.resolve(enterpriseId, instance.id)
      ]);

      if (application === null) {
        throw new AppError({
          code: 'APPLICATION_DEFINITION_NOT_FOUND',
          message: 'Application definition was not found for an active application instance.',
          module: 'capability',
          operation: 'listCapabilities',
          details: {
            enterpriseId,
            applicationInstanceId: instance.id,
            applicationDefinitionId: instance.applicationDefinitionId
          }
        });
      }

      for (const command of effective.commands) {
        capabilities.push({
          code: `${application.code}.${command.code}`,
          kind: 'COMMAND',
          applicationCode: application.code,
          applicationName: application.name,
          applicationInstanceId: instance.id,
          applicationVersion: effective.definitionVersion,
          contractVersion: String(effective.schemaVersion),
          commandCode: command.code,
          inputSchema: command.inputSchema as Readonly<Record<string, unknown>>,
          resultingBusinessDataType: command.resultingBusinessDataType
        });
      }
    }

    capabilities.sort((a, b) =>
      a.code.localeCompare(b.code) ||
      a.applicationInstanceId.localeCompare(b.applicationInstanceId)
    );

    return {
      enterpriseId,
      source: 'COMMAND_DEFINITION_BOOTSTRAP',
      capabilitySetVersion: stableCapabilitySetVersion(
        enterpriseId,
        capabilities
      ),
      capabilities
    };
  }

  private async requireActiveEnterprise(enterpriseId: string): Promise<void> {
    const enterprise = await this.metadata.getEnterprise(enterpriseId);

    if (enterprise === null) {
      throw new AppError({
        code: 'ENTERPRISE_NOT_FOUND',
        message: 'Enterprise was not found.',
        module: 'capability',
        operation: 'discoverCapabilities',
        details: { enterpriseId }
      });
    }

    if (enterprise.status !== 'ACTIVE') {
      throw new AppError({
        code: 'ENTERPRISE_NOT_ACTIVE',
        message: 'Enterprise is not active.',
        module: 'capability',
        operation: 'discoverCapabilities',
        details: { enterpriseId, status: enterprise.status }
      });
    }
  }
}

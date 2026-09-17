import { AppError } from '../../../platform/contracts/src/index.js';
import type {
  EffectiveApplicationDefinition
} from '../api/contracts.js';
import type { MetadataReader } from '../api/metadata-reader.js';
import { mergeJsonObjects } from '../domain/json-merge.js';

export class EffectiveDefinitionResolver {
  constructor(private readonly reader: MetadataReader) {}

  async resolve(
    enterpriseId: string,
    applicationInstanceId: string
  ): Promise<EffectiveApplicationDefinition> {
    const instance = await this.reader.getApplicationInstance(
      enterpriseId,
      applicationInstanceId
    );

    if (instance === null) {
      throw new AppError({
        code: 'APPLICATION_INSTANCE_NOT_FOUND',
        message: 'Application instance was not found for this enterprise.',
        module: 'metadata',
        operation: 'resolveEffectiveDefinition',
        details: { enterpriseId, applicationInstanceId }
      });
    }

    if (instance.status !== 'ACTIVE') {
      throw new AppError({
        code: 'APPLICATION_INSTANCE_NOT_ACTIVE',
        message: 'Application instance is not active.',
        module: 'metadata',
        operation: 'resolveEffectiveDefinition',
        details: {
          enterpriseId,
          applicationInstanceId,
          status: instance.status
        }
      });
    }

    const definition =
      instance.pinnedDefinitionVersion === null
        ? await this.reader.getPublishedApplicationDefinitionVersion(
            instance.applicationDefinitionId
          )
        : await this.reader.getApplicationDefinitionVersion(
            instance.applicationDefinitionId,
            instance.pinnedDefinitionVersion
          );

    if (definition === null || definition.status !== 'PUBLISHED') {
      throw new AppError({
        code: 'PUBLISHED_APPLICATION_DEFINITION_NOT_FOUND',
        message: 'No usable published application definition version exists.',
        module: 'metadata',
        operation: 'resolveEffectiveDefinition',
        details: {
          applicationDefinitionId: instance.applicationDefinitionId,
          pinnedDefinitionVersion: instance.pinnedDefinitionVersion
        }
      });
    }

    const overlay = await this.reader.getPublishedOverlay(instance.id);

    if (
      overlay !== null &&
      overlay.baseDefinitionVersion !== definition.version
    ) {
      throw new AppError({
        code: 'OVERLAY_BASE_VERSION_MISMATCH',
        message: 'Published overlay targets a different base definition version.',
        module: 'metadata',
        operation: 'resolveEffectiveDefinition',
        details: {
          applicationInstanceId: instance.id,
          definitionVersion: definition.version,
          overlayBaseDefinitionVersion: overlay.baseDefinitionVersion,
          overlayVersion: overlay.overlayVersion
        }
      });
    }

    const effectiveConfig =
      overlay === null
        ? mergeJsonObjects(definition.baseConfig, instance.config)
        : mergeJsonObjects(
            mergeJsonObjects(definition.baseConfig, instance.config),
            overlay.patch
          );

    const [fields, commands, postingRules] = await Promise.all([
      this.reader.getFields(definition.id),
      this.reader.getCommands(definition.id),
      this.reader.getPostingRules(definition.id)
    ]);

    return {
      enterpriseId,
      applicationInstanceId: instance.id,
      applicationDefinitionId: instance.applicationDefinitionId,
      definitionVersion: definition.version,
      schemaVersion: definition.schemaVersion,
      effectiveConfig,
      fields,
      commands,
      postingRules,
      overlayVersion: overlay?.overlayVersion ?? null,
      definitionHash: definition.definitionHash,
      overlayHash: overlay?.overlayHash ?? null
    };
  }
}

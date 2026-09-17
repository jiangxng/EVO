import { AppError } from '../../../platform/contracts/src/index.js';
import type {
  CreateApplicationSkeletonInput,
  CreateApplicationVersionInput,
  CreateEnterpriseInput,
  MetadataWriter
} from '../api/metadata-writer.js';

export class MetadataService {
  constructor(private readonly writer: MetadataWriter) {}

  async createEnterprise(input: CreateEnterpriseInput): Promise<string> {
    if (input.code.trim().length === 0 || input.name.trim().length === 0) {
      throw new AppError({
        code: 'INVALID_ENTERPRISE_METADATA',
        message: 'Enterprise code and name are required.',
        module: 'metadata',
        operation: 'createEnterprise'
      });
    }
    return this.writer.createEnterprise(input);
  }

  createApplicationSkeleton(
    input: CreateApplicationSkeletonInput
  ): Promise<string> {
    return this.writer.createApplicationSkeleton(input);
  }

  async createApplicationVersion(
    input: CreateApplicationVersionInput
  ): Promise<string> {
    if (!Number.isInteger(input.version) || input.version <= 0) {
      throw new AppError({
        code: 'INVALID_APPLICATION_VERSION',
        message: 'Application definition version must be a positive integer.',
        module: 'metadata',
        operation: 'createApplicationVersion'
      });
    }
    return this.writer.createApplicationVersion(input);
  }

  publishApplicationVersion(
    applicationDefinitionId: string,
    version: number
  ): Promise<void> {
    return this.writer.publishApplicationVersion(
      applicationDefinitionId,
      version
    );
  }
}

import { describe, expect, it } from 'vitest';
import { MetadataService } from '../application/metadata-service.js';
import type {
  CreateApplicationSkeletonInput,
  CreateApplicationVersionInput,
  CreateEnterpriseInput,
  MetadataWriter
} from '../api/metadata-writer.js';

class FakeWriter implements MetadataWriter {
  async createEnterprise(_input: CreateEnterpriseInput): Promise<string> {
    return 'enterprise-id';
  }
  async createApplicationSkeleton(
    _input: CreateApplicationSkeletonInput
  ): Promise<string> {
    return 'application-id';
  }
  async createApplicationVersion(
    _input: CreateApplicationVersionInput
  ): Promise<string> {
    return 'version-id';
  }
  async publishApplicationVersion(): Promise<void> {}
}

describe('MetadataService', () => {
  it('rejects an invalid application version before persistence', async () => {
    const service = new MetadataService(new FakeWriter());

    await expect(
      service.createApplicationVersion({
        applicationDefinitionId: 'a1',
        version: 0
      })
    ).rejects.toMatchObject({
      code: 'INVALID_APPLICATION_VERSION'
    });
  });

  it('creates a valid enterprise through the interface', async () => {
    const service = new MetadataService(new FakeWriter());

    await expect(
      service.createEnterprise({
        code: 'ACME',
        name: 'ACME'
      })
    ).resolves.toBe('enterprise-id');
  });
});

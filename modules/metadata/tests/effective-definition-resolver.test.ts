import { describe, expect, it } from 'vitest';
import { EffectiveDefinitionResolver } from '../application/effective-definition-resolver.js';
import type {
  ApplicationDefinition,
  ApplicationDefinitionVersion,
  ApplicationInstance,
  CommandDefinition,
  Enterprise,
  EnterpriseApplicationOverlay,
  FieldDefinition,
  PostingRuleDefinition
} from '../api/contracts.js';
import type { MetadataReader } from '../api/metadata-reader.js';

class FakeMetadataReader implements MetadataReader {
  enterprise: Enterprise | null = {
    id: 'e1',
    code: 'ACME',
    name: 'ACME',
    status: 'ACTIVE',
    defaultTimezone: 'Asia/Singapore'
  };

  instance: ApplicationInstance | null = {
    id: 'i1',
    enterpriseId: 'e1',
    applicationDefinitionId: 'a1',
    code: 'sales',
    name: 'Sales',
    pinnedDefinitionVersion: null,
    status: 'ACTIVE',
    config: { ui: { density: 'compact' } }
  };

  definition: ApplicationDefinitionVersion | null = {
    id: 'av1',
    applicationDefinitionId: 'a1',
    version: 1,
    schemaVersion: 1,
    status: 'PUBLISHED',
    baseConfig: {
      ui: { density: 'comfortable', currency: 'USD' },
      behavior: { approval: true }
    },
    definitionHash: 'base-hash'
  };

  overlay: EnterpriseApplicationOverlay | null = {
    id: 'o1',
    enterpriseId: 'e1',
    applicationInstanceId: 'i1',
    baseDefinitionVersion: 1,
    overlayVersion: 2,
    status: 'PUBLISHED',
    patch: {
      ui: { currency: 'SGD' }
    },
    overlayHash: 'overlay-hash'
  };

  fields: readonly FieldDefinition[] = [];
  commands: readonly CommandDefinition[] = [];
  postingRules: readonly PostingRuleDefinition[] = [];

  async getEnterprise(): Promise<Enterprise | null> {
    return this.enterprise;
  }
  async getApplicationDefinition(): Promise<ApplicationDefinition | null> {
    return {
      id: 'a1',
      code: 'sales_order',
      name: 'Sales Order',
      description: null
    };
  }
  async listApplicationInstances(): Promise<readonly ApplicationInstance[]> {
    return this.instance === null ? [] : [this.instance];
  }
  async getApplicationInstance(): Promise<ApplicationInstance | null> {
    return this.instance;
  }
  async getPublishedApplicationDefinitionVersion(): Promise<ApplicationDefinitionVersion | null> {
    return this.definition;
  }
  async getApplicationDefinitionVersion(): Promise<ApplicationDefinitionVersion | null> {
    return this.definition;
  }
  async getPublishedOverlay(): Promise<EnterpriseApplicationOverlay | null> {
    return this.overlay;
  }
  async getFields(): Promise<readonly FieldDefinition[]> {
    return this.fields;
  }
  async getCommands(): Promise<readonly CommandDefinition[]> {
    return this.commands;
  }
  async getPostingRules(): Promise<readonly PostingRuleDefinition[]> {
    return this.postingRules;
  }
}

describe('EffectiveDefinitionResolver', () => {
  it('resolves base + instance config + enterprise overlay deterministically', async () => {
    const reader = new FakeMetadataReader();
    const resolver = new EffectiveDefinitionResolver(reader);

    const effective = await resolver.resolve('e1', 'i1');

    expect(effective.definitionVersion).toBe(1);
    expect(effective.overlayVersion).toBe(2);
    expect(effective.effectiveConfig).toEqual({
      ui: {
        density: 'compact',
        currency: 'SGD'
      },
      behavior: {
        approval: true
      }
    });
  });

  it('rejects an overlay published against another base version', async () => {
    const reader = new FakeMetadataReader();
    reader.overlay = {
      ...reader.overlay!,
      baseDefinitionVersion: 2
    };

    const resolver = new EffectiveDefinitionResolver(reader);

    await expect(resolver.resolve('e1', 'i1')).rejects.toMatchObject({
      code: 'OVERLAY_BASE_VERSION_MISMATCH'
    });
  });
});

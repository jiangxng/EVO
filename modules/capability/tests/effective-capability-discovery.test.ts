import { describe, expect, it } from 'vitest';
import type {
  ApplicationDefinition,
  ApplicationDefinitionVersion,
  ApplicationInstance,
  CommandDefinition,
  Enterprise,
  EnterpriseApplicationOverlay,
  FieldDefinition,
  PostingRuleDefinition
} from '../../metadata/api/contracts.js';
import type { MetadataReader } from '../../metadata/api/metadata-reader.js';
import { DefaultEffectiveCapabilityDiscovery } from '../application/effective-capability-discovery.js';

class FakeMetadataReader implements MetadataReader {
  constructor(
    private readonly instances: readonly ApplicationInstance[]
  ) {}

  async getEnterprise(enterpriseId: string): Promise<Enterprise | null> {
    return {
      id: enterpriseId,
      code: 'E1',
      name: 'Enterprise 1',
      status: 'ACTIVE',
      defaultTimezone: 'UTC'
    };
  }

  async getApplicationDefinition(
    applicationDefinitionId: string
  ): Promise<ApplicationDefinition | null> {
    const definitions: Record<string, ApplicationDefinition> = {
      salesDef: {
        id: 'salesDef',
        code: 'sales_order',
        name: 'Sales Order',
        description: null
      },
      paymentDef: {
        id: 'paymentDef',
        code: 'supplier_payment',
        name: 'Supplier Payment',
        description: null
      }
    };
    return definitions[applicationDefinitionId] ?? null;
  }

  async listApplicationInstances(): Promise<readonly ApplicationInstance[]> {
    return this.instances;
  }

  async getApplicationInstance(
    enterpriseId: string,
    applicationInstanceId: string
  ): Promise<ApplicationInstance | null> {
    return this.instances.find(
      (x) => x.enterpriseId === enterpriseId && x.id === applicationInstanceId
    ) ?? null;
  }

  async getPublishedApplicationDefinitionVersion(
    applicationDefinitionId: string
  ): Promise<ApplicationDefinitionVersion | null> {
    return {
      id: `${applicationDefinitionId}:v1`,
      applicationDefinitionId,
      version: 1,
      schemaVersion: 1,
      status: 'PUBLISHED',
      baseConfig: {},
      definitionHash: 'v1'
    };
  }

  async getApplicationDefinitionVersion(
    applicationDefinitionId: string,
    version: number
  ): Promise<ApplicationDefinitionVersion | null> {
    return {
      id: `${applicationDefinitionId}:v${version}`,
      applicationDefinitionId,
      version,
      schemaVersion: 1,
      status: 'PUBLISHED',
      baseConfig: {},
      definitionHash: `v${version}`
    };
  }

  async getPublishedOverlay(): Promise<EnterpriseApplicationOverlay | null> {
    return null;
  }

  async getFields(): Promise<readonly FieldDefinition[]> {
    return [];
  }

  async getCommands(
    applicationDefinitionVersionId: string
  ): Promise<readonly CommandDefinition[]> {
    if (applicationDefinitionVersionId.startsWith('salesDef:')) {
      return [
        {
          id: 'approve',
          code: 'approve-sales-order',
          name: 'Approve Sales Order',
          inputSchema: { type: 'object' },
          preconditions: [],
          executionPolicy: {},
          resultingBusinessDataType: 'sales_order.approved',
          config: {}
        }
      ];
    }
    return [
      {
        id: 'pay',
        code: 'record-payment',
        name: 'Record Payment',
        inputSchema: { type: 'object' },
        preconditions: [],
        executionPolicy: {},
        resultingBusinessDataType: 'supplier_payment.recorded',
        config: {}
      }
    ];
  }

  async getPostingRules(): Promise<readonly PostingRuleDefinition[]> {
    return [];
  }
}

const sales: ApplicationInstance = {
  id: 'sales-instance',
  enterpriseId: 'ent-1',
  applicationDefinitionId: 'salesDef',
  code: 'sales',
  name: 'Sales',
  pinnedDefinitionVersion: 1,
  status: 'ACTIVE',
  config: {}
};

const paymentDisabled: ApplicationInstance = {
  id: 'payment-instance',
  enterpriseId: 'ent-1',
  applicationDefinitionId: 'paymentDef',
  code: 'payment',
  name: 'Payment',
  pinnedDefinitionVersion: 1,
  status: 'DISABLED',
  config: {}
};

describe('DefaultEffectiveCapabilityDiscovery', () => {
  it('exposes commands only from effective active applications', async () => {
    const discovery = new DefaultEffectiveCapabilityDiscovery(
      new FakeMetadataReader([paymentDisabled, sales])
    );

    const apps = await discovery.listApplications('ent-1');
    const capabilities = await discovery.listCapabilities('ent-1');

    expect(apps.applications.map((x) => x.applicationCode)).toEqual([
      'sales_order'
    ]);
    expect(capabilities.capabilities.map((x) => x.code)).toEqual([
      'sales_order.approve-sales-order'
    ]);
    expect(capabilities.capabilities[0]?.commandCode).toBe(
      'approve-sales-order'
    );
    expect(capabilities.source).toBe('COMMAND_DEFINITION_BOOTSTRAP');
  });

  it('produces deterministic capability set identity', async () => {
    const first = new DefaultEffectiveCapabilityDiscovery(
      new FakeMetadataReader([sales])
    );
    const second = new DefaultEffectiveCapabilityDiscovery(
      new FakeMetadataReader([sales])
    );

    expect(
      (await first.listCapabilities('ent-1')).capabilitySetVersion
    ).toBe(
      (await second.listCapabilities('ent-1')).capabilitySetVersion
    );
  });
});

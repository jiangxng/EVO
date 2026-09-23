import { describe, expect, it, vi } from 'vitest';
import { PublicCommandInvoker } from '../src/public-command-invoker.js';
import type { EffectiveCapabilityDiscovery } from '../../../modules/capability/api/contracts.js';
import type { AuthorizationService } from '../../../modules/identity/api/authorization.js';
import type { CommandExecutor } from '../../../modules/command/api/command-executor.js';

function discovery(permissionCode: string | undefined): EffectiveCapabilityDiscovery {
  return {
    async listApplications() {
      return { enterpriseId: 'ent-1', applications: [] };
    },
    async listCapabilities() {
      return {
        enterpriseId: 'ent-1',
        source: 'COMMAND_DEFINITION_BOOTSTRAP',
        capabilitySetVersion: 'sha256:test',
        capabilities: [{
          code: 'sales_order.approve-sales-order',
          kind: 'COMMAND',
          applicationCode: 'sales_order',
          applicationName: 'Sales Order',
          applicationInstanceId: 'sales-instance',
          applicationVersion: 1,
          contractVersion: '1',
          commandCode: 'approve-sales-order',
          inputSchema: { type: 'object' },
          resultingBusinessDataType: 'sales_order.approved',
          ...(permissionCode === undefined ? {} : { permissionCode })
        }]
      };
    }
  };
}

describe('PublicCommandInvoker', () => {
  it('authorizes metadata-declared permission then invokes governed Command', async () => {
    const requirePermission = vi.fn(async () => undefined);
    const execute = vi.fn(async () => ({
      commandExecutionId: 'cmd-1',
      businessDataId: 'bd-1',
      businessObjectVersion: 1n,
      postingInputId: 'pi-1',
      postingSequence: 1n,
      postingStatus: 'QUEUED' as const,
      retroactive: false,
      replayRequired: false,
      idempotentReplay: false
    }));

    const invoker = new PublicCommandInvoker(
      discovery('sales.approve'),
      { require: requirePermission } satisfies AuthorizationService,
      { execute } satisfies CommandExecutor
    );

    const result = await invoker.invoke({
      enterpriseId: 'ent-1',
      capabilityCode: 'sales_order.approve-sales-order',
      actor: { type: 'AI', id: 'demo-agent' },
      requestId: 'req-1',
      correlationId: 'O2C:SO-1',
      idempotencyKey: 'approve:SO-1',
      effectiveAt: new Date('2026-09-23T00:00:00Z'),
      businessObjectKey: 'SO-1',
      input: { orderNo: 'SO-1' }
    });

    expect(requirePermission).toHaveBeenCalledWith({
      enterpriseId: 'ent-1',
      actorType: 'AI',
      actorId: 'demo-agent',
      permissionCode: 'sales.approve'
    });
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({
      enterpriseId: 'ent-1',
      applicationInstanceId: 'sales-instance',
      commandCode: 'approve-sales-order',
      businessObjectKey: 'SO-1'
    }));
    expect(result.command.businessDataId).toBe('bd-1');
  });

  it('fails closed when capability lacks authorization metadata', async () => {
    const invoker = new PublicCommandInvoker(
      discovery(undefined),
      { require: vi.fn() } satisfies AuthorizationService,
      { execute: vi.fn() } satisfies CommandExecutor
    );

    await expect(invoker.invoke({
      enterpriseId: 'ent-1',
      capabilityCode: 'sales_order.approve-sales-order',
      actor: { type: 'AI', id: 'demo-agent' },
      requestId: 'req-1',
      correlationId: 'O2C:SO-1',
      idempotencyKey: 'approve:SO-1',
      effectiveAt: new Date('2026-09-23T00:00:00Z'),
      businessObjectKey: 'SO-1',
      input: { orderNo: 'SO-1' }
    })).rejects.toMatchObject({
      code: 'CAPABILITY_AUTHORIZATION_POLICY_MISSING'
    });
  });
});

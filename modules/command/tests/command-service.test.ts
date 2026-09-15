import { describe, expect, it } from 'vitest';
import { CommandService } from '../application/command-service.js';
import type { CommandCapabilityResolver } from '../api/command-capability-resolver.js';
import type { CommandCapability } from '../api/contracts.js';
import type {
  CommandTransactionPort,
  CommitCommandInput
} from '../application/command-transaction-port.js';

class FakeCapabilities implements CommandCapabilityResolver {
  async resolve(): Promise<CommandCapability> {
    return {
      commandDefinitionId: 'cd1',
      commandCode: 'approve',
      resultingBusinessDataType: 'sales_order_approved',
      metadataVersion: 1,
      inputSchemaVersion: 1,
      inputSchema: {
        type: 'object',
        required: ['orderNo'],
        additionalProperties: false,
        properties: {
          orderNo: { type: 'string', minLength: 1 }
        }
      }
    };
  }
}

class FakeTransaction implements CommandTransactionPort {
  lastInput: CommitCommandInput | undefined;

  async commit(input: CommitCommandInput) {
    this.lastInput = input;
    return {
      commandExecutionId: 'ce1',
      businessDataId: 'bd1',
      businessObjectVersion: 1n,
      postingInputId: 'pi1',
      postingSequence: 1n,
      postingStatus: 'QUEUED' as const,
      retroactive: false,
      replayRequired: false,
      idempotentReplay: false
    };
  }
}

describe('CommandService', () => {
  it('uses actor/application/command as part of idempotency scope', async () => {
    const transaction = new FakeTransaction();
    const service = new CommandService(new FakeCapabilities(), transaction);

    await service.execute({
      enterpriseId: 'e1', applicationInstanceId: 'a1', commandCode: 'approve',
      actor: { type: 'AI', id: 'agent-1' }, requestId: 'r1', correlationId: 'c1',
      idempotencyKey: 'idem-1', input: { orderNo: 'SO-1' },
      effectiveAt: new Date('2026-09-09T10:00:00Z'), businessObjectKey: 'SO-1'
    });

    expect(transaction.lastInput?.idempotencyScope).toBe('AI:agent-1:a1:approve');
  });

  it('rejects missing idempotency keys before persistence', async () => {
    const service = new CommandService(new FakeCapabilities(), new FakeTransaction());
    await expect(service.execute({
      enterpriseId: 'e1', applicationInstanceId: 'a1', commandCode: 'approve',
      actor: { type: 'HUMAN', id: 'u1' }, requestId: 'r1', correlationId: 'c1',
      idempotencyKey: ' ', input: {}, effectiveAt: new Date(), businessObjectKey: 'SO-1'
    })).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
  });

  it('rejects input that violates the EVO-published schema before persistence', async () => {
    const transaction = new FakeTransaction();
    const service = new CommandService(new FakeCapabilities(), transaction);
    await expect(service.execute({
      enterpriseId: 'e1', applicationInstanceId: 'a1', commandCode: 'approve',
      actor: { type: 'HUMAN', id: 'u1' }, requestId: 'r2', correlationId: 'c2',
      idempotencyKey: 'idem-2', input: { unexpected: true },
      effectiveAt: new Date('2026-09-15T00:00:00Z'), businessObjectKey: 'SO-2'
    })).rejects.toMatchObject({ code: 'COMMAND_INPUT_SCHEMA_INVALID' });
    expect(transaction.lastInput).toBeUndefined();
  });
});

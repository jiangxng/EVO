import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('atomic BusinessData write core convergence', () => {
  it('keeps BusinessData + PostingInput insertion in one reusable core', async () => {
    const core = await readFile(
      'modules/business-data/application/atomic-business-data-write.ts',
      'utf8'
    );
    expect(core).toContain(".insertInto('business_data')");
    expect(core).toContain(".insertInto('posting_input')");
    expect(core).toContain(".insertInto('outbox_event')");
    expect(core).toContain('isRetroactivePostingInput');
    expect(core).toContain(".forUpdate()");
  });

  it('routes the legacy Command adapter through the shared core', async () => {
    const command = await readFile(
      'modules/command/infrastructure/postgres-command-transaction.ts',
      'utf8'
    );
    expect(command).toContain('writeBusinessDataAndPostingInputV010');
    expect(command).not.toContain(".insertInto('business_data')");
    expect(command).not.toContain(".insertInto('posting_input')");
    expect(command).not.toContain(".insertInto('outbox_event')");
  });

  it('versions BusinessData by exact applicationId rather than legacy application instance', async () => {
    const core = await readFile(
      'modules/business-data/application/atomic-business-data-write.ts',
      'utf8'
    );
    expect(core).toContain(".where('application_id', '=', input.applicationId)");
    expect(core).not.toContain(
      ".where('application_instance_id', '=', input.legacyApplicationInstanceId)"
    );
  });
});

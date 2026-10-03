import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import type { BusinessDataSubmissionV010 } from '../api/contracts.js';
import {
  businessDataSubmissionRequestDigestV010
} from '../infrastructure/postgres-business-data-submission.js';

function request(payload: Record<string, unknown>): BusinessDataSubmissionV010 {
  return {
    contractVersion: '0.1.0',
    scopeKey: 'enterprise:demo',
    applicationId: 'trading-lite',
    businessDataType: 'sales.order',
    businessObjectKey: 'SO-1001',
    effectiveAt: new Date('2026-10-03T00:00:00.000Z'),
    payload,
    correlationId: 'corr-1',
    idempotencyKey: 'idem-1'
  };
}

describe('direct BusinessDataSubmission convergence', () => {
  it('uses deterministic request digests independent of JSON key order', () => {
    expect(
      businessDataSubmissionRequestDigestV010(
        request({ amount: '100.00', quantity: 2 })
      )
    ).toBe(
      businessDataSubmissionRequestDigestV010(
        request({ quantity: 2, amount: '100.00' })
      )
    );
  });

  it('keeps direct submission independent from the Command module', async () => {
    const source = await readFile(
      'modules/business-data/infrastructure/postgres-business-data-submission.ts',
      'utf8'
    );
    expect(source).toContain('writeBusinessDataAndPostingInputV010');
    expect(source).toContain('business_data_submission_receipt');
    expect(source).not.toContain("modules/command");
    expect(source).not.toContain("../../command/");
    expect(source).not.toContain('CommandExecution');
  });

  it('relaxes only legacy provenance while preserving canonical applicationId routing', async () => {
    const migration = await readFile(
      'migrations/schema/202610030030_direct_business_data_submission.sql',
      'utf8'
    );
    expect(migration).toContain(
      'alter column application_instance_id drop not null'
    );
    expect(migration).toContain(
      'alter column command_execution_id drop not null'
    );
    expect(migration).toContain('alter column metadata_version drop not null');
    expect(migration).toContain(
      'uq_business_data_application_object_version'
    );
    expect(migration).not.toContain(
      'alter column application_id drop not null'
    );
  });
});

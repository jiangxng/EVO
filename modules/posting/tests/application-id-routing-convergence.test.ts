import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('PostingRule applicationId routing convergence', () => {
  it('routes normal PostingService by exact applicationId', async () => {
    const source = await readFile(
      'modules/posting/application/posting-service.ts',
      'utf8'
    );
    expect(source).toContain(
      'candidate.applicationId,\n        candidate.metadataVersion'
    );
    expect(source).not.toContain('candidate.applicationDefinitionId');
  });

  it('routes replay directly from posting_input.application_id', async () => {
    const source = await readFile(
      'modules/posting/infrastructure/postgres-candidate-posting-replay-service.ts',
      'utf8'
    );
    expect(source).toContain("'p.application_id'");
    expect(source).toContain(
      'row.application_id,\n        row.metadata_version'
    );
    expect(source).not.toContain("innerJoin('application_instance");
  });

  it('keeps zero-rule applications valid', async () => {
    const source = await readFile(
      'modules/metadata/infrastructure/postgres-posting-metadata-reader.ts',
      'utf8'
    );
    expect(source).not.toContain('POSTING_METADATA_VERSION_NOT_FOUND');
    expect(source).toContain('postingRules');
  });

  it('fails migration on ambiguous legacy runtime application ids', async () => {
    const migration = await readFile(
      'migrations/schema/202610030010_posting_rule_application_id.sql',
      'utf8'
    );
    expect(migration).toContain(
      'CORE_MIN_POSTING_RULE_APPLICATION_ID_AMBIGUOUS'
    );
    expect(migration).toContain(
      'alter column application_id set not null'
    );
  });
});

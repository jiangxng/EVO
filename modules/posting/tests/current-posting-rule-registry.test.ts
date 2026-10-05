import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('current executable PostingRule registry convergence', () => {
  it('normal posting reads current rules by exact applicationId only', async () => {
    const service = await readFile(
      'modules/posting/application/posting-service.ts',
      'utf8'
    );
    expect(service).toContain('loadCurrentPostingRules');
    expect(service).toContain('enterpriseId');
    expect(service).toContain('candidate.applicationId');
    expect(service).not.toContain('candidate.metadataVersion');
  });

  it('candidate replay preserves versioned compatibility reader', async () => {
    const replay = await readFile(
      'modules/posting/infrastructure/postgres-candidate-posting-replay-service.ts',
      'utf8'
    );
    expect(replay).toContain('loadPostingMetadata');
    expect(replay).toContain('row.metadata_version');
  });

  it('current registry has no ApplicationDefinitionVersion foreign key', async () => {
    const migration = await readFile(
      'migrations/schema/202610030020_current_posting_rule_registry.sql',
      'utf8'
    );
    expect(migration).toContain('create table if not exists current_posting_rule');
    expect(migration).toContain('application_id text not null');
    expect(migration).not.toContain(
      'current_posting_rule (\n  application_definition_version_id'
    );
    expect(migration).toContain('CORE_MIN_CURRENT_POSTING_RULE_AMBIGUOUS');

    const enterpriseScopeMigration = await readFile(
      'migrations/schema/202610050010_current_posting_rule_enterprise_scope.sql',
      'utf8'
    );
    expect(enterpriseScopeMigration).toContain('enterprise_id');
    expect(enterpriseScopeMigration).toContain(
      'uq_current_posting_rule_enterprise_application_code'
    );
  });

  it('legacy writers dual-write current executable rules during convergence', async () => {
    const configurator = await readFile(
      'apps/api/src/configurator-mvp.ts',
      'utf8'
    );
    const seed = await readFile('scripts/seed-demo.ts', 'utf8');
    expect(configurator).toContain("insertInto('current_posting_rule')");
    expect(seed).toContain("insertInto('current_posting_rule')");
  });
});

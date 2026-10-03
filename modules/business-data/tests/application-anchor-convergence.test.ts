import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('minimal ApplicationAnchor convergence', () => {
  it('keeps ApplicationAnchor as a minimal applicationId-only contract', async () => {
    const source = await readFile(
      'modules/business-data/api/application-anchor.ts',
      'utf8'
    );
    expect(source).toContain('readonly applicationId: string');
    expect(source).not.toContain('ApplicationDefinition');
    expect(source).not.toContain('ApplicationInstance');
    expect(source).not.toContain('permission');
    expect(source).not.toContain('capability');
  });

  it('requires a registered anchor before direct BusinessData submission', async () => {
    const source = await readFile(
      'modules/business-data/infrastructure/postgres-business-data-submission.ts',
      'utf8'
    );
    expect(source).toContain(
      'await this.applicationAnchors.require(applicationId)'
    );
  });

  it('keeps rich Application lifecycle out of the anchor table', async () => {
    const migration = await readFile(
      'migrations/schema/202610030040_application_anchor_registry.sql',
      'utf8'
    );
    expect(migration).toContain(
      'create table if not exists application_anchor'
    );
    const tableDefinition = migration
      .split('create table if not exists application_anchor', 2)[1]!
      .split(');', 1)[0]!;
    expect(tableDefinition).toContain('application_id text primary key');
    expect(tableDefinition).not.toContain('status');
    expect(tableDefinition).not.toContain('version');
    expect(tableDefinition).not.toContain('permission');
  });
});

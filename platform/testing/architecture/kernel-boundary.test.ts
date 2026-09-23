import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = resolve(process.cwd());
const kernelRuntime = join(repoRoot, 'apps/api/src/kernel-runtime.ts');

const forbiddenRuntimeModules = [
  '/modules/accounting/',
  '/modules/allocation/',
  '/modules/ai/',
  '/modules/application/',
  '/modules/capability/',
  '/modules/command/',
  '/modules/cost/',
  '/modules/economic/',
  '/modules/enterprise-package/',
  '/modules/enterprise-template/',
  '/modules/flow/',
  '/modules/metrics/',
  '/modules/position/',
  '/modules/query/',
  '/modules/sop/',
  '/modules/valuation/',
  '/modules/workflow/'
] as const;

describe('EVO Kernel composition boundary', () => {
  it('does not compose optional business, finance, analytics or learning modules', async () => {
    const source = await readFile(kernelRuntime, 'utf8');
    const violations = forbiddenRuntimeModules.filter((segment) =>
      source.includes(segment)
    );

    expect(violations).toEqual([]);
  });

  it('keeps the first extracted kernel centered on BusinessData, Posting and Ledger', async () => {
    const source = await readFile(kernelRuntime, 'utf8');

    expect(source).toContain('/modules/business-data/');
    expect(source).toContain('/modules/posting/');
    expect(source).toContain('/modules/ledger/');
  });
});

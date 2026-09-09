import { readdir } from 'node:fs/promises';
import { basename, join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();

const ignoredDirectories = new Set([
  '.git',
  'node_modules',
  'dist',
  'coverage',
  '.tmp'
]);

const windowsReservedNames = new Set([
  'con', 'prn', 'aux', 'nul',
  'com1', 'com2', 'com3', 'com4', 'com5', 'com6', 'com7', 'com8', 'com9',
  'lpt1', 'lpt2', 'lpt3', 'lpt4', 'lpt5', 'lpt6', 'lpt7', 'lpt8', 'lpt9'
]);

async function repositoryPaths(dir: string): Promise<string[]> {
  const result: string[] = [];

  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;

    const path = join(dir, entry.name);
    const rel = relative(repoRoot, path).replaceAll('\\', '/');
    result.push(rel);

    if (entry.isDirectory()) {
      result.push(...await repositoryPaths(path));
    }
  }

  return result;
}

function normalizedCollisionKey(path: string): string {
  return path
    .normalize('NFKC')
    .replaceAll('\\', '/')
    .toLocaleLowerCase('en-US');
}

describe('cross-platform repository paths', () => {
  it('has no case/unicode-normalized path collisions', async () => {
    const seen = new Map<string, string>();
    const collisions: string[] = [];

    for (const path of await repositoryPaths(repoRoot)) {
      const key = normalizedCollisionKey(path);
      const existing = seen.get(key);

      if (existing !== undefined && existing !== path) {
        collisions.push(`${existing} <-> ${path}`);
      } else {
        seen.set(key, path);
      }
    }

    expect(collisions).toEqual([]);
  });

  it('uses Windows-safe file and directory names', async () => {
    const violations: string[] = [];

    for (const path of await repositoryPaths(repoRoot)) {
      const name = basename(path);
      const stem = name.split('.')[0]?.toLocaleLowerCase('en-US') ?? '';

      if (/[<>:"|?*\u0000-\u001F]/u.test(name)) {
        violations.push(`${path}: illegal Windows character`);
      }

      if (/[. ]$/u.test(name)) {
        violations.push(`${path}: trailing dot/space`);
      }

      if (windowsReservedNames.has(stem)) {
        violations.push(`${path}: Windows reserved name`);
      }
    }

    expect(violations).toEqual([]);
  });
});

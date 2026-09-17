import { readFile, readdir } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

interface Manifest {
  readonly modules: Record<
    string,
    {
      readonly mayDependOn: readonly string[];
    }
  >;
}

const repoRoot = resolve(process.cwd());
const modulesRoot = join(repoRoot, 'modules');

async function sourceFiles(dir: string): Promise<string[]> {
  const result: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) result.push(...(await sourceFiles(path)));
    if (entry.isFile() && entry.name.endsWith('.ts')) result.push(path);
  }
  return result;
}

function moduleOf(file: string): string | undefined {
  const rel = relative(modulesRoot, file);
  if (rel.startsWith('..')) return undefined;
  return rel.split(sep)[0];
}

function importSpecifiers(source: string): string[] {
  const matches = source.matchAll(
    /(?:from\s+|import\s*\()\s*['"]([^'"]+)['"]/g
  );
  return [...matches].map((match) => match[1] ?? '');
}

function resolvedModuleImport(
  fromFile: string,
  specifier: string
): string | undefined {
  if (!specifier.startsWith('.')) return undefined;
  const target = resolve(dirname(fromFile), specifier);
  return moduleOf(target);
}

describe('module dependency boundaries', () => {
  it('does not introduce undeclared cross-module imports', async () => {
    const manifest = JSON.parse(
      await readFile(join(repoRoot, 'architecture.manifest.json'), 'utf8')
    ) as Manifest;

    const violations: string[] = [];

    for (const file of await sourceFiles(modulesRoot)) {
      const owner = moduleOf(file);
      if (owner === undefined) continue;

      const allowed = new Set([
        owner,
        ...(manifest.modules[owner]?.mayDependOn ?? [])
      ]);

      const source = await readFile(file, 'utf8');

      for (const specifier of importSpecifiers(source)) {
        const target = resolvedModuleImport(file, specifier);
        if (target !== undefined && !allowed.has(target)) {
          violations.push(
            `${relative(repoRoot, file)} imports ${target} via ${specifier}`
          );
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('forbids cross-module infrastructure imports', async () => {
    const violations: string[] = [];

    for (const file of await sourceFiles(modulesRoot)) {
      const owner = moduleOf(file);
      if (owner === undefined) continue;

      const source = await readFile(file, 'utf8');
      for (const specifier of importSpecifiers(source)) {
        const target = resolvedModuleImport(file, specifier);
        if (
          target !== undefined &&
          target !== owner &&
          specifier.includes('/infrastructure/')
        ) {
          violations.push(
            `${relative(repoRoot, file)} imports another module's infrastructure: ${specifier}`
          );
        }
      }
    }

    expect(violations).toEqual([]);
  });
});

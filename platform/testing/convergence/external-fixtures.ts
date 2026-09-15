import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

export interface ExternalConvergenceFixture<T = unknown> {
  readonly sourcePath: string;
  readonly sha256: string;
  readonly value: T;
}

/**
 * Loads a Convergence-owned JSON fixture without embedding its schema semantics
 * in EVO. Certification CI supplies the exact external checkout/path.
 */
export async function loadExternalConvergenceFixture<T = unknown>(
  path: string
): Promise<ExternalConvergenceFixture<T>> {
  const sourcePath = resolve(path);
  const bytes = await readFile(sourcePath);
  const text = bytes.toString('utf8');
  return {
    sourcePath,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    value: JSON.parse(text) as T
  };
}

/**
 * Resolves a fixture under the externally supplied Convergence fixture root.
 * This helper deliberately does not know canonical contract filenames.
 */
export function convergenceFixturePath(relativePath: string): string {
  const root = process.env['EVO_CONVERGENCE_FIXTURE_ROOT'];
  if (root === undefined || root.trim().length === 0) {
    throw new Error('EVO_CONVERGENCE_FIXTURE_ROOT is required for Convergence certification tests.');
  }
  return resolve(root, relativePath);
}

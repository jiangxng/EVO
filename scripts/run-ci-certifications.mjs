import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';

const lane = process.argv[2];
if (!lane) throw new Error('Usage: node scripts/run-ci-certifications.mjs <lane>');

const manifest = JSON.parse(await readFile(new URL('../ci/certification-manifest.json', import.meta.url), 'utf8'));
const entries = manifest.lanes?.[lane];
if (!Array.isArray(entries)) throw new Error(`Unknown CI certification lane: ${lane}`);

for (const entry of entries) {
  console.log(`::group::CI certification: ${entry.id}`);
  const result = spawnSync('npm', ['run', entry.script], {
    stdio: 'inherit',
    env: process.env,
    shell: process.platform === 'win32'
  });
  console.log('::endgroup::');
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

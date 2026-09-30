import { readFile } from 'node:fs/promises';

const manifest = JSON.parse(await readFile(new URL('../ci/certification-manifest.json', import.meta.url), 'utf8'));
const isolated = manifest.lanes?.isolated;
if (!Array.isArray(isolated) || isolated.length === 0) {
  throw new Error('CI certification manifest must declare at least one isolated certification.');
}
process.stdout.write(JSON.stringify(isolated));

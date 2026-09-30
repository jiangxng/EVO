import { readFile } from 'node:fs/promises';

const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const manifest = JSON.parse(await readFile(new URL('../ci/certification-manifest.json', import.meta.url), 'utf8'));

const fail = (message) => {
  console.error(`CI_CERTIFICATION_MANIFEST_INVALID: ${message}`);
  process.exitCode = 1;
};

if (manifest.schemaVersion !== 1) fail('schemaVersion must be 1.');
if (manifest.lanes === null || typeof manifest.lanes !== 'object' || Array.isArray(manifest.lanes)) {
  fail('lanes must be an object.');
}

const entries = [];
for (const [lane, laneEntries] of Object.entries(manifest.lanes ?? {})) {
  if (!Array.isArray(laneEntries)) {
    fail(`lane ${lane} must be an array.`);
    continue;
  }
  for (const entry of laneEntries) {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      fail(`lane ${lane} contains a non-object entry.`);
      continue;
    }
    if (typeof entry.id !== 'string' || !/^[a-z0-9][a-z0-9-]*$/u.test(entry.id)) {
      fail(`lane ${lane} has invalid id ${String(entry.id)}.`);
    }
    if (typeof entry.script !== 'string' || !entry.script.startsWith('validate:')) {
      fail(`lane ${lane}/${String(entry.id)} must reference a validate:* npm script.`);
    }
    entries.push({ lane, id: entry.id, script: entry.script });
  }
}

const duplicate = (values) => {
  const seen = new Set();
  const duplicates = new Set();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates].sort();
};

for (const id of duplicate(entries.map((entry) => entry.id))) fail(`duplicate certification id ${id}.`);
for (const script of duplicate(entries.map((entry) => entry.script))) fail(`script ${script} is assigned more than once.`);

for (const entry of entries) {
  if (typeof packageJson.scripts?.[entry.script] !== 'string') {
    fail(`${entry.script} is declared by lane ${entry.lane} but is absent from package.json.`);
  }
}

const manifestScripts = new Set(entries.map((entry) => entry.script));
const ignored = new Set(['validate:ci-manifest']);
const packageValidationScripts = Object.keys(packageJson.scripts ?? {})
  .filter((script) => script.startsWith('validate:') && !ignored.has(script))
  .sort();

for (const script of packageValidationScripts) {
  if (!manifestScripts.has(script)) fail(`${script} exists in package.json but is not assigned to a CI lane.`);
}
for (const script of [...manifestScripts].sort()) {
  if (!packageValidationScripts.includes(script)) fail(`${script} is in the CI manifest but is not a governed validation script.`);
}

if (process.exitCode === undefined) {
  console.log(JSON.stringify({
    status: 'PASS',
    lanes: Object.fromEntries(
      Object.entries(manifest.lanes).map(([lane, laneEntries]) => [lane, laneEntries.length])
    ),
    validationScripts: packageValidationScripts.length
  }));
}

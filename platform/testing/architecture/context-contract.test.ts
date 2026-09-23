import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

async function text(file: string) {
  return readFile(join(root, file), 'utf8');
}

describe('LLM context determinism contract', () => {
  it('ships the canonical project context files', async () => {
    const manifest = JSON.parse(await text('context.manifest.json')) as {
      requiredReading: string[];
      rules: Record<string, unknown>;
    };
    expect(manifest.requiredReading).toContain('PHILOSOPHY.md');
    expect(manifest.requiredReading).toContain('INVARIANTS.md');
    expect(manifest.requiredReading).toContain('PUBLIC-API.md');
    expect(manifest.requiredReading).toContain(
      'docs/architecture/decisions/2026-09-24-evo-minimal-runtime-plugin-boundary-v0.1.md'
    );
    expect(manifest.rules.actualWriteBoundary).toBe('BusinessDataSubmission');
    expect(manifest.rules.commandRequiredByCore).toBe(false);
    expect(manifest.rules.identityOwnedByCore).toBe(false);
    expect(manifest.rules.permissionsOwnedByCore).toBe(false);
    expect(manifest.rules.applicationDefinitionsOwnedByCore).toBe(false);
    expect(manifest.rules.capabilityDiscoveryOwnedByCore).toBe(false);
    expect(manifest.rules.postingRuleLifecycleOwnedByCore).toBe(false);
    expect(manifest.rules.higherOrderEnginesDefaultToPlugins).toBe(true);
    expect(manifest.rules.replayExecutesCommands).toBe(false);
    for (const file of manifest.requiredReading) {
      expect((await text(file)).length).toBeGreaterThan(20);
    }
  });

  it('keeps key semantic prohibitions explicit', async () => {
    const invariants = await text('INVARIANTS.md');
    expect(invariants).toContain('Replay never executes Commands');
    expect(invariants).toContain('must not infer them from matching quantities');
    expect(invariants).toContain('CostResult cannot silently mutate LedgerBalance');
  });
});

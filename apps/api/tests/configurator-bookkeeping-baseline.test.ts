import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import {
  compileBookkeepingBaselineV010,
  compileBookkeepingExpressionV010,
  type BookkeepingBaselineSourceV010
} from '../src/configurator-expression-compiler.js';

interface BaselineArtifactV010 {
  readonly contractVersion: '0.1.0';
  readonly kind: 'evo.ledger-runtime.bookkeeping-baseline';
  readonly baselineId: string;
  readonly sourceDefinition: BookkeepingBaselineSourceV010;
  readonly compiledConfiguration: unknown;
  readonly acceptance: {
    readonly applications: number;
    readonly accounts: number;
    readonly rules: number;
    readonly referencedApplications: number;
    readonly referencedAccounts: number;
    readonly uniqueExpressions: number;
    readonly compiledExpressionUses: number;
    readonly missingApplicationReferences: number;
    readonly missingAccountReferences: number;
    readonly requiredRuleCompileCount: number;
    readonly compiledRuleCount: number;
  };
}

async function baseline(): Promise<BaselineArtifactV010> {
  return JSON.parse(
    await readFile(
      'reference/ledger-runtime/bookkeeping-account-foundation-2022-v0.1.json',
      'utf8'
    )
  ) as BaselineArtifactV010;
}

describe('bookkeeping Ledger Runtime baseline', () => {
  it('contains the complete source definition corpus', async () => {
    const artifact = await baseline();

    expect(artifact.contractVersion).toBe('0.1.0');
    expect(artifact.kind).toBe('evo.ledger-runtime.bookkeeping-baseline');
    expect(artifact.sourceDefinition.applications).toHaveLength(143);
    expect(artifact.sourceDefinition.accounts).toHaveLength(141);
    expect(artifact.sourceDefinition.policies).toHaveLength(912);

    expect(artifact.acceptance).toEqual({
      applications: 143,
      accounts: 141,
      rules: 912,
      referencedApplications: 117,
      referencedAccounts: 141,
      uniqueExpressions: 397,
      compiledExpressionUses: 1963,
      missingApplicationReferences: 0,
      missingAccountReferences: 0,
      requiredRuleCompileCount: 912,
      compiledRuleCount: 912
    });
  });

  it('recompiles all 912 policies deterministically to the checked-in configuration', async () => {
    const artifact = await baseline();
    const compiled = compileBookkeepingBaselineV010(
      artifact.sourceDefinition,
      artifact.baselineId
    );

    expect(compiled.rules).toHaveLength(912);
    expect(compiled.applications).toHaveLength(143);
    expect(compiled.accounts).toHaveLength(141);
    expect(compiled.compiler.uniqueExpressionCount).toBe(397);
    expect(compiled.compiler.compiledExpressionCount).toBe(1963);
    expect(compiled).toEqual(artifact.compiledConfiguration);
  });

  it('compiles representative Aviator syntax into EVO expression IR', () => {
    expect(
      compileBookkeepingExpressionV010(
        "changeTag=='out' && (物料属性=='原料' || 物料属性=='辅料')"
      )
    ).toEqual({
      type: 'and',
      values: [
        {
          type: 'eq',
          left: { type: 'field', path: 'changeTag' },
          right: { type: 'literal', value: 'out' }
        },
        {
          type: 'or',
          values: [
            {
              type: 'eq',
              left: { type: 'field', path: '物料属性' },
              right: { type: 'literal', value: '原料' }
            },
            {
              type: 'eq',
              left: { type: 'field', path: '物料属性' },
              right: { type: 'literal', value: '辅料' }
            }
          ]
        }
      ]
    });

    expect(
      compileBookkeepingExpressionV010(
        "发票类型=='专用发票'?不含税金额:含税金额"
      )
    ).toEqual({
      type: 'conditional',
      condition: {
        type: 'eq',
        left: { type: 'field', path: '发票类型' },
        right: { type: 'literal', value: '专用发票' }
      },
      whenTrue: { type: 'field', path: '不含税金额' },
      whenFalse: { type: 'field', path: '含税金额' }
    });

    expect(
      compileBookkeepingExpressionV010(
        "include(string.split('包装物,低值易耗品,模具',','),物料属性)"
      )
    ).toEqual({
      type: 'contains',
      collection: {
        type: 'split',
        value: { type: 'literal', value: '包装物,低值易耗品,模具' },
        separator: { type: 'literal', value: ',' }
      },
      value: { type: 'field', path: '物料属性' }
    });
  });
});

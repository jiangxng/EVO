import { describe, expect, it } from 'vitest';
import type { EnterpriseDefinitionSnapshot, EnterprisePackageV01 } from '../api/contracts.js';
import { planEnterprisePackageDeployment } from '../application/package-planner.js';
import { validateEnterprisePackage } from '../application/package-validator.js';

const pkg: EnterprisePackageV01 = {
  packageSchemaVersion: '0.1', packageId: 'reference.sales', packageVersion: '1.0.0', name: 'Sales',
  compatibility: { evoRuntime: '>=1.0.0-alpha.2' },
  definitions: [
    { kind: 'domain', key: 'sales', version: 1, spec: { name: 'Sales' } },
    { kind: 'transaction-type', key: 'sales-order', version: 2, dependsOn: [{ kind: 'domain', key: 'sales', version: 1 }], spec: { code: 'sales-order', name: 'Sales Order' } }
  ]
};

const snapshot: EnterpriseDefinitionSnapshot = {
  enterpriseScope: 'enterprise-1', definitionVersion: '17',
  definitions: [
    { kind: 'domain', key: 'sales', version: 1, spec: { name: 'Sales' } },
    { kind: 'transaction-type', key: 'sales-order', version: 1, spec: { code: 'sales-order', name: 'Sales Order' } },
    { kind: 'field-definition', key: 'legacy-field', version: 1, spec: {} }
  ]
};

describe('Enterprise Package v0.1 runtime', () => {
  it('validates definition references fail closed', () => {
    expect(validateEnterprisePackage(pkg)).toEqual({ valid: true, issues: [] });
    const broken: EnterprisePackageV01 = { ...pkg, definitions: [{ ...pkg.definitions[1]!, dependsOn: [{ kind: 'domain', key: 'missing', version: 1 }] }] };
    expect(validateEnterprisePackage(broken).issues.some((x) => x.code === 'UNRESOLVED_DEFINITION_REFERENCE')).toBe(true);
  });

  it('enforces stable EVO-owned semantic anchors without creating a parallel metadata model', () => {
    const commandPackage: EnterprisePackageV01 = {
      ...pkg,
      definitions: [{
        kind: 'command-definition', key: 'approve-sales-order', version: 1,
        spec: {
          code: 'approve-sales-order', applicationDefinitionKey: 'sales-order',
          resultingBusinessDataType: 'sales_order.approved', inputSchema: { type: 'object' }
        }
      }]
    };
    expect(validateEnterprisePackage(commandPackage).valid).toBe(true);
    const missingSchema: EnterprisePackageV01 = {
      ...commandPackage,
      definitions: [{ kind: 'command-definition', key: 'approve-sales-order', version: 1, spec: { code: 'approve-sales-order', applicationDefinitionKey: 'sales-order', resultingBusinessDataType: 'sales_order.approved' } }]
    };
    expect(validateEnterprisePackage(missingSchema).issues.some((x) => x.code === 'COMMAND_INPUT_SCHEMA_REQUIRED')).toBe(true);
  });

  it('produces a deterministic side-effect-free human review diff', () => {
    const first = planEnterprisePackageDeployment(snapshot, pkg, '17');
    const second = planEnterprisePackageDeployment(snapshot, pkg, '17');
    expect(first).toEqual(second);
    expect(first.sideEffectFree).toBe(true);
    expect(first.requiresHumanReview).toBe(true);
    expect(first.changes).toEqual([
      { operation: 'UNCHANGED', kind: 'domain', key: 'sales', fromVersion: 1, toVersion: 1 },
      { operation: 'REMOVE', kind: 'field-definition', key: 'legacy-field', fromVersion: 1 },
      { operation: 'UPDATE', kind: 'transaction-type', key: 'sales-order', fromVersion: 1, toVersion: 2 }
    ]);
  });

  it('fails closed on a stale base definition version', () => {
    const plan = planEnterprisePackageDeployment(snapshot, pkg, '16');
    expect(plan.blockingIssues.some((x) => x.code === 'STALE_BASE_VERSION')).toBe(true);
  });
});

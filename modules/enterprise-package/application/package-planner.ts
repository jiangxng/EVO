import type {
  EnterpriseDefinitionSnapshot,
  EnterprisePackageDefinition,
  EnterprisePackageDeploymentPlan,
  EnterprisePackageV01,
  PackagePlanChange
} from '../api/contracts.js';
import { validateEnterprisePackage } from './package-validator.js';

function logicalId(definition: EnterprisePackageDefinition): string {
  return `${definition.kind}:${definition.key}`;
}

function compareChange(a: PackagePlanChange, b: PackagePlanChange): number {
  return a.kind.localeCompare(b.kind) || a.key.localeCompare(b.key) || a.operation.localeCompare(b.operation);
}

export function planEnterprisePackageDeployment(
  snapshot: EnterpriseDefinitionSnapshot,
  pkg: EnterprisePackageV01,
  expectedBaseDefinitionVersion?: string
): EnterprisePackageDeploymentPlan {
  const validation = validateEnterprisePackage(pkg);
  const blockingIssues = [...validation.issues.filter((x) => x.severity === 'ERROR')];
  const warnings = [...validation.issues.filter((x) => x.severity === 'WARNING')];

  if (expectedBaseDefinitionVersion !== undefined && expectedBaseDefinitionVersion !== snapshot.definitionVersion) {
    blockingIssues.push({
      code: 'STALE_BASE_VERSION', severity: 'ERROR', path: '/expectedBaseDefinitionVersion',
      message: `Expected enterprise definition ${expectedBaseDefinitionVersion}, current version is ${snapshot.definitionVersion}.`
    });
  }

  const current = new Map(snapshot.definitions.map((x) => [logicalId(x), x]));
  const target = new Map(pkg.definitions.map((x) => [logicalId(x), x]));
  const changes: PackagePlanChange[] = [];

  for (const [id, next] of target) {
    const before = current.get(id);
    if (before === undefined) changes.push({ operation: 'ADD', kind: next.kind, key: next.key, toVersion: next.version });
    else if (String(before.version) === String(next.version)) changes.push({ operation: 'UNCHANGED', kind: next.kind, key: next.key, fromVersion: before.version, toVersion: next.version });
    else changes.push({ operation: 'UPDATE', kind: next.kind, key: next.key, fromVersion: before.version, toVersion: next.version });
  }

  for (const [id, before] of current) {
    if (!target.has(id)) changes.push({ operation: 'REMOVE', kind: before.kind, key: before.key, fromVersion: before.version });
  }

  return {
    enterpriseScope: snapshot.enterpriseScope,
    baseDefinitionVersion: snapshot.definitionVersion,
    packageId: pkg.packageId,
    packageVersion: pkg.packageVersion,
    changes: changes.sort(compareChange),
    blockingIssues,
    warnings,
    sideEffectFree: true,
    requiresHumanReview: true
  };
}

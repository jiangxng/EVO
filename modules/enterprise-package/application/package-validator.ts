import {
  enterprisePackageDefinitionKinds,
  type EnterprisePackageDefinition,
  type EnterprisePackageDefinitionRef,
  type EnterprisePackageV01,
  type PackageValidationIssue,
  type PackageValidationResult
} from '../api/contracts.js';
import { validateDefinitionSemantics } from './definition-semantics.js';

const forbiddenRuntimeKinds = new Set([
  'business-data', 'ledger-entry', 'ledger-balance', 'balance', 'cost-result',
  'work-item', 'posting-input', 'command-execution', 'replay-run', 'cost-run',
  'valuation-posting-run', 'valuation-position'
]);

function refId(ref: EnterprisePackageDefinitionRef): string {
  return `${ref.kind}:${ref.key}:${String(ref.version)}`;
}

function issue(code: string, path: string, message: string): PackageValidationIssue {
  return { code, severity: 'ERROR', path, message };
}

export function validateEnterprisePackage(pkg: EnterprisePackageV01): PackageValidationResult {
  const issues: PackageValidationIssue[] = [];
  if (pkg.packageSchemaVersion !== '0.1') issues.push(issue('UNSUPPORTED_PACKAGE_SCHEMA', '/packageSchemaVersion', 'Only Enterprise Package schema 0.1 is supported.'));
  if (pkg.packageId.trim() === '') issues.push(issue('PACKAGE_ID_REQUIRED', '/packageId', 'packageId is required.'));
  if (pkg.packageVersion.trim() === '') issues.push(issue('PACKAGE_VERSION_REQUIRED', '/packageVersion', 'packageVersion is required.'));
  if (pkg.name.trim() === '') issues.push(issue('PACKAGE_NAME_REQUIRED', '/name', 'name is required.'));

  const allowedKinds = new Set<string>(enterprisePackageDefinitionKinds);
  const definitions = new Map<string, EnterprisePackageDefinition>();
  const logicalKeys = new Set<string>();

  pkg.definitions.forEach((definition, index) => {
    const path = `/definitions/${index}`;
    if (!allowedKinds.has(definition.kind)) issues.push(issue('UNKNOWN_DEFINITION_KIND', `${path}/kind`, `Unsupported definition kind ${definition.kind}.`));
    if (forbiddenRuntimeKinds.has(definition.kind)) issues.push(issue('ACTUAL_RUNTIME_DATA_FORBIDDEN', `${path}/kind`, 'Enterprise Package DEFINITION_ONLY must not contain actual runtime data.'));
    if (definition.key.trim() === '') issues.push(issue('DEFINITION_KEY_REQUIRED', `${path}/key`, 'Definition key is required.'));
    const id = refId(definition);
    if (definitions.has(id)) issues.push(issue('DUPLICATE_DEFINITION', path, `Duplicate definition ${id}.`));
    definitions.set(id, definition);
    const logicalKey = `${definition.kind}:${definition.key}`;
    if (logicalKeys.has(logicalKey)) issues.push(issue('MULTIPLE_VERSIONS_IN_PACKAGE', path, `Package must contain at most one target version of ${logicalKey}.`));
    logicalKeys.add(logicalKey);
    issues.push(...validateDefinitionSemantics(definition, path));
  });

  pkg.definitions.forEach((definition, index) => {
    for (const dependency of definition.dependsOn ?? []) {
      if (!definitions.has(refId(dependency))) {
        issues.push(issue('UNRESOLVED_DEFINITION_REFERENCE', `/definitions/${index}/dependsOn`, `Missing referenced definition ${refId(dependency)}.`));
      }
    }
  });

  return { valid: issues.every((x) => x.severity !== 'ERROR'), issues };
}

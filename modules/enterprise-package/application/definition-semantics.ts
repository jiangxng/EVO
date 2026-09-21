import type { EnterprisePackageDefinition, PackageValidationIssue } from '../api/contracts.js';

type Obj = Record<string, unknown>;

function isObject(value: unknown): value is Obj {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
function error(code: string, path: string, message: string): PackageValidationIssue {
  return { code, severity: 'ERROR', path, message };
}
function requireString(spec: Obj, key: string, path: string, issues: PackageValidationIssue[]): void {
  if (!nonEmpty(spec[key])) issues.push(error('DEFINITION_SEMANTIC_INVALID', `${path}/spec/${key}`, `${key} must be a non-empty string.`));
}
function requireArray(spec: Obj, key: string, path: string, issues: PackageValidationIssue[]): void {
  if (!Array.isArray(spec[key])) issues.push(error('DEFINITION_SEMANTIC_INVALID', `${path}/spec/${key}`, `${key} must be an array.`));
}

/**
 * Validates only stable EVO-owned semantic anchors. Package specs deliberately remain
 * extensible: module owners may add properties without changing the package envelope.
 * This prevents Enterprise Package from becoming a second metadata model.
 */
export function validateDefinitionSemantics(definition: EnterprisePackageDefinition, path: string): readonly PackageValidationIssue[] {
  const issues: PackageValidationIssue[] = [];
  if (!isObject(definition.spec)) return [error('DEFINITION_SPEC_REQUIRED', `${path}/spec`, 'spec must be an object.')];
  const spec = definition.spec as Obj;

  switch (definition.kind) {
    case 'transaction-type':
      requireString(spec, 'code', path, issues);
      requireString(spec, 'name', path, issues);
      break;
    case 'application-definition':
      requireString(spec, 'code', path, issues);
      requireString(spec, 'name', path, issues);
      requireString(spec, 'transactionTypeKey', path, issues);
      break;
    case 'field-group':
      requireString(spec, 'code', path, issues);
      requireString(spec, 'name', path, issues);
      requireString(spec, 'applicationDefinitionKey', path, issues);
      break;
    case 'field-definition':
      requireString(spec, 'code', path, issues);
      requireString(spec, 'name', path, issues);
      requireString(spec, 'fieldGroupKey', path, issues);
      requireString(spec, 'valueType', path, issues);
      break;
    case 'command-definition':
      requireString(spec, 'code', path, issues);
      requireString(spec, 'applicationDefinitionKey', path, issues);
      requireString(spec, 'resultingBusinessDataType', path, issues);
      if (!isObject(spec['inputSchema'])) issues.push(error('COMMAND_INPUT_SCHEMA_REQUIRED', `${path}/spec/inputSchema`, 'Published CommandDefinition must carry its EVO-owned inputSchema.'));
      break;
    case 'ledger-definition':
      requireString(spec, 'code', path, issues);
      requireString(spec, 'name', path, issues);
      requireString(spec, 'ledgerClass', path, issues);
      break;
    case 'posting-rule':
      requireString(spec, 'code', path, issues);
      requireString(spec, 'sourceBusinessDataType', path, issues);
      requireArray(spec, 'effects', path, issues);
      break;
    case 'dimension-definition':
      requireString(spec, 'code', path, issues);
      requireString(spec, 'name', path, issues);
      break;
    case 'cost-policy':
    case 'valuation-policy':
      requireString(spec, 'code', path, issues);
      break;
    default:
      // Other kinds stay envelope-validated until their owning EVO modules publish
      // stronger stable semantics. Do not invent parallel package-only concepts here.
      break;
  }
  return issues;
}

export const enterprisePackageDefinitionKinds = [
  'enterprise', 'domain', 'transaction-type', 'application-definition', 'field-group',
  'field-definition', 'command-definition', 'capability-definition', 'flow-definition',
  'sop-definition', 'metric-definition', 'dimension-definition', 'ledger-definition',
  'posting-rule', 'cost-policy', 'valuation-policy', 'authorization-template'
] as const;

export type EnterprisePackageDefinitionKind = typeof enterprisePackageDefinitionKinds[number];
export type DefinitionVersion = string | number;

export interface EnterprisePackageDefinitionRef {
  readonly kind: EnterprisePackageDefinitionKind;
  readonly key: string;
  readonly version: DefinitionVersion;
}

export interface EnterprisePackageDefinition extends EnterprisePackageDefinitionRef {
  readonly dependsOn?: readonly EnterprisePackageDefinitionRef[];
  readonly spec: Readonly<Record<string, unknown>>;
}

export interface EnterprisePackageV01 {
  readonly packageSchemaVersion: '0.1';
  readonly packageId: string;
  readonly packageVersion: string;
  readonly name: string;
  readonly description?: string;
  readonly compatibility: {
    readonly evoRuntime: string;
    readonly requiresCapabilities?: readonly string[];
  };
  readonly dependencies?: readonly { readonly packageId: string; readonly versionRange: string }[];
  readonly definitions: readonly EnterprisePackageDefinition[];
  readonly provenance?: Readonly<Record<string, unknown>>;
}

export interface PackageValidationIssue {
  readonly code: string;
  readonly severity: 'ERROR' | 'WARNING';
  readonly path: string;
  readonly message: string;
}

export interface PackageValidationResult {
  readonly valid: boolean;
  readonly issues: readonly PackageValidationIssue[];
}

export interface EnterpriseDefinitionSnapshot {
  readonly enterpriseScope: string;
  readonly definitionVersion: string;
  readonly definitions: readonly EnterprisePackageDefinition[];
}

export interface PackagePlanChange {
  readonly operation: 'ADD' | 'UPDATE' | 'REMOVE' | 'UNCHANGED';
  readonly kind: EnterprisePackageDefinitionKind;
  readonly key: string;
  readonly fromVersion?: DefinitionVersion;
  readonly toVersion?: DefinitionVersion;
}

export interface EnterprisePackageDeploymentPlan {
  readonly enterpriseScope: string;
  readonly baseDefinitionVersion: string;
  readonly packageId: string;
  readonly packageVersion: string;
  readonly changes: readonly PackagePlanChange[];
  readonly blockingIssues: readonly PackageValidationIssue[];
  readonly warnings: readonly PackageValidationIssue[];
  readonly sideEffectFree: true;
  readonly requiresHumanReview: true;
}

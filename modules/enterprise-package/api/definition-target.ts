import type { EnterprisePackageDefinition } from './contracts.js';

export interface EnterpriseDefinitionDeployment {
  readonly deploymentId: string;
  readonly enterpriseScope: string;
  readonly previousDefinitionVersion: string;
  readonly definitionVersion: string;
  readonly idempotentReplay: boolean;
}

/**
 * Atomic EVO-owned publication boundary. Implementations own persistence, authorization
 * integration and migrations. Enterprise Package never writes module tables itself.
 */
export interface EnterpriseDefinitionTarget {
  publish(input: {
    readonly enterpriseScope: string;
    readonly expectedBaseDefinitionVersion: string;
    readonly idempotencyKey: string;
    readonly packageId: string;
    readonly packageVersion: string;
    readonly definitions: readonly EnterprisePackageDefinition[];
  }): Promise<EnterpriseDefinitionDeployment>;
}

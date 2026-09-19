import type { EnterprisePackageDefinition } from './contracts.js';

/**
 * EVO-owned read boundary used by Enterprise Package export/plan.
 * Implementations project authoritative module definitions into the package envelope.
 * Package code must not read another module's tables directly.
 */
export interface EnterpriseDefinitionSource {
  readDefinitionVersion(enterpriseScope: string): Promise<string>;
  readDefinitions(enterpriseScope: string): Promise<readonly EnterprisePackageDefinition[]>;
}

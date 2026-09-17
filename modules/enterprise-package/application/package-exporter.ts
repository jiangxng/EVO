import type { EnterpriseDefinitionSource } from '../api/definition-source.js';
import type { EnterprisePackageDefinition, EnterprisePackageV01 } from '../api/contracts.js';
import { validateEnterprisePackage } from './package-validator.js';

function compareDefinition(a: EnterprisePackageDefinition, b: EnterprisePackageDefinition): number {
  return a.kind.localeCompare(b.kind) || a.key.localeCompare(b.key) || String(a.version).localeCompare(String(b.version));
}

export interface ExportEnterprisePackageInput {
  readonly enterpriseScope: string;
  readonly packageId: string;
  readonly packageVersion: string;
  readonly name: string;
  readonly evoRuntimeCompatibility: string;
}

/** Deterministic DEFINITION_ONLY export. No BusinessData/LedgerEntry/Balance runtime rows. */
export async function exportEnterprisePackage(
  source: EnterpriseDefinitionSource,
  input: ExportEnterprisePackageInput
): Promise<EnterprisePackageV01> {
  const definitions = [...await source.readDefinitions(input.enterpriseScope)].sort(compareDefinition);
  const pkg: EnterprisePackageV01 = {
    packageSchemaVersion: '0.1',
    packageId: input.packageId,
    packageVersion: input.packageVersion,
    name: input.name,
    compatibility: { evoRuntime: input.evoRuntimeCompatibility },
    definitions,
    provenance: {
      source: 'EVO',
      sourceDefinitionVersion: await source.readDefinitionVersion(input.enterpriseScope),
      exportMode: 'DEFINITION_ONLY'
    }
  };
  const validation = validateEnterprisePackage(pkg);
  if (!validation.valid) {
    throw new Error(`EVO_EXPORT_INVALID:${validation.issues.map((x) => `${x.code}@${x.path}`).join(',')}`);
  }
  return pkg;
}

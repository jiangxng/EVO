import { describe, expect, it } from 'vitest';
import type { EnterpriseDefinitionSource } from '../api/definition-source.js';
import type { EnterpriseDefinitionDeployment, EnterpriseDefinitionTarget } from '../api/definition-target.js';
import type { EnterprisePackageDefinition } from '../api/contracts.js';
import { deployEnterprisePackage } from '../application/package-deployer.js';
import { exportEnterprisePackage } from '../application/package-exporter.js';

class MemoryDefinitions implements EnterpriseDefinitionSource, EnterpriseDefinitionTarget {
  version = '0';
  definitions: readonly EnterprisePackageDefinition[] = [];
  private readonly receipts = new Map<string, EnterpriseDefinitionDeployment>();

  async readDefinitionVersion(): Promise<string> { return this.version; }
  async readDefinitions(): Promise<readonly EnterprisePackageDefinition[]> { return this.definitions; }

  async publish(input: { enterpriseScope: string; expectedBaseDefinitionVersion: string; idempotencyKey: string; packageId: string; packageVersion: string; definitions: readonly EnterprisePackageDefinition[] }): Promise<EnterpriseDefinitionDeployment> {
    const prior = this.receipts.get(input.idempotencyKey);
    if (prior) return { ...prior, idempotentReplay: true };
    if (input.expectedBaseDefinitionVersion !== this.version) throw new Error('STALE_BASE_VERSION');
    const previousDefinitionVersion = this.version;
    this.version = String(Number(this.version) + 1);
    this.definitions = input.definitions;
    const receipt = { deploymentId: `deploy-${this.version}`, enterpriseScope: input.enterpriseScope, previousDefinitionVersion, definitionVersion: this.version, idempotentReplay: false } as const;
    this.receipts.set(input.idempotencyKey, receipt);
    return receipt;
  }
}

const defs: readonly EnterprisePackageDefinition[] = [
  { kind: 'transaction-type', key: 'sales-order', version: 1, spec: { code: 'sales-order', name: 'Sales Order' } },
  { kind: 'application-definition', key: 'sales', version: 1, dependsOn: [{ kind: 'transaction-type', key: 'sales-order', version: 1 }], spec: { code: 'sales', name: 'Sales', transactionTypeKey: 'sales-order' } }
];

describe('enterprise package roundtrip', () => {
  it('definition-only export deploy export preserves semantic definitions', async () => {
    const source = new MemoryDefinitions(); source.definitions = defs; source.version = '7';
    const pkg = await exportEnterprisePackage(source, { enterpriseScope: 'A', packageId: 'p', packageVersion: '1', name: 'P', evoRuntimeCompatibility: '>=1' });
    const target = new MemoryDefinitions();
    const receipt = await deployEnterprisePackage(target, target, { enterpriseScope: 'B', package: pkg, expectedBaseDefinitionVersion: '0', idempotencyKey: 'k1', authorizationConfirmed: true, humanApprovalConfirmed: true });
    expect(receipt.definitionVersion).toBe('1');
    const exported = await exportEnterprisePackage(target, { enterpriseScope: 'B', packageId: 'p2', packageVersion: '1', name: 'P2', evoRuntimeCompatibility: '>=1' });
    expect(exported.definitions).toEqual(pkg.definitions);
  });

  it('deployment is idempotent at target boundary', async () => {
    const target = new MemoryDefinitions();
    const source = new MemoryDefinitions(); source.definitions = defs;
    const pkg = await exportEnterprisePackage(source, { enterpriseScope: 'A', packageId: 'p', packageVersion: '1', name: 'P', evoRuntimeCompatibility: '>=1' });
    const input = { enterpriseScope: 'B', package: pkg, expectedBaseDefinitionVersion: '0', idempotencyKey: 'same', authorizationConfirmed: true, humanApprovalConfirmed: true } as const;
    const first = await deployEnterprisePackage(target, target, input);
    expect(first.idempotentReplay).toBe(false);
    const directReplay = await target.publish({ enterpriseScope: 'B', expectedBaseDefinitionVersion: '0', idempotencyKey: 'same', packageId: 'p', packageVersion: '1', definitions: pkg.definitions });
    expect(directReplay.idempotentReplay).toBe(true);
    expect(directReplay.deploymentId).toBe(first.deploymentId);
  });
});

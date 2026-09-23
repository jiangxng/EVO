export type EffectiveCapabilityKind = 'COMMAND' | 'QUERY';

export interface EffectiveApplicationSummary {
  readonly applicationCode: string;
  readonly applicationName: string;
  readonly applicationInstanceId: string;
  readonly instanceCode: string;
  readonly instanceName: string;
  readonly status: 'ACTIVE';
  readonly definitionVersion: number;
  readonly schemaVersion: number;
}

export interface EffectiveCapability {
  readonly code: string;
  readonly kind: EffectiveCapabilityKind;
  readonly applicationCode: string;
  readonly applicationName: string;
  readonly applicationInstanceId: string;
  readonly applicationVersion: number;
  readonly contractVersion: string;
  readonly commandCode?: string;
  readonly inputSchema?: Readonly<Record<string, unknown>>;
  readonly resultingBusinessDataType?: string;
  readonly permissionCode?: string;
}

export interface EffectiveApplicationCatalog {
  readonly enterpriseId: string;
  readonly applications: readonly EffectiveApplicationSummary[];
}

export interface EffectiveCapabilityCatalog {
  readonly enterpriseId: string;
  readonly source: 'COMMAND_DEFINITION_BOOTSTRAP';
  readonly capabilitySetVersion: string;
  readonly capabilities: readonly EffectiveCapability[];
}

export interface EffectiveCapabilityDiscovery {
  listApplications(enterpriseId: string): Promise<EffectiveApplicationCatalog>;
  listCapabilities(enterpriseId: string): Promise<EffectiveCapabilityCatalog>;
}

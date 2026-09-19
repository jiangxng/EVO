import type { JsonObject } from '../../metadata/api/contracts.js';

export interface EnterpriseTemplateVersion {
  readonly templateCode: string;
  readonly templateName: string;
  readonly version: number;
  readonly status: 'DRAFT' | 'PUBLISHED' | 'RETIRED';
  readonly semanticDigest: string;
  readonly definition: JsonObject;
}

export interface EnterpriseTemplateBinding {
  readonly enterpriseId: string;
  readonly enterpriseCode: string;
  readonly templateCode: string;
  readonly templateVersion: number;
  readonly semanticDigest: string;
  readonly boundAt: Date;
}

export interface PublishEnterpriseTemplateInput {
  readonly templateCode: string;
  readonly templateName: string;
  readonly description?: string;
  readonly version: number;
  readonly definition: JsonObject;
}

export interface EnterpriseTemplateService {
  get(templateCode: string, version?: number): Promise<EnterpriseTemplateVersion>;
  publish(input: PublishEnterpriseTemplateInput): Promise<EnterpriseTemplateVersion>;
  bindEnterprise(enterpriseCode: string, templateCode: string, version: number, actorId: string, reason?: string): Promise<EnterpriseTemplateBinding>;
  getEnterpriseBinding(enterpriseCode: string): Promise<EnterpriseTemplateBinding | null>;
}

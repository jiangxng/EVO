import type { JsonObject } from './contracts.js';

export interface CreateEnterpriseInput {
  readonly code: string;
  readonly name: string;
  readonly defaultTimezone?: string;
}

export interface CreateApplicationSkeletonInput {
  readonly domainCode: string;
  readonly domainName: string;
  readonly transactionTypeCode: string;
  readonly transactionTypeName: string;
  readonly applicationCode: string;
  readonly applicationName: string;
}

export interface CreateApplicationVersionInput {
  readonly applicationDefinitionId: string;
  readonly version: number;
  readonly schemaVersion?: number;
  readonly baseConfig?: JsonObject;
}

export interface MetadataWriter {
  createEnterprise(input: CreateEnterpriseInput): Promise<string>;

  createApplicationSkeleton(
    input: CreateApplicationSkeletonInput
  ): Promise<string>;

  createApplicationVersion(
    input: CreateApplicationVersionInput
  ): Promise<string>;

  publishApplicationVersion(
    applicationDefinitionId: string,
    version: number
  ): Promise<void>;
}

import type { JsonObject } from '../../metadata/api/contracts.js';

export interface FlowProjection {
  projectCommand(commandExecutionId: string): Promise<void>;
}

export interface ExternalFlowDefinitionSourceV010 {
  readonly authority: 'HOST';
  readonly ref: string;
  readonly revision: number;
  readonly digest: string;
}

export interface RegisterExternalFlowDefinitionRequestV010 {
  readonly enterpriseId: string;
  readonly code: string;
  readonly name: string;
  readonly source: ExternalFlowDefinitionSourceV010;
  readonly definition: JsonObject;
}

export interface RegisteredExternalFlowDefinitionV010 {
  readonly contractVersion: '0.1.0';
  readonly flowDefinitionId: string;
  readonly enterpriseId: string;
  readonly code: string;
  readonly name: string;
  readonly version: number;
  readonly source: ExternalFlowDefinitionSourceV010;
}

export interface ExternalFlowDefinitionRegistryV010 {
  register(
    request: RegisterExternalFlowDefinitionRequestV010
  ): Promise<RegisteredExternalFlowDefinitionV010>;
}

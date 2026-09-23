import type {
  ApplicationDefinition,
  ApplicationDefinitionVersion,
  ApplicationInstance,
  CommandDefinition,
  Enterprise,
  EnterpriseApplicationOverlay,
  FieldDefinition,
  PostingRuleDefinition
} from './contracts.js';

export interface MetadataReader {
  getEnterprise(enterpriseId: string): Promise<Enterprise | null>;

  getApplicationDefinition(
    applicationDefinitionId: string
  ): Promise<ApplicationDefinition | null>;

  listApplicationInstances(
    enterpriseId: string
  ): Promise<readonly ApplicationInstance[]>;

  getApplicationInstance(
    enterpriseId: string,
    applicationInstanceId: string
  ): Promise<ApplicationInstance | null>;

  getPublishedApplicationDefinitionVersion(
    applicationDefinitionId: string
  ): Promise<ApplicationDefinitionVersion | null>;

  getApplicationDefinitionVersion(
    applicationDefinitionId: string,
    version: number
  ): Promise<ApplicationDefinitionVersion | null>;

  getPublishedOverlay(
    applicationInstanceId: string
  ): Promise<EnterpriseApplicationOverlay | null>;

  getFields(
    applicationDefinitionVersionId: string
  ): Promise<readonly FieldDefinition[]>;

  getCommands(
    applicationDefinitionVersionId: string
  ): Promise<readonly CommandDefinition[]>;

  getPostingRules(
    applicationDefinitionVersionId: string
  ): Promise<readonly PostingRuleDefinition[]>;
}

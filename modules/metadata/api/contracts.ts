export type JsonValue =
  | null
  | boolean
  | number
  | string
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

export type JsonObject = Readonly<Record<string, JsonValue>>;

export interface Enterprise {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly status: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';
  readonly defaultTimezone: string;
}

export interface ApplicationDefinitionVersion {
  readonly id: string;
  readonly applicationDefinitionId: string;
  readonly version: number;
  readonly schemaVersion: number;
  readonly status: 'DRAFT' | 'PUBLISHED' | 'RETIRED';
  readonly baseConfig: JsonObject;
  readonly definitionHash: string | null;
}

export interface FieldDefinition {
  readonly id: string;
  readonly code: string;
  readonly label: string;
  readonly dataType: string;
  readonly required: boolean;
  readonly referenceMode: 'REFERENCE' | 'SNAPSHOT' | null;
  readonly sortOrder: number;
  readonly config: JsonObject;
}

export interface CommandDefinition {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly inputSchema: JsonObject;
  readonly preconditions: readonly JsonValue[];
  readonly executionPolicy: JsonObject;
  readonly resultingBusinessDataType: string;
  readonly config: JsonObject;
}

export interface PostingRuleDefinition {
  readonly id: string;
  readonly code: string;
  readonly priority: number;
  readonly conditionAst: JsonObject;
  readonly effectAst: JsonObject;
  readonly ruleSchemaVersion: number;
}

export interface ApplicationInstance {
  readonly id: string;
  readonly enterpriseId: string;
  readonly applicationDefinitionId: string;
  readonly code: string;
  readonly name: string;
  readonly pinnedDefinitionVersion: number | null;
  readonly status: 'ACTIVE' | 'DISABLED' | 'ARCHIVED';
  readonly config: JsonObject;
}

export interface EnterpriseApplicationOverlay {
  readonly id: string;
  readonly enterpriseId: string;
  readonly applicationInstanceId: string;
  readonly baseDefinitionVersion: number;
  readonly overlayVersion: number;
  readonly status: 'DRAFT' | 'PUBLISHED' | 'RETIRED';
  readonly patch: JsonObject;
  readonly overlayHash: string | null;
}

export interface EffectiveApplicationDefinition {
  readonly enterpriseId: string;
  readonly applicationInstanceId: string;
  readonly applicationDefinitionId: string;
  readonly definitionVersion: number;
  readonly schemaVersion: number;
  readonly effectiveConfig: JsonObject;
  readonly fields: readonly FieldDefinition[];
  readonly commands: readonly CommandDefinition[];
  readonly postingRules: readonly PostingRuleDefinition[];
  readonly overlayVersion: number | null;
  readonly definitionHash: string | null;
  readonly overlayHash: string | null;
}

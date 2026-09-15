import type {
  CommandDefinition,
  EffectiveApplicationDefinition,
  FieldDefinition,
  PostingRuleDefinition
} from '../../metadata/api/contracts.js';
import type { EnterprisePackageDefinition } from '../api/contracts.js';

function fieldDefinition(appKey: string, groupKey: string, version: number, field: FieldDefinition): EnterprisePackageDefinition {
  return {
    kind: 'field-definition', key: `${appKey}.${field.code}`, version,
    dependsOn: [{ kind: 'field-group', key: groupKey, version }],
    spec: {
      code: field.code, name: field.label, fieldGroupKey: groupKey, valueType: field.dataType,
      required: field.required, referenceMode: field.referenceMode, sortOrder: field.sortOrder, config: field.config
    }
  };
}
function commandDefinition(appKey: string, version: number, command: CommandDefinition): EnterprisePackageDefinition {
  return {
    kind: 'command-definition', key: `${appKey}.${command.code}`, version,
    dependsOn: [{ kind: 'application-definition', key: appKey, version }],
    spec: {
      code: command.code, name: command.name, applicationDefinitionKey: appKey,
      inputSchema: command.inputSchema, preconditions: command.preconditions,
      executionPolicy: command.executionPolicy, resultingBusinessDataType: command.resultingBusinessDataType,
      config: command.config
    }
  };
}
function postingRuleDefinition(appKey: string, version: number, rule: PostingRuleDefinition): EnterprisePackageDefinition {
  return {
    kind: 'posting-rule', key: `${appKey}.${rule.code}`, version,
    dependsOn: [{ kind: 'application-definition', key: appKey, version }],
    spec: {
      code: rule.code,
      sourceBusinessDataType: 'APPLICATION_COMMAND_RESULT',
      priority: rule.priority, conditionAst: rule.conditionAst, effects: [rule.effectAst], ruleSchemaVersion: rule.ruleSchemaVersion
    }
  };
}

/**
 * Projects an already-resolved EffectiveApplicationDefinition. It does not resolve
 * implicit latest metadata and does not query private metadata tables.
 */
export function projectEffectiveApplicationDefinition(
  appKey: string,
  transactionTypeKey: string,
  effective: EffectiveApplicationDefinition
): readonly EnterprisePackageDefinition[] {
  const version = effective.definitionVersion;
  const groupKey = `${appKey}.default`;
  return [
    {
      kind: 'application-definition', key: appKey, version,
      spec: {
        code: appKey, name: appKey, transactionTypeKey, schemaVersion: effective.schemaVersion,
        baseConfig: effective.effectiveConfig, definitionHash: effective.definitionHash,
        overlayVersion: effective.overlayVersion, overlayHash: effective.overlayHash
      }
    },
    {
      kind: 'field-group', key: groupKey, version,
      dependsOn: [{ kind: 'application-definition', key: appKey, version }],
      spec: { code: 'default', name: 'Default', applicationDefinitionKey: appKey }
    },
    ...effective.fields.map((field) => fieldDefinition(appKey, groupKey, version, field)),
    ...effective.commands.map((command) => commandDefinition(appKey, version, command)),
    ...effective.postingRules.map((rule) => postingRuleDefinition(appKey, version, rule))
  ];
}

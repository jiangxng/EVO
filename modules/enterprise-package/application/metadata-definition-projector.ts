import type { CommandDefinition, EffectiveApplicationDefinition, FieldDefinition, PostingRuleDefinition } from '../../metadata/api/contracts.js';
import { deriveFieldGroups, resolveFieldGroupCode } from '../../metadata/api/field-groups.js';
import type { EnterprisePackageDefinition } from '../api/contracts.js';

function fieldDefinition(appKey: string, version: number, field: FieldDefinition): EnterprisePackageDefinition {
  const groupCode = resolveFieldGroupCode(field);
  const groupKey = `${appKey}.${groupCode}`;
  return {
    kind: 'field-definition', key: `${appKey}.${field.code}`, version,
    dependsOn: [{ kind: 'field-group', key: groupKey, version }],
    spec: { code: field.code, name: field.label, fieldGroupKey: groupKey, valueType: field.dataType, required: field.required, referenceMode: field.referenceMode, sortOrder: field.sortOrder, config: field.config }
  };
}
function commandDefinition(appKey: string, version: number, command: CommandDefinition): EnterprisePackageDefinition {
  return {
    kind: 'command-definition', key: `${appKey}.${command.code}`, version,
    dependsOn: [{ kind: 'application-definition', key: appKey, version }],
    spec: { code: command.code, name: command.name, applicationDefinitionKey: appKey, inputSchema: command.inputSchema, preconditions: command.preconditions, executionPolicy: command.executionPolicy, resultingBusinessDataType: command.resultingBusinessDataType, config: command.config }
  };
}
function postingRuleDefinition(appKey: string, version: number, rule: PostingRuleDefinition): EnterprisePackageDefinition {
  return {
    kind: 'posting-rule', key: `${appKey}.${rule.code}`, version,
    dependsOn: [{ kind: 'application-definition', key: appKey, version }],
    spec: { code: rule.code, sourceBusinessDataType: 'APPLICATION_COMMAND_RESULT', priority: rule.priority, conditionAst: rule.conditionAst, effects: [rule.effectAst], ruleSchemaVersion: rule.ruleSchemaVersion }
  };
}

/** Projects a pinned/resolved EVO EffectiveApplicationDefinition; never implicit latest metadata. */
export function projectEffectiveApplicationDefinition(appKey: string, transactionTypeKey: string, effective: EffectiveApplicationDefinition): readonly EnterprisePackageDefinition[] {
  const version = effective.definitionVersion;
  const groups = deriveFieldGroups(effective.fields).map((group): EnterprisePackageDefinition => ({
    kind: 'field-group', key: `${appKey}.${group.code}`, version,
    dependsOn: [{ kind: 'application-definition', key: appKey, version }],
    spec: { code: group.code, name: group.name, applicationDefinitionKey: appKey, sortOrder: group.sortOrder, config: group.config }
  }));
  return [
    { kind: 'application-definition', key: appKey, version, spec: { code: appKey, name: appKey, transactionTypeKey, schemaVersion: effective.schemaVersion, baseConfig: effective.effectiveConfig, definitionHash: effective.definitionHash, overlayVersion: effective.overlayVersion, overlayHash: effective.overlayHash } },
    ...groups,
    ...effective.fields.map((field) => fieldDefinition(appKey, version, field)),
    ...effective.commands.map((command) => commandDefinition(appKey, version, command)),
    ...effective.postingRules.map((rule) => postingRuleDefinition(appKey, version, rule))
  ];
}

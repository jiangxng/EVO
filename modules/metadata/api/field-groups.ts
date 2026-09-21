import type { FieldDefinition, JsonObject } from './contracts.js';

export interface FieldGroupDefinition {
  readonly code: string;
  readonly name: string;
  readonly sortOrder: number;
  readonly config: JsonObject;
}

export interface GroupedFieldDefinition extends FieldDefinition {
  readonly groupCode: string;
}

/**
 * Field groups are semantic organization, not UI-only layout containers.
 * Legacy definitions without explicit grouping deterministically resolve to `default`.
 */
export function resolveFieldGroupCode(field: FieldDefinition): string {
  const configured = field.config['fieldGroup'];
  return typeof configured === 'string' && configured.trim().length > 0 ? configured.trim() : 'default';
}

export function deriveFieldGroups(fields: readonly FieldDefinition[]): readonly FieldGroupDefinition[] {
  const codes = new Set(fields.map(resolveFieldGroupCode));
  if (codes.size === 0) codes.add('default');
  return [...codes].sort().map((code, index) => ({ code, name: code === 'default' ? 'Default' : code, sortOrder: index, config: {} }));
}

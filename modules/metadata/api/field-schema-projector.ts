import type { FieldDefinition, JsonObject, JsonValue } from './contracts.js';

const typeMap: Readonly<Record<string, string>> = {
  string: 'string', text: 'string', uuid: 'string', date: 'string', datetime: 'string',
  number: 'number', decimal: 'number', integer: 'integer', boolean: 'boolean',
  object: 'object', array: 'array'
};

function propertySchema(field: FieldDefinition): JsonObject {
  const configured = field.config['commandSchema'];
  if (configured !== undefined && typeof configured === 'object' && configured !== null && !Array.isArray(configured)) {
    return configured as JsonObject;
  }
  const jsonType = typeMap[field.dataType.toLowerCase()];
  if (jsonType === undefined) throw new Error(`UNSUPPORTED_FIELD_DATA_TYPE:${field.code}:${field.dataType}`);
  const result: Record<string, JsonValue> = { type: jsonType };
  if (field.dataType.toLowerCase() === 'date') result['format'] = 'date';
  if (field.dataType.toLowerCase() === 'datetime') result['format'] = 'date-time';
  return result;
}

/**
 * Deterministically projects business-semantic fields into a JSON Schema object.
 * FieldDefinition remains authoritative. A field may explicitly override only its
 * commandSchema projection through field config; unsupported data types fail closed.
 */
export function projectFieldsToCommandInputSchema(fields: readonly FieldDefinition[]): JsonObject {
  const properties: Record<string, JsonValue> = {};
  const required: string[] = [];
  for (const field of [...fields].sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code))) {
    const exposure = field.config['commandInput'];
    if (exposure === false) continue;
    properties[field.code] = propertySchema(field);
    if (field.required) required.push(field.code);
  }
  return {
    type: 'object',
    properties,
    required,
    additionalProperties: false
  };
}

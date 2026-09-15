import { AppError } from '../../../platform/contracts/src/index.js';
import type { JsonObject, JsonValue } from '../../metadata/api/contracts.js';

function isObject(value: JsonValue | undefined): value is Readonly<Record<string, JsonValue>> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function matchesType(value: JsonValue | undefined, type: string): boolean {
  switch (type) {
    case 'object': return isObject(value);
    case 'array': return Array.isArray(value);
    case 'string': return typeof value === 'string';
    case 'number': return typeof value === 'number' && Number.isFinite(value);
    case 'integer': return typeof value === 'number' && Number.isInteger(value);
    case 'boolean': return typeof value === 'boolean';
    case 'null': return value === null;
    default: return false;
  }
}

function fail(path: string, message: string): never {
  throw new AppError({
    code: 'COMMAND_INPUT_SCHEMA_INVALID',
    message: `Command input does not satisfy the published schema: ${message}`,
    module: 'command',
    operation: 'validateCommandInput',
    details: { path }
  });
}

function validateValue(value: JsonValue | undefined, schema: JsonObject, path: string): void {
  const type = schema.type;
  if (typeof type === 'string' && !matchesType(value, type)) {
    fail(path, `expected ${type}`);
  }

  const enumValues = schema.enum;
  if (Array.isArray(enumValues) && !enumValues.some((item) => JSON.stringify(item) === JSON.stringify(value))) {
    fail(path, 'value is not in enum');
  }

  if (typeof value === 'string') {
    if (typeof schema.minLength === 'number' && value.length < schema.minLength) fail(path, 'string is shorter than minLength');
    if (typeof schema.maxLength === 'number' && value.length > schema.maxLength) fail(path, 'string is longer than maxLength');
  }

  if (typeof value === 'number') {
    if (typeof schema.minimum === 'number' && value < schema.minimum) fail(path, 'number is below minimum');
    if (typeof schema.maximum === 'number' && value > schema.maximum) fail(path, 'number is above maximum');
  }

  if (isObject(value)) {
    const required = schema.required;
    if (Array.isArray(required)) {
      for (const key of required) {
        if (typeof key === 'string' && !(key in value)) fail(`${path}.${key}`, 'required property is missing');
      }
    }

    const properties = schema.properties;
    if (isObject(properties)) {
      for (const [key, childSchema] of Object.entries(properties)) {
        if (key in value && isObject(childSchema)) validateValue(value[key], childSchema, `${path}.${key}`);
      }
    }

    if (schema.additionalProperties === false && isObject(properties)) {
      for (const key of Object.keys(value)) {
        if (!(key in properties)) fail(`${path}.${key}`, 'additional property is not allowed');
      }
    }
  }

  if (Array.isArray(value) && isObject(schema.items)) {
    value.forEach((item, index) => validateValue(item, schema.items as JsonObject, `${path}[${index}]`));
  }
}

/**
 * Deliberately supports the deterministic JSON-Schema subset published by EVO
 * command definitions. Unsupported schema keywords fail closed so admission can
 * never silently weaken an EVO-owned contract.
 */
export function validateCommandInput(input: JsonObject, schema: JsonObject): void {
  const supported = new Set([
    'type', 'properties', 'required', 'additionalProperties', 'items', 'enum',
    'minLength', 'maxLength', 'minimum', 'maximum', 'description', '$schema', '$id', 'title'
  ]);
  for (const key of Object.keys(schema)) {
    if (!supported.has(key)) {
      throw new AppError({
        code: 'COMMAND_INPUT_SCHEMA_UNSUPPORTED',
        message: `Published command schema uses unsupported keyword: ${key}`,
        module: 'command',
        operation: 'validateCommandInput',
        details: { keyword: key }
      });
    }
  }
  validateValue(input, schema, '$');
}

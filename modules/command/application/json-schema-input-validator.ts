import { AppError } from '../../../platform/contracts/src/index.js';
import type { JsonObject, JsonValue } from '../../metadata/api/contracts.js';

function fail(path: string, message: string): never {
  throw new AppError({ code: 'COMMAND_INPUT_SCHEMA_VIOLATION', message, module: 'command', operation: 'validateInput', details: { path } });
}
function isObject(v: unknown): v is Record<string, JsonValue> { return typeof v === 'object' && v !== null && !Array.isArray(v); }
function check(value: JsonValue | undefined, schema: JsonObject, path: string): void {
  const type = schema['type'];
  if (typeof type !== 'string') fail(path, 'Published command schema must declare a supported type.');
  if (type === 'object') {
    if (!isObject(value)) fail(path, 'Expected object.');
    const props = isObject(schema['properties']) ? schema['properties'] : {};
    const required = Array.isArray(schema['required']) ? schema['required'].filter((x): x is string => typeof x === 'string') : [];
    for (const key of required) if (!(key in value)) fail(`${path}/${key}`, 'Required property is missing.');
    if (schema['additionalProperties'] === false) for (const key of Object.keys(value)) if (!(key in props)) fail(`${path}/${key}`, 'Additional property is not allowed.');
    for (const [key, child] of Object.entries(props)) if (isObject(child) && key in value) check(value[key], child, `${path}/${key}`);
    return;
  }
  if (type === 'array') { if (!Array.isArray(value)) fail(path, 'Expected array.'); return; }
  if (type === 'string') { if (typeof value !== 'string') fail(path, 'Expected string.'); }
  else if (type === 'number') { if (typeof value !== 'number' || !Number.isFinite(value)) fail(path, 'Expected finite number.'); }
  else if (type === 'integer') { if (typeof value !== 'number' || !Number.isInteger(value)) fail(path, 'Expected integer.'); }
  else if (type === 'boolean') { if (typeof value !== 'boolean') fail(path, 'Expected boolean.'); }
  else fail(path, `Unsupported schema type ${type}.`);
  const enumValues = schema['enum'];
  if (Array.isArray(enumValues) && !enumValues.some((x) => x === value)) fail(path, 'Value is not in enum.');
}

/** Minimal fail-closed subset used by EVO-published command schemas. */
export function validateCommandInput(input: JsonObject, schema: JsonObject): void { check(input, schema, ''); }

import { AppError } from '../../../platform/contracts/src/index.js';
import type { JsonObject, JsonValue } from '../../metadata/api/contracts.js';

const SUPPORTED = new Set([
  'type', 'properties', 'required', 'additionalProperties', 'items', 'enum',
  'minLength', 'maxLength', 'minimum', 'maximum', 'description', '$schema', '$id', 'title'
]);
const TYPES = new Set(['object','array','string','number','integer','boolean','null']);

function isObject(value: JsonValue | undefined): value is Readonly<Record<string, JsonValue>> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function unsupported(path: string, message: string): never {
  throw new AppError({ code:'COMMAND_INPUT_SCHEMA_UNSUPPORTED', message:`Published command schema is unsupported: ${message}`, module:'command', operation:'validateCommandInput', details:{ path } });
}
function assertSchema(schema: JsonObject, path: string): void {
  for (const key of Object.keys(schema)) if (!SUPPORTED.has(key)) unsupported(`${path}.${key}`, `keyword ${key}`);
  if (schema.type !== undefined && (typeof schema.type !== 'string' || !TYPES.has(schema.type))) unsupported(`${path}.type`, 'type must be a supported scalar type');
  if (schema.required !== undefined && (!Array.isArray(schema.required) || schema.required.some(x => typeof x !== 'string'))) unsupported(`${path}.required`, 'required must be an array of strings');
  if (schema.additionalProperties !== undefined && typeof schema.additionalProperties !== 'boolean') unsupported(`${path}.additionalProperties`, 'only boolean additionalProperties is supported');
  if (schema.enum !== undefined && !Array.isArray(schema.enum)) unsupported(`${path}.enum`, 'enum must be an array');
  for (const key of ['minLength','maxLength','minimum','maximum'] as const) if (schema[key] !== undefined && typeof schema[key] !== 'number') unsupported(`${path}.${key}`, `${key} must be numeric`);
  if (schema.properties !== undefined) {
    if (!isObject(schema.properties)) unsupported(`${path}.properties`, 'properties must be an object');
    for (const [key, child] of Object.entries(schema.properties)) {
      if (!isObject(child)) unsupported(`${path}.properties.${key}`, 'property schema must be an object');
      assertSchema(child, `${path}.properties.${key}`);
    }
  }
  if (schema.items !== undefined) {
    if (!isObject(schema.items)) unsupported(`${path}.items`, 'items must be an object schema');
    assertSchema(schema.items, `${path}.items`);
  }
}
function matchesType(value: JsonValue | undefined, type: string): boolean {
  switch (type) {
    case 'object': return isObject(value); case 'array': return Array.isArray(value); case 'string': return typeof value === 'string';
    case 'number': return typeof value === 'number' && Number.isFinite(value); case 'integer': return typeof value === 'number' && Number.isInteger(value);
    case 'boolean': return typeof value === 'boolean'; case 'null': return value === null; default: return false;
  }
}
function fail(path: string, message: string): never {
  throw new AppError({ code:'COMMAND_INPUT_SCHEMA_INVALID', message:`Command input does not satisfy the published schema: ${message}`, module:'command', operation:'validateCommandInput', details:{ path } });
}
function validateValue(value: JsonValue | undefined, schema: JsonObject, path: string): void {
  const type=schema.type; if(typeof type==='string'&&!matchesType(value,type)) fail(path,`expected ${type}`);
  if(Array.isArray(schema.enum)&&!schema.enum.some(item=>JSON.stringify(item)===JSON.stringify(value))) fail(path,'value is not in enum');
  if(typeof value==='string'){ if(typeof schema.minLength==='number'&&value.length<schema.minLength) fail(path,'string is shorter than minLength'); if(typeof schema.maxLength==='number'&&value.length>schema.maxLength) fail(path,'string is longer than maxLength'); }
  if(typeof value==='number'){ if(typeof schema.minimum==='number'&&value<schema.minimum) fail(path,'number is below minimum'); if(typeof schema.maximum==='number'&&value>schema.maximum) fail(path,'number is above maximum'); }
  if(isObject(value)){
    if(Array.isArray(schema.required)) for(const key of schema.required) if(typeof key==='string'&&!(key in value)) fail(`${path}.${key}`,'required property is missing');
    const properties=schema.properties; if(isObject(properties)) for(const [key,child] of Object.entries(properties)) if(key in value&&isObject(child)) validateValue(value[key],child,`${path}.${key}`);
    if(schema.additionalProperties===false&&isObject(properties)) for(const key of Object.keys(value)) if(!(key in properties)) fail(`${path}.${key}`,'additional property is not allowed');
  }
  if(Array.isArray(value)&&isObject(schema.items)) value.forEach((item,index)=>validateValue(item,schema.items as JsonObject,`${path}[${index}]`));
}

/** EVO deliberately supports a deterministic JSON-Schema subset. Any unsupported or malformed published schema fails closed. */
export function validateCommandInput(input: JsonObject, schema: JsonObject): void {
  assertSchema(schema,'$schema');
  validateValue(input,schema,'$');
}

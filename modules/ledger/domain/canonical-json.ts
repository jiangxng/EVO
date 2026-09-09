import { createHash } from 'node:crypto';
import type {
  JsonObject,
  JsonValue
} from '../../metadata/api/contracts.js';

function canonicalValue(value: JsonValue): string {
  if (value === null) return 'null';

  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error('JSON canonicalization does not allow non-finite numbers.');
    }
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(canonicalValue).join(',')}]`;
  }

  const object = value as JsonObject;
  const keys = Object.keys(object).sort();
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${canonicalValue(object[key]!)}`)
    .join(',')}}`;
}

export function canonicalizeJson(value: JsonObject): string {
  return canonicalValue(value);
}

export function dimensionHash(dimensions: JsonObject): string {
  return createHash('sha256')
    .update(canonicalizeJson(dimensions), 'utf8')
    .digest('hex');
}

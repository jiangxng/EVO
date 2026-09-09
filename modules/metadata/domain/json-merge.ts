import type { JsonObject, JsonValue } from '../api/contracts.js';

function isObject(value: JsonValue): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * EVO M1 overlay semantics:
 * - object keys merge recursively
 * - arrays replace
 * - scalar values replace
 * - null is a real value, not a delete instruction
 *
 * Field-level structural overlay evolution remains a future design concern.
 */
export function mergeJsonObjects(
  base: JsonObject,
  patch: JsonObject
): JsonObject {
  const result: Record<string, JsonValue> = { ...base };

  for (const [key, patchValue] of Object.entries(patch)) {
    const baseValue = result[key];

    if (
      baseValue !== undefined &&
      isObject(baseValue) &&
      isObject(patchValue)
    ) {
      result[key] = mergeJsonObjects(baseValue, patchValue);
      continue;
    }

    result[key] = patchValue;
  }

  return result;
}

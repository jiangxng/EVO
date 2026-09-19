import { describe, expect, it } from 'vitest';
import type { FieldDefinition } from '../api/contracts.js';
import { deriveFieldGroups, resolveFieldGroupCode } from '../api/field-groups.js';

const field = (code: string, fieldGroup?: string): FieldDefinition => ({
  id: code, code, label: code, dataType: 'string', required: false, referenceMode: null, sortOrder: 0,
  config: fieldGroup === undefined ? {} : { fieldGroup }
});

describe('field group semantics', () => {
  it('preserves legacy fields through the deterministic default group', () => {
    expect(resolveFieldGroupCode(field('customer'))).toBe('default');
  });
  it('derives stable semantic groups independent of field order', () => {
    const first = deriveFieldGroups([field('b', 'shipping'), field('a', 'header')]);
    const second = deriveFieldGroups([field('a', 'header'), field('b', 'shipping')]);
    expect(first).toEqual(second);
    expect(first.map((x) => x.code)).toEqual(['header', 'shipping']);
  });
});

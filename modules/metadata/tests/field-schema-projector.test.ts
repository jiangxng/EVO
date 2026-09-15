import { describe, expect, it } from 'vitest';
import type { FieldDefinition } from '../api/contracts.js';
import { projectFieldsToCommandInputSchema } from '../api/field-schema-projector.js';

const field = (code: string, dataType: string, required: boolean, sortOrder: number, config = {}): FieldDefinition => ({
  id: `field-${code}`, code, label: code, dataType, required, referenceMode: null, sortOrder, config
});

describe('FieldDefinition -> Command input JSON Schema', () => {
  it('projects stable field semantics and rejects undeclared input', () => {
    expect(projectFieldsToCommandInputSchema([
      field('quantity', 'number', true, 20), field('orderNo', 'string', true, 10), field('note', 'text', false, 30)
    ])).toEqual({
      type: 'object',
      properties: { orderNo: { type: 'string' }, quantity: { type: 'number' }, note: { type: 'string' } },
      required: ['orderNo', 'quantity'],
      additionalProperties: false
    });
  });

  it('supports explicit field-owned command projection and exclusion', () => {
    expect(projectFieldsToCommandInputSchema([
      field('customer', 'uuid', true, 1, { commandSchema: { type: 'string', format: 'uuid' } }),
      field('displayOnly', 'string', false, 2, { commandInput: false })
    ])).toEqual({
      type: 'object', properties: { customer: { type: 'string', format: 'uuid' } }, required: ['customer'], additionalProperties: false
    });
  });

  it('fails closed for an unsupported field data type', () => {
    expect(() => projectFieldsToCommandInputSchema([field('mystery', 'magic', false, 1)])).toThrow('UNSUPPORTED_FIELD_DATA_TYPE');
  });
});

import { describe, expect, it } from 'vitest';
import { mergeJsonObjects } from '../domain/json-merge.js';

describe('mergeJsonObjects', () => {
  it('merges objects recursively and replaces arrays/scalars', () => {
    const result = mergeJsonObjects(
      {
        a: { x: 1, y: 2 },
        list: [1, 2],
        flag: true
      },
      {
        a: { y: 9 },
        list: [3],
        flag: false
      }
    );

    expect(result).toEqual({
      a: { x: 1, y: 9 },
      list: [3],
      flag: false
    });
  });

  it('treats null as an explicit value', () => {
    expect(
      mergeJsonObjects({ a: { x: 1 } }, { a: null })
    ).toEqual({ a: null });
  });
});

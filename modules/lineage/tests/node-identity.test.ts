import { describe, expect, it } from 'vitest';
import {
  ECONOMIC_RUNTIME_DEPENDENCY_GRAPH_VERSION,
  versionedDependencyNodeId
} from '../domain/node-identity.js';

describe('calculation dependency node identity', () => {
  it('creates stable version-qualified node ids', () => {
    expect(versionedDependencyNodeId('policy-1',2)).toBe('policy-1@v2');
  });

  it('pins the economic runtime dependency graph version', () => {
    expect(ECONOMIC_RUNTIME_DEPENDENCY_GRAPH_VERSION)
      .toBe('economic-runtime-v0.1');
  });
});

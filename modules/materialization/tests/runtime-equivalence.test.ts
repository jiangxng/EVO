import { describe, expect, it } from 'vitest';
import { evaluateRuntimeEquivalence } from '../domain/runtime-equivalence.js';

const exact = {
  candidateBuilding: true,
  oracleVerified: true,
  oracleBoundToCandidate: true,
  semanticScopeMatches: true,
  activeParentMatches: true,
  checkpointActive: true,
  promotionActive: true,
  oracleStoredDigest: 'a'.repeat(64),
  oracleComputedDigest: 'a'.repeat(64),
  candidateComputedDigest: 'a'.repeat(64)
} as const;

describe('runtime equivalence activation gate', () => {
  it('admits only an exact governed Candidate/Oracle match', () => {
    expect(evaluateRuntimeEquivalence(exact)).toEqual([]);
  });

  it('fails closed when semantic digests differ', () => {
    expect(evaluateRuntimeEquivalence({
      ...exact,
      candidateComputedDigest: 'b'.repeat(64)
    })).toContain('SEMANTIC_DIGEST_MISMATCH');
  });

  it('fails closed when the active parent changed after computation', () => {
    expect(evaluateRuntimeEquivalence({
      ...exact,
      activeParentMatches: false
    })).toContain('STALE_ACTIVE_PARENT');
  });

  it('detects Oracle derived-state drift after verification', () => {
    expect(evaluateRuntimeEquivalence({
      ...exact,
      oracleStoredDigest: 'c'.repeat(64)
    })).toContain('ORACLE_STORED_DIGEST_DRIFT');
  });
});

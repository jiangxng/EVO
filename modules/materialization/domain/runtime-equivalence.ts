import type { RuntimeEquivalenceBlocker } from '../api/runtime-equivalence-certification.js';

export interface RuntimeEquivalenceEvaluationInput {
  readonly candidateBuilding: boolean;
  readonly oracleVerified: boolean;
  readonly oracleBoundToCandidate: boolean;
  readonly semanticScopeMatches: boolean;
  readonly activeParentMatches: boolean;
  readonly checkpointActive: boolean;
  readonly promotionActive: boolean;
  readonly postingCursorWithinCandidate: boolean;
  readonly oracleStoredDigest: string | null;
  readonly oracleComputedDigest: string;
  readonly candidateComputedDigest: string;
}

export function evaluateRuntimeEquivalence(
  input: RuntimeEquivalenceEvaluationInput
): readonly RuntimeEquivalenceBlocker[] {
  const blockers: RuntimeEquivalenceBlocker[] = [];
  if (!input.candidateBuilding) blockers.push('CANDIDATE_NOT_BUILDING');
  if (!input.oracleVerified) blockers.push('ORACLE_NOT_VERIFIED');
  if (!input.oracleBoundToCandidate) blockers.push('ORACLE_NOT_BOUND_TO_CANDIDATE');
  if (!input.semanticScopeMatches) blockers.push('SEMANTIC_SCOPE_MISMATCH');
  if (!input.activeParentMatches) blockers.push('STALE_ACTIVE_PARENT');
  if (!input.checkpointActive) blockers.push('CHECKPOINT_NOT_ACTIVE');
  if (!input.promotionActive) blockers.push('PROMOTION_NOT_ACTIVE');
  if (!input.postingCursorWithinCandidate) blockers.push('POSTING_CURSOR_AHEAD_OF_CANDIDATE');
  if (input.oracleStoredDigest !== input.oracleComputedDigest) {
    blockers.push('ORACLE_STORED_DIGEST_DRIFT');
  }
  if (input.candidateComputedDigest !== input.oracleComputedDigest) {
    blockers.push('SEMANTIC_DIGEST_MISMATCH');
  }
  return blockers;
}

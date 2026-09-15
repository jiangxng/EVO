# EVO -> Architecture Convergence Handoff

Phase: Upstream Readiness  
Branch: `convergence/upstream-readiness-v0.2.1`  
Base EVO commit: `45f77e448e4fe4ce6b5e828c40dea8cfbe2d073a`  

Read first: `docs/integration/convergence/UPSTREAM-READINESS-v0.2.1.md`.

## Current readiness

| Boundary | Status |
|---|---|
| Shared Envelope | PARTIAL |
| Enterprise Observation provider | PARTIAL |
| Command Proposal admission | PARTIAL |
| ActionRequest -> EVO mapping | GAP |
| Enterprise Context provider | PARTIAL |
| Operational Change Proposal governance | GAP |
| Enterprise Simulation provider | PARTIAL |

## Certification hook

EVO provides `platform/testing/convergence/external-fixtures.ts`. Convergence certification may supply its fixture checkout using `EVO_CONVERGENCE_FIXTURE_ROOT`. EVO intentionally does not duplicate canonical schemas or fixtures.

## First requested certification slice

`Enterprise Observation -> Command Proposal admission -> ActionRequest/Host mapping -> EVO Command -> new Enterprise Observation`.

## Known EVO blockers/gaps

There is no cross-repo architecture blocker. Product implementation gaps are:

1. published Command input schemas are currently too weak in the alpha.2 demo and `CommandService` does not yet enforce JSON-schema validation;
2. no canonical Enterprise Observation provider/projection exists yet;
3. no Command Proposal admission adapter exists yet;
4. no Host-neutral ActionRequest -> EVO mapping adapter/profile exists yet;
5. no stable cross-system CommandDefinition projection exists yet;
6. APM alternate-supplier procurement action is absent from current Command catalog;
7. Enterprise Context remains a demo/read-model asset rather than governed provider;
8. Operational Change Proposal and generic Hypothetical Simulation remain later implementation gaps.

## Cross-repository rule

Do not ask EC/Eidos/Host to import EVO modules or access EVO storage. Any missing cross-system semantic requirement returns to Convergence as a CRCP; EVO implementation-specific work stays in EVO.

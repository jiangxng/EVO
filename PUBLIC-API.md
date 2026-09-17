# EVO Public API Contract

Status: Authoritative Contract Overview
Version: 1.0-alpha.2

## Boundary Philosophy

Public write APIs represent business Commands. They do not expose direct writes to BusinessData, LedgerEntry, LedgerBalance, CostResult, WorkItem or Replay internals.

A client may be a human UI, mobile tool, scanner, AI agent, automation, portal or external integration. Actor type does not bypass the Command boundary.

## Contract Requirements

Every public Command request must define:

- enterprise scope
- application/capability target
- command code
- actor identity and permission scope
- idempotency key
- correlation id
- effective business time
- business object key
- schema-versioned input

Public responses expose stable execution identifiers and status. Internal implementation classes, SQL schema and worker details are not public API.

## Current v1.0-alpha.2 Reference Endpoints

The `/api/v1/demo/*` endpoints are validation/reference endpoints and are not yet general production API commitments.

Reference business chain:

1. `POST /api/v1/demo/sales-orders/approve`
2. `POST /api/v1/demo/production/complete`
3. `POST /api/v1/demo/shipments/create`
4. `POST /api/v1/demo/cost/recalculate`
5. `POST /api/v1/demo/replay`
6. `GET /api/v1/demo/dashboard`

Legacy generic inventory receipt/shipment endpoints from v0.9 are implementation-validation endpoints and must not be used as the semantic model for v1.0.

## Error Contract

Errors use the stable envelope:

```json
{
  "error": {
    "code": "STABLE_MACHINE_CODE",
    "message": "human readable message",
    "retryable": false,
    "details": {},
    "correlation_id": "..."
  }
}
```

## Idempotency

A repeated Command with the same idempotency scope/key returns the prior completed result. It must not create a second BusinessData record.

## Versioning

Additive changes are preferred. Breaking behavior or schema changes require an explicit version transition and compatibility policy. Historical Replay must not depend on whatever definition happens to be latest at replay time.

## v1.0.0-alpha.2 additions

### Dimension contracts
- `DimensionDefinition`: governed analytical key.
- `LedgerDefinition.dimension_schema`: `{ required?: string[], optional?: string[], forbidden?: string[] }`.
- Posting effects continue to use `dimensions`, but are now validated against published DimensionDefinitions and the target Ledger policy.

### Valuation Posting
`ValuationPostingService.postCostResult(costResultId)` converts a pinned CostResult into Inventory Value / COGS LedgerEntries. Reposting an identical target is `NO_CHANGE`; a changed target posts only the delta.

### Cost recalculation
`CostEngine.recalculate(enterpriseId, method, pins?)` supports explicit replay pins for ValuationPolicy and ValuationRule versions.

### Replay
`prepareFullReplay()` returns the preserved cost method and cost pins needed to reconstruct the pre-replay valuation semantics.

# Valuation Posting Interface

Purpose: turn CostResult into deterministic inventory-value and COGS ledger effects.

Owner: valuation
Caller: cost runtime / replay orchestration
Input: cost_result id
Output: ValuationPostingResult
Preconditions: CostResult exists; source BusinessData exists; published ValuationRule exists; target ledgers exist; required dimensions resolve.
Postconditions: reflected valuation position equals target CostResult total; exactly two effects for non-zero delta in the reference shipment rule.
Invariants: no Command; no BusinessData write; explicit dimension mapping; deterministic delta; idempotent on identical target cost.
Transaction Boundary: valuation run, ledger entries, balances and valuation position commit atomically.
Ordering Guarantee: valuation follows cost calculation for the source BusinessData.
Idempotency: same reflected target cost => NO_CHANGE.
Consistency: same active ledger dataset as operational posting.
Error Contract: structured AppError for missing rules/ledgers/dimensions.
Versioning: valuation_rule.version is persisted on run and ledger entries.

## Dimension mapping modes

A ValuationRule may use the historical flat mapping form when both valuation legs share the same dimensions:

```json
{
  "product_id": { "type": "field", "path": "productId" },
  "warehouse": { "type": "field", "path": "warehouse" }
}
```

For value transfer between different dimensional identities, the rule may use an explicit two-leg form:

```json
{
  "source": {
    "product_id": { "type": "field", "path": "productId" },
    "warehouse": { "type": "field", "path": "sourceWarehouse" }
  },
  "target": {
    "product_id": { "type": "field", "path": "productId" },
    "warehouse": { "type": "field", "path": "destinationWarehouse" }
  }
}
```

The first valuation leg uses `source`; the second uses `target`.

This is a dimension-aware value-transfer primitive, not an inventory-transfer-specific runtime. Existing flat rules remain backward compatible.


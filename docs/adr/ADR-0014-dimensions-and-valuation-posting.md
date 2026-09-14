# ADR-0014 — Explicit Dimensions and Valuation Posting

Status: Accepted for v1.0.0-alpha.2.

## Decisions

1. Ledger measurement semantics (quantity/amount) are orthogonal to analytical dimensions.
2. Dimension values never propagate implicitly from BusinessData.
3. Ledger policies declare required/optional/forbidden dimensions.
4. Posting rules and valuation rules explicitly map source data to dimensions.
5. CostResult is derived calculation output, not BusinessData.
6. CostResult never mutates LedgerBalance directly. Valuation Posting creates LedgerEntry records.
7. Recalculation posts only the delta from the currently reflected valuation position.
8. Replay clears derived cost/valuation state and deterministically rebuilds it.

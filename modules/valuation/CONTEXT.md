# Valuation Context

Valuation is a derived-accounting boundary, separate from business posting.

- Input: persisted `CostResult` plus pinned `ValuationRule`.
- Output: ordinary `ledger_entry` rows with `entry_source_kind=VALUATION`.
- Idempotency/recalculation: `valuation_position` stores the currently reflected total cost per business datum/rule; only the delta is posted.
- Replay removes derived valuation state and recalculates from preserved BusinessData using pinned/selected policy and published valuation rule.
- Dimension mapping is explicit and validated through the same ledger dimension policy as normal posting.

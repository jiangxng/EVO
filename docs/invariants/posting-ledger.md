# Posting / Ledger Invariants

1. Canonical Posting order is `(effective_at, posting_priority, posting_sequence)`.
2. Normal Posting must not advance while `replay_required = true`.
3. Posting commits only the first eligible canonical queued input for an Enterprise consistency domain.
4. Posting rule evaluation is deterministic for the same BusinessData and metadata version.
5. Posting rule execution cannot execute arbitrary JavaScript or SQL.
6. Authoritative decimal arithmetic does not use binary floating-point fractional values.
7. A failed Posting transaction leaves no partial LedgerEntry set.
8. LedgerEntry + LedgerBalance + PostingInput POSTED + high-water advance are atomic.
9. High-water advances only after Ledger effects have been committed in the same transaction.
10. One PostingInput cannot create a second authoritative LedgerEntry set in the same LedgerDataset.
11. LedgerBalance is derived from LedgerEntry and is rebuildable.
12. Dimensions have deterministic canonical identity and SHA-256 hash.
13. Ledger code must resolve through LedgerDefinition; rules do not invent ledgers at runtime.
14. Ledger records retain PostingInput, BusinessData, PostingRule and PostingRun lineage.
15. Posting arrival order is not authoritative ordering.
16. LedgerDataset identity exists from M3 to preserve future replay candidate-dataset evolution.

# Dimensions

Owns analytical/accounting dimension semantics. A dimension is not a BusinessData field and is never propagated merely because a source payload contains a similarly named field.

Canonical rule: **dimensions are explicitly defined, ledger policies explicitly declare allowed/required dimensions, and posting/valuation rules explicitly map source semantics into ledger dimension values.**

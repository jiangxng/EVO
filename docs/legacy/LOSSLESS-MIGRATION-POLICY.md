# Legacy → EVO Lossless Migration Policy

Status: AUTHORITATIVE

## Objective
Preserve eleven years of accumulated business knowledge from Asloop-Backend and bookkeeping without allowing legacy implementation constraints to redefine EVO architecture.

## Invariant
No legacy datum or semantic detail may disappear because of context-window, token, file-size, implementation convenience, or because EVO cannot yet express it.

Every discovered source item MUST have a migration disposition: PRESERVED, TRANSFORMED, MERGED, SPLIT, LEGACY_ONLY, DEPRECATED, or UNRESOLVED. DEPRECATED does not mean deleted: provenance and original content remain retained.

## Conservation
For each source dataset, source cardinality must be reconciled against migration evidence. A reduction in normalized definitions is valid only when every source item remains traceable to its disposition and target(s).

## Processing stages
RAW INVENTORY → CLASSIFICATION → NORMALIZATION → EVO MAPPING → TEMPLATE → INSTALLATION.

Raw evidence is immutable. Normalized outputs never replace raw evidence. Generated templates never become the only record of legacy meaning.

## Batches
01 schema inventory
02 master metadata
03 fields
04 transaction types
05 transaction-field relations
06 directions
07 calculation relations
08 expressions
09 accounts/policies/dimensions
10 balances/cost
11 code semantic rules
12 cross-reference and conservation

Each batch is persisted as repository artifacts so future LLM work reads files rather than relying on chat memory.

## Architectural boundary
Preserve business semantics. Do not migrate legacy physical schemas, mutable historical balance chains, dynamic-SQL accounting, stored-procedure accounting, controller/DAO/UI coupling, implicit-latest semantics, or direct cost-to-balance mutation into EVO runtime.

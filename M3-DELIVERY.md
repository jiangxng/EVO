# EVO M3 — Posting + Ledger Delivery

## Delivered

- deterministic PostingService
- canonical queue selection
- EnterpriseRuntimeState lock before authoritative posting
- race revalidation
- replay-required blocking
- controlled JSON expression AST
- decimal-safe arithmetic
- PostingRule evaluator
- PostingRun
- LedgerDataset
- LedgerEntry
- LedgerBalance
- SHA-256 canonical dimension identity
- LedgerReader / LedgerWriter
- structured PostingFailure
- high-water advancement
- Posting/Ledger atomic transaction
- tests for expressions/rules/dimension identity
- Posting/Ledger interface contract
- invariants
- ADR-0004 / 0005
- cross-platform repository path invariant
- `.gitattributes`
- lowercase normalization of prior invariant document filenames
- ADR-0006

## Critical correctness property

```text
LedgerEntry[]
+ LedgerBalance
+ PostingInput POSTED
+ Posting High-Water
```

commit together or not at all.

## Numeric rule

Authoritative fractional quantity/amount values are decimal strings.

Example:

```json
{
  "quantity": 20,
  "unitPrice": "12.50"
}
```

The rule engine computes `"250"` using arbitrary-precision decimal arithmetic.

## Windows-safe repository change

M3 normalizes prior invariant-document names and adds CI checks for:

- case-insensitive collisions
- Unicode-normalized collisions
- Windows-invalid characters
- reserved Windows names
- trailing dots/spaces

## Next

M4 — Work Loop.

Before M4, the first Sales Order posting scenario can now be wired through:

```text
Approve Sales Order
→ BusinessData
→ PostingInput
→ 待生产 / 待出库 / 待收款 Ledger
→ LedgerBalance
```

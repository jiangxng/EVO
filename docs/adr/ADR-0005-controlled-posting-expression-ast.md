# ADR-0005 — Controlled Posting Expression AST

**Status:** ACCEPTED  
**Milestone:** M3

## Decision

Posting conditions/formulas use a versioned controlled JSON AST.

M3 nodes:

```text
literal
field
not
and
or
eq ne gt gte lt lte
add sub mul div
```

## Rejected

- arbitrary JavaScript
- `eval`
- user SQL
- arbitrary stored procedures as rule expressions

## Numeric rule

Fractional authoritative values must enter as decimal strings.

Safe integers may use JSON integer values.

Arithmetic uses `decimal.js`.

## Consequences

- deterministic execution
- inspectable metadata
- machine-readable rule contracts
- safer AI generation
- easier replay and testing
- future AST nodes require schema-version evolution

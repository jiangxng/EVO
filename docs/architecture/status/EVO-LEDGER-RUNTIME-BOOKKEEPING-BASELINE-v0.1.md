# EVO Ledger Runtime Bookkeeping Baseline v0.1

**Document class:** CURRENT_AUTHORITY  
**Status:** Candidate release baseline  
**Date:** 2026-10-04

## Purpose

This baseline is the complete definition corpus used to validate the Ledger
Runtime Configurator against the historical bookkeeping configuration.

It is not demo data and it is not the simplified Enterprise Core reference
template.

## Source

Repository:

`jiangxng/bookkeeping`

Pinned commit:

`d5628952a90f0753d32fa7c752948695c49a53a5`

Definition files:

- `src/main/resources/app.sql`
- `src/main/resources/accounts.sql`
- `src/main/resources/policy.sql`

Enterprise instance / transaction data is not included.

## Complete source counts

- applications: **143**
- accounts / ledgers: **141**
- posting policies: **912**
- applications referenced by policies: **117**
- accounts referenced by policies: **141**
- missing application references: **0**
- missing account references: **0**

The 26 applications without a posting policy remain preserved in the source
definition. They are not silently deleted.

Historical application state labels such as `测试通过`, `未配置`, `Bug`,
`测试不通过` and null remain source evidence. They do not independently
determine current EVO runtime eligibility.

## Expression compilation

The bookkeeping policy corpus uses Aviator-style expressions.

The v0.1 compiler deterministically translates the corpus to EVO expression IR.

Observed corpus:

- unique expressions: **397**
- expression uses: **1963**
- successfully compiled expression uses: **1963**
- failed expression uses: **0**
- compiled PostingRules: **912 / 912**

Observed functions are limited to:

- `include(...)`
- `string.split(...)`

Observed operators are covered by EVO IR:

- boolean `&&`, `||`, `!`
- comparison `==`, `!=`, `>`, `>=`, `<`, `<=`
- arithmetic `+`, `-`, `*`, `/`
- conditional `?:`

## Artifact

Authoritative checked-in artifact:

`reference/ledger-runtime/bookkeeping-account-foundation-2022-v0.1.json`

The artifact contains both:

1. **sourceDefinition** — lossless normalized projection of all 143 applications,
   141 accounts and 912 policies including source-only metadata; and
2. **compiledConfiguration** — the exact
   `evo.ledger-runtime.compiled-configuration` body accepted by the Configurator
   burn endpoint.

The compiled configuration contains all 143 application identities, all 141
ledger identities and all 912 executable rules.

## Reproducibility gate

CI reads the checked-in sourceDefinition and recompiles all 912 rules with
`compileBookkeepingBaselineV010`.

The resulting compiled configuration MUST exactly equal the checked-in
compiledConfiguration, including its semantic digest.

A mismatch is a release blocker.

## Release meaning

This artifact is suitable as a **Ledger Runtime validation/bootstrap candidate**.

It proves complete source capture and deterministic compilation for the
bookkeeping in-boundary corpus.

Production release still requires the normal runtime verification gates,
including burn into a clean runtime database and representative posting /
balance behavior checks. Historical source application state labels are
preserved and must not be misrepresented as modern certification results.

## Template Store boundary

Template Store may distribute an immutable snapshot of this artifact.

Template Store must not become the authority for the Ledger Runtime baseline;
EVO owns this source artifact and compiler.

A Template Store copy is therefore a distribution snapshot pinned to the EVO
artifact version/digest.

# EVO Global Invariants

Status: Authoritative
Context Version: 1.0

These rules are architecture constraints, not implementation suggestions.

- INV-001: Every write that creates Actual BusinessData must pass through the Command boundary.
- INV-002: Business history is preserved; historical BusinessData is not silently rewritten to represent later state.
- INV-003: Replay never executes Commands.
- INV-004: Replay reconstruction ordering is deterministic by canonical posting key.
- INV-005: AI, Human, Automation and External System actors use governed Command capabilities.
- INV-006: Application/UI cannot own an independent authoritative fact system.
- INV-007: LedgerEntry is derived from governed posting inputs and rules; LedgerBalance is a projection.
- INV-008: CostResult cannot silently mutate LedgerBalance. Valuation changes require an explicit deterministic valuation-posting contract.
- INV-009: Scenario results cannot enter Actual Ledger without an authorized Decision/Approval followed by Command.
- INV-010: Capability classifies enterprise ability; it does not execute transactions by itself.
- INV-011: Flow may cross Domains, Applications, Processes and Ledgers.
- INV-012: Business object relationships and fulfillment must be explicit; the runtime must not infer them from matching quantities.
- INV-013: Published SOP and metadata versions are immutable in place; changes produce a new version.
- INV-014: Published MetricDefinition is the source of formal metric semantics.
- INV-015: Historical reconstruction must use deterministic/persisted version selection, never implicit latest-version semantics.
- INV-016: Breaking public contract changes require a version change, compatibility statement, migration and tests.
- INV-017: Core semantic changes to Command → BusinessData → Posting → Ledger → Cost require an Architecture Change record.
- INV-018: Repository documentation, contracts and tests are authoritative over chat history or LLM memory.

## Alpha.2 Dimensions + Valuation Posting

### DIM-01 — Explicit Dimension Definition
Every dimension key persisted on a LedgerEntry must have a published DimensionDefinition applicable to the enterprise.

### DIM-02 — Ledger Dimension Policy
Each LedgerDefinition explicitly declares required/optional/forbidden analytical dimensions.

### DIM-03 — No Implicit Dimension Propagation
A field present on BusinessData does not become a LedgerEntry dimension unless a versioned PostingRule or ValuationRule explicitly maps it.

### DIM-04 — Enterprise Concepts Remain Distinct
Project, Department, Profit Center, Cost Center, Product and other enterprise concepts are not collapsed into one generic business object merely because they can all be analytical dimensions.

### VAL-01 — CostResult Does Not Mutate LedgerBalance
CostResult is derived calculation output. Ledger value changes occur only through Valuation Posting and LedgerEntry.

### VAL-02 — Valuation Does Not Create BusinessData
Valuation Posting is derived accounting and must not call Command or create Actual BusinessData.

### VAL-03 — Deterministic Delta Posting
Recalculation compares the target CostResult with the reflected valuation position. Identical target cost produces no duplicate ledger value; changed target cost posts only the deterministic delta.

### VAL-04 — Version Pinning
CostRun pins ValuationPolicy version. CostResult pins ValuationRule version. Replay must reuse those pins for historical reconstruction and must not silently select a newer rule.

### VAL-05 — Replay Rebuilds Valuation
Full Replay clears derived cost/valuation state, rebuilds operational posting, recalculates cost using pinned versions, and recreates valuation LedgerEntries before digest validation.

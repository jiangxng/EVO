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

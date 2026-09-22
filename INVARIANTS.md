# EVO Global Invariants

Status: **CONSTITUTIONAL / AUTHORITATIVE**
Context Version: 1.1

These rules are architecture constraints, not implementation suggestions. They are binding on humans, LLMs, migrations, generators, tests and future implementations. A later implementation MUST NOT silently weaken them. A deliberate constitutional change requires an explicit Architecture Change record, rationale, compatibility/data impact, migration plan and tests.

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

## LLM-Native Engineering Constitution

- INV-019 — Repository Is Memory: EVO MUST remain understandable and maintainable without access to the chat/model that created it. Architecture, ownership, interfaces, invariants, lineage, version semantics, migration decisions and non-obvious algorithms MUST be documented in-repository.
- INV-020 — Context Determinism: An LLM following the repository read order and authoritative artifacts MUST be able to recover the intended architecture without reconstructing historical conversations. When equal-authority sources conflict, implementation MUST stop until the conflict is explicitly resolved.
- INV-021 — Small Replaceable Modules: Implementation SHOULD be decomposed behind explicit contracts so an LLM can modify one bounded module without loading the whole system. Dependency direction and ownership MUST remain explicit.
- INV-022 — Explain Non-Obvious Semantics: Code alone is not sufficient documentation for business invariants, replay ordering, accounting direction, cost propagation, allocation, version selection or migration decisions. Those semantics MUST have adjacent durable documentation and executable tests.
- INV-023 — Deterministic Runtime Without LLM: EVO Instance runtime MUST remain fully operational without an LLM. LLMs may design, analyze, compile or propose outside runtime; deterministic EVO services execute authoritative operations.

## Eleven-Year Legacy Preservation Constitution

Asloop-Backend is the older and broader calculation/ERP implementation. `bookkeeping` is a later simplification of accounting/calculation semantics but is incomplete and does not supersede all Asloop behavior. Neither repository is copied as EVO architecture; both are evidence sources for LLM-native convergence.

- INV-024 — Lossless First: No source datum, metadata item, relation, expression, rule, code-encoded business semantic or historical test dataset from Asloop-Backend or bookkeeping may disappear merely because of context-window limits, token limits, file size, implementation convenience, apparent redundancy, or because EVO cannot yet express it.
- INV-025 — No Unjustified Deletion: Every discovered legacy item MUST receive a traceable disposition: PRESERVED, TRANSFORMED, MERGED, SPLIT, LEGACY_ONLY, DEPRECATED, or UNRESOLVED. DEPRECATED and UNRESOLVED content remains retained with provenance.
- INV-026 — Source Conservation: For every migrated source dataset, source cardinality and identity MUST reconcile to migration evidence. Normalization may reduce runtime definitions only when every source item remains traceable to its disposition and zero items are silently dropped.
- INV-027 — Raw Evidence Is Immutable: Raw legacy evidence and provenance are retained independently from normalized EVO definitions. Normalized data and generated Enterprise Templates never replace the source evidence record.
- INV-028 — Semantics Over Implementation: EVO MUST preserve useful business meaning while rejecting legacy implementation coupling such as physical legacy schemas, mutable historical balance chains, dynamic-SQL accounting, stored-procedure accounting, controller/DAO/UI coupling, implicit latest-version behavior and direct cost-to-balance mutation.
- INV-029 — Bookkeeping Is Not Complete Authority: Simplification found in bookkeeping MUST NOT be interpreted as evidence that broader Asloop semantics are obsolete. Where bookkeeping does not cover Asloop behavior, that Asloop behavior remains a migration candidate until explicitly classified with evidence.
- INV-030 — LLM-Native Rewrite: Legacy executable code is a semantic source, not a codebase to mechanically port. EVO implementations MUST be rewritten against canonical EVO contracts, deterministic invariants and bounded modules, with documentation sufficient for a different LLM to understand why the implementation exists.
- INV-031 — Batch Processing Must Be Lossless: Large datasets MAY be analyzed in batches, but batching MUST NOT become sampling. Batch manifests, counts, source locators and reconciliation MUST make the union of batches equivalent to the accounted source set.
- INV-032 — Full-Scale Data Validation: Migration and runtime architecture MUST preserve the ability to load and exercise complete enterprise-scale legacy-derived datasets for stress, replay, posting, balance, cost, lineage and deterministic reconstruction tests. Sample/demo data is never sufficient evidence of migration completeness.

## Financial Accounting Integrity Constitution

- INV-039 — Economic Ledger Is Not Automatically General Ledger: EVO's generic operational/economic Ledger remains an increase/decrease projection for quantities, obligations, positions, costs and management state. A ledger code such as cash, receivable, payable, inventory, revenue, expense or COGS MUST NOT be treated as proof that statutory/general-ledger double-entry accounting has been satisfied.
- INV-040 — General Ledger Uses Explicit Double Entry: Every authoritative General Ledger Journal MUST contain explicit debit/credit lines. A financial journal MUST NOT be committed if total debit amount differs from total credit amount in the journal accounting currency under the declared precision policy.
- INV-041 — No One-Sided General Ledger Posting: A canonical accounting projection MUST NOT create a one-sided General Ledger journal. A journal requires at least one debit line and at least one credit line; zero-value balancing lines are not acceptable substitutes for real accounting semantics.
- INV-042 — Journal Balance Is Transactional: Double-entry validation occurs before the accounting journal becomes authoritative. If debit/credit validation fails, the entire General Ledger projection for that journal fails atomically; partially committed journal lines are forbidden.
- INV-043 — Trial Balance Is Independently Verifiable: For every authoritative General Ledger dataset/period/accounting currency, EVO MUST be able to produce and validate a trial balance whose debit and credit totals reconcile exactly under the pinned accounting policy/version.
- INV-044 — Financial Statements Derive From General Ledger: Balance Sheet, Income Statement and Cash Flow Statement are governed projections from authoritative accounting state. They MUST NOT become an independent fact system or be made to balance by rewriting canonical BusinessData.
- INV-045 — Accounting Projection Remains Replayable: General Ledger journals, trial balance and financial statements are derived accounting results. They MUST be reproducible from canonical BusinessData/economic results plus explicitly pinned chart-of-accounts, recognition, posting, currency and period policies.

## Application Capability Exposure Constitution

- INV-033 — No Implicit Domain Capability: EVO Core MUST NOT imply that an enterprise owns a domain capability merely because EVO can host an application that provides it.
- INV-034 — Installed Application Governs Domain API Exposure: A domain API/capability is currently available only when its owning application instance and effective application definition/version satisfy the governed active-state requirements for that enterprise.
- INV-035 — Effective API Must Match Effective Capability Set: Runtime API discovery, generated API descriptions and callable domain routes MUST NOT advertise inactive, uninstalled or otherwise ineffective application capabilities as currently available.
- INV-036 — Domain Writes Still Use Command: Application-specific REST, agent or integration adapters MUST resolve to governed Command capabilities; installing an application does not create a second authoritative write path.
- INV-037 — Uninstall Does Not Erase History: Deactivation or uninstall removes current application capability exposure but MUST NOT silently delete historical BusinessData, Ledger history, lineage or replay evidence.
- INV-038 — Runtime Discovery Overrides Assumption: Human clients, integrations, automation and LLM agents MUST be able to determine current enterprise capabilities from governed runtime discovery. Prior sessions, demo APIs, another enterprise, static examples or model memory are not evidence that a capability is currently available.

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

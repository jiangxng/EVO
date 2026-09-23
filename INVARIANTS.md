# EVO Global Invariants

Status: **CONSTITUTIONAL / AUTHORITATIVE**
Context Version: 1.1

These rules are architecture constraints, not implementation suggestions. They are binding on humans, LLMs, migrations, generators, tests and future implementations. A later implementation MUST NOT silently weaken them. A deliberate constitutional change requires an explicit Architecture Change record, rationale, compatibility/data impact, migration plan and tests.

- INV-001: Every write that creates runtime BusinessData must pass through EVO's BusinessData ingestion boundary. A Host/Application MAY wrap that submission in its own Command model, but Command is not required by EVO Core.
- INV-002: BusinessData is append-only/immutable while it exists in the current runtime dataset; later state MUST NOT rewrite prior BusinessData in place. A deliberate governed Clear Cache MAY remove BusinessData for the selected scope.
- INV-003: Replay never executes Commands.
- INV-004: Replay reconstruction ordering is deterministic by canonical posting key.
- INV-005: Actor identity, permissions and business authorization are Host/plugin concerns. EVO Core receives trusted runtime submissions and MUST NOT own user/role/permission configuration.
- INV-006: Business Applications MAY own their source/domain data. EVO owns only the BusinessData currently submitted into its runtime dataset and the deterministic results derived from it.
- INV-007: LedgerEntry is derived from governed posting inputs and rules; LedgerBalance is a projection.
- INV-008: CostResult cannot silently mutate LedgerBalance. Valuation changes require an explicit deterministic valuation-posting contract.
- INV-009: EVO Core derives Ledger effects only from accepted runtime BusinessData plus supplied rules. Approval/decision policy is owned by Host/plugins.
- INV-010: Capability/Application lifecycle is not an EVO Core concept. If a Host exposes capabilities, it owns their discovery and lifecycle.
- INV-011: Flow/process semantics are outside minimal EVO Core; plugins may build them using EVO runtime data/results.
- INV-012: Business object relationships and fulfillment must be explicit; the runtime must not infer them from matching quantities.
- INV-013: SOP/application metadata lifecycle is outside EVO Core. Plugins/Host may version such definitions under their own contracts.
- INV-014: Metric/SOP/business semantic definitions are plugin concerns, not EVO Core runtime responsibilities.
- INV-015: EVO recalculation over retained runtime data MUST be deterministic for the exact runtime inputs and rule set supplied to Core. Core MUST NOT perform hidden rule/application version selection.
- INV-016: Breaking public contract changes require a version change, compatibility statement, migration and tests.
- INV-017: Core semantic changes to BusinessData ingestion → Posting → Ledger → Balance require an Architecture Change record.
- INV-018: Repository documentation, contracts and tests are authoritative over chat history or LLM memory.

## Minimal EVO Runtime Plugin Constitution

- INV-065 — EVO Is A Lightweight Runtime Plugin: EVO Core is an installable deterministic runtime plugin, not the enterprise/application platform.
- INV-066 — No Identity Or Permission Ownership: EVO Core MUST NOT own users, roles, permission configuration, authorization policy, organization/application membership or actor lifecycle.
- INV-067 — Minimal Application Identity Only: EVO Core MUST own a minimal stable ApplicationAnchor/applicationId used to route BusinessData to PostingRules. Rich ApplicationDefinition/ApplicationInstance lifecycle, Package/Feature lifecycle and capability discovery belong to the Host/App Platform.
- INV-068 — BusinessData Is The Core Input: EVO Core accepts generic BusinessData through a stable ingestion contract. Host/application Command models are optional adapters outside Core.
- INV-069 — Runtime Scope And Application Routing Are Distinct: EVO Core MAY require an opaque scope/tenant key for isolation and MUST require applicationId for rule routing. It MUST NOT require rich Enterprise/Application platform definitions to interpret either key.
- INV-070 — Current Rules Are Core Runtime Configuration: EVO Core stores/evaluates the current PostingRules supplied by plugins/Host. Every PostingRule MUST be anchored to applicationId. Rule editing, versioning, approval, effective dates and rollback remain outside Core.
- INV-071 — Higher-Order Engines Default To Plugins: Cost methods, valuation, General Ledger/statutory accounting, financial statements, workflow, SOP, metrics, audit/archive and jurisdiction logic default to separate plugins/packages unless later proven to be unavoidable Core primitives.
- INV-072 — Minimal Core Operations: The target Core surface is ApplicationAnchor, BusinessData submit, current PostingRules, deterministic posting/ledger/balance, current-state query, recalculation, runtime-data clear, full export and asynchronous result/status observation.
- INV-073 — Current Repository Breadth Does Not Define Core: Existing modules outside the minimal boundary are reusable assets/compatibility layers/plugin candidates and MUST NOT be used as evidence that they belong in EVO Core.

- INV-074 — ApplicationId Is The First Posting Route: Every accepted BusinessData item MUST carry applicationId. Posting candidate selection MUST first restrict rules to the same applicationId before condition evaluation.
- INV-075 — PostingRule Application Anchor Is Mandatory: Every executable PostingRule MUST carry applicationId identifying a registered ApplicationAnchor. Payload similarity MUST NOT be used to infer rule ownership.
- INV-076 — Application Identity Is Not Application Lifecycle: ApplicationAnchor may contain only applicationId. Names, UI, install/activation state, permissions, Package/Feature metadata, commands and application versions are outside EVO Core.
- INV-077 — ApplicationAnchor And Current Rules Survive Clear: Clear Cache MUST remove application-scoped BusinessData and derived runtime state while preserving ApplicationAnchor and the current PostingRules/configuration required to process resubmitted data.

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

## Financial Accounting Plugin Integrity Constitution

- INV-039 — Economic Ledger Is Not Automatically General Ledger: EVO's generic Ledger runtime remains an increase/decrease projection. General Ledger/statutory accounting is a Finance plugin concern. A ledger code such as cash, receivable, payable, inventory, revenue, expense or COGS MUST NOT be treated as proof that statutory/general-ledger double-entry accounting has been satisfied.
- INV-040 — General Ledger Uses Explicit Double Entry: Every authoritative General Ledger Journal MUST contain explicit debit/credit lines. A financial journal MUST NOT be committed if total debit amount differs from total credit amount in the journal accounting currency under the declared precision policy.
- INV-041 — No One-Sided General Ledger Posting: A canonical accounting projection MUST NOT create a one-sided General Ledger journal. A journal requires at least one debit line and at least one credit line; zero-value balancing lines are not acceptable substitutes for real accounting semantics.
- INV-042 — Journal Balance Is Transactional: Double-entry validation occurs before the accounting journal becomes authoritative. If debit/credit validation fails, the entire General Ledger projection for that journal fails atomically; partially committed journal lines are forbidden.
- INV-043 — Trial Balance Is Independently Verifiable: For every authoritative General Ledger dataset/period/accounting currency, EVO MUST be able to produce and validate a trial balance whose debit and credit totals reconcile exactly under the pinned accounting policy/version.
- INV-044 — Financial Statements Derive From General Ledger: Balance Sheet, Income Statement and Cash Flow Statement are governed projections from authoritative accounting state. They MUST NOT become an independent fact system or be made to balance by rewriting canonical BusinessData.
- INV-045 — Accounting Projection Remains Replayable: General Ledger journals, trial balance and financial statements are derived accounting results. They MUST be reproducible from canonical BusinessData/economic results plus explicitly pinned chart-of-accounts, recognition, posting, currency and period policies.

## Host/Application Capability Exposure Constitution

- INV-033 — No Implicit Domain Capability: EVO Core MUST NOT imply that an enterprise owns a domain capability merely because EVO can host an application that provides it.
- INV-034 — Installed Application Governs Domain API Exposure: A domain API/capability is currently available only when its owning application instance and effective application definition/version satisfy the governed active-state requirements for that enterprise.
- INV-035 — Effective API Must Match Effective Capability Set: Runtime API discovery, generated API descriptions and callable domain routes MUST NOT advertise inactive, uninstalled or otherwise ineffective application capabilities as currently available.
- INV-036 — Domain Writes Still Use Command: Application-specific REST, agent or integration adapters MUST resolve to governed Command capabilities; installing an application does not create a second authoritative write path.
- INV-037 — Uninstall Is Separate From Runtime Data Clearing: Deactivation or uninstall removes current application capability exposure but MUST NOT implicitly perform Clear Cache. Runtime business data is removed only by an explicit governed clear/reset operation.
- INV-038 — Runtime Discovery Overrides Assumption: Human clients, integrations, automation and LLM agents MUST be able to determine current enterprise capabilities from governed runtime discovery. Prior sessions, demo APIs, another enterprise, static examples or model memory are not evidence that a capability is currently available.


## Automatic Posting Lifecycle Constitution

- INV-046 — Accepted Business Facts Automatically Enter Posting: Any business fact accepted through a governed public business/Command API MUST automatically enter its current effective posting lifecycle. The caller MUST NOT need a second API call to start the posting of that accepted fact.
- INV-047 — Caller Does Not Own Initial Posting Orchestration: Business Applications submit facts and business commands, not ledger instructions or worker controls. They MUST NOT be required to know or invoke PostingInput, worker, queue, LedgerEntry, LedgerBalance, or private posting-runtime details to complete the posting.
- INV-048 — Posting Completion May Be Synchronous Or Asynchronous: EVO MAY complete posting within the originating request or continue it asynchronously. If asynchronous, an accepted/queued/running response means EVO has already assumed responsibility for continuation and MUST expose a durable, traceable path to a terminal POSTED/COMPLETED or FAILED result.
- INV-049 — Explicit Posting APIs Are Platform Controls, Not First-Posting Requirements: EVO MAY expose Posting/PostingRun APIs for re-posting, Replay, bulk processing, retry/recovery, repair, rebuild and other governed platform operations. Ordinary Applications MUST NOT be required to call such an API to initiate the posting of a newly accepted business fact.
- INV-050 — Facts Do Not Carry Ledger Instructions: External Applications submit governed business semantics. Effective PostingRules determine derived Ledger effects. A caller MUST NOT be required to specify the ledger entries that represent an accepted business fact.

## Recalculation and Runtime Cache Constitution

- INV-051 — Recalculation Has Two Perspectives: EVO-internal recalculation rebuilds derived state from EVO's current governed runtime data. An Application's own "recalculation" is merely ordinary data resubmission to EVO unless a separate platform-control API is explicitly invoked.
- INV-052 — Application Recalculation Has No Special EVO Semantics: EVO MUST NOT require or infer an Application-specific recalculation mode. Resubmitted data follows the same public API, identity, idempotency, authorization and automatic Posting rules as any other submission.
- INV-053 — Runtime Cache Is Rebuildable State: EVO Runtime Cache is a governed rebuildable active working set/materialization. Clearing it MUST NOT silently destroy historical/audit evidence required for lineage, reconstruction, compliance or diagnosis.
- INV-054 — Cache Clear Is Explicit And Scoped: EVO SHALL expose a privileged, auditable, scope-bounded cache-clear capability. Cache clearing MUST be idempotent or safely retryable and MUST prevent mixed old/new active runtime generations.
- INV-055 — Cache Clear Does Not Change Business Semantics: After a governed cache clear, Applications repopulate EVO through ordinary APIs. EVO processes those submissions without caring whether the Application describes the workflow as recalculation, refresh, rebuild, resync or reimport.

## Core Runtime Data Lifecycle Constitution

- INV-056 — Clear Cache Clears Business Runtime Data: A governed Clear Cache MAY remove BusinessData and all dependent runtime/derived state in the selected scope, including posting state, Ledger entries/balances, cost/valuation results, work projections and accounting projections.
- INV-057 — Runtime Configuration Survives Clear Cache: ApplicationAnchor, current PostingRules and generic Ledger/runtime definitions required to process new BusinessData MUST NOT be deleted by ordinary Clear Cache. Host permissions, rich Application metadata and Package/Feature state are outside EVO Core.
- INV-058 — Append-Only Is Dataset-Scoped, Not Permanent Archive: BusinessData MUST NOT be rewritten in place while present in the active runtime dataset. Core is not required to retain that BusinessData forever after an explicit Clear Cache.
- INV-059 — Full Data Export Is Core Capability: EVO Core SHALL provide a governed, versioned export of the complete current EVO dataset sufficient for external backup/archive/transfer purposes.
- INV-060 — Long-Term Audit Retention Is Optional Policy: EVO Core MUST NOT silently preserve hidden audit copies after Clear Cache. Long-term accounting-voucher/statutory/audit retention belongs to optional plugins/packages or customer-managed export retention.
- INV-061 — Cache Clear Preserves Rebuild Semantics: After Clear Cache, the selected runtime scope MUST be empty of business/runtime results while retaining the rules and definitions required for resubmitted data to be processed deterministically.

- INV-062 — PostingRule Versioning Is Not a Core Concern: EVO Core MUST NOT own PostingRule draft/publish/version/effective-date/rollback history. A rule-owning plugin/package may implement those lifecycle semantics and supplies the rule set Core should execute.
- INV-063 — Core Executes Supplied Rules: Posting Core evaluates the currently supplied governed PostingRules deterministically. It MAY record stable rule identity/hash for diagnostics and reproducibility, but MUST NOT interpret that identity as a Core-managed rule version lifecycle.
- INV-064 — Rule Change Is Plugin Configuration: Changing PostingRules is a plugin/package configuration operation, not Clear Cache and not a special Core recalculation mode. After rules change, callers/plugins may request EVO recalculation or clear-and-resubmit as appropriate.

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

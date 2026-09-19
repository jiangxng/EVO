# Batch 04 — Matching / Component Calculation Genealogy

Status: IN PROGRESS — evidence-backed schema baseline; runtime call graph still under archaeology.

Source baseline:

- Asloop-Backend branch `main`, commit `c9703eb4ab98e4637f0a7f2953b3f3c18f942833`.
- `release-schema.sql` generated `2026-09-08 13:57:48`, declaring 176 tables.
- EVO branch `evo/apm-certification-enterprise-template-v0.1`, base commit `ca9ba92b602d591c1168586578b00eedfef32f12`.

This document continues Batch 01–03. It records legacy evidence before changing canonical EVO contracts.

## 1. Previously recovered census anchors

The repository already preserves these evidence-backed counts from the current extraction:

- `account_field`: 451 rows;
- `trans_type`: 372 rows;
- `calc_rel`: 134 rows;
- `c_calc_field`: 63 rows in the extracted definition dataset;
- `c_expression_custom`: 8,553 rows with 3,503 distinct raw expression strings.

These are evidence-snapshot counts, not universal invariants. They must stay tied to the extraction/source version that produced them.

## 2. Current release schema makes Component an execution-semantic bundle

Current `c_component` is not a UI component. It directly binds a calculation relation and transaction type and carries calculation/matching/runtime policy fields:

- `CALC_REL_CODE` — calculation/account relation;
- `TRANS_TYPE` — transaction type, with FK to `trans_type`;
- `STOCK_LOCK` — stock locking;
- `MATCH_TYPE` — `1 automatic / 2 manual / 3 manual-or-automatic` matching;
- `PARENT` — parent component used when inheriting a parent calculation relation;
- `CHECK_DIRECTION` — debit/credit direction (`1 / -1`);
- `MATCH_DIRECTION` — matching/verification direction;
- `IS_ALLOWED_NEGATIVE` — negative-stock policy;
- `IS_VERIFICATION` — whether verification/matching applies;
- merge and location controls: `IS_MERGE`, `MERGE_FIELD`, `ASSIST_CONTAINER_FIELD`, `BLACKLIST_CONTAINER_FIELD`, `POSITION_STRATEGY`;
- `EXPAND_ALGORITHM` — post-calculation extension algorithm;
- `MANUALLY_FIELD` — alternate manual-matching query field;
- `SORT`, `STATUS`, `BUILT_IN`, `MASTER_FIELD`.

High-confidence finding:

> Legacy Component is a contextual calculation/matching policy bundle joining TransactionType and CalcRelation. It must not be migrated as a generic UI/component object and must not automatically become one monolithic EVO object.

## 3. The matching graph is relational and contextual

Current schema exposes several Component-owned relation families.

### 3.1 `c_calc_fg_rel`

Maps field group (`FG_CODE`, `FG_NAME`) to `COMPONENT_ID`.

This connects transaction/form field-group context to a calculation component.

### 3.2 `c_mapping_field`

Carries `COMPONENT_ID`, `TARGET_FIELD`, `MAPPING_FIELD`, mapping `TYPE` and operator `OP`.

Its own comment distinguishes calculation-field mappings from locating-field mappings. Therefore mapping participates in both value calculation and identity/location resolution.

### 3.3 `c_data_filter`

Carries component-specific filter rules (`PARAM`, `TERMS`, `OP`, `PARAM_VALUE`) and distinguishes detail filters from data-collector extension filters.

This is evidence that source-data eligibility is configuration, not merely expression arithmetic.

### 3.4 `c_expression`

Each expression is tied to a `c_calc_field` and contains:

- expression name;
- matching direction;
- governed calculation measure selector (`qty`, `amount`, or combinations);
- balance expression;
- verification expression;
- verification object key;
- primary-field flag;
- expression type (`required`, locating-field, calculation-field);
- calculation sort/order.

Expression order is therefore explicit source metadata. It must not be confused with business-effective ordering or global replay order.

### 3.5 `c_match_field`

Current structure is a relation from `COMPONENT_ID` to `EXP_ID` (`c_expression.ID`).

High-confidence finding:

> Matching fields are contextual expression edges owned by a Component; matching semantics are not recoverable from field names alone.

### 3.6 `c_match_rel`

Current structure carries `COMPONENT_ID + CALC_REL_CODE + TRANS_TYPE`.

The calculation relation and transaction type are denormalized on the relation in addition to the Component linkage. The runtime reason for this redundancy is not yet proven.

Do not infer that `c_match_rel` is the complete matching model merely from its name. Its actual runtime consumer remains an archaeology gate.

## 4. `c_data_collector` is strong evidence of algorithmic selection/order policy

`c_data_collector` contains:

- `MATCH_DIRECTION`;
- `CHECK_DIRECTION`;
- `CALC_FIELD`;
- built-in `CONDITION`;
- built-in `REORDER`;
- status.

This strongly suggests that matching/calculation source selection includes both filtering and ordering policy before or during consumption. The exact runtime sequence remains unverified until the implementing class/service is located.

Important separation for EVO:

- source selection/order policy;
- economic/business effective order;
- calculation dependency order;
- replay/posting sequence;
- materialization execution order

must not be collapsed into one generic `sort` or sequence field.

## 5. Current `calc_rel` remains a compressed Ledger/State definition

Current `calc_rel` explicitly includes:

- measure declaration (`CALC_FIELD`);
- locating and auxiliary locating fields;
- account code/name;
- state-vs-balance type;
- debit-side matching direction;
- sort;
- merge policy;
- accounting/business object field;
- lifecycle/status/revoke behavior.

This reinforces Batch 03: one `calc_rel` row is not one canonical EVO object. Its semantics span LedgerDefinition, measures, dimensions/reference identity, posting/matching policy, state/balance projection and lifecycle governance.

## 6. Genealogy correction: do not mix older and current schemas

A recovered prior-chat record described an older/different shape in which matching/component tables used code-oriented keys such as `MATCH_REL_CODE`, `COMPONENT_CODE`, `COMPONENT_INDEX`, `FIELD_CODE`, `EXPRESSION_CODE`, and a smaller Component record.

The current pinned release schema does **not** have that shape. It uses numeric `ID` relations and the richer Component structure documented above.

Therefore:

1. the code-keyed shape is preserved only as an **older/stale lineage candidate** until a historical repository commit or another pinned database snapshot proves its origin;
2. the current release baseline is `c9703eb4ab98e4637f0a7f2953b3f3c18f942833`;
3. no conclusion may silently merge fields from the two schema generations;
4. schema evolution itself is valuable evidence: matching/calculation responsibilities appear to have moved and accumulated over time.

The next genealogy pass must locate the historical transition rather than choosing one version by memory.

## 7. Candidate configuration graph — not yet a runtime call graph

The schema currently supports this evidence graph:

`TransactionType + CalcRelation`
` -> Component`
` -> FieldGroup / MappingField / DataFilter`
` -> CalcField / Expression`
` -> MatchField / MatchRelation`
` -> DataCollector selection/reorder policy`

This graph is a configuration relationship graph only. The actual execution call graph, evaluation phases, short-circuit behavior, mutation boundaries and ordering remain unverified.

Do not document the graph above as executable truth until implementation evidence closes it.

## 8. EVO convergence hypotheses and confidence

### HIGH confidence

- Component is contextual calculation/matching configuration, not presentation/UI metadata.
- Debit/credit direction and matching direction are explicit independent concepts in legacy metadata.
- Automatic/manual matching is explicit governed policy.
- Expressions have contextual measure, verification and ordering semantics.
- Source eligibility/filtering and ordering are separately configurable concerns.
- Legacy calculation metadata mixes semantic policy and runtime/execution controls that EVO should separate.

### MEDIUM confidence — requires runtime confirmation

A Component will probably decompose across EVO concepts such as:

`PostingRule + MatchingPolicy/AllocationPolicy + Dimension/Positioning Policy + Value/Verification Expressions + execution metadata`

This is deliberately not yet a canonical object model.

### UNKNOWN / unresolved

- exact runtime consumer and behavior of `c_match_rel`;
- exact consumer/order semantics of `c_data_collector.REORDER`;
- whether matching produces durable business allocation facts, derived interpretation relations, or both depending on mode;
- how manual matching differs from automatic matching in persistence/provenance;
- exact behavior of `lastStockOut` and related inventory functions;
- how FX settlement and realized/unrealized gain/loss join matching/allocation;
- whether older code-keyed matching schema can be tied to a specific historical commit/snapshot;
- current row counts for matching tables in each release/recall dataset. `AUTO_INCREMENT` values in DDL are not row counts.

## 9. Architectural consequence at this evidence gate

No new constitutional EVO invariant is promoted in this batch.

The evidence strengthens one boundary requirement:

> EVO must distinguish an explicit enterprise matching/allocation relation from the algorithm/configuration used to discover or calculate that relation, and both must preserve provenance.

Whether an individual relation is immutable Business Fact, versioned Interpretation Result, or rebuildable Projection remains context-dependent and is still under investigation.

## 10. Validation status

- Schema evidence: VERIFIED against current Asloop `main/release-schema.sql`.
- Existing census anchors: VERIFIED from earlier EVO convergence batches tied to extracted definition data.
- Runtime implementation: NOT YET VERIFIED in this batch.
- Historical schema transition: NOT YET VERIFIED.
- EVO code/contracts changed: NO.
- Tests required for this documentation-only batch: none; future canonical/runtime changes require architecture and behavior tests.

## 11. Exact next archaeology gate

Continue without waiting for a new design decision:

1. trace `release-schema.sql` history to identify when the matching/component schema changed;
2. traverse Asloop modules/directories to locate runtime consumers of `c_component`, `c_match_field`, `c_match_rel`, `c_data_collector`, `MATCH_DIRECTION`, `REORDER` and manual matching;
3. recover actual current row counts and representative anonymized configurations from release/recall data;
4. trace `lastStockOut`, `lastStockIn`, stock-out/allocation functions only from implementation evidence;
5. reconstruct manual/user-selected allocation versus automatic/algorithm-generated allocation persistence and provenance;
6. reconstruct `foreign`, `foreignExchangeSettlement`, `exchangeGainOrLoss`, `cashGainOrLoss` and currency/settlement semantics;
7. only after runtime closure, update `docs/architecture/decisions/2026-09-17-economic-flow-valuation-and-materialization.md` and decide whether Matching/Allocation deserves a standalone canonical contract.

## 12. Continuation Checkpoint

Branch: `evo/apm-certification-enterprise-template-v0.1`

Base before this batch: `ca9ba92b602d591c1168586578b00eedfef32f12`

Pinned Asloop current release commit: `c9703eb4ab98e4637f0a7f2953b3f3c18f942833`

Stable facts to carry into the next chat/work window:

- prior census anchors are already preserved in Batch 01–03;
- current matching/component schema is ID-based and materially richer than the older code-keyed recovered record;
- Component binds TransactionType and CalcRelation and owns matching, direction, stock, merge, positioning and extension-algorithm policy;
- `c_match_field` links Component to Expression;
- `c_match_rel` links Component with CalcRelation and TransactionType;
- `c_data_collector` explicitly contains matching direction, debit/credit direction, condition and reorder policy;
- schema graph is not yet runtime call graph;
- no canonical EVO contract should change until runtime and genealogy evidence close the unresolved boundaries.

Next exact entry point:

`Asloop release-schema history -> runtime consumers -> matching data census -> lastStockOut -> FX/settlement -> explicit-vs-algorithmic allocation -> architecture decision update`.

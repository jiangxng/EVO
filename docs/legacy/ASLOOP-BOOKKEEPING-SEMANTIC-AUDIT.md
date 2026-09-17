# Asloop-Backend & bookkeeping → EVO Semantic Archaeology

Status: WORKING AUDIT — evidence-backed findings are preserved here as the audit continues.
Owner: EVO
Sources: `jiangxng/Asloop-Backend`, `jiangxng/bookkeeping`
Date: 2026-09-15

## Purpose

These legacy repositories are historical enterprise-design assets, not implementation templates. EVO will extract business semantics, data-model lessons, real configuration patterns, posting/balance/cost behavior, and production-data evidence while rejecting legacy technical coupling.

Canonical rule:

> Preserve business history and validated semantics; redesign implementation boundaries. Do not migrate legacy tables, Java/DAO/controller code, dynamic SQL, or stored procedures merely because they exist.

The audit uses four evidence layers:

`Implementation code → Physical schema → Metadata/configuration → Historical/business data`

Business data is used to discover and falsify semantic assumptions. It must not force EVO to reproduce the legacy physical schema.

## 1. Capability inventory

### Asloop-Backend

The legacy schema contains 176 tables and spans substantially more than accounting. Important capability families include:

- metadata-driven forms/views: `account_container`, `account_field`, `account_field_model`, `account_table`, `account_view`, `field_group`, `form_data_source_def`, `form_view_part`, `form_view_part_result`;
- transaction/application metadata: `trans_type`, `trans_type_direction`, `tpl_fields_setting`, `tpl_list_container`, `tpl_obj_field_rel`, `tpl_table_definition`, `tpl_table_link_rel`, `tpl_trans_type_obj_field_rel`;
- calculation/posting configuration: `c_calc_fg_rel`, `c_calc_field`, `c_component`, `c_data_collector`, `c_data_filter`, `c_expression`, `c_mapping_field`, `c_match_field`, `c_trans_config`, `calc_rel`;
- accounting/cash-flow: `account_*`, `obj_accounting_object`, cash-flow definition/contrast structures;
- sales/purchase/manufacturing/inventory/MRP/WMS;
- project/process/task/OKR and other enterprise-management domains;
- cost and cost recalculation, including inventory/WMS cost artifacts.

The repository also contains substantial data/configuration dumps (`release-data.sql`, `recall-data.sql`) in addition to schema. These are semantic evidence, not merely seed fixtures.

Observed production/configuration evidence includes hundreds of transaction types, many calculation relationships, thousands of expressions, and a large transaction-type/object/field relationship set. Examples include receipts, payments, stocking orders, financial payments, export sales returns and contract-receipt-to-order-receipt business semantics. Calculation relationships show that account/balance semantics were keyed by combinations such as dealer, account subject, entity/material and facility dimensions.

### bookkeeping

bookkeeping concentrates the accounting runtime into a clearer chain:

`App → Transdata → Policy → Account → TransdataAccount → Balance → Cost`

Important services/models include App/Account/Balance/Cost MWA, transaction data, policy/formula evaluation, dynamic datasource/query support, error handling and asynchronous processing.

## 2. Core semantic discoveries

### 2.1 Application and transaction are distinct

Legacy `App` associates a business application with posting policies. `Transdata` represents business occurrence data. This supports EVO's separation of definition/application from durable BusinessData.

EVO mapping:

`TransactionType → ApplicationDefinition → Command → BusinessData`

The old implementation is not copied; the semantic distinction is retained.

### 2.2 Operational and financial accounting share one abstraction

Legacy `Account` is broader than a statutory chart-of-accounts subject. It carries finance/non-finance classification, primary accounting object, auxiliary accounting fields and cost configuration.

This validates EVO's generic Ledger abstraction:

> A Ledger is a governed accumulator of business or financial occurrences whose derived balance has enterprise meaning. Financial ledgers are one class of ledger, not the definition of Ledger itself.

Examples may include inventory, pending production, pending purchasing, pending shipment, receivable, cash, expense and other operational balances.

### 2.3 Policy is an ancestor of EVO PostingRule

Legacy Policy semantics include:

- application binding;
- account/ledger target;
- entry conditions;
- quantity formula;
- amount formula;
- direction;
- main accounting object;
- auxiliary accounting fields/dimensions;
- balance verification;
- finance vs non-finance classification.

The retained EVO semantic chain is:

`BusinessData + pinned PostingRule → Condition Evaluation → Dimension Mapping → Quantity/Amount Value Expressions → Ledger Effects`

Do not reduce Posting to `BusinessData → account + amount`.

### 2.4 TransdataAccount is a historical ancestor of LedgerEntry

The legacy result contains concepts corresponding to target account, source policy, business object, direction, quantity/amount factors, transaction identity/number and effective transaction time.

Semantic mapping:

- `accountId` → LedgerDefinition identity;
- `policyId` → pinned PostingRule/version lineage;
- object identity/type → business object and/or explicit dimensions;
- direction → ledger effect direction;
- quantity/amount factor → occurrence measures;
- source transaction UUID/number → BusinessData lineage;
- transaction time → effective business time.

EVO must preserve this lineage explicitly and immutably.

### 2.5 Auxiliary accounting fields validate explicit dimensions

Legacy `laneFields` and real calculation relationships demonstrate multi-dimensional accounting by project/department/material/facility/dealer/entity and similar keys.

EVO retains this as `DimensionDefinition` + explicit Ledger dimension policy + explicit Posting dimension mapping.

Invariant:

> Dimensions never propagate implicitly just because a BusinessData field exists.

### 2.6 Balance is derived state

The legacy system performs balance mutation, balance logs, forward modifications and stored-procedure based maintenance. The business need is valid; the mutable implementation is rejected.

EVO model:

`Immutable LedgerEntry → deterministic Balance Projection`

Balance can drive operational work and cost logic, but historical balance rows are not the source of truth.

### 2.7 Cost semantics are retained; SQL-coupled cost execution is rejected

Legacy bookkeeping contains weighted-average/cost lookup, cross-warehouse cost, debit/credit counterpart amounts, allocation cost and balance-based price lookup semantics.

These are valuable algorithmic/business concepts. They must become explicit Cost/Valuation inputs and policies rather than database functions embedded in formulas.

EVO chain:

`BusinessData → Posting/Ledger → CostRun → CostResult → Valuation Posting → Ledger`

CostResult must not directly mutate balances.

### 2.8 Recalculation is a first-class production requirement

Legacy WMS/cost structures contain explicit cost recalculation concepts. bookkeeping also contains reverse/rebuild-oriented balance behavior. This reinforces EVO's requirement that derived accounting/cost state be rebuildable from preserved business history under pinned rule/algorithm versions.

Replay must never re-execute Commands.

### 2.9 Numerical allocation conservation

The Asloop documentation records a practical allocation rule: calculations use controlled decimal precision and the final allocation absorbs the remaining difference so allocations reconcile exactly to the source total.

EVO should formalize the semantic invariant rather than copy the exact implementation:

> Allocation results must conserve the source amount/quantity exactly. Precision, rounding and residual-assignment policies must be explicit, versioned, deterministic and replayable.

This requires a formal EVO Cost/Allocation architecture decision before implementation.

### 2.10 Field metadata is business metadata, not merely UI layout

Asloop separates containers, fields, field models and views. Fields carry type/association/display/order semantics while view models carry presentation details.

EVO should retain business/data semantics in FieldDefinition and avoid importing legacy renderer/UI code.

Long-term projection direction:

`FieldDefinition → Command Input Projection → schema → API / interaction/tool consumers`

Command schemas must not silently drift into a second independent business field model.

## 3. Historical/business data as architecture evidence

The legacy data dumps are included in this audit intentionally. They will be mined to recover real chains such as:

`Transaction Type → Application/Form → Fields → Business Transaction → Calculation/Posting Rule → Accounting Object/Dimensions → Account/Ledger Occurrences → Balance → Cost`

and domain chains such as:

`Sales → MRP/Purchase/Manufacturing → Inventory/WMS → Receivable/Settlement → Financial accounting`

The audit will actively search for counterexamples that cannot be naturally represented by EVO's current model. A counterexample is more valuable than simply finding data that confirms the current architecture.

No credentials, secrets or personally identifying production data should be copied into EVO documentation. Preserve semantic patterns and anonymized examples only.

## 4. Decision matrix

| Legacy asset | Decision | EVO destination / rationale |
|---|---|---|
| Transaction Type | ADOPT | TransactionType metadata |
| App/Application semantics | ADOPT | ApplicationDefinition/ApplicationInstance semantics |
| Field / FieldGroup | ADOPT | Metadata; retain business semantics |
| Form/List/View configuration | REDESIGN | Preserve semantic intent; experience rendering is not legacy UI code |
| Account abstraction | ADOPT/REDESIGN | Generic LedgerDefinition, not finance-only account |
| Finance/business account distinction | ADOPT | Ledger class/category |
| Policy | ADOPT/REDESIGN | Versioned PostingRule |
| entryConditions | ADOPT | Deterministic Condition AST/profile |
| quantity/amount formula | ADOPT/REDESIGN | Deterministic ValueExpression profile |
| main accounting object | ADOPT/REDESIGN | explicit business object/dimension semantics |
| laneFields | ADOPT | DimensionDefinition + mapping/policy |
| Transdata | ADOPT/REDESIGN | BusinessData semantics, not physical model |
| TransdataAccount | ADOPT/REDESIGN | immutable LedgerEntry semantics/lineage |
| Balance | ADOPT/REDESIGN | deterministic derived projection |
| balance_log lineage | ADOPT/REDESIGN | immutable entry/run lineage |
| mutable historical balance chains | REJECT | derived state must be rebuildable |
| SQL balance mutation | REJECT | no core dynamic-SQL accounting engine |
| stored-procedure accounting | REJECT | deterministic module contracts/services |
| Cost MWA semantics | ADOPT/REDESIGN | Cost/Valuation policies and runs |
| cost SQL functions | REJECT | no hidden DB-function business semantics |
| allocation conservation | ADOPT | formal versioned numerical invariant/policy |
| MRP/WMS/sales/purchase/manufacturing models | ARCHIVE + ADOPT SEMANTICS | Reference Enterprise Packs, not EVO core tables |
| project/process/OKR/task domain models | ARCHIVE + ADOPT SEMANTICS | generic capability/flow/SOP/metric or reference packs after audit |
| legacy controllers/DAO/JDBC | REJECT | implementation archaeology only |
| dynamic SQL/global mutable runtime registries | REJECT | violates bounded deterministic architecture |
| legacy physical table structures | ARCHIVE | evidence/reference, never automatic migration target |

## 5. EVO gap register — current

These are candidate gaps or areas requiring stronger formalization; they are not permission to add new core objects casually.

1. **Posting expression profile** — conditions, quantity/amount formulas, dimension mapping and balance/cost references need an explicit deterministic supported language/profile.
2. **Allocation numerical policy** — precision, rounding, conservation and residual assignment need versioned contracts.
3. **Cost basis vocabulary** — legacy concepts such as counterpart cost, cross-warehouse cost and allocation cost need explicit Cost/Valuation semantics rather than SQL functions.
4. **Command schema derivation** — FieldDefinition and Command input schemas need a governed relationship to avoid semantic duplication/drift.
5. **Historical state references in rules** — legacy expressions reference historical/balance state. EVO must define exactly which deterministic projections may be read during Posting/Cost and how their dataset/version is pinned.
6. **Reference Enterprise Packs** — legacy domain assets should become semantic packs/examples rather than core runtime modules.
7. **Business-data counterexample suite** — anonymized legacy patterns should become architecture/certification fixtures to test whether EVO can express real enterprise behavior.

Any change to the canonical `Command → BusinessData → Posting → Ledger → Cost` semantics must follow EVO architecture-change governance before implementation.

## 6. Concepts that must NOT enter EVO core

- Asloop/bookkeeping database schemas as canonical EVO schema;
- mutable historical transaction/accounting state as source of truth;
- dynamic SQL as business-rule language;
- stored procedures as hidden accounting/cost semantics;
- hard-coded application UUID behavior;
- comma-delimited auxiliary dimensions;
- implicit latest metadata/rule selection;
- UI renderer/view implementation coupled to business truth;
- domain-specific MRP/WMS/sales tables promoted to universal EVO core merely because legacy ERP used them;
- direct cost mutation of balances;
- replay through Command execution.

## 7. Migration strategy

This is semantic extraction, not code/table migration.

`Legacy source → semantic extractor/anonymizer → normalized legacy evidence → EVO concept mapping → gap/counterexample tests → architecture decision → EVO metadata/reference package`

For future tooling, extraction should produce stable machine-readable evidence records carrying source repository/version, legacy concept/table/class, anonymized example, inferred semantic role, EVO target concept, decision status and rationale. Raw production data should remain outside EVO unless deliberately converted into sanitized fixtures.

## 8. Relationship to Enterprise Package

The legacy audit is directly relevant to Enterprise Package quality. Once a legacy domain semantic model is accepted, it should be expressible through EVO-owned package definitions rather than private database imports.

A future migration/certification path should look like:

`Legacy semantics/data evidence → normalized EVO definitions → Enterprise Package → Validate → Plan/Diff → Human Review → governed Deploy`

This makes legacy knowledge portable without making EVO dependent on either legacy system.

## 9. Audit continuation

Continue mining both repositories without requiring user prompts between steps. Priority investigations:

- Asloop transaction-type/template/field-group/field relationships;
- calculation relationships, expression vocabulary and real dimension combinations;
- sales/purchase/manufacturing/MRP/WMS business-data chains;
- bookkeeping transaction → policy → entry → balance → cost/reverse/recalc execution order;
- backdated/effective-time behavior and its relationship to EVO retroactive posting;
- actual correction/reversal/settlement/exchange patterns;
- anonymized counterexamples against current EVO concepts.

Update this document as evidence strengthens, weakens or falsifies current conclusions. Do not silently convert an inference into a canonical invariant.
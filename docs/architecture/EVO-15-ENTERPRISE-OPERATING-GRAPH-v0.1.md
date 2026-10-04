# EVO Enterprise Operating Graph v0.1

**Status:** AUTHORITATIVE PRODUCT / SEMANTIC DIRECTION  
**Date:** 2026-09-28  
**Purpose:** Converge enterprise-process modeling into existing EVO concepts without creating a parallel ontology.

## 1. Why this exists

Before migrating a customer's legacy data into EVO, the enterprise must first confirm how it intends to operate in EVO.

Natural Language
↕
Enterprise Operating Graph
↕
Visual Process / Enterprise Model

The graph is not a generic drawing document. It is a visual/editorial projection of existing EVO semantic definitions.

## 2. Core principle

> Do not invent a second process/data model for the diagram. Reuse EVO's canonical concepts as graph nodes and relationships.

Previously confirmed EVO concepts are directly useful in the graph:

- Capability
- Process
- Transaction Type
- Application
- Command / business action
- BusinessData / business fact type
- enterprise metadata / Model / Field semantics
- PostingRule
- LedgerDefinition
- Role / responsibility references where supplied by the Host

The graph is an editing and understanding surface over these concepts.

## 2.1 Authority clarification — no previous design is superseded

This section **does not overturn or supersede the previously established architecture**. It only makes the existing authority boundaries explicit.

The Enterprise Operating Graph must distinguish **graph definition**, **runtime definition**, **runtime fact**, and **enterprise context**.

### Runtime Definition Plane

The core economic/operational skeleton is owned by EVO Runtime definitions:

```text
ApplicationAnchor
+ PostingRule
+ LedgerDefinition
+ conditional posting semantics
```

Rich Application UI/metadata/lifecycle may remain Host-owned, but the Application identity used for deterministic posting is the EVO `ApplicationAnchor/applicationId`.

A versioned **Default Runtime Template** may provide the initial installable set of Application anchors, Ledger definitions and Posting-rule patterns. Its purpose is implementation efficiency and a sane starting operating skeleton.

The template is not immutable enterprise truth. Once adopted/adjusted for one enterprise, the pinned enterprise Runtime Definition is the executable authority.

### Runtime Fact Plane

Actual enterprise operational facts originate only through the EVO runtime chain:

```text
BusinessData
→ Posting
→ LedgerEntry
→ LedgerBalance
```

EOG, Enterprise Context, UI state or an Agent must never manufacture an already-happened runtime fact.

### Enterprise Context / Enterprise Graph Definition

The previously established rule remains valid:

> **Enterprise Context is the authority for Enterprise Graph Definition.**

Here, Enterprise Graph Definition means the definition of the projection itself:

- which authoritative objects are included in a Graph;
- graph membership;
- graph-to-graph / subgraph navigation;
- projection organization;
- stable references;
- projection annotations and other Graph-level semantics.

It does **not** mean Enterprise Context owns the executable Application ↔ PostingRule ↔ Ledger definitions.

Enterprise Context must not duplicate those runtime semantics and become a second executable truth source.

Therefore:

> **Enterprise Context owns Enterprise Graph Definition. EVO Runtime owns executable Application/Posting/Ledger semantics and occurred runtime facts. EOG is the projection surface over these authorities.**

No prior authority is moved; the ambiguous word “definition” is merely separated into Graph Definition versus Runtime Definition.

---

## 3. Human / LLM / Agent roles

### Human

Defines and confirms how the enterprise should operate: what the enterprise does, who owns activities, which branch is correct, which Application owns work, when a business fact occurs, and which economic consequence is intended.

### LLM

Acts as business-analysis intelligence. It may extract a proposed process from natural language, use APQC as a reference framework, use accounting/economic principles to identify missing consequences or questions, detect missing branches/owners/facts/completion conditions, and propose reuse of existing EVO Transaction Types, Applications, Metadata and Ledgers.

LLM output is a proposal until accepted/published.

### Agent

Executes declared model operations such as createNode, connectNodes, bindCapability, bindProcess, bindTransactionType, bindApplication, bindCommand, bindMetadata, bindPostingRule, bindLedger, moveNode and publishVersion.

Mouse/direct manipulation and natural-language changes must converge on the same model operations.

## 4. The graph's top and bottom

### Top: how the enterprise operates

APQC / Capability
→ Process
→ Application
→ Transaction Type / Business Action

This defines the intended operating model.

### Bottom: what the enterprise is made of

Enterprise Metadata may include Party/Dealer/Customer/Supplier, Inventory/Product/Material/Service, Warehouse/Location, Fund, Cost/Expense object, Facility/Resource, Organization/Responsibility and other governed semantic objects.

The exact reusable metadata vocabulary continues to inherit from EVO-01 and the Asloop/bookkeeping archaeology. This document does not freeze a new universal ontology.

### Bridge: what happens

Transaction Type
+ Application
+ Metadata references
+ Measures
+ Effective time
→ BusinessData

This bridge later becomes the target for legacy-data projection.

## 5. Canonical node kinds

### Capability Node

What the enterprise must be able to do. It may reference APQC or another capability taxonomy. It does not execute transactions.

### Process Node

How work is coordinated across activities/responsibilities.

### Transaction Type Node

Existing EVO meaning: a high-level business occurrence category. It is not the same as an Application.

### Application Node

Existing EVO meaning: a concrete executable business capability/tool around a Transaction Type/process.

Example:

Transaction Type: 销售订单  
Applications: 现货销售 / 预售销售 / 项目销售

The graph must preserve TransactionType ≠ Application.

### Business Action / Command Node

An authorized action a Human, Agent or automation can execute, such as approve order, complete production, confirm shipment or receive payment.

### Business Fact / BusinessData Type Node

The durable business occurrence emitted/accepted after an action or external fact, such as SalesOrderApproved, ProductionCompleted, ShipmentCompleted or PaymentReceived.

### Metadata Node

A governed enterprise semantic object used by facts and Applications, such as Customer, Product, Service, Warehouse, Department or Currency. A Metadata Node may open deeper Field/FieldGroup semantics when needed.

### Posting Rule Node

The deterministic rule that interprets BusinessData into ledger effects. It is metadata, not runtime history.

### Ledger Node

Existing EVO meaning: a governed accumulator of business or financial occurrences whose derived balance has enterprise meaning.

Examples: 待生产、待出库、库存、应收、现金、费用.

## 6. Canonical relationships

The graph should use semantic relationships rather than arbitrary lines.

Initial vocabulary:

- CAPABILITY_CONTAINS_PROCESS
- PROCESS_FLOWS_TO
- PROCESS_USES_APPLICATION
- APPLICATION_REALIZES_TRANSACTION_TYPE
- APPLICATION_EXPOSES_COMMAND
- COMMAND_PRODUCES_FACT
- FACT_REFERENCES_METADATA
- FACT_INTERPRETED_BY_POSTING_RULE
- POSTING_RULE_AFFECTS_LEDGER
- ACTIVITY_OWNED_BY
- TRIGGERS
- REQUIRES

Names may evolve before executable contract freeze, but the rule is fixed:

> Edges must carry enterprise meaning. A visual connector alone is not sufficient.

## 7. One model, multiple views

Do not put every semantic object on one crowded canvas. The same graph can be rendered as different projections:

- Process View: Human-first business flow.
- Application View: which Applications support each step.
- Transaction View: Transaction Types / Commands / Business Facts.
- Data View: Metadata objects required by each fact.
- Ledger View: PostingRules and Ledgers affected.

These views are projections of one model, not separate sources of truth.

## 8. Example

Human says:

“客户订单由销售审核。有库存就直接出库；无库存就生产。发货以后进入应收，收到款以后完成。”

The proposed model can connect:

Order-to-Cash Capability
→ Sales Fulfillment Process
→ Sales Order Transaction Type
→ Sales Application
→ Approve Order Command
→ SalesOrderApproved Fact
→ Customer / Product Metadata
→ Posting Rules
→ pending_shipment / pending_production Ledgers

Later facts can connect ShipmentCompleted to inventory, pending shipment and receivable effects only according to the enterprise's confirmed rules.

The Human sees a business flow; EVO retains exact semantic bindings.

## 9. APQC role

APQC is a reference taxonomy/checklist for the LLM and Human. It can help identify missing capabilities/processes and place a process in an end-to-end value chain.

APQC is not the enterprise's executable truth. Human-confirmed EVO definitions remain authoritative.

## 10. Accounting / economic-rule role

Accounting rules and economic principles provide consistency checks, not a replacement for business-process design.

For example, when a process contains Shipment, Invoice, Revenue Recognition, Receivable and Payment, the LLM can identify that the recognition point is not explicit and ask the Human to confirm it.

After confirmation, PostingRules/Ledgers encode the deterministic result.


## 10.1 Genealogy: bookkeeping / Asloop are direct semantic ancestors

The Enterprise Operating Graph must inherit already-converged semantics from the legacy `bookkeeping` and `Asloop-Backend` archaeology rather than rediscover them from scratch.

The previously established legacy-to-EVO chain is:

`App → Transdata → Policy → Account → TransdataAccount → Balance → Cost`

with the retained EVO mapping:

- legacy `App` → Application semantics;
- legacy transaction type / `Transdata` → Transaction Type + BusinessData semantics;
- legacy `Policy` → PostingRule semantics;
- legacy `Account` → generic LedgerDefinition semantics;
- legacy `TransdataAccount` → LedgerEntry lineage;
- legacy balance → derived LedgerBalance.

This genealogy is documented in:

- `docs/legacy/ASLOOP-BOOKKEEPING-SEMANTIC-AUDIT.md`
- `docs/architecture/EVO-ASLOOP-METADATA-FIELD-DESIGN-UNDERSTANDING-v0.1.md`
- `docs/architecture/EVO-03-Ledger-Conditional-Posting-Model-v0.1.md`

The graph therefore reuses an already-proven enterprise model lineage rather than introducing new business primitives.

## 10.2 Accounting-guidance template topology

Historical design intent supplied by the Human indicates that legacy posting rules were not created only as isolated formulas. Their expected predecessor/successor relationships were prepared in advance as guidance for building the enterprise operating flow.

Those rule templates were informed by **《企业会计准则——应用指南》** and the PRC accounting guidance lineage used by the legacy system. The canonical source handling, update/supplement rules and executable-template boundary are defined in `docs/architecture/status/EVO-PRC-ACCOUNTING-REGULATORY-BASELINE-2026-09-22-v0.1.md`.

This produces two distinct layers:

### Guidance Topology

A reusable recommended topology derived from:

- accounting guidance;
- bookkeeping / Asloop posting-rule templates;
- APQC / standard process references;
- reusable industry or enterprise templates.

It can recommend that a given Application / Business Fact normally affects specific Ledgers and may suggest expected upstream/downstream business relationships.

It is guidance, not enterprise truth.

### Published Enterprise Topology

The Human-confirmed operating graph for one enterprise.

It may accept, modify or reject guidance where the enterprise's actual business policy, timing, legal/accounting policy or operating method differs.

The required relationship is:

`Guidance Template → enterprise adoption/adjustment → pinned Enterprise Runtime Definition → EOG projection`

LLM/Agent assistance may help propose or explain choices later, but it is not required for this flow.

The system must never silently convert a guidance template into enterprise Runtime truth.

### Accounting guidance convergence rule

The Enterprise Operating Graph does not embed the publication itself and does not hard-code statutory rules into diagram nodes.

Use:

```text
Accounting Guidance Knowledge
→ versioned Accounting Guidance Template Pack
→ Default Runtime Template / Guidance Topology
→ enterprise adoption / adjustment
→ pinned Runtime Definition
→ EOG projection
```

This allows the same visual model to show a recommended accounting path while keeping source authority, enterprise policy, Posting/Recognition rules and visual presentation as separate versioned concerns.

## 10.3 Why this matters for the editor

The Enterprise Operating Graph Editor should therefore not behave like a blank free-form canvas by default.

When appropriate, it should be able to surface and navigate the active Runtime topology.

Initial deterministic toolbox traversal is:

```text
selected Application
→ show Ledger definitions that may receive an INCREASE effect
  from that Application's conditional PostingRules

selected Ledger
→ show Application anchors whose conditional PostingRules
  may produce a DECREASE effect on that Ledger
```

“May” means a matching rule/condition definition exists. It does not mean the condition has been satisfied by a current BusinessData fact.

This provides a guided alternating path:

```text
Application → +Ledger → Application that -Ledger → +Ledger → ...
```

The editor can also surface template recommendations or conflicts, but its first source for an enterprise already configured in EVO is the active/pinned Enterprise Runtime Definition.

This is stronger than generic diagramming:

`runtime topology + user-selected graph projection + governed definition editing`

## 11. Decision Backbone

The graph's first purpose is to **project and make understandable** the enterprise's Decision Backbone:

Process
→ Business Action
→ Business Fact
→ Enterprise State / Ledger effect
→ Next Decision / Action

Supporting functions/data are added around this backbone later.

This prevents implementation details, old-system tables and incidental UI state from defining the enterprise model.

## 12. Relationship to migration

Migration comes after a usable target graph exists.

Enterprise Operating Graph
→ defines target Transaction Types / Applications / Metadata / Ledgers
← source-data projection from legacy ERP / MES / CRM / files

The migration question becomes:

> Which source records/fields prove the already-confirmed EVO facts and metadata?

It is no longer:

> What does this database happen to contain?

## 13. Graph is not a duplicate store

The visual graph is a projection and must not copy authoritative definitions into an unrelated diagram schema and then drift.

Preferred principle:

Graph Node
→ stable reference to canonical definition
+ graph membership / navigation metadata
+ view/layout metadata

For the initial Application/Ledger projection flow:

- dragging an Application or Ledger from the toolbox adds an existing definition reference to the current Graph;
- it saves only graph/view data needed to display that object;
- it does **not** create an Application;
- it does **not** create a LedgerDefinition;
- it does **not** create or modify a PostingRule;
- it does **not** install an Application.

If the referenced Runtime definitions already imply an Application ↔ Ledger posting relation, EOG may project that existing relation automatically. The drop action itself does not create the semantic relation.

Application nodes reference ApplicationAnchor/applicationId plus Host metadata where needed. Ledger nodes reference LedgerDefinition.

Creating new Applications, LedgerDefinitions or PostingRules is an advanced-definition workflow and is intentionally deferred from ordinary toolbox drag/drop.

Layout coordinates, zoom, collapsed groups and visual annotations are presentation data. Executable business semantics remain canonical definition data.

## 14. Versioning

A published enterprise operating model cannot be silently overwritten.

Draft
→ Human/LLM Review
→ Validate
→ Publish Version
→ later Draft Revision
→ Diff
→ Publish New Version

Historical BusinessData/ledger interpretation continues to obey applicable pinned definitions/rules.

## 15. First implementation target

The first product target is not a ProcessOn replacement.

It is **Enterprise Operating Graph Editor v0.1**.

Minimum semantic scope:

1. create/open an enterprise model;
2. create/bind Process;
3. bind Transaction Type;
4. bind Application;
5. bind Command/business action;
6. bind Business Fact type;
7. bind Metadata;
8. bind PostingRule/Ledger;
9. semantic edges;
10. Human direct editing;
11. Agent editing through declared actions;
12. LLM natural-language proposal;
13. model validation;
14. draft/published version distinction.

Visual implementation is owned separately by Eidos/App Platform and must not redefine these semantics.

## 16. Explicit non-goals for v0.1

Do not currently build a generic diagramming suite, mind maps/network diagrams, a second workflow engine, a second Application model, a second Metadata model, a second Ledger model, automatic enterprise truth from LLM output, or legacy-data migration before target semantic modeling exists.

## 17. Invariants

EOG-01 — The Enterprise Operating Graph is a semantic **projection/editor of the projection** over canonical EVO/Host definitions, not a parallel ontology and not an enterprise-definition authoring system.

EOG-01A — Enterprise Context remains authoritative for Enterprise Graph Definition. Application/PostingRule/Ledger executable semantics are owned by EVO Runtime definitions. These are complementary authorities, not competing ones.

EOG-01B — Actual BusinessData/Posting/LedgerEntry/LedgerBalance facts originate from EVO Runtime, never from graph layout or contextual metadata.

EOG-02 — Transaction Type and Application remain distinct.

EOG-03 — Ledger nodes reference governed LedgerDefinitions; diagram nodes do not redefine ledger semantics.

EOG-04 — Business Fact and PostingRule remain distinct.

EOG-05 — Natural language, direct graphical editing and Agent actions converge on the same semantic model operations.

EOG-06 — LLM-generated changes are proposals until accepted according to product governance.

EOG-07 — APQC is reference knowledge, not executable enterprise truth.

EOG-08 — A visual edge without declared semantic relationship is insufficient for a published enterprise model.

EOG-09 — The target enterprise operating model precedes legacy-data projection.

EOG-10 — Presentation/layout data must not become enterprise business truth.

EOG-11 — Accounting/APQC/industry templates provide default/guidance topology; enterprise adoption/adjustment must produce a pinned Runtime Definition before it becomes executable for that enterprise.

EOG-12 — Legacy bookkeeping/Asloop semantic convergence remains genealogy evidence for Application, Transaction Type, PostingRule and Ledger graph nodes.

## 18. Current concise architecture

Human Natural Language
↕
LLM
→ proposal
Personal Agent
→ declared model actions
Default / Guidance Runtime Template
→ enterprise adoption / adjustment
→ Enterprise Runtime Definition
   ├─ ApplicationAnchor
   ├─ PostingRule
   └─ LedgerDefinition
→ EOG projects / organizes references (projection only)
   ├─ multiple user-defined Graphs
   └─ guided Application ↔ Ledger traversal
→ runtime execution
   BusinessData → Posting → LedgerEntry → LedgerBalance
→ legacy-data projection / detailed Application design can continue

## 19. One-line target

> Let the enterprise owner describe the business in natural language, let the LLM structure it, let the Agent draw and modify it, let the Human directly correct it, and let the resulting graph reuse EVO's existing Transaction Type, Application, Metadata, Posting and Ledger semantics as the executable definition of how that enterprise intends to run.

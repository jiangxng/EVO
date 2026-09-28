# EVO Enterprise Data Abstraction & Migration Learning Architecture v0.1

**Status:** SUPPORTING / EXPLORATORY MIGRATION RESEARCH  
**Date:** 2026-09-28  
**Scope:** Enterprise metadata abstraction, migration semantics, Agent learning/training roadmap  
**Primary authority:** EVO repository architecture  
**Related systems:** Eidos, EVO-App-Platform Personal/Enterprise Agent, Experience Compiler

> **Current sequencing note (2026-09-28):** Do not begin with legacy-data projection or training. First define the customer's target operating model through `EVO-15-ENTERPRISE-OPERATING-GRAPH-v0.1.md`. EVO-14 remains supporting migration research to use after the target Transaction Types, Applications, Metadata and Ledger semantics are sufficiently confirmed.

---

## 1. Why this document exists

EVO will often enter an enterprise that already has ERP, MES, CRM, spreadsheets, custom databases and long-lived operating conventions.

The migration problem is therefore not:

> copy old tables into new tables.

The target is:

> understand the enterprise's economic semantics, reconstruct its durable business facts, and let EVO Ledger Runtime deterministically reinterpret those facts.

The intended migration chain is:

```text
Legacy Systems
  ↓
Enterprise Metadata Discovery
  ↓
Enterprise Semantic Metadata
  ↓
Historical Business Facts / Transactions
  ↓
Canonical EVO BusinessData
  ↓
Posting Rules
  ↓
Ledger / Balance / Cost / Work
  ↓
Reconciliation
  ↓
Production Cutover
```

Conversation is expected to become a primary Human interaction channel for this migration, but conversation is not the system of record. The durable outputs are structured Enterprise Context, metadata mappings, provider specifications, migration decisions, reconciliations and validated BusinessData.

---

## 2. Legacy evidence: bookkeeping and Asloop

EVO does not invent the abstraction from zero.

### 2.1 Bookkeeping

The legacy `bookkeeping` implementation centered on:

- `Account`
- `Transdata`
- `Policy`
- `TransdataAccount`
- `Balance`
- cost configuration

Important observations:

1. `Transdata` represented business facts with stable identity, business grouping, occurrence time, application, handler, parent-child relation and extensible properties.
2. `Account` was not limited to statutory finance. It could represent financial and non-financial positions and carried auxiliary dimensions and cost behavior.
3. `Policy` connected business data to accounting/posting effects.
4. Balances were derived from entries rather than treated as the primary fact.
5. One business fact could generate multiple financial and operational effects.

This legacy already contained the core separation:

```text
Business Fact
≠
Posting Rule
≠
Ledger Effect
≠
Balance
```

### 2.2 Asloop

The legacy `Asloop-Backend` further separated reusable enterprise objects and transaction/calculation configuration, including examples such as:

- Customer
- Dealer
- Inventory
- Funds
- Warehouse
- Price
- Transaction/BOM objects
- transaction type configuration
- calculation configuration
- matching / mapping / data-collector definitions

This shows an earlier attempt to describe enterprises using:

```text
Object
+ Relationship
+ Transaction Type
+ Calculation / Accounting Rule
```

rather than hard-coding one software module per business domain.

### 2.3 EVO inheritance

Current EVO already preserves the strongest part of that design:

```text
Metadata
→ BusinessData
→ Posting
→ Ledger
→ Cost / Valuation / Work
→ Replay
```

This document narrows the higher-level enterprise abstraction that should feed that runtime.

---

# 3. Primary enterprise abstraction: economic semantics first

The first migration question is not:

> Which source table maps to which EVO table?

The first question is:

> What economically meaningful things exist in this enterprise, and what economically meaningful changes happen between them?

For the migration/runtime boundary, enterprise data is classified first by whether it participates in enterprise economic decisions.

---

# 4. Decision Data vs Tool Data

## 4.1 Decision Data

**Decision Data** affects enterprise economic state, enterprise obligations, rights, resources, commitments, valuation, cost, cash, delivery, production or management decisions.

Examples:

- Customer / Supplier
- Product / Material / Service
- Facility / Warehouse
- Contract
- Price / Currency / Tax
- Inventory
- Receivable / Payable
- Sales Order / Purchase Order
- Shipment / Receipt
- Production consumption / completion
- Payment / Receipt / Settlement
- Cost object
- Expense
- Employee/department when used as an economic dimension
- business commitments and pending work that drive economic execution

Decision Data belongs in the semantic migration scope and may become Metadata or Business Facts.

## 4.2 Tool Data

**Tool Data** exists primarily to help Humans/software perform work but does not itself define enterprise economic truth.

Examples:

- UI layout preference
- dashboard panel size
- draft search filters
- notification presentation state
- editor state
- cached display data
- non-economic collaboration convenience data
- browser/session-only interaction state

Tool Data may still be important product data, but it must not be promoted into the economic runtime merely because it exists in a source system.

## 4.3 Boundary rule

The distinction is semantic, not physical.

A field such as `department_id` may be:

- Tool Data in one context; or
- Decision Data when it participates in cost allocation, responsibility accounting or authorization.

The Migration Agent must classify by business meaning, not column name.

---

# 5. Enterprise economic flows: Material Flow + Money Flow

For economic migration, a useful first abstraction is:

```text
Enterprise Economic Activity
=
Material Flow
+
Money Flow
```

This is intentionally simpler than modelling every existing application/module.

---

## 5.1 Material Flow

Material Flow means movement, transformation, consumption, creation, reservation or provision of an economic object.

Material Flow has two major forms.

### A. Physical material

Examples:

- raw material
- finished goods
- inventory
- equipment
- spare parts
- packaging
- goods in transit

Common measures:

```text
quantity
unit
location
lot / serial
quality state
ownership / custody
time
```

### B. Virtual material / service

A purchased or delivered service is not physically stocked like a part, but it still represents an economic object that can be ordered, received, consumed, measured and costed.

Examples:

- consulting hours
- cloud service
- transportation
- software subscription
- maintenance service
- advertising service
- processing service
- labor capacity

Common measures:

```text
quantity / duration / usage
service unit
period
recipient
provider
completion / acceptance state
cost
```

Therefore EVO must not define Material Flow as “physical goods only”.

A more precise concept is:

> **Economic Resource / Deliverable Flow**

Physical inventory is one subtype.

---

## 5.2 Money Flow

Money Flow represents monetary rights, obligations, holdings and settlement.

Examples:

- cash
- bank balance
- receivable
- payable
- deposit
- prepayment
- loan
- tax payable / receivable
- accrued expense
- revenue recognition
- settlement
- FX gain/loss

Common measures:

```text
amount
currency
counterparty
due date
settlement status
economic period
valuation basis
```

Money Flow does not mean only actual cash movement. A receivable is already part of money-flow semantics before collection.

---

# 6. The smallest durable enterprise semantic vocabulary

Do not prematurely model every industry concept as a Core object.

For migration discovery, begin with a deliberately small vocabulary.

## 6.1 Metadata classes

```text
Party
EconomicObject
Location
OrganizationUnit
Person / Responsibility
UnitOfMeasure
Currency
Price / Rate
Contract / Agreement
Classification
Account / Ledger Definition
Application / Transaction Type
Rule / Policy
```

### Party

Customer, supplier, employee, bank, government body, partner, related party.

### EconomicObject

Anything economically exchanged, held, consumed, produced or delivered:

- physical product/material;
- service;
- labor/capacity;
- right/entitlement;
- expense object;
- fund/cash instrument where useful.

### Location

Warehouse, store, plant, bin, virtual service location, custody location.

### OrganizationUnit

Legal entity, business unit, department, cost center, project organization.

These categories are discovery aids. They do not require one universal physical database table.

---

# 7. Transaction / Business Fact abstraction

Once metadata is understood, historical data is classified into Business Facts.

A Business Fact should answer:

```text
WHO / WHAT participated?
WHAT happened?
WHEN did it happen?
HOW MUCH occurred?
UNDER WHICH business identity / application?
WHAT evidence identifies the fact?
```

A useful canonical view is:

```text
BusinessFact
=
Event Type
+ Metadata References
+ Measures
+ Effective Time
+ Enterprise / Application Identity
+ Stable Business Identity
+ Optional Relationships / Evidence
```

Examples:

```text
SalesOrderApproved
Customer=A
Product=P
Qty=100
Amount=10,000

ServiceAccepted
Supplier=B
Service=Consulting
Hours=40
Amount=8,000

PaymentReceived
Customer=A
Currency=USD
Amount=5,000
```

The fact is preserved. Posting and costing remain separate interpretations.

---

# 8. Never confuse facts with derived state

Migration discovery must classify source data into at least:

```text
METADATA
BUSINESS_FACT
DERIVED_STATE
SNAPSHOT
LEDGER_RESULT
TECHNICAL_DATA
TOOL_DATA
UNKNOWN
```

Examples:

| Source concept | Classification |
|---|---|
| customer master | METADATA |
| product/service master | METADATA |
| approved sales-order line | BUSINESS_FACT |
| inventory movement | BUSINESS_FACT |
| current inventory balance | DERIVED_STATE or SNAPSHOT |
| month-end stock snapshot | SNAPSHOT |
| receivable balance | LEDGER_RESULT |
| last_modified_at | TECHNICAL_DATA |
| grid column width | TOOL_DATA |

This classification is a required migration step.

Derived balances may be imported as reconciliation evidence or opening-state material when history is unavailable, but must never be silently treated as original facts.

---

# 9. Metadata-first migration

The standard migration sequence is:

## Phase M0 — Source inventory

Discover:

- systems;
- databases;
- tables/files/APIs;
- ownership;
- update cadence;
- volume;
- date coverage;
- known business owner.

Output:

`SourceSystemInventory`

## Phase M1 — Structural profiling

Collect:

- schema;
- types;
- nullability;
- keys;
- relationships;
- comments;
- sample values;
- value distributions;
- cardinality;
- temporal behavior.

Output:

`SourceDataProfile`

## Phase M2 — Semantic classification

Classify source structures as:

- metadata;
- business fact;
- derived state;
- snapshot;
- ledger result;
- tool/technical data;
- unresolved.

Output:

`EnterpriseDataInventory`

## Phase M3 — Enterprise metadata model

Map high-confidence source semantics into enterprise metadata.

Output:

`EnterpriseMetadataModel`

## Phase M4 — Human confirmation

Only unresolved / consequential mappings are escalated to Humans.

The Agent should prefer:

```text
“We believe CUSTOMER_MASTER.status is customer lifecycle status (94%).
[Confirm] [Correct meaning] [Show evidence]”
```

over asking Humans to document every field from scratch.

## Phase M5 — Business Fact extraction

Define how source records become canonical historical facts.

Output:

`BusinessFactMapping`

## Phase M6 — Best Data Provider specification

Generate/configure the enterprise-specific ingestion provider:

```text
connection
schema discovery
metadata mapping
fact extraction
transform
validation
incremental sync
lineage
error handling
reconciliation
```

## Phase M7 — Dry-run BusinessData

Submit to an isolated migration/runtime scope.

No production cutover yet.

## Phase M8 — Ledger replay

```text
BusinessData
→ Posting Rules
→ Ledger / Cost / Work
```

## Phase M9 — Reconciliation

Compare:

- quantities;
- money;
- inventory;
- receivable/payable;
- cost;
- financial totals;
- selected operational positions.

## Phase M10 — Human acceptance / cutover

Only after unresolved differences meet agreed acceptance policy.

---

# 10. What “Best Data Provider” means

A Best Data Provider is not merely a database connector.

It is the best currently-known governed translation between a source enterprise system and EVO semantics.

```text
Source
→ Discovery
→ Semantic Mapping
→ Canonical Metadata / Business Facts
→ Validation
→ EVO
```

It should be versioned and evidence-backed.

A provider can improve as understanding improves without rewriting original source evidence.

Recommended durable artifacts:

```text
ProviderDefinition
ProviderVersion
SourceSchemaFingerprint
MetadataMapping
FactMapping
TransformationRule
ValidationRule
LineageRule
ReconciliationRule
KnownException
Confidence / Evidence
```

---

# 11. Conversation is the migration control plane, not the database

Enterprise migration will often be driven through Agent conversation.

The Chat surface must be able to:

- discover source systems;
- request/import samples;
- show structured metadata proposals;
- show mapping diffs;
- expose unresolved questions;
- present evidence/confidence;
- provide direct actions;
- launch dry runs;
- show reconciliation;
- resume work later.

But durable migration state is not `messages[]`.

It is:

```text
MigrationWorkspace
├─ EnterpriseContext
├─ SourceSystemInventory
├─ DataProfiles
├─ MetadataMappings
├─ FactMappings
├─ ProviderVersions
├─ Decisions
├─ OpenQuestions
├─ MigrationRuns
├─ ReconciliationResults
└─ Approvals
```

Conversation is one evidence/input channel into this workspace.

---

# 12. Agent capability: abstraction before model training

The Personal/Enterprise Agent must eventually treat enterprise abstraction as a basic capability.

However, “training” is deliberately staged.

The first goal is not to modify model weights.

The first goal is to move enterprise knowledge into executable architecture.

---

# 13. Learning ladder

## L0 — Human-confirmed vocabulary

**Now.**

Define and maintain:

- Decision Data vs Tool Data;
- Material Flow vs Money Flow;
- Physical vs Virtual Material/Service;
- Metadata vs Fact vs Derived State;
- enterprise metadata vocabulary;
- migration phases.

Evidence source:

- Human direction;
- bookkeeping archaeology;
- Asloop archaeology;
- EVO runtime invariants.

**Exit gate:** vocabulary is documented, examples exist, contradictions are recorded.

## L1 — Deterministic classification contracts

Create machine-readable contracts/enums for migration classification.

The Agent should be able to produce structured proposals such as:

```json
{
  "source": "stock_balance",
  "classification": "SNAPSHOT",
  "semanticCandidate": "inventory.position",
  "confidence": 0.94,
  "evidence": [...]
}
```

**No model training required.**

**Exit gate:** classification proposals validate structurally and can be reviewed/rejected.

## L2 — Legacy curriculum

Build a curated curriculum from:

- bookkeeping;
- Asloop;
- EVO certified reference scenarios.

Generate examples of:

- metadata detection;
- fact detection;
- derived-balance detection;
- material-flow identification;
- money-flow identification;
- physical vs service object distinction;
- posting-rule separation.

This becomes:

- few-shot examples;
- evaluation cases;
- negative examples;
- Agent behavior tests.

**Exit gate:** target LLMs pass a fixed evaluation suite at an agreed threshold.

## L3 — Synthetic migration exercises

Create artificial enterprises with known ground truth:

- trading company;
- service company;
- manufacturer;
- mixed physical/service enterprise.

Give Agent raw schemas and samples, then measure whether it reconstructs the known semantic model.

**Exit gate:** repeatable accuracy and low Human correction burden.

## L4 — Shadow real-enterprise migration

For early customers:

- Agent proposes;
- Human implementation consultant approves;
- no autonomous production cutover.

Record:

- proposal;
- Human correction;
- reason;
- accepted mapping;
- later reconciliation outcome.

This is the most valuable learning dataset.

**Exit gate:** correction rate falls and high-impact semantic errors remain below agreed safety target.

## L5 — Experience Compiler learning

Generalize only reusable patterns:

- schema patterns;
- semantic mappings;
- migration heuristics;
- provider templates;
- industry vocabulary;
- reconciliation patterns.

Do not automatically share enterprise raw data.

**Exit gate:** new enterprises measurably require fewer Human decisions.

## L6 — Model optimization (optional)

Only when L0–L5 provide enough stable evidence should we consider:

- supervised fine-tuning;
- preference optimization;
- distillation to smaller/private models.

Training dataset should contain structured context:

```text
source evidence
candidate semantics
available actions
expected classification/action
accepted/rejected reasoning
Human correction
final outcome
```

Do not fine-tune merely because one model gave a poor answer that can be fixed by contracts, tools or examples.

---

# 14. When to abstract further

Create a new abstraction only when at least one condition is true:

1. the same semantic pattern appears across multiple unrelated enterprises;
2. bookkeeping/Asloop/EVO evidence independently converges on the same concept;
3. the concept materially simplifies BusinessData, Posting, reconciliation or migration;
4. Humans repeatedly make the same mapping decision;
5. the concept is necessary to define a stable Provider contract.

Do **not** add a Core abstraction because:

- one customer's table happens to have that shape;
- one LLM finds the concept convenient;
- an industry package uses the term;
- a UI screen needs a grouping label.

Default:

```text
Enterprise-specific pattern
→ Provider / Enterprise Context first
→ repeated evidence
→ template
→ only then consider platform-level abstraction
```

---

# 15. When to train further

Continue Agent training/evaluation when one of these triggers fires:

- repeated Human correction on the same semantic class;
- Agent confuses fact and balance;
- Agent confuses service and physical inventory;
- Agent proposes posting semantics before metadata is understood;
- Agent overfits source table names;
- migration dry runs produce systematic reconciliation gaps;
- new industry introduces semantic classes not covered by current curriculum;
- a new LLM/provider materially regresses the evaluation suite.

The response order is:

```text
1. Contract / ontology fix
2. Tool / context fix
3. Example / curriculum fix
4. Evaluation expansion
5. Prompt / behavior policy
6. Parameter training only if still justified
```

---

# 16. Human confirmation policy

LLM proposals are not enterprise truth.

For migration:

```text
DISCOVERED
→ INFERRED
→ HUMAN-CONFIRMED or EVIDENCE-CERTIFIED
→ PUBLISHED
```

High-impact concepts always require stronger confirmation, especially:

- legal entity;
- ownership;
- financial account meaning;
- customer/supplier identity;
- quantity/currency semantics;
- transaction effective time;
- opening balances;
- inventory costing identity;
- posting direction;
- tax;
- historical corrections;
- cutover rules.

The system should concentrate Human attention on uncertainty rather than require Humans to re-document obvious metadata.

---

# 17. Migration confidence

A useful product-level score may be:

```text
Migration Confidence
=
Metadata Coverage
× Semantic Confidence
× Fact Coverage
× Replay Determinism
× Reconciliation Accuracy
```

This is not yet a Core accounting formula.

It is a migration/workspace quality model.

Each component must be separately visible; one aggregate score must never hide a severe low-confidence area.

---

# 18. Canonical example: service purchase

A service purchase demonstrates why “virtual material” matters.

Source enterprise:

```text
Supplier: ConsultingCo
Service: Implementation consulting
Qty: 40 hours
Price: 200/hour
Amount: 8,000
```

Metadata:

```text
Party(Supplier)
EconomicObject(Service)
UnitOfMeasure(Hour)
Currency
Organization / Project dimension
```

Fact sequence may be:

```text
ServiceOrdered
ServicePerformed
ServiceAccepted
InvoiceReceived
PaymentMade
```

Depending on enterprise rules these can create:

- commitment;
- expense/cost;
- payable;
- cash reduction;
- project cost.

The service is economically a deliverable even though it is not physical inventory.

---

# 19. Canonical example: physical purchase

```text
Supplier
Material
Warehouse
Qty
Unit
Price
Currency
```

Fact sequence:

```text
PurchaseOrdered
GoodsReceived
InvoiceReceived
PaymentMade
```

Potential derived positions:

```text
pending_receipt
inventory
payable
cash
cost / valuation
```

This and the service example should share as much semantic machinery as possible without pretending that service inventory and physical stock are identical.

---

# 20. Architecture boundary

This document describes **enterprise semantic and migration architecture**, not a mandate to enlarge minimal EVO Ledger Runtime.

Minimal Ledger Runtime remains:

```text
BusinessData
→ PostingRule
→ Ledger
→ Balance
```

Migration discovery, Agent behavior, source connectors, Enterprise Context and Best Data Provider lifecycle generally belong to App Platform / plugins / migration tooling.

EVO owns the canonical semantic contracts required for deterministic runtime consumption.

---

# 21. Project goals

## Goal A — Freeze Enterprise Data Vocabulary v0.1

Deliver:

- classification vocabulary;
- metadata vocabulary;
- physical/service examples;
- legacy evidence crosswalk.

Acceptance:

- Human review;
- no contradiction with BusinessData / Posting invariants.

## Goal B — Migration Classification Contract v0.1

Deliver machine-readable:

- source artifact;
- classification;
- semantic candidate;
- confidence;
- evidence;
- Human decision;
- version.

Acceptance:

- validator;
- examples;
- negative cases.

## Goal C — Legacy Migration Curriculum v0.1

Use bookkeeping + Asloop + EVO certified scenarios.

Acceptance:

- fixed evaluation corpus;
- at least one fact-vs-balance test;
- one physical-vs-service test;
- one money-flow test;
- one mixed-flow test.

## Goal D — Migration Workspace MVP

Conversation-driven:

```text
source discovery
→ metadata proposal
→ Human confirmation
→ fact mapping
→ provider spec
→ dry run
→ reconciliation
```

Acceptance:

- persistent structured state;
- resume after chat/session restart;
- direct actions for deterministic decisions.

## Goal E — Best Data Provider MVP

First provider should support one realistic source shape end-to-end.

Acceptance:

- lineage;
- deterministic transform;
- validation;
- replayable dry run;
- reconciliation report.

## Goal F — Shadow Enterprise Pilot

Run a real migration without autonomous cutover.

Acceptance:

- Human corrections recorded;
- unresolved questions explicit;
- metadata and fact coverage measurable;
- reconciliation measurable;
- training/evaluation feedback captured.

## Goal G — EC Learning Loop

Generalize reusable migration knowledge.

Acceptance:

- enterprise raw data remains scoped;
- reusable patterns are versioned;
- new pilot needs fewer Human corrections than previous baseline.

---

# 22. Near-term order

Do not jump directly to model fine-tuning.

The recommended implementation order is:

```text
1. Architecture vocabulary            ← this document
2. Machine-readable classification contract
3. Legacy curriculum + evaluator
4. Agent Behavior Architecture integration
5. Migration Workspace data model
6. First metadata discovery tool/provider
7. First end-to-end dry-run migration
8. Real shadow pilot
9. EC pattern learning
10. Fine-tuning only if evidence justifies it
```

This is the default sequence unless a Human business decision changes priorities.

---

# 23. Invariants

### EM-01
Metadata understanding precedes canonical historical fact migration.

### EM-02
Business facts and posting rules remain separate.

### EM-03
Balances and other derived state must not silently become original facts.

### EM-04
Physical goods and services are both economic deliverables, but their operational semantics may differ.

### EM-05
Money Flow includes rights and obligations, not only settled cash movement.

### EM-06
Decision Data and Tool Data are classified by business meaning, not storage location.

### EM-07
Enterprise-specific semantics begin in Enterprise Context / Provider mappings; repeated evidence is required before promoting them to shared abstractions.

### EM-08
LLM inference is proposal, not published enterprise truth.

### EM-09
Migration Chat is an interaction/control surface; structured Migration Workspace state is durable truth.

### EM-10
Best Data Provider mappings are versioned and lineage-backed.

### EM-11
Agent learning must prefer contracts/evaluation/curriculum before parameter training.

### EM-12
A new LLM must be able to learn the migration method from repository artifacts without prior chat memory.

---

# 24. One-line target

> **EVO should be able to meet an unfamiliar enterprise, discover its core metadata, reconstruct its material and money flows as durable business facts, generate the best governed data provider for that enterprise, replay those facts through EVO's deterministic ledger runtime, reconcile the result, and continuously improve this ability without depending on any single LLM's memory.**

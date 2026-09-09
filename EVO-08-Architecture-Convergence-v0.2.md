# EVO-08 — Architecture Convergence

**Version:** 0.2  
**Status:** Conceptual Architecture Baseline  
**Project:** EVO — Enterprise Operating System  
**Scope:** Convergence of EVO-00 through EVO-07

---

## 1. Purpose

EVO-08 is the first architecture convergence document.

It does not introduce a new subsystem. It consolidates the decisions made in EVO-00 through EVO-07 into one canonical conceptual architecture and removes concepts that were superseded during the design process.

After EVO-08, EVO should move from broad conceptual architecture into physical design and implementation architecture.

---

## 2. EVO Definition

EVO is an AI-native Enterprise Operating System.

Its purpose is to represent:

```text
Enterprise Semantics
Business Capabilities
Business Data
Posting Rules
Ledgers
Balances
Cost / Valuation
Processes
Plans
Work
Human / AI / Automation Actions
```

inside one coherent, reproducible operating model.

The central operating loop is:

```text
Enterprise Metadata
        ↓
Human / AI / Automation
        ↓
Command
        ↓
Business Application
        ↓
Business Data
        ↓
Posting Input
        ↓
Conditional Posting
        ↓
Ledger Entries
        ↓
Balance / Cost / State
        ↓
Process / Plan / Work
        ↓
Next Command
```

---

## 3. Canonical Architecture

```text
┌─────────────────────────────────────────────────────┐
│                  ACTORS                             │
│          Human / AI / Automation                    │
└──────────────────────┬──────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────┐
│              EXECUTION / WORK                       │
│ Command / Process / Plan / Work Item / Approval     │
└──────────────────────┬──────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────┐
│              BUSINESS APPLICATIONS                  │
│ Domain / Transaction Type / Application Instance    │
└──────────────────────┬──────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────┐
│                 BUSINESS DATA                       │
│        Runtime records preserving history           │
└──────────────────────┬──────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────┐
│                POSTING ENGINE                       │
│ Posting Input / Sequence / Conditional Posting      │
└──────────────────────┬──────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────┐
│                 LEDGER ENGINE                       │
│ Ledger Definition / Entry / Dimensions / Balance    │
└──────────────────────┬──────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────┐
│              COST / VALUATION                       │
│ Policy / Pool / Layer / Match / Cost Result         │
└──────────────────────┬──────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────┐
│           REPLAY / RECALCULATION                    │
│ Posting Run / Ledger Dataset / Cost Run / Dataset   │
└─────────────────────────────────────────────────────┘

Cross-cutting foundation:

┌─────────────────────────────────────────────────────┐
│                  METADATA                           │
│ Model / Template / Application / Fields / Rules     │
│ Commands / Processes / Ledgers / AI Capabilities    │
└─────────────────────────────────────────────────────┘
```

AI spans the architecture through semantic read access and controlled Command execution. It does not replace deterministic posting, ledger, cost or replay engines.

---

## 4. Canonical Enterprise Metadata Hierarchy

The canonical semantic hierarchy is:

```text
Enterprise
    ↓
Domain
    ↓
Transaction Type
    ↓
Specific Business Application
    ↓
Field Group
    ↓
Field
```

This hierarchy is semantic, not necessarily a strict physical database tree.

### Enterprise

Operational ownership boundary.

### Domain

Business-semantic grouping.

### Transaction Type

High-level transaction abstraction.

Example:

```text
销售订单
```

### Specific Business Application

Executable business capability.

Example:

```text
销售订单
├── 预售销售
├── 现货销售
├── 寄售销售
└── 项目销售
```

Transaction Type and Specific Business Application are explicitly different concepts.

---

## 5. Canonical Definition Layers

EVO retains four distinct definition layers:

```text
Model
    ↓
Template
    ↓
ApplicationDefinition
    ↓
ApplicationInstance
```

### Model

Reusable business-object semantic definition.

### Template

Reusable versioned business-capability package.

### ApplicationDefinition

Concrete specification of application behavior and semantics.

### ApplicationInstance

Installed/configured application inside one Enterprise.

Enterprise customization uses:

```text
Effective Definition
=
Base Definition / Template
+
Enterprise Overlay
```

Published Template versions remain immutable.

---

## 6. Canonical Metadata Objects

The canonical metadata vocabulary is:

```text
Enterprise
Domain
TransactionType
Model
Template
ApplicationDefinition
ApplicationInstance

FieldGroup
Field

CommandDefinition
ProcessDefinition
ProcessStepDefinition
PostingRule
LedgerDefinition
ValuationPolicy
PermissionDefinition
ApprovalPolicy
ViewDefinition
TriggerDefinition
AICapabilityDefinition
```

The suffix `Definition` is used when necessary to distinguish metadata from runtime instances/results.

---

## 7. Canonical Runtime Objects

The canonical runtime vocabulary is:

```text
BusinessData
PostingInput

CommandExecution
ProcessInstance
ProcessStepInstance
WorkItem
Plan

LedgerEntry
LedgerBalance

CostPool
CostLayer
CostMatch
CostResult

ReplayRun
PostingRun
LedgerDataset
CostRun
CostDataset
```

`BusinessFact` and `BusinessEvent` are no longer required as foundational runtime object categories.

Applications may still use words such as event, approval event, shipment event or business fact in their business vocabulary, but the generic runtime kernel does not depend on a philosophical Fact/Event distinction.

---

## 8. Major Convergence Change — Business Fact Immutability

EVO-00 originally stated:

```text
Business Facts are Immutable
```

This is superseded.

The canonical principle is now:

> **Business History Is Preserved.**

EVO does not require the posting kernel to enforce an abstract universal immutability rule on every business record.

Instead, business changes are expressed using newly added business data.

```text
Original Business Data
        ↓
New Business Data
        ↓
New Business Data
        ↓
Complete Business History
```

Example:

```text
Order +100
Adjustment -20
Result = 80
```

The posting engine does not need to know that `-20` is philosophically a correction of `+100`.

It simply posts the ordered business data.

---

## 9. No Generic Correction Graph

The following are not required kernel concepts:

```text
correction_of
reversal_of
replace_of
```

An application may model such relationships when useful for business explanation.

But:

```text
Business Description Layer
```

owns that meaning.

The Ledger Engine remains neutral.

This is a deliberate simplification.

---

## 10. Canonical Business Data Principle

Business Data is the durable replay source.

The system must retain enough business history to rebuild derived results.

Canonical relationship:

```text
Business Data
    ↓
Posting
    ↓
Ledger
    ↓
Cost
```

Derived posting and calculation data may be deleted and rebuilt.

---

## 11. Command Boundary

Command is the canonical write capability for Human, AI and Automation.

```text
Human / AI / Automation
        ↓
CommandDefinition
        ↓
CommandExecution
        ↓
Business Data
```

A Command represents a request to perform a business operation.

It does not directly mutate LedgerBalance.

Canonical rule:

> **Commands create business data; posting creates ledger results.**

---

## 12. Replay Never Re-executes Commands

Historical replay consumes existing Business Data.

It does not re-run historical Commands.

Correct:

```text
Business Data
↓
Replay Posting
↓
Ledger / Cost
```

Incorrect:

```text
Historical Command
↓
Execute Again
↓
Create Duplicate Business Data
```

This is a system invariant.

---

## 13. Posting Input

Any business record relevant to posting becomes a PostingInput.

Conceptually:

```text
PostingInput
    business_data_identity
    application
    effective_time
    posting_priority
    stable_sequence
    metadata_version
```

The exact physical representation is deferred.

---

## 14. Canonical Posting Sequence

Posting order is deterministic.

```text
PostingSequence
=
Business Effective Time
+ Explicit Posting Priority
+ Stable Sequence Number
```

Posting order must not rely solely on:

```text
database insert time
auto increment id
physical row order
thread scheduling
message arrival race
```

The same posting input set and versions must produce the same logical order.

---

## 15. Conditional Posting

Canonical posting model:

```text
PostingInput
+ Application
+ Conditions
+ PostingRule Version
        ↓
Ledger Effects
```

A PostingRule may define:

```text
Target Ledger
Direction
Quantity Formula
Amount Formula
Condition
Dimension Mapping
Priority
Version
```

Rules are metadata and are versioned.

---

## 16. Canonical Ledger Model

Ledger is a generic enterprise abstraction, not a finance-only abstraction.

Examples:

```text
待采购
待生产
待质检
待入库
待出库
待收款
待付款
库存数量
库存价值
现金
应收
应付
收入
费用
```

Financial accounting is a standardized Ledger family within this model.

Canonical distinction:

```text
LedgerDefinition = Metadata
LedgerEntry      = Derived Runtime Result
LedgerBalance    = Projection from LedgerEntry
```

---

## 17. Ledger Entry Is Rebuildable

LedgerEntry is not original business truth.

It is produced by:

```text
Business Data
+ Posting Rule Version
+ Posting Sequence
```

Therefore it may be cleared and regenerated.

The same applies to materialized LedgerBalance.

---

## 18. Ledger Dimensions

Ledger dimensions are explicit.

Examples:

```text
Enterprise
Organization
Warehouse
Product
Customer
Supplier
Project
Batch
Serial Number
Currency
Application
Transaction Type
```

Dimensions must not be hidden only inside hard-coded SQL.

---

## 19. Balance

Canonical definition:

```text
LedgerBalance
=
Projection / aggregation of LedgerEntry
```

Balance may drive:

```text
State
Plan
Work
Alert
AI Recommendation
Next Command
```

But balance is not the durable historical source.

---

## 20. Cost Is Separate from Posting

The canonical boundary is:

```text
Posting Engine
    ↓
LedgerEntry
    ↓
Cost / Valuation Engine
    ↓
CostResult
```

The Ledger Engine determines:

```text
What quantity/direct amount affects which ledger and dimensions?
```

The Cost Engine determines:

```text
At what valuation is the cost-bearing movement measured?
```

---

## 21. Canonical Valuation Methods

Initial architecture supports:

```text
FIFO
LIFO
MOVING_AVERAGE
SPECIFIC_IDENTIFICATION
```

Reserved extensions include:

```text
PERIODIC_WEIGHTED_AVERAGE
STANDARD_COST
BATCH_COST
PROJECT_COST
ACTUAL_PRODUCTION_COST
```

---

## 22. Canonical Cost Objects

```text
ValuationPolicy
    ↓
CostPool
    ↓
CostLayer / Running Average State
    ↓
CostMatch
    ↓
CostResult
```

### FIFO / LIFO

Share CostLayer and CostMatch structures; layer selection order differs.

### Moving Average

Maintains running quantity, amount and average unit cost within CostPool.

### Specific Identification

Requires explicit identifying dimensions such as:

```text
Serial Number
Batch
Lot
Asset Identity
Project Identity
Specific Inventory Identity
```

The Cost Engine cannot invent identity that was absent from business/posting data.

---

## 23. Cost Result Is Rebuildable

CostResult is derived data.

So are:

```text
CostPool state
CostLayer
CostMatch
```

They may be cleared and rebuilt during recalculation.

---

## 24. Dataset Dependency

Canonical dependency:

```text
Business Data
    ↓
PostingRun
    ↓
LedgerDataset
    ↓
CostRun
    ↓
CostDataset
```

And:

```text
CostDataset
depends on
LedgerDataset
```

A valuation-policy change can generate a new CostDataset without rewriting Business Data.

If LedgerDataset remains valid, cost-only recalculation is conceptually allowed.

---

## 25. Full Replay Is the Initial Strategy

The initial implementation deliberately chooses simplicity.

```text
Pause Authoritative Real-Time Posting
        ↓
Acquire Replay Lock
        ↓
Establish Input Boundary
        ↓
Clear Ledger / Balance / Cost Derived Data
        ↓
Replay All Business Data
        ↓
Rebuild Ledger
        ↓
Rebuild Balance
        ↓
Recalculate Cost
        ↓
Validate
        ↓
Resume Posting
```

Not required initially:

```text
Partial Replay
From-Date Replay
Impact Replay
Incremental Posting Rebuild
Distributed Replay
```

These are future performance optimizations.

---

## 26. Replay and New Business Data

During Replay:

```text
Real-time posting = paused
```

Business data creation may remain available.

New posting-relevant Business Data receives sequence information and waits beyond the Replay input boundary.

After replay:

```text
Publish rebuilt result
↓
Process waiting inputs in sequence
↓
Resume normal posting
```

The entire enterprise does not necessarily need to stop recording business activity.

---

## 27. Replay Publication

The long-term preferred architecture is:

```text
Active Dataset A
        ↓
Build Candidate Dataset B
        ↓
Validate B
        ↓
Atomic Switch
        ↓
Active Dataset B
```

However, the first implementation may use:

```text
Pause
↓
Clear
↓
Rebuild
↓
Validate
↓
Resume
```

Dataset isolation is an availability optimization, not an initial architectural requirement.

---

## 28. Reproducibility Contract

EVO's canonical reproducibility contract is:

```text
Same Business Input Set
+ Same Metadata Version
+ Same Posting Rule Version
+ Same Posting Sequence
+ Same Valuation Policy Version
+ Same Calculation Rules
=
Same Derived Result
```

Derived Result includes:

```text
Ledger Entries
Ledger Balances
Cost Layers
Cost Matches
Cost Results
```

within defined precision and rounding rules.

---

## 29. Process, Plan and Work

Process coordinates enterprise work.

It does not replace Business Data or Ledger state.

Canonical separation:

```text
LedgerBalance
=
How much state / obligation exists?

WorkItem
=
Who or what should act?

Plan
=
What future work is intended?

Command
=
Execute a business operation.
```

---

## 30. Work Loop

Example:

```text
待生产 Balance = 70
        ↓
Production Plan
        ↓
Work Item
        ↓
Release / Produce Command
        ↓
New Business Data
        ↓
Posting
        ↓
待生产 -30
        ↓
New Balance = 40
```

This is the canonical closed operating loop.

---

## 31. Trigger Boundary

Triggers may react to:

```text
Business Data
Ledger Balance
Threshold
Time
Process Completion
External Signal
Manual Request
AI Decision
```

Preferred:

```text
Trigger
↓
Command / Process / Work
↓
Business Data
↓
Posting
```

Not:

```text
Trigger
↓
Direct Balance Mutation
```

---

## 32. Actor Model

Canonical actor types:

```text
Human
AI
Automation
External System
```

Human, AI and Automation share the same Command capability model.

External systems should normally integrate through declared Commands or business interfaces rather than writing LedgerEntry directly.

---

## 33. AI-Native Boundary

AI is a first-class actor but deterministic engines remain authoritative.

AI may:

```text
Observe
Explain
Recommend
Plan
Prepare
Execute permitted Commands
Coordinate permitted work
Diagnose
```

AI may not bypass:

```text
Permission
Approval
Command Preconditions
Posting Rules
Ledger Engine
Cost Engine
Replay Lock
```

---

## 34. AI Read and Write Model

Canonical AI read model:

```text
Metadata Query
Business Data Query
Ledger Query
Cost Query
Process Query
Work Query
Capability Query
```

Canonical AI write model:

```text
Command
Plan
Work
Approval
```

AI does not normally require arbitrary SQL/database writes.

---

## 35. AI Context

AI context is permission-aware and retrieved on demand.

```text
Intent
↓
Semantic Discovery
↓
Relevant Metadata
↓
Relevant Business Data
↓
Relevant Ledger / Cost / Work State
↓
Working Context
```

The whole enterprise dataset is not dumped into AI context.

---

## 36. Enterprise Truth

Canonical truth boundaries:

```text
Conversation Context ≠ Business Data
AI Memory            ≠ Ledger
AI Assumption        ≠ Enterprise Policy
UI State             ≠ Business Truth
Process State        ≠ Complete Business History
Balance              ≠ Historical Source
Cost Result          ≠ Original Business Data
```

Enterprise truth is resolved through EVO's authoritative metadata and runtime data.

---

## 37. Reference and Snapshot

The distinction established in EVO-01 remains.

### Reference

```text
What object is this?
```

### Snapshot

```text
What value was recorded at this business moment?
```

Historical business data must not silently change because referenced master data later changed.

---

## 38. Canonical Versioned Metadata

At minimum, EVO versions:

```text
Template
ApplicationDefinition
Field Definition
PostingRule
ProcessDefinition
ValuationPolicy
```

Published definitions are immutable versions.

Enterprise ApplicationInstance records the effective installed/configured definition.

---

## 39. Canonical System Invariants

The following invariants are now the conceptual architecture baseline.

1. Enterprise is the operational ownership boundary.
2. Metadata and runtime data are separate.
3. TransactionType is not Specific Business Application.
4. Template, ApplicationDefinition and ApplicationInstance are distinct.
5. Published Template versions are immutable.
6. Enterprise customization uses an overlay.
7. Field is business-semantic metadata.
8. Business history must be preserved.
9. Business changes are represented through newly added business data.
10. The generic posting kernel does not require correction/reversal graphs.
11. Commands create business data.
12. Replay never re-executes historical Commands.
13. Posting consumes ordered Business Data.
14. Posting order is deterministic.
15. PostingRules are versioned metadata.
16. LedgerDefinition is metadata.
17. LedgerEntry is rebuildable derived data.
18. LedgerBalance is a projection.
19. Ledger is not finance-only.
20. Ledger dimensions are explicit.
21. Cost calculation is separate from posting.
22. CostResult is rebuildable derived data.
23. FIFO, LIFO, Moving Average and Specific Identification share one valuation framework.
24. CostDataset depends on LedgerDataset.
25. Full replay pauses authoritative real-time posting.
26. Initial replay strategy is full clear-and-rebuild.
27. New business data created during replay must not be lost.
28. Replay results must be validated before becoming authoritative.
29. Process coordinates work but does not replace business history.
30. WorkItem is actionable work; LedgerBalance is enterprise state.
31. Plan executes through Commands.
32. Triggers do not directly mutate ledger balances.
33. Human, AI and Automation share the Command model.
34. AI cannot bypass permission or deterministic engines.
35. AI context is semantic, scoped and permission-aware.
36. UI is a client of the business model, not its source of truth.
37. The same inputs, versions, ordering and policies must reproduce the same derived results.

---

## 40. Concepts Removed or Downgraded

### Removed as foundational concepts

```text
BusinessFact as mandatory universal runtime type
BusinessEvent as mandatory universal runtime type
Generic correction graph
Mandatory partial replay
Mandatory dataset coexistence
```

### Downgraded to business/application vocabulary

```text
Fact
Event
Correction
Cancellation
Reversal
```

These may still be useful inside specific applications, but the EVO kernel does not depend on them.

### Deferred optimizations

```text
Partial Replay
Impact-Based Replay
Parallel Replay
Distributed Replay
Atomic Dataset Switching
Near-Zero-Downtime Replay
Advanced BPMN
Multi-Agent Autonomous Operation
```

---

## 41. Remaining Open Architecture Questions

The conceptual architecture is sufficiently stable to begin physical design, but several questions remain intentionally open.

### 41.1 Model Scope

Current:

```text
Model = reusable business-object semantic definition
```

Whether Model evolves into a broader schema/type system remains open.

### 41.2 Enterprise Overlay Upgrade Merge

Future Template upgrades require:

```text
Base Template v1
Base Template v2
Enterprise Overlay
```

and a three-way merge/conflict model.

### 41.3 Cost → Financial Posting Integration

Still open:

```text
Cost Result drives secondary financial posting
or
Cost Result feeds financial projection
or
Cost Result becomes a later posting-phase input
```

This should be resolved during physical accounting runtime design.

### 41.4 Negative Inventory

ValuationPolicy must explicitly define behavior.

Initial physical design must decide the first supported policy.

### 41.5 Storage Strategy

Still intentionally undecided:

```text
Relational
Document
Hybrid
Event-oriented
Specialized ledger structures
```

EVO-09 should now resolve this.

---

## 42. Canonical Object Map

```text
METADATA
──────────────────────────────────────────────
Enterprise
Domain
TransactionType
Model
Template
ApplicationDefinition
ApplicationInstance
FieldGroup
Field
CommandDefinition
ProcessDefinition
ProcessStepDefinition
PostingRule
LedgerDefinition
ValuationPolicy
PermissionDefinition
ApprovalPolicy
TriggerDefinition
ViewDefinition
AICapabilityDefinition


BUSINESS RUNTIME
──────────────────────────────────────────────
BusinessData
CommandExecution
ProcessInstance
ProcessStepInstance
WorkItem
Plan


POSTING / LEDGER
──────────────────────────────────────────────
PostingInput
PostingRun
LedgerEntry
LedgerBalance
LedgerDataset


COST
──────────────────────────────────────────────
CostPool
CostLayer
CostMatch
CostResult
CostRun
CostDataset


SYSTEM OPERATION
──────────────────────────────────────────────
ReplayRun
ReplayLock
InputBoundary
ValidationResult


ACTORS
──────────────────────────────────────────────
Human
AI
Automation
ExternalSystem
```

---

## 43. Canonical Dependency Map

```text
Template / Metadata
        │
        ↓
ApplicationInstance
        │
        ↓
CommandDefinition
        │
        ↓
CommandExecution
        │
        ↓
BusinessData
        │
        ↓
PostingInput
        │
        ↓
PostingRule
        │
        ↓
LedgerEntry
        │
        ├──────────────→ LedgerBalance
        │
        ↓
ValuationPolicy
        │
        ↓
CostResult
        │
        ↓
Enterprise State
        │
        ↓
Process / Plan / Work
        │
        ↓
Next Command
```

Replay path:

```text
BusinessData
    ↓
PostingRun
    ↓
LedgerDataset
    ↓
CostRun
    ↓
CostDataset
```

---

## 44. Conceptual Architecture Freeze

With EVO-08 v0.2, the first conceptual architecture phase is considered sufficiently converged.

From this point:

> **Do not add a new conceptual object merely because implementation becomes inconvenient.**

Physical design should first attempt to implement the canonical concepts defined here.

If implementation exposes a genuine conceptual flaw, the architecture can be revised explicitly.

---

## 45. Next Stage

The next document is:

**EVO-09 — Physical Data Model & Runtime Storage Architecture v0.1**

It should resolve:

```text
Database strategy
Metadata physical schema
BusinessData storage
Posting queue / sequence storage
LedgerEntry storage
LedgerBalance projection
Cost tables
Replay tables
Versioning representation
Enterprise isolation
Indexing
Transaction boundaries
Concurrency
ID strategy
JSON vs relational columns
Partitioning strategy
```

Then:

```text
EVO-10 — Service Boundaries & Runtime Components
EVO-11 — API & Command Contracts
EVO-12 — Repository Structure & Implementation Roadmap
```

After EVO-12, implementation can begin with a coherent architecture rather than another round of conceptual expansion.

---

## 46. Final Architecture Principle

The converged EVO principle is:

> **Preserve business history, make enterprise semantics explicit, derive ledger and cost deterministically, make every derived result rebuildable, and let Human, AI and Automation operate through the same controlled business capabilities.**

Or, in one execution loop:

```text
DEFINE
    Metadata
        ↓
OPERATE
    Command
        ↓
RECORD
    Business Data
        ↓
ACCOUNT
    Posting / Ledger
        ↓
VALUE
    Cost
        ↓
UNDERSTAND
    State
        ↓
ACT
    Process / Plan / Work
        ↓
REPEAT
```

---

**End of EVO-08 v0.2**

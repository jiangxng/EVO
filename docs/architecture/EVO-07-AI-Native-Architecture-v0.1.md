# EVO-07 — AI-Native Architecture

**Version:** 0.1  
**Status:** Draft / Architecture Design  
**Project:** EVO — Enterprise Operating System

---

## 1. Purpose

EVO-07 defines how AI becomes a native participant in the enterprise operating system.

AI is not an isolated chatbot attached to ERP screens.

AI operates through the same semantic enterprise model used by humans and automation:

```text
Metadata Graph
    ↓
Enterprise Context
    ↓
AI Understanding / Planning
    ↓
Capability Discovery
    ↓
Command
    ↓
Business Data
    ↓
Posting / Ledger / Cost
    ↓
Enterprise State
    ↓
Process / Plan / Work
    ↓
AI observes again
```

The goal is:

> **Make the enterprise machine-readable, explainable and safely operable by AI.**

---

## 2. AI-Native Does Not Mean AI-Defined Truth

AI may:

```text
Understand
Search
Explain
Recommend
Plan
Prepare
Execute
Coordinate
Monitor
Diagnose
```

But authoritative enterprise results remain governed by deterministic system components:

```text
Metadata
Business Rules
Commands
Permissions
Posting Engine
Ledger Engine
Cost Engine
Replay Engine
```

AI does not replace these engines.

---

## 3. AI Uses the Metadata Graph

EVO metadata is the semantic interface between AI and the enterprise.

AI should be able to discover:

```text
Enterprise
Domain
Transaction Type
Application
Field Group
Field
Command
Process
Posting Rule
Ledger
Permission
View
AI Capability
```

For an Application, AI should understand:

```text
What does this application mean?
What business transaction type does it belong to?
What fields exist?
Which fields are required?
Where do values come from?
What commands can be executed?
What preconditions apply?
What ledgers may be affected?
What processes may follow?
What permissions apply?
```

---

## 4. Semantic Description Is First-Class Metadata

Technical identifiers alone are insufficient.

Bad AI interface:

```text
app_id = 128
field = F_0012
command = C_09
```

Preferred metadata:

```text
Application:
    现货销售

Business Meaning:
    Sales of inventory currently available for fulfillment.

Field:
    交货仓库

Meaning:
    Warehouse from which the order is expected to be fulfilled.

Command:
    Allocate Inventory

Meaning:
    Reserve available inventory for this sales order.
```

Descriptions should be available to both humans and AI.

---

## 5. Enterprise Context

AI requires scoped enterprise context.

Conceptually:

```text
AIContext
    enterprise
    actor
    organization
    application
    business_object
    current_work
    permissions
    time
    relevant_metadata
    relevant_state
```

Context must be explicit rather than relying on hidden conversational assumptions.

---

## 6. Context Is Retrieved, Not Dumped

An enterprise may contain millions of records and thousands of metadata objects.

AI should not receive the entire enterprise state.

Instead:

```text
Intent
    ↓
Semantic Discovery
    ↓
Relevant Metadata
    ↓
Relevant Business Data
    ↓
Relevant Ledger / State
    ↓
Working Context
```

This is both more efficient and safer.

---

## 7. Capability Discovery

Applications expose machine-readable capabilities.

Example:

```text
Application: Purchase Request

Commands:
    Create
    Submit
    Approve
    Reject
    Convert to Purchase Order
```

For each Command, AI can discover:

```text
Description
Input Schema
Required Fields
Preconditions
Permission Requirements
Approval Requirements
Expected Result
Risk Level
```

AI should not guess application operations from UI labels.

---

## 8. Command Is the AI Execution Boundary

AI performs business actions through Commands.

Preferred:

```text
AI
↓
Command
↓
Permission / Preconditions
↓
Business Data
↓
Posting
```

Forbidden architectural shortcut:

```text
AI
↓
Direct SQL
↓
Change Ledger Balance
```

AI may use lower-level administrative tools only when explicitly designed and authorized for system administration.

---

## 9. AI Action Levels

EVO defines conceptual autonomy levels.

### Level 0 — Observe

```text
Read
Search
Summarize
Explain
```

### Level 1 — Recommend

```text
Analyze
Recommend action
No execution
```

### Level 2 — Prepare

```text
Prepare command input
Draft plan
Wait for approval
```

### Level 3 — Execute Within Policy

```text
Execute permitted low-risk Commands
```

### Level 4 — Coordinate

```text
Plan and execute multi-step work
Use multiple Commands
Manage Process / Work Items
Escalate exceptions
```

### Level 5 — Autonomous Domain Operation

```text
Operate a defined business domain within explicit policy, budget, risk and approval boundaries
```

Autonomy is permission/policy-controlled, not an intrinsic AI privilege.

---

## 10. Human Approval Boundary

Some AI actions require human authorization.

Example:

```text
AI detects:
    Supplier payment due

AI prepares:
    Payment Command

Policy:
    > 100,000 requires Finance Director approval

Result:
    Approval Work Item
```

The same approval mechanism can apply to human or automated actors.

---

## 11. AI Planning

AI may convert enterprise state into a proposed plan.

Example:

```text
待采购 = 500

AI considers:
    Supplier lead time
    Price
    Minimum order quantity
    Existing purchase orders
    Cash constraints

Plan:
    Supplier A = 300
    Supplier B = 200
```

The Plan is not business execution.

Execution requires Commands.

```text
AI Plan
↓
Commands
↓
Business Data
```

---

## 12. AI and Ledger State

Ledgers provide a powerful structured state interface for AI.

Instead of inferring operational obligations from many mutable status fields, AI can query:

```text
待采购
待生产
待入库
待出库
待收款
待付款
待审批
库存
现金
应收
应付
```

along with dimensions.

Example:

```text
Ledger = 待生产
Product = A
Warehouse = HK
Balance = 70
```

AI can then reason about what work is required.

---

## 13. AI and Cost

AI may explain and analyze Cost Results.

Examples:

```text
Why did gross margin change?
Which FIFO layers were consumed?
Why is Product A cost higher this month?
What is the difference between FIFO and Moving Average?
Which receipt caused the current valuation?
```

AI reads:

```text
Cost Result
Cost Match
Cost Layer
Valuation Policy
```

It does not invent authoritative cost numbers independently of the Cost Engine.

---

## 14. AI and Replay

AI may assist Replay operations.

Examples:

```text
Explain replay failure
Find first failed posting input
Compare Posting Rule v1 vs v2
Explain Ledger Dataset difference
Explain FIFO vs Average cost difference
Recommend validation checks
```

AI must not bypass Replay Lock or publish failed datasets.

---

## 15. AI and Process

AI can participate in process execution as:

```text
Observer
Decision Assistant
Work Actor
Planner
Coordinator
Exception Handler
```

Example:

```text
Process Step:
    Review supplier exception

Actor:
    AI

AI Result:
    Recommend Supplier B

Next Step:
    Human approval
```

---

## 16. Dynamic Work

Not all enterprise work needs a rigid predefined workflow.

EVO supports:

```text
Defined Process
+
Dynamic Command Selection
```

Example:

```text
Exception Work Item
      ↓
AI inspects enterprise context
      ↓
Discovers permitted Commands
      ↓
Chooses next safe action
      ↓
Executes or requests approval
```

This allows adaptive operation without bypassing system controls.

---

## 17. Enterprise Knowledge

EVO should build reusable enterprise knowledge from metadata and operational definitions.

Knowledge sources may include:

```text
Models
Templates
Applications
Fields
Business Descriptions
Posting Rules
Ledger Definitions
Processes
Policies
Command Definitions
Enterprise Overlays
Documentation
```

This knowledge is different from transactional runtime data.

---

## 18. Template Knowledge Library

Published Templates can become AI-readable business knowledge packages.

Example:

```text
Manufacturing Template
    ↓
AI understands:
    Production Order
    Material Requirement
    Work Order
    Production Receipt
    Relevant Ledgers
    Relevant Commands
    Relevant Processes
```

Historical enterprise configurations can therefore contribute to a reusable capability library.

---

## 19. Enterprise-Specific Knowledge

Installed applications may differ from base Templates.

AI must resolve:

```text
Base Template
+
Enterprise Overlay
=
Effective Enterprise Definition
```

AI should operate against the effective definition, while retaining lineage to the base template.

---

## 20. AI Memory vs Enterprise Truth

AI conversational memory must not become the source of enterprise truth.

Authoritative business state comes from EVO data.

```text
Conversation Context
    ≠
Business Record

AI Memory
    ≠
Ledger

AI Assumption
    ≠
Enterprise Policy
```

When business correctness matters, AI retrieves authoritative EVO context.

---

## 21. AI Audit

AI actions must be auditable.

For AI-executed Commands retain:

```text
AI Actor Identity
Command
Input
Relevant Context Identity
Permission Decision
Approval Decision
Execution Result
Time
```

For high-impact planning, EVO may also retain:

```text
Plan
Recommendation
Selected Action
Human Override
```

The goal is operational accountability, not storage of unrestricted hidden reasoning.

---

## 22. Explainability

EVO should make deterministic system results explainable to AI.

Example:

```text
Why is 待生产 = 70?
```

AI can trace:

```text
Ledger Balance
↓
Ledger Entries
↓
Posting Rules
↓
Posting Inputs
↓
Business Data
```

Example:

```text
Why is shipment cost = 1240?
```

Trace:

```text
Cost Result
↓
Cost Matches
↓
Cost Layers
↓
Inbound Ledger Entries
↓
Business Data
```

This traceability is a major AI-native advantage.

---

## 23. AI Read Model

AI often needs a semantic read layer rather than raw physical tables.

Conceptually:

```text
Enterprise Semantic API
    ├── Metadata Query
    ├── Business Data Query
    ├── Ledger Query
    ├── Cost Query
    ├── Process Query
    ├── Work Query
    └── Capability Query
```

This is a conceptual interface; physical API design comes later.

---

## 24. AI Write Model

AI writes through controlled capabilities:

```text
Command API
Plan API
Work API
Approval API
```

Normal AI business operation should not require arbitrary database writes.

---

## 25. Permission-Aware Retrieval

AI must not retrieve data merely because it exists.

Read access is scoped by:

```text
Enterprise
Organization
Role
Data Scope
Application
Business Object
Field Sensitivity
```

AI context construction must respect the actor's permission boundary.

---

## 26. Field-Level Semantics

Fields may include AI-specific semantic metadata:

```text
AI Description
Business Meaning
Examples
Sensitivity
Allowed Use
Validation Guidance
Reference Meaning
Snapshot Meaning
```

This helps AI correctly populate and interpret business data.

---

## 27. Structured Output

When AI prepares a Command, output should conform to the Command input schema.

Example:

```text
Command:
    Create Purchase Request

Input:
    Product
    Quantity
    Required Date
    Warehouse
    Reason
```

The system validates structured input before execution.

Natural-language interpretation occurs before the deterministic Command boundary.

---

## 28. AI Error Handling

AI execution failures return structured business/system errors.

Examples:

```text
Permission denied
Precondition failed
Required field missing
Invalid reference
Approval required
Insufficient inventory
Posting temporarily paused
```

AI can then:

```text
Correct input
Ask human
Create Work Item
Select another permitted Command
Stop
```

---

## 29. AI During Replay

During Replay Mode:

```text
Read access may remain available
Business data creation may remain available
Authoritative posting execution is paused
```

If AI executes a business Command that creates posting-relevant data during replay, that data joins the waiting posting sequence.

AI must be aware that derived balances may temporarily represent the pre-replay active state or be unavailable depending on implementation.

---

## 30. Multi-Agent Architecture

EVO does not require separate autonomous agents for every module.

Initial architecture should prefer:

```text
One AI capability framework
+
Domain/Application Context
+
Command Catalog
+
Permission Policy
```

Later, specialized agents may exist for:

```text
Procurement
Production
Finance
Sales
Planning
Compliance
```

but they should share the same enterprise semantic and command infrastructure.

---

## 31. AI Capability Definition

Applications may declare AI capabilities.

Conceptually:

```text
AICapabilityDefinition
    application
    name
    description
    required_context
    allowed_commands
    autonomy_level
    approval_policy
```

Examples:

```text
Sales Order Assistant
Purchase Planner
Production Scheduler
Collection Assistant
Cost Analyst
```

---

## 32. AI Capability Is Metadata

AI behavior should not be defined only in opaque prompts embedded in application code.

Important behavior belongs in metadata:

```text
Purpose
Available Context
Allowed Commands
Policies
Approval Boundaries
Expected Outputs
```

Prompts may exist as implementation artifacts, but they are not the sole business definition.

---

## 33. Closed Enterprise Operating Loop

The complete AI-native EVO loop is:

```text
Enterprise Metadata
        ↓
Enterprise Runtime State
        ↓
AI Observation
        ↓
Reason / Plan
        ↓
Capability Discovery
        ↓
Command
        ↓
Business Data
        ↓
Conditional Posting
        ↓
Ledger / Cost / State
        ↓
Process / Plan / Work
        ↓
AI Observation
```

This loop can include humans at any required approval or execution boundary.

---

## 34. Architectural Invariants

1. AI is a native enterprise actor.
2. AI uses the same Commands as humans and automation.
3. AI does not bypass permissions, approvals or business rules.
4. Metadata Graph is the primary semantic interface for AI.
5. Enterprise context is explicitly scoped and retrieved.
6. AI does not require the whole enterprise dataset in context.
7. Commands are the normal AI write boundary.
8. Ledger provides structured enterprise state for AI reasoning.
9. Cost Engine remains authoritative for valuation.
10. Replay Engine remains authoritative for rebuild.
11. AI may explain and diagnose deterministic results.
12. Enterprise truth lives in EVO, not conversational memory.
13. AI actions are auditable.
14. Retrieval is permission-aware.
15. Application capabilities are machine-discoverable.
16. AI autonomy is policy-controlled.
17. AI Capability Definition is metadata.
18. Dynamic AI coordination still operates through permitted Commands.
19. Templates form reusable AI-readable business knowledge.
20. Human approval remains available at any required risk boundary.

---

## 35. Initial Implementation Scope

Implement first:

```text
Metadata Semantic Query
Application Discovery
Field Discovery
Command Catalog
Permission-Aware Context
Structured Command Invocation
AI Actor Identity
AI Action Audit
Approval Handoff
Ledger / Balance Query
Cost Explanation Query
Work Queue Query
```

Initial autonomy:

```text
Observe
Recommend
Prepare
Execute explicitly permitted Commands
```

Reserve for later:

```text
Autonomous Domain Operation
Multi-Agent Coordination
Continuous Enterprise Optimization
Automatic Process Generation
AI-Generated Template Design
Cross-Enterprise Knowledge Learning
```

---

## 36. Architecture Stack After EVO-07

The current conceptual architecture is now:

```text
┌─────────────────────────────────────────────┐
│              Human / AI / Automation        │
├─────────────────────────────────────────────┤
│       Command / Process / Plan / Work       │
├─────────────────────────────────────────────┤
│          Business Applications              │
├─────────────────────────────────────────────┤
│             Business Data                   │
├─────────────────────────────────────────────┤
│       Posting Sequence / Posting Rules      │
├─────────────────────────────────────────────┤
│          Ledger / Balance Engine            │
├─────────────────────────────────────────────┤
│           Cost / Valuation Engine           │
├─────────────────────────────────────────────┤
│         Replay / Recalculation              │
├─────────────────────────────────────────────┤
│        Metadata / Template / Model          │
└─────────────────────────────────────────────┘
```

AI spans the stack through semantic read access and controlled Command execution rather than becoming a replacement for deterministic system layers.

---

## 37. Next Stage — Architecture Convergence

EVO-00 through EVO-07 now provide enough conceptual coverage for the first convergence pass.

The next document should be:

**EVO-08 — Architecture Convergence v0.2**

Its purpose is not to add another subsystem.

It will:

```text
Review EVO-00 … EVO-07
↓
Normalize terminology
↓
Remove obsolete concepts
↓
Resolve cross-document conflicts
↓
Define canonical object names
↓
Define system invariants
↓
Produce one consolidated architecture map
↓
Freeze Conceptual Architecture v0.2
```

Only after that convergence should EVO move to:

```text
Physical Data Model
Service Boundaries
Runtime Components
API Contracts
Repository Structure
Implementation Roadmap
```

---

## 38. Final Principle

> **AI-native ERP is not ERP with a chatbot. It is an enterprise system whose semantics, capabilities, state and controls are explicit enough for AI to understand and safely operate.**

---

**End of EVO-07 v0.1**

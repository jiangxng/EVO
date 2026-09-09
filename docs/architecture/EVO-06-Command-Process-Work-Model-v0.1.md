# EVO-06 — Command, Process & Work Model

**Version:** 0.1  
**Status:** Draft / Architecture Design  
**Project:** EVO — Enterprise Operating System

---

## 1. Purpose

EVO-06 defines how humans, AI and automation operate enterprise applications.

The core chain is:

```text
Human / AI / Automation Intent
            ↓
          Command
            ↓
 Business Application
            ↓
      Business Data
            ↓
         Posting
            ↓
 Ledger Balance / State
            ↓
 Process / Plan / Work Item
            ↓
       Next Command
```

EVO does not treat workflow as a separate universe disconnected from business data and ledgers.

> **Work is generated from enterprise state, and commands create the next business change.**

---

## 2. Three Execution Actors

EVO recognizes three first-class actors:

```text
Human
AI
Automation
```

All three operate through the same business capability boundary.

They should not require three separate application models.

Example:

```text
Command: Approve Purchase Request

Actor:
    Human
or
    AI
or
    Automation
```

Whether an actor is allowed to execute the command is determined by permissions, policy and approval rules.

---

## 3. Command

A Command represents an explicit request to perform a business operation.

Examples:

```text
Create Sales Order
Approve Sales Order
Allocate Inventory
Create Purchase Order
Release Production Order
Confirm Receipt
Ship Goods
Approve Payment
Cancel Remaining Quantity
```

A Command is metadata-defined capability.

Conceptually:

```text
CommandDefinition
    id
    application
    name
    input_schema
    preconditions
    permissions
    execution_policy
    resulting_business_data
```

---

## 4. Command Is Not an Event

EVO keeps the practical distinction:

```text
Command
=
Request to do something

Business Data / Event
=
Resulting business occurrence/data
```

Example:

```text
Command:
    Approve Sales Order

Result:
    Approval business data is created

Then:
    Posting rules process that new data
```

The system does not need philosophical event modeling beyond what is useful operationally.

---

## 5. Command Execution

Canonical execution:

```text
Receive Command
      ↓
Resolve Application
      ↓
Authenticate Actor
      ↓
Check Permission
      ↓
Check Preconditions
      ↓
Execute Business Logic
      ↓
Create New Business Data
      ↓
Return Result
      ↓
Posting Queue
```

A command must not directly bypass business data and write arbitrary ledger balances.

Preferred path:

```text
Command
↓
Business Data
↓
Posting
↓
Ledger
```

---

## 6. Preconditions

Commands may have preconditions.

Examples:

```text
Order exists
Order has remaining quantity
Approval amount is within authority
Inventory balance is sufficient
Required fields are complete
Previous process step is complete
User belongs to authorized organization
```

Preconditions are explicit business metadata/rules.

A failed precondition prevents execution rather than silently producing partial business data.

---

## 7. Permission Boundary

Permission is evaluated at command execution.

Conceptually:

```text
Actor
+ Enterprise
+ Organization
+ Application
+ Command
+ Business Context
        ↓
Permission Decision
```

Permission may depend on:

```text
Role
Organization
Data Scope
Amount
Product
Project
Customer
Command Type
Approval Level
```

---

## 8. Human, AI and Automation Use the Same Commands

EVO should avoid building special hidden APIs only for AI.

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

Humans may trigger these through UI.

AI may trigger them through tool/capability calls.

Automation may trigger them through rules/schedules.

All invoke the same Command Definition and permission model.

---

## 9. AI Does Not Bypass Authority

AI is a native actor, but not an unrestricted superuser.

Example:

```text
AI proposes:
    Approve payment 1,000,000

Permission / Approval Policy:
    Human CFO approval required
```

Result:

```text
AI cannot execute final approval
↓
Create / route Work Item to authorized human
```

AI-native does not mean control-free.

---

## 10. Process

A Process defines a coordinated sequence or graph of business work.

Example:

```text
Sales Fulfillment

Order Approved
      ↓
Inventory Allocation
      ↓
Pick
      ↓
Ship
      ↓
Invoice
      ↓
Collect Payment
```

A Process is metadata.

A Process does not itself replace business data or ledger state.

---

## 11. Process Step

A Process consists of steps.

Conceptually:

```text
ProcessDefinition
    ↓
ProcessStep
```

A step may represent:

```text
Command
Decision
Wait
Human Work
AI Work
Automation
External Action
Subprocess
```

Example:

```text
Step 1: Check Inventory
Step 2: Allocate Inventory
Step 3: Create Production Requirement if insufficient
Step 4: Wait for available quantity
Step 5: Release shipment
```

---

## 12. Process Instance

A Process Definition is metadata.

A Process Instance is runtime state.

```text
Process Definition
        ↓
Process Instance
        ↓
Process Step Instances
```

Conceptually:

```text
ProcessInstance
    enterprise
    process_definition_version
    business_context
    status
    started_at
    completed_at
```

---

## 13. Work Item

A Work Item represents actionable work waiting for an actor.

Examples:

```text
Approve Purchase Request
Produce 40 units
Inspect Batch A
Pick Sales Order 1001
Collect overdue receivable
Review AI exception
```

Conceptually:

```text
WorkItem
    enterprise
    application
    command
    business_context
    assigned_actor
    candidate_actors
    priority
    due_time
    status
```

---

## 14. Work Is Often Derived from Ledger State

This is a central EVO design principle.

Example:

```text
Ledger: 待生产
Balance: 70
```

This may generate or update:

```text
Production Plan
Work Queue
AI Recommendation
```

After producing 30:

```text
待生产 -30
Balance = 40
```

The remaining work is now 40.

The business ledger therefore becomes a powerful bridge between accounting-style state and operational execution.

---

## 15. Work Item vs Ledger Balance

They are not the same thing.

### Ledger Balance

Answers:

> How much obligation/state currently exists?

### Work Item

Answers:

> Who or what should do something about it?

Example:

```text
待审批 Balance = 15 requests
```

may correspond to:

```text
15 individual Work Items
```

or grouped work:

```text
1 batch-review Work Item
```

Work Items may be derived from ledger state, process state or explicit business rules.

---

## 16. Plan

A Plan represents intended future work or allocation.

Examples:

```text
Production Plan
Purchase Plan
Delivery Plan
Cash Plan
Collection Plan
Inspection Plan
```

Conceptually:

```text
Plan
    source_state
    target
    quantity / amount
    time_window
    priority
    constraints
```

A Plan is not necessarily an executed business fact.

Execution occurs through Commands.

---

## 17. Plan → Command

Example:

```text
待生产 Balance = 70
        ↓
Production Plan = 70
        ↓
Split:
    Work Center A = 40
    Work Center B = 30
        ↓
Commands:
    Release Production Order A
    Release Production Order B
```

This preserves separation:

```text
State
↓
Plan
↓
Execution Command
↓
Business Data
```

---

## 18. Trigger

A Trigger determines when work, process or automation should react.

Possible trigger sources:

```text
New Business Data
Ledger Balance Change
Threshold
Time
Process Step Completion
External Signal
Manual Request
AI Decision
```

Examples:

```text
IF 待采购 > 0
THEN create Purchase Planning work
```

```text
IF overdue receivable > threshold
THEN create Collection Work Item
```

```text
IF stock balance < safety stock
THEN trigger replenishment process
```

---

## 19. Trigger Does Not Directly Mutate Ledger

Preferred chain:

```text
Trigger
↓
Command / Process / Work
↓
Business Data
↓
Posting
↓
Ledger
```

Avoid:

```text
Trigger
↓
Directly change balance
```

This keeps business history replayable.

---

## 20. Automation

Automation executes Commands under predefined policy.

Example:

```text
Trigger:
    Inventory < Safety Stock

Automation:
    Create Replenishment Request
```

Automation may be:

```text
Rule-based
Scheduled
Event-driven
AI-assisted
```

But it still operates through declared business capabilities.

---

## 21. AI Action

AI may perform several levels of participation:

```text
Observe
Explain
Recommend
Plan
Prepare Command
Execute Command
Coordinate Process
```

Permission policy determines the maximum allowed level.

Example:

```text
AI observes:
    待采购 = 500

AI plans:
    Supplier A: 300
    Supplier B: 200

AI executes:
    Create Purchase Requests

Human approval required:
    Approve Purchase Orders
```

---

## 22. Approval

Approval is modeled as business capability, not hard-coded into every application.

Conceptually:

```text
Command
    ↓
Approval Policy
    ↓
Execute
or
Create Approval Work Item
```

Approval policy may depend on:

```text
Amount
Organization
Risk
Customer
Supplier
Project
Actor
Command
```

---

## 23. Process Is Not the Source of Truth

Processes coordinate execution, but underlying business data remains authoritative for what happened.

If a process engine state is lost, EVO should ultimately be able to reconstruct meaningful operational state from:

```text
Business Data
Ledger State
Process Metadata
```

where practical.

Process runtime state may be persisted for efficiency, but it should not become the only explanation of enterprise history.

---

## 24. Dynamic Process

EVO should not require every business process to be a rigid BPMN-style graph.

Some work is naturally dynamic.

Example:

```text
Exception occurs
↓
AI analyzes situation
↓
Selects permitted next Command
↓
Human approval if required
↓
Continue
```

Therefore EVO supports:

```text
Defined Process
Dynamic Command Selection
AI-Orchestrated Work
```

under the same permission and business-data rules.

---

## 25. Command Catalog

Every Application should expose a machine-readable command catalog.

Example:

```text
Application: 现货销售

Commands:
    Create Order
    Submit
    Approve
    Allocate Inventory
    Ship
    Cancel Remaining Quantity
```

For each Command, AI and UI should be able to discover:

```text
Description
Required Input
Optional Input
Preconditions
Permission Requirements
Possible Result
Risk / Approval Requirement
```

This is a core AI-native capability.

---

## 26. Work Queue

Work Items can be queried as enterprise work queues.

Examples:

```text
My Work
Team Work
AI Work
Overdue Work
High Priority Work
Production Work
Approval Work
Exception Work
```

The Work Queue is a runtime projection.

It may combine:

```text
Process Work Items
Ledger-Derived Work
Explicit Assignments
AI-Generated Recommendations
```

---

## 27. Idempotency

Command execution must support idempotency where duplicate execution would create incorrect business data.

Example:

```text
Ship Order
Pay Supplier
Approve Request
Create Purchase Order
```

Conceptually:

```text
Command Request
    idempotency_key
```

Repeated delivery of the same command request must not accidentally create duplicate business effects.

Detailed physical implementation is deferred.

---

## 28. Command Result

A Command Result should identify what was created.

Conceptually:

```text
CommandResult
    command_execution
    status
    created_business_data
    created_work_items
    process_effect
    errors
```

Ledger results need not be synchronously embedded in every Command Result because posting may be queued.

---

## 29. Command Execution Record

For operational audit, EVO should retain:

```text
Who / what executed
Which Command
Which Application
When
Input
Permission decision
Result
Failure
```

Conceptually:

```text
CommandExecution
    actor
    command_definition_version
    business_context
    request
    result
    status
```

This is especially important for AI and automation.

---

## 30. Replay Interaction

Replay recalculates derived posting/cost data.

It must not blindly re-execute Commands.

That distinction is critical.

```text
Replay:
    Business Data
    ↓
    Posting
    ↓
    Ledger / Cost
```

NOT:

```text
Replay:
    Re-run historical Commands
    ↓
    accidentally create new business data
```

Commands create business history.

Replay consumes business history.

---

## 31. Process and Replay

Process runtime state may depend on recalculated ledger balances.

After replay, EVO may need to refresh derived work projections.

Conceptually:

```text
Replay Ledger / Cost
      ↓
Recalculate Derived State
      ↓
Refresh Work Queue / Plans / Alerts
```

Historical Commands are not executed again.

---

## 32. Human UI Is a Client of the Command Model

Forms and buttons should map to metadata-defined business capabilities.

Example:

```text
UI Button: 批准
        ↓
Command: Approve
```

The UI is not the source of business logic.

This allows:

```text
Web UI
Mobile UI
AI
API
Automation
```

to share the same execution model.

---

## 33. External Systems

External systems may also invoke Commands.

Example:

```text
E-commerce Platform
      ↓
Create Sales Order Command
      ↓
EVO Business Data
```

or provide external signals that trigger work.

External integration should not normally write Ledger Entries directly.

---

## 34. Architectural Invariants

1. Command is an explicit business capability.
2. Human, AI and Automation use the same Command model.
3. Commands are permission-controlled.
4. Commands create business data; they do not directly mutate balances.
5. Posting consumes business data and generates ledger results.
6. Process coordinates work but does not replace business history.
7. Work Item represents actionable work.
8. Ledger Balance represents outstanding quantity/amount/state.
9. Work may be derived from ledger or process state.
10. Plans represent intended future work and execute through Commands.
11. Triggers initiate work/commands/processes rather than directly changing balances.
12. AI is a first-class actor but cannot bypass authority.
13. Applications expose machine-readable Command catalogs.
14. Command execution should be idempotent where necessary.
15. Replay never re-executes historical Commands.
16. After replay, derived work/state projections may be refreshed.
17. UI is a client of metadata-defined Commands, not the business-logic source.

---

## 35. Initial Implementation Scope

Implement first:

```text
CommandDefinition
CommandExecution
Permission Check
Precondition Check
Business Data Creation
ProcessDefinition
ProcessInstance
ProcessStep
WorkItem
Trigger
Basic Plan
Human / AI / Automation Actor Type
Command Catalog
```

Keep process execution simple:

```text
Sequential Steps
Conditional Branch
Wait
Human Work
AI Work
Automation
```

Reserve for later:

```text
Advanced BPMN Compatibility
Complex Compensation
Distributed Saga
Process Mining
Dynamic Optimization
Multi-Agent Coordination
Autonomous Enterprise Planning
```

---

## 36. Next Stage

**EVO-07 — AI-Native Architecture**

EVO-07 will connect the architecture built so far:

```text
Metadata Graph
Business Applications
Command Catalog
Business Data
Posting Rules
Ledgers
Balances
Cost Results
Processes
Work Items
```

into an AI-operable enterprise system.

It will define:

```text
AI Context
Semantic Discovery
Capability Discovery
Tool / Command Execution
Permission Boundary
Planning
Explanation
Enterprise Knowledge
AI Audit
Human Approval
Autonomy Levels
```

---

## 37. Final Direction

EVO execution can now be summarized as:

```text
             Enterprise State
                    │
                    ↓
              Human / AI
                    │
                    ↓
                 Command
                    │
                    ↓
              Business Data
                    │
                    ↓
                 Posting
                    │
                    ↓
                  Ledger
                    │
                    ↓
            Balance / Cost / State
                    │
                    ↓
             Process / Plan / Work
                    │
                    └──────────────→ Next Command
```

This creates a closed enterprise operating loop.

> **EVO is not only a system that stores transactions. It is a system that turns enterprise state into executable work and turns executed work back into new enterprise state.**

---

**End of EVO-06 v0.1**

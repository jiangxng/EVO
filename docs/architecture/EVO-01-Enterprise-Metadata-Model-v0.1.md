# EVO-01 — Enterprise & Metadata Model

**Version:** 0.1  
**Status:** Draft / Architecture Design  
**Project:** EVO — Enterprise Operating System

## 1. Purpose

EVO-01 defines the enterprise and business metadata conceptual model. It continues EVO-00's hierarchy:

```text
Enterprise → Domain → Transaction Type → Specific Business Application → Field Group → Field
```

Physical database design remains intentionally deferred.

## 2. Core architecture decisions

### Enterprise
Enterprise is the operational ownership boundary for installed applications, business configuration, facts, events, ledgers, policies and runtime state.

### Domain
Domain is a semantic grouping of related business capabilities, such as Sales, Procurement, Inventory, Manufacturing, Finance, Projects or Logistics. It is not a UI menu or database module.

### Transaction Type
Transaction Type is a high-level business transaction abstraction, not a concrete application.

```text
销售订单
├── 预售销售
├── 现货销售
├── 寄售销售
└── 项目销售
```

Applications under the same Transaction Type may have different fields, commands, events, processes, conditional posting rules, ledgers and permissions.

### Specific Business Application
A Specific Business Application is the executable business-capability definition.

## 3. Definition layers

EVO distinguishes:

```text
Model
  ↓
Template
  ↓
Application Definition
  ↓
Enterprise Application Instance
```

### Model
A reusable business-object semantic definition, such as Customer, Supplier, Product, Warehouse, Employee or Project.

### Template
A reusable, versioned business-capability package. It may contain application definitions, field groups, fields, commands, events, processes, posting rules, ledgers, permissions, views, dependencies and AI capabilities. Published template versions are immutable.

### Application Definition
The concrete specification of a business application, including its Transaction Type, fields, commands, events, processes, rules, ledgers, views and permissions.

### Enterprise Application Instance
An installed and configured application inside one Enterprise. It retains lineage to its base definition/template and carries enterprise-specific configuration.

## 4. Canonical metadata graph

```text
Enterprise
└── Domain
    └── Transaction Type
        └── Specific Business Application
            ├── Field Group
            │   └── Field
            ├── Command
            ├── Event
            ├── Process
            ├── Conditional Posting
            ├── Ledger
            ├── Permission
            ├── View
            └── AI Capability
```

This is a semantic graph rather than a mandatory physical foreign-key tree. Metadata objects may be reusable through explicit bindings.

## 5. Field Group

Field Group is a semantic business component, not merely a UI section.

Examples:

```text
订单基本信息
客户信息
收货信息
商品明细
费用明细
发票明细
```

A Field Group may be scalar, composite, repeating, nested or reusable.

## 6. Field

Field is a business-semantic definition, not merely a technical column.

Examples:

```text
客户
客户名称
客户地址
联系人
商品
订单数量
含税单价
订单金额
仓库
交货日期
```

A Field may define identity, name, code, semantic type, technical type, requiredness, defaults, validation, data source, reference target, snapshot policy, formula, visibility, searchability, editability and AI description.

## 7. Reference vs Snapshot

Reference and Snapshot are different semantics.

**Reference:** What business object is this?

**Snapshot:** What value was recorded at the time of the business fact?

Example:

```text
SalesOrder.customer_id
SalesOrder.customer_name_snapshot
SalesOrder.customer_address_snapshot
```

If the Customer master data changes later, the historical Sales Order must not silently change.

## 8. Data Source

A field value may originate from:

```text
User Input
Fixed Value
Dictionary
Reference Application / Model
Another Field
Calculation
System Context
External Source
```

The source definition is metadata. The resulting value stored in a Business Fact is runtime data.

## 9. Enterprise customization

Published Templates must not be directly mutated by an Enterprise.

```text
Effective Definition
    =
Base Template
    +
Enterprise Overlay
```

An overlay may add/hide fields, rename labels, customize rules, permissions or processes.

This preserves template lineage and enables future upgrades, difference detection, conflict detection and rollback.

## 10. Versioning

Metadata must be versioned. At minimum:

```text
Template Version
Application Version
Field Definition Version
Rule Version
Process Version
```

Published versions are immutable. Historical Business Facts retain sufficient metadata identity/version information to reconstruct their original meaning.

## 11. Metadata vs Runtime

### Metadata

```text
Domain
Transaction Type
Application
Field
Command
Event Definition
Rule
Process
Ledger Definition
```

### Runtime

```text
Business Fact
Business Event
Ledger Entry
Balance
Work Item
Plan
Calculation Result
```

Therefore:

```text
Metadata ≠ Runtime Data
Definition ≠ Fact
Rule ≠ Result
Ledger Definition ≠ Ledger Entry
```

## 12. Relationship to Business Facts

```text
Application Definition
        ↓
Business Fact
```

A Business Fact must retain the identity/version of the metadata needed to understand its original semantics. Later metadata changes must not mutate historical facts.

## 13. Relationship to Conditional Posting

Conditional Posting belongs to metadata; generated Ledger Entries belong to runtime.

```text
Application / Event Definition
        ↓
Posting Rule
        ↓
Business Event
        ↓
Conditional Posting
        ↓
Ledger Entries
```

Example:

```text
Application: 预售销售
Event: Order Approved
Condition: 商品类型 = 自制品

Posting:
待生产 + quantity
待出库 + quantity
待收款 + amount
```

## 14. AI relationship

AI should consume the metadata graph directly so it can understand applications, transaction types, fields, commands, events, rules, processes, ledgers and enterprise-specific customization.

Metadata therefore must be explicit and semantic rather than hidden in UI code.

## 15. Canonical conceptual objects

### Metadata objects

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
Command
EventDefinition
ProcessDefinition
PostingRule
LedgerDefinition
PermissionDefinition
ViewDefinition
AICapabilityDefinition
```

### Runtime objects

```text
BusinessFact
BusinessEvent
LedgerEntry
LedgerBalance
WorkItem
Plan
PostingRun
LedgerDataset
CostRun
CostDataset
```

## 16. Template dependencies and installation

Template dependencies must be explicit and versioned.

Application installation is a controlled metadata operation:

```text
Select Template
→ Resolve Dependencies
→ Select Version
→ Create Application Instance
→ Apply Enterprise Configuration
→ Publish
→ Available for Runtime
```

Installation should produce a coherent metadata snapshot/version before the application becomes operational.

## 17. Anti-patterns

EVO should not:

1. Make a unique hard-coded table the primary conceptual model for every application.
2. Treat UI/form/list definitions as the source of business truth.
3. Mix Field Definition with Field Value.
4. Mutate published Templates for enterprise customization.
5. Treat mutable balances/status projections as historical truth.

## 18. Decisions locked by EVO-01

1. Enterprise is the operational ownership boundary.
2. Domain is a semantic business grouping.
3. Transaction Type is a high-level transaction abstraction.
4. Specific Business Application is the executable business capability definition.
5. Model, Template, Application Definition and Application Instance are distinct concepts.
6. Published Templates are reusable, versioned and immutable.
7. Enterprise customization is an overlay rather than template mutation.
8. Field is a business-semantic definition.
9. Field Group is a semantic component boundary.
10. Reference and Snapshot have distinct meanings.
11. Metadata and Runtime are separate layers.
12. Conditional Posting rules are metadata; Ledger Entries are runtime results.
13. AI consumes the metadata graph directly.
14. Physical database schema remains deferred.

## 19. Open questions

### Model scope
Current direction:

```text
Model = reusable business-object semantic definition
```

Whether Model should become a more general schema/type system remains open.

### Application inheritance
Current recommendation: Transaction Type provides semantic identity/common contracts, while application behavior remains explicitly defined rather than using deep inheritance.

### Overlay conflicts
Future upgrades require a three-way merge model:

```text
Template v1
Template v2
Enterprise Overlay
```

### Physical storage
Relational, document, hybrid, event-oriented and specialized ledger storage decisions remain deferred.

## 20. Next stage

**EVO-02 — Business Fact & Event Runtime Model**

```text
Application Definition
        ↓
Business Fact
        ↓
Business Event
        ↓
Conditional Posting
        ↓
Ledger Entry
```

EVO-02 will define Business Fact, Business Event, Command/Event distinction, event immutability, corrections, identities, real-time posting and historical replay.

Only after EVO-02 is stable should EVO move into physical runtime/storage design.

## 21. Final principle

> **Metadata defines what the enterprise means and how it operates; Runtime records what actually happened.**

This separation is the foundation for:

```text
Reproducibility
Replayability
AI-native operation
```

---

**End of EVO-01 v0.1**

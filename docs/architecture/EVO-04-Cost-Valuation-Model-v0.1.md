# EVO-04 — Cost & Valuation Model

**Version:** 0.1  
**Status:** Draft / Architecture Design  
**Project:** EVO — Enterprise Operating System

---

## 1. Purpose

EVO-04 defines the cost and valuation engine used after posting.

The core principle is:

> **Ledger determines business quantity/amount effects. Cost Engine determines how cost-bearing flows are valued.**

The canonical chain is:

```text
Business Data
    ↓
Posting Input
    ↓
Conditional Posting
    ↓
Ledger Entries
    ↓
Cost Dimension
    ↓
Valuation Policy
    ↓
Cost Run
    ↓
Cost Result
```

Cost results are derived data and must be fully recalculable.

---

## 2. Cost Is Not Original Business Truth

EVO separates:

```text
Business Data
Ledger Entry
Cost Result
```

These are different layers.

Example:

```text
Ledger Entry:
    Inventory Quantity = -80
```

The cost of this `-80` movement may be:

```text
FIFO result
LIFO result
Average-cost result
Specific-identification result
```

depending on the valuation policy.

Therefore:

> **Cost is a calculation result, not immutable source data.**

---

## 3. Core Cost Objects

EVO defines the following conceptual objects:

```text
ValuationPolicy
CostDimension
CostLayer
CostMatch
CostRun
CostResult
```

### ValuationPolicy

Defines how cost is calculated.

### CostDimension

Defines the business dimensions within which cost is accumulated and matched.

### CostLayer

Represents a remaining quantity/amount layer available for valuation.

### CostMatch

Represents how an outbound or consuming movement consumes one or more inbound cost layers.

### CostRun

Represents one cost calculation execution.

### CostResult

Represents the calculated valuation outcome for a cost-bearing ledger movement.

---

## 4. Valuation Policy

Valuation Policy is metadata.

Conceptually:

```text
ValuationPolicy
    id
    enterprise
    scope
    method
    dimensions
    effective_version
    rounding_policy
    currency_policy
```

The initial supported methods are:

```text
FIFO
LIFO
MOVING_AVERAGE
SPECIFIC_IDENTIFICATION
```

Future methods may include:

```text
PERIODIC_WEIGHTED_AVERAGE
STANDARD_COST
BATCH_COST
PROJECT_COST
ACTUAL_PRODUCTION_COST
```

The architecture must not hard-code inventory costing as one fixed algorithm.

---

## 5. Cost Dimension

Cost is calculated within a dimension scope.

Possible dimensions include:

```text
Enterprise
Organization
Warehouse
Product
Batch
Serial Number
Project
Customer
Supplier
Currency
Application
Transaction Type
```

Example:

```text
Cost Scope:
    Enterprise = A
    Warehouse = HK
    Product = SKU-001
```

Another:

```text
Cost Scope:
    Enterprise = A
    Project = P-1001
    Product = Material-X
```

Valuation policy selects which dimensions form one independent costing pool.

---

## 6. Cost Pool

A Cost Pool is the effective grouping created by Cost Dimensions.

Example:

```text
Valuation Policy:
    FIFO
Dimensions:
    Warehouse + Product
```

Then these are separate cost pools:

```text
HK / Product-A
HK / Product-B
SG / Product-A
SG / Product-B
```

Movements in different pools do not consume each other's cost layers unless policy explicitly allows it.

---

## 7. Cost-Bearing Ledger Movements

Not every ledger requires valuation.

Examples that may require cost calculation:

```text
Inventory Receipt
Inventory Issue
Production Consumption
Production Completion
Transfer
Sales Shipment
Return
Asset Acquisition
Project Material Consumption
```

Examples that may not require cost valuation:

```text
待审批
待生产
待拣货
待收款
```

Ledger Definition or metadata should declare whether a ledger participates in cost calculation.

---

## 8. Inbound and Outbound Cost Flows

For cost calculation purposes, movements are classified conceptually as:

```text
Inbound Cost Flow
Outbound Cost Flow
```

### Inbound Cost Flow

Adds quantity and cost basis to a cost pool.

Example:

```text
Purchase Receipt
+100 units
Amount = 1000
Unit Cost = 10
```

### Outbound Cost Flow

Consumes quantity from a cost pool and requires calculated cost.

Example:

```text
Sales Shipment
-30 units
```

The valuation method determines which cost basis is consumed.

---

## 9. FIFO

FIFO means:

> **First cost layer in, first cost layer out.**

Example:

```text
Layer A:
100 @ 10

Layer B:
100 @ 12

Outbound:
120
```

FIFO consumes:

```text
100 @ 10 = 1000
20  @ 12 = 240
----------------
Cost = 1240
```

Remaining:

```text
80 @ 12
```

FIFO requires persistent calculation-layer semantics during a Cost Run.

---

## 10. LIFO

LIFO means:

> **Last cost layer in, first cost layer out.**

Using the same example:

```text
Layer A:
100 @ 10

Layer B:
100 @ 12

Outbound:
120
```

LIFO consumes:

```text
100 @ 12 = 1200
20  @ 10 = 200
----------------
Cost = 1400
```

Remaining:

```text
80 @ 10
```

FIFO and LIFO therefore share the same underlying Cost Layer and Cost Match model.

They differ primarily in layer-selection order.

---

## 11. Moving Average

Moving Average maintains a running average cost within the Cost Pool.

Example:

```text
Receipt 1:
100 @ 10
Amount = 1000

Receipt 2:
100 @ 12
Amount = 1200
```

Pool becomes:

```text
Quantity = 200
Amount = 2200
Average Unit Cost = 11
```

Outbound:

```text
120 @ 11
Cost = 1320
```

Remaining:

```text
Quantity = 80
Amount = 880
Average Unit Cost = 11
```

Moving Average does not require outbound layer matching in the same way as FIFO/LIFO, but EVO may still preserve calculation lineage for traceability.

---

## 12. Periodic Weighted Average

EVO-04 does not require this method in the initial implementation, but the model must leave room for it.

Periodic Weighted Average calculates cost over a defined accounting or valuation period.

It differs from Moving Average because it does not necessarily recalculate unit cost after every inbound movement.

Initial implementation recommendation:

```text
Support:
    MOVING_AVERAGE

Reserve:
    PERIODIC_WEIGHTED_AVERAGE
```

---

## 13. Specific Identification

Specific Identification values the exact identified item or lot being consumed.

Example:

```text
Serial SN001
Cost = 1000

Serial SN002
Cost = 1200
```

Outbound:

```text
SN002
```

Calculated cost:

```text
1200
```

Specific Identification requires a sufficiently precise Cost Dimension, such as:

```text
Serial Number
Lot
Batch
Asset Identity
Project Identity
Specific Inventory Identity
```

The Cost Engine cannot invent that identity after the fact.

The business data and posting dimensions must supply it.

---

## 14. Cost Layer

Cost Layer is primarily required by FIFO and LIFO and may also be useful for traceability under other methods.

Conceptually:

```text
CostLayer
    cost_pool
    source_ledger_entry
    original_quantity
    remaining_quantity
    original_amount
    remaining_amount
    unit_cost
    effective_time
    sequence
```

Example:

```text
CostLayer
    Product = A
    Warehouse = HK
    Quantity = 100
    Remaining = 80
    Unit Cost = 12
```

Cost Layer is derived calculation state, not original business data.

It may be deleted and rebuilt during full recalculation.

---

## 15. Cost Match

Cost Match records how an outbound movement consumes inbound cost basis.

Example:

```text
Outbound Ledger Entry #500
    consumes
        Layer #101: 100 @ 10
        Layer #102: 20 @ 12
```

Conceptually:

```text
CostMatch
    outbound_entry
    inbound_layer
    matched_quantity
    matched_amount
    unit_cost
```

Cost Match is especially important for:

```text
FIFO
LIFO
Specific Identification
```

It provides cost traceability without changing the original Ledger Entries.

---

## 16. Cost Result

Cost Result is the calculated valuation result associated with a cost-bearing movement.

Conceptually:

```text
CostResult
    cost_run
    ledger_entry
    valuation_policy
    cost_pool
    quantity
    cost_amount
    unit_cost
    currency
```

Example:

```text
Ledger Entry:
    Inventory -120

Cost Result:
    method = FIFO
    cost = 1240
```

Changing the valuation policy and recalculating may produce a different Cost Result while the underlying Ledger Entry remains the same.

---

## 17. Cost Run

Cost Run represents one complete valuation calculation execution.

Conceptually:

```text
CostRun
    id
    enterprise
    ledger_dataset
    valuation_policy_version
    started_at
    completed_at
    status
```

Possible statuses:

```text
Pending
Running
Completed
Failed
```

A Cost Run must be reproducible from:

```text
Ledger Dataset
+ Valuation Policy Version
+ Posting Sequence
```

---

## 18. Ordering

Cost calculation must follow deterministic ledger movement order where the valuation method depends on sequence.

Conceptually:

```text
Cost Sequence
=
Posting Sequence
+ Cost Rule Priority
+ Stable Cost Sequence
```

FIFO, LIFO and Moving Average are sequence-sensitive.

Therefore:

> **Cost calculation must consume ledger movements in the same deterministic business order used by the posting model, unless the valuation policy explicitly defines another ordering rule.**

---

## 19. Relationship Between Posting and Cost

Posting and cost must remain separated.

Bad model:

```text
Business Data
↓
Posting Rule directly freezes inventory cost forever
```

Preferred model:

```text
Business Data
↓
Posting Rule
↓
Ledger Entry
↓
Valuation Policy
↓
Cost Result
```

This allows:

```text
Reposting
Revaluation
Policy change
Historical recalculation
Alternative calculation
```

without rewriting original business data.

---

## 20. Direct Amount vs Calculated Cost

Some ledger entries may already contain direct business amounts.

Example:

```text
Purchase Receipt
Quantity = +100
Business Amount = 1000
```

This amount may become the inbound cost basis.

For outbound movement:

```text
Sales Shipment
Quantity = -30
```

the cost amount is derived by Cost Engine.

Therefore EVO distinguishes conceptually:

```text
Direct Business Amount
Calculated Cost Amount
```

They must not be confused.

---

## 21. Cost Propagation

Some business flows transfer cost from one pool or ledger context to another.

Example:

```text
Raw Material Inventory
      ↓ consume
Work In Process
      ↓ complete production
Finished Goods Inventory
```

The Cost Engine must eventually support cost propagation:

```text
Consumed Material Cost
+ Labor Cost
+ Manufacturing Overhead
        ↓
Production Completion Cost
```

EVO-04 establishes the generic cost-result model but does not yet fully define manufacturing cost allocation.

That will be extended later on top of the same Cost Run architecture.

---

## 22. Inventory Transfer

Warehouse transfer illustrates why quantity posting and costing are separate.

Example:

```text
Warehouse HK
Inventory -10

Warehouse SG
Inventory +10
```

The quantity effect belongs to Ledger Posting.

The transferred cost basis belongs to Cost Engine.

Depending on policy, the outbound cost from HK becomes the inbound cost basis in SG.

Conceptually:

```text
HK Outbound Cost Result
        ↓
Cost Transfer
        ↓
SG Inbound Cost Layer
```

---

## 23. Negative Inventory

Negative inventory creates valuation ambiguity.

EVO-04 does not silently define one universal behavior.

A Valuation Policy must eventually declare whether negative inventory is:

```text
Disallowed
Temporarily Allowed
Estimated
Backfilled by later receipt
```

Initial implementation recommendation:

> Treat negative inventory behavior as explicit policy, not an accidental side effect of the algorithm.

Detailed backfill strategy is deferred.

---

## 24. Currency

Cost calculation may involve currency.

Conceptually distinguish:

```text
Transaction Currency
Cost Currency
Enterprise Base Currency
```

Valuation Policy or enterprise accounting policy determines currency conversion rules.

Foreign exchange calculation is not part of the initial EVO-04 algorithm definition, but the Cost Result model must preserve currency identity.

---

## 25. Rounding

Cost calculations require deterministic rounding.

Valuation Policy must define:

```text
Unit Cost Precision
Amount Precision
Rounding Mode
Residual Handling
```

The same Cost Run must not produce different results across environments due to implicit decimal behavior.

---

## 26. Full Cost Recalculation

When EVO performs full replay:

```text
Pause Real-Time Posting
      ↓
Clear Ledger Results
      ↓
Clear Balance Results
      ↓
Clear Cost Results
      ↓
Rebuild Ledger Entries
      ↓
Rebuild Balances
      ↓
Run Cost Engine
      ↓
Rebuild Cost Layers
      ↓
Rebuild Cost Matches
      ↓
Rebuild Cost Results
      ↓
Resume Real-Time Posting
```

Cost data is therefore entirely reconstructable.

---

## 27. Multiple Valuation Policies

Architecturally, the same Ledger Dataset may be evaluated under different Valuation Policies.

Example:

```text
Ledger Dataset A
    ├── FIFO Cost Run
    ├── LIFO Cost Run
    └── Moving Average Cost Run
```

This does not mean the first implementation must keep all results active simultaneously.

But the conceptual model should allow comparison and replay under alternative policies.

---

## 28. Cost Dataset

EVO may treat all results of one Cost Run as a Cost Dataset.

```text
Ledger Dataset
+ Valuation Policy Version
      ↓
Cost Run
      ↓
Cost Dataset
```

A Cost Dataset may include:

```text
Cost Results
Cost Layers
Cost Matches
Calculated Balances
Valuation Metadata
```

This provides a clean reproducibility boundary.

---

## 29. Relationship to Financial Accounting

Cost results may feed financial posting or financial reporting.

Example:

```text
Sales Shipment
    ↓
Inventory Quantity -80
    ↓
FIFO Cost Result = 1240
    ↓
Financial Accounting
    Cost of Goods Sold = 1240
    Inventory Value = -1240
```

The exact integration mode between Cost Result and financial ledger posting requires a later design decision.

Possible future patterns include:

```text
Cost Result drives secondary posting
Cost Result feeds financial projection
Cost Result becomes input to a later posting phase
```

EVO-04 does not lock one of these yet.

---

## 30. Architectural Invariants

1. Cost Result is derived data.
2. Cost data must be fully recalculable.
3. Ledger Entry and Cost Result are separate objects.
4. Valuation Policy is metadata.
5. Cost Dimensions define independent costing pools.
6. FIFO and LIFO use Cost Layers and layer-selection order.
7. Moving Average uses running pool quantity and amount.
8. Specific Identification requires explicit business identity.
9. Cost calculation order must be deterministic.
10. Cost Layers are derived calculation state.
11. Cost Matches provide traceability between outbound and inbound basis.
12. Direct business amount and calculated cost amount are distinct concepts.
13. Negative inventory behavior must be explicit policy.
14. Rounding must be deterministic.
15. Full replay may clear and rebuild all cost data.
16. The same Ledger Dataset may conceptually support multiple Cost Runs.
17. Manufacturing and advanced allocation can extend this model later.

---

## 31. Initial Implementation Scope

Recommended first implementation:

```text
Valuation Methods:
    FIFO
    LIFO
    MOVING_AVERAGE
    SPECIFIC_IDENTIFICATION

Core Objects:
    ValuationPolicy
    CostPool
    CostLayer
    CostMatch
    CostRun
    CostResult

Replay:
    Full recalculation only
```

Deferred:

```text
Periodic Weighted Average
Standard Cost
Manufacturing Overhead Allocation
Partial Recalculation
Negative Inventory Backfill Optimization
Multi-Currency Revaluation
Advanced Cost Simulation
```

---

## 32. Next Stage

**EVO-05 — Replay & Recalculation Model**

EVO-05 will define the system-level rebuild lifecycle:

```text
Normal Mode
    ↓
Pause Posting
    ↓
Replay Lock
    ↓
Clear Derived Data
    ↓
Rebuild Posting
    ↓
Rebuild Balances
    ↓
Rebuild Costs
    ↓
Validation
    ↓
Resume Normal Mode
```

It will also define:

```text
Replay State
Posting Run
Ledger Dataset
Cost Run
Cost Dataset
Failure Handling
Atomic Publish / Switch
Validation
```

---

**End of EVO-04 v0.1**

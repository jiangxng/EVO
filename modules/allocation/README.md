# allocation module

## Purpose

Generic source-consumption semantics shared by fulfillment, settlement, inventory layers, cost basis propagation and other open-position processes.

## Owns

- AllocationInstruction / source constraint contracts
- AllocationPolicy contracts
- AllocationRelation contracts
- AllocationRun semantics

## Non-responsibilities

- Business causality
- Cost valuation policy
- Accounting projection
- Position materialization ownership
- Workflow approval

## Rules

- Explicit business/user source selection is preserved as instruction/evidence.
- Generated allocation edges are derived and rebuildable.
- Manual selection and algorithm-generated edges are not the same object.
- Allocation lineage must not be stored as generic business causality.
- Public contracts belong under `api/`.


## Cost integration

Layer-based cost methods use this module as their source-consumption lineage boundary.

For FIFO/LIFO/Specific Identification:
- Cost validates an explicit published AllocationPolicy pin.
- Cost opens an AllocationRun.
- Each consumed source layer emits one AllocationRelation.
- Relation measurements describe consumed resource quantity.
- Cost-specific value details remain lineage/valuation derivation, not a replacement for Allocation semantics.

Full replay preserves canonical AllocationInstruction rows and rebuilds AllocationRun/AllocationRelation rows.

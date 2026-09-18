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

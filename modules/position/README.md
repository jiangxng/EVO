# position module

## Purpose

Owns versioned PositionDefinition semantics and deterministic reconstruction boundaries for open/current economic positions.

## Owns

- `position_definition` versioned semantics
- PositionDefinition public contracts
- position-resolution semantics

## Does not own

- canonical BusinessData facts
- AllocationInstruction
- cost/valuation policy
- accounting projection
- mutable canonical Position rows

## Frozen rule

`PositionDefinition` is versioned template/reference semantics.

`Position` itself is a derived result.

Historical replay must resolve positions from a pinned PositionDefinition, never from an unversioned current template definition.

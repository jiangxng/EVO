# lineage module

## Purpose

Neutral contracts for derived calculation dependency lineage.

## Owns

- CalculationDependencyEdge semantic contract
- CalculationDependencyStore emission/query port

## Non-responsibilities

- business causality (flow)
- source consumption semantics (allocation)
- valuation semantics
- replay orchestration/checkpoint policy

## Rules

- dependency edges describe recalculation impact, not business truth;
- graphVersion is first-class and immutable for an edge;
- producer modules may emit edges without depending on Replay;
- Replay consumes the graph to build impact closure;
- business causality, allocation lineage and calculation dependency remain distinct semantics.

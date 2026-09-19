Purpose: trace value/object/state/responsibility chains across domains and applications.
Responsibility: FlowDefinition, FlowInstance identity, FlowTrace, BusinessObjectLink semantics.
Non-Responsibility: replacing Process, Command, BusinessData or Ledger.
Dependencies: metadata, business-data, command.
Invariants: never infer fulfillment from matching quantity/time; Flow may cross domains; lineage does not mutate facts.
Replay: trace reconstruction must be deterministic from persisted lineage metadata.


Freeze refinement — 2026-09-18:
- Flow/business-object links own business-level lineage such as CAUSES, FULFILLS and REFERENCES.
- New runtime-derived ALLOCATION, VALUATION/COST DERIVATION and CALCULATION DEPENDENCY edges must use their dedicated module contracts.
- Existing persisted compatibility values remain readable until ER-C03 migration/crosswalk proves safe.

Purpose: trace value/object/state/responsibility chains across domains and applications.
Responsibility: FlowDefinition, FlowInstance identity, FlowTrace, BusinessObjectLink semantics.
Non-Responsibility: replacing Process, Command, BusinessData or Ledger.
Dependencies: metadata, business-data, command.
Invariants: never infer fulfillment from matching quantity/time; Flow may cross domains; lineage does not mutate facts.
Replay: trace reconstruction must be deterministic from persisted lineage metadata.

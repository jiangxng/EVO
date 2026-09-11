Purpose: govern Enterprise Capability definitions.
Responsibility: capability identity, versioned semantics, mapping context.
Non-Responsibility: executing Commands, owning BusinessData, orchestrating workflow.
Public Interfaces: capability definitions/query contracts (foundation only in alpha.1).
Dependencies: metadata.
Invariants: Capability does not execute transactions; Capability may group Processes, Apps, Commands, SOPs and Metrics.
Forbidden Changes: do not introduce CapabilityExecution without an independent lifecycle/invariants architecture change.

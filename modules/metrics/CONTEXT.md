Purpose: provide a shared semantic measurement layer.
Responsibility: MetricDefinition and versioned calculation/query contracts.
Non-Responsibility: ad-hoc UI formulas becoming enterprise truth.
Dependencies: metadata, query.
Invariants: formal metrics originate from published MetricDefinition; results must retain lineage to facts/derived state.

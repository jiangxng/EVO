# Business Lineage Interface

Purpose: make causation, fulfillment and cross-domain flow trace explicit.

Owner: `flow`

Input: Command execution lineage metadata and resulting BusinessData identifiers.

Output: immutable `business_object_link` and `flow_trace` records.

Preconditions:
- linked objects belong to the same enterprise;
- relation type is explicit;
- a Flow definition is published/active when flow trace is written.

Postconditions:
- lineage can be traced without guessing from quantity, timestamp, product or textual similarity.

Invariants:
- links do not rewrite BusinessData;
- lineage is descriptive/audit state, not an alternative fact store;
- equal quantities never imply `FULFILLS` automatically.

Idempotency: one command/result step should create at most one equivalent flow trace record for a flow instance and step.

Versioning: relation vocabulary and flow definition are version-governed.

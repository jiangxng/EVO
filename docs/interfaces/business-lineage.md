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

## Host-governed runtime flow registration

Current alpha execution evidence supports a Host-owned process/SOP authority without moving that authority into EVO.

The Host may register an immutable published runtime-flow snapshot through:

```text
POST /api/v1/runtime-flow-definitions/register
```

The registration stores only the externally governed identity needed by EVO's runtime trace projection:

- enterprise scope;
- stable flow code;
- source authority/reference;
- source revision;
- semantic digest;
- bounded definition snapshot.

The Host remains the lifecycle/semantic authority. Registering a snapshot does not make EVO the owner of SOP/workflow semantics.

A governed Command or Configurator BusinessData submission may then carry explicit lineage:

```text
flowDefinitionId
flowInstanceKey
stepCode
parentBusinessDataId?
relationType?
```

If lineage is supplied, EVO projects it into the existing immutable `flow_instance`, `flow_trace` and optional `business_object_link` evidence. Invalid enterprise scope, unpublished flow identity or cross-enterprise parent references fail closed.

Public trace reads remain:

```text
POST /api/v1/runtime-traces/query
```

No private-table insertion is required to produce runtime-flow evidence.


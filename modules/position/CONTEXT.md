# Position Context

The module exists because open/current state is not the same thing as immutable enterprise history.

Expected chain:

`BusinessData + Allocation lineage + pinned PositionDefinition → Position snapshot`.

A PositionDefinition describes:
- source BusinessData types;
- increase/decrease direction;
- measurement mappings;
- unit semantics;
- dimensions/grouping;
- optional filters/config.

Do not persist a derived Position merely to make replay easier unless it is explicitly classified as a materialization/checkpoint.

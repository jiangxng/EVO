# EVO Complete Enterprise Template Constitution

Status: AUTHORITATIVE
Version: 1.0

## Purpose

The Complete Enterprise Template is the LLM-native, normalized definition model required to instantiate and run a complete enterprise in EVO. It is not an Asloop template, not a bookkeeping port, and not a dump of legacy tables.

Asloop-Backend and bookkeeping are knowledge/evidence assets. Their accumulated definition data and business semantics constrain completeness, but their implementation architecture does not constrain EVO.

## Hard boundary

Enterprise Template contains Definition Data. It MUST NOT contain Enterprise Instance Data.

Example Definition Data: field `生产日期`, its data type, semantic type, validation, component bindings, data source, field-group memberships, command projections, posting mappings and provenance.

Example Instance Data: a concrete sale of product A, quantity 100, amount 1000. Such facts belong to Enterprise Instance Data / BusinessData and are forbidden from the reusable template.

## Four conservation laws

1. Record conservation — every legacy definition record has an accounted disposition.
2. Property conservation — every source property has a target mapping, evidence-preserved legacy representation, or explicit disposition.
3. Relation conservation — every source relationship is accounted for independently of entity normalization.
4. Semantic conservation — normalization must not destroy a business distinction merely because two legacy structures look technically similar.

Allowed dispositions: PRESERVED, TRANSFORMED, MERGED, SPLIT, LEGACY_ONLY, DEPRECATED, UNRESOLVED.

## LLM-native convergence

Legacy executable code is evidence of business semantics, not source code to port. Repeated physical structures should converge into canonical definitions plus explicit usages/relations. Expressions should converge into typed deterministic rule semantics where understood; original expressions remain traceable evidence. Unknown semantics remain UNRESOLVED rather than guessed or deleted.

The template storage model is relational/normalized Definition Dataset first. JSON is a deterministic package projection for validation, exchange, review and installation; it is not required to be the sole physical representation.

## Canonical definition families

The template may contain: enterprise/organization model, domains, capabilities, master-data definitions, semantic fields, field groups, components, data sources, transaction types, applications, commands, BusinessData schemas, explicit relationships, dimensions, operational and financial ledgers, posting policies, typed expressions, allocation policies, cost/valuation policies, BOM/MRP/production/WMS definitions, workflows/SOPs/flows/work definitions, metrics, authorization semantics, installation/version/replay policies, and provenance.

Families are added because enterprise semantics require them, not to mirror legacy table names.

## Completeness gate

A template MUST NOT be marked COMPLETE merely because demo scenarios run. COMPLETE requires zero unexplained loss in definition records/properties/relations, explicit handling of unresolved legacy semantics, and successful compatibility validation against the full Enterprise Instance Data corpus available for certification.

A legacy instance that cannot be represented because a required definition is absent is first treated as a Template Coverage Gap, not silently discarded as incompatible data.

## Full-instance certification

The final certification path is:

Legacy full enterprise dataset → deterministic import/transform → BusinessData → canonical ordering → Posting → LedgerEntry → Balance → Cost/Valuation → Replay → deterministic reconstruction → conservation checks → performance/stress measurements.

Sample/demo data can test mechanics but can never prove template completeness.

## Provenance classes

Canonical definitions record knowledge origin separately from runtime semantics:
- LEGACY_DERIVED — directly preserved business definition with normalization.
- LEGACY_CONVERGED — synthesized from multiple legacy definitions/implementations.
- EVO_NATIVE — introduced by EVO to complete/generalize the enterprise model.

Provenance does not grant legacy implementation authority over EVO runtime.
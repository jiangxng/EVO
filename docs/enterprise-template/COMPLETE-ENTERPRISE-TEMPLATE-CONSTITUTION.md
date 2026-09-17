# EVO Complete Enterprise Template Constitution

Status: AUTHORITATIVE
Version: 1.0

The Complete Enterprise Template is the LLM-native normalized Definition Data model required to instantiate and run a complete enterprise in EVO. It is not an Asloop template, a bookkeeping port, or a legacy table dump.

## Boundary
Enterprise Template contains Definition Data and MUST NOT contain Enterprise Instance Data. A field such as `生产日期`, including its type, semantics, validation, UI/data-source bindings, usages and provenance, is Definition Data. A concrete sale of product A quantity 100 amount 1000 is Enterprise Instance Data and is forbidden from the reusable template.

## Conservation laws
Every legacy definition record, property and relation must have an accounted disposition, and normalization must preserve meaningful business distinctions. Allowed dispositions: PRESERVED, TRANSFORMED, MERGED, SPLIT, LEGACY_ONLY, DEPRECATED, UNRESOLVED. Unknown semantics remain UNRESOLVED rather than guessed or deleted.

## LLM-native convergence
Legacy executable code and data are evidence of enterprise knowledge, not architecture to port. Repeated physical structures converge into canonical definitions plus explicit usages/relations. Expressions converge into typed deterministic semantics where understood while original expressions remain traceable evidence. The storage model is a normalized Definition Dataset; JSON is a deterministic package projection, not the only physical representation.

## Completeness
Demo success never proves completeness. COMPLETE requires definition record/property/relation conservation, explicit unresolved semantics, full Enterprise Instance Data compatibility, deterministic replay, and full-scale stress certification. A legacy instance that cannot be represented because a definition is absent is first classified as a TEMPLATE_COVERAGE_GAP.

Certification path: Legacy full enterprise dataset → deterministic import/transform → BusinessData → canonical ordering → Posting → LedgerEntry → Balance → Cost/Valuation → Replay → deterministic reconstruction → conservation checks → stress measurements.

## Provenance
Canonical definitions classify knowledge origin as LEGACY_DERIVED, LEGACY_CONVERGED, or EVO_NATIVE. Provenance never grants legacy implementation authority over EVO runtime.
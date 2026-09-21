# cost module

## Purpose

Valuation policies and deterministic cost calculation.

## Owns

`cost state/results`

## Rules

- Public entry points belong under `api/`.
- Domain/application code must not expose persistence records as contracts.
- Another module may not write this module's owned data directly.
- Cross-module dependencies must be declared in `architecture.manifest.json`.
- Importing another module's `infrastructure/` is prohibited.
- Material interface or invariant changes require documentation and tests.

## Status

Implemented with unit coverage for supported cost methods and database E2E
certification for the reference FIFO checkpoint/suffix scenario. This does not
mean every method has equivalent production activation certification.


## Economic Runtime Freeze refinements

- Authoritative cost runs require explicit pinned policy identity/version.
- Business-data eligibility, pool grain and field mappings are policy-driven; application names must not be hard-coded in the generic engine.
- FIFO/LIFO use ordered source layers.
- Specific Identification uses an explicit source identity.
- Moving Average is a quantity+amount valuation pool. It MUST NOT simulate residual state by consuming receipt layers while retaining original layer unit costs.
- Valuation rules used by authoritative cost runs are explicitly pinned.
- Cost execution order follows semantic effective order plus explicit posting sequence and stable tie-breaker.


Residual closure invariant:
- when a final consumption exhausts a quantity/value pool, the consuming result takes the exact remaining amount;
- do not recompute the final amount as rounded unit-cost × quantity;
- this prevents ghost residual value and must hold under deterministic replay.


## Normalized valuation input boundary

Cost algorithms do not parse application-specific BusinessData payloads directly.

The runtime pipeline is:

`BusinessData + posting sequence + pinned valuation policy mapping`
` → ValuationInputReader`
` → normalized ValuationInput`
` → cost/allocation algorithm`.

ValuationInput carries:
- inbound/outbound direction;
- semantic order;
- pool key/dimensions;
- quantity Measurement;
- optional basis Measurement;
- optional specific identity.

This keeps application field names and business-data-type mapping in policy/adapter boundaries rather than in generic cost algorithms.

## Allocation lineage from cost methods

FIFO, LIFO and Specific Identification create durable derived `allocation_relation` rows for each source-layer consumption.

- `allocation_instruction` remains canonical explicit business intent when present.
- `allocation_relation` is a rebuildable interpretation result.
- Moving Average does not fabricate receipt-layer allocation edges; it remains a pool valuation model.
- Cost runs pin the AllocationPolicy that generated layer-consumption lineage.

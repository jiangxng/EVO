# Batch 03 — Ledger / Measure / Dimension Convergence

Status: IN PROGRESS
Evidence: uploaded Asloop definition SQL, `calc_rel` (134 records) and `c_calc_field` (63 records).

## Finding 1 — calc_rel is a compressed accounting model, not an EVO object

All 134 calc-rel definitions carry `entityId` in their locating/auxiliary fields. Their measure fields are overwhelmingly `qty` and `amount`, with a small `foreign` population. The legacy row compresses at least: business measure, ledger/account target, locating dimensions, auxiliary dimensions, matching behavior, merge behavior, finance-check behavior, direction behavior and lifecycle flags.

EVO therefore MUST NOT map one calc_rel row to one monolithic replacement record. It decomposes the semantics into LedgerDefinition + MeasureDefinition + DimensionPolicy + PostingPolicy + MatchingPolicy/AllocationPolicy where applicable, with lineage back to every source property.

## Observed measure incidence

Across 134 calc-rel records: `qty` appears in 87 measure declarations, `amount` in 73, and `foreign` in 4. A source row can declare more than one measure; counts are incidences, not row counts.

Canonical candidate measures:
- QUANTITY — decimal quantity with explicit unit semantics.
- AMOUNT — functional/base monetary amount only when currency basis is explicit.
- FOREIGN_AMOUNT — original/foreign currency amount with explicit currency and FX lineage.

`qty,amount` is not one scalar. It means a ledger semantic may expose multiple governed measures.

## Observed locating/auxiliary field incidence

Across calc-rel locating + auxiliary field declarations:
- entityId 134
- matCode 76
- dealerCode 66
- accountSub 60
- whCode 19
- facilityCode 17
- projectId 13
- departmentId 9
- orderCode 8
- expCode 6
- proPointCode 5
- processCode 5
- storehouseCode 3
- batchNo 3
- cashCode 2
- draftNumber 2
- processProCode 1
- boxCode 1

These counts are evidence of analytical/business identity, not automatic proof that every field becomes an EVO DimensionDefinition. `orderCode`, `processCode`, `draftNumber` and similar identifiers may instead be explicit lineage/reference keys. Classification remains evidence-driven.

## Finding 2 — calc fields mix facts, state, lineage and execution metadata

The 63 `c_calc_field` definitions include:
- identity/lineage: transCode, appId, transType, transDetailId, parentId, componentId;
- temporal ordering: effectiveTime, calcTime, seqTime;
- measures: qty, amount;
- matching state: transMatchedCode, transMatchedSeq, qtyTbMatched, amntTbMatched, locked values;
- dimensions/reference candidates: matCode, whCode, facilityCode, dealerCode, departmentId, projectId, batchNo, cashCode;
- execution/technical state: version, firstValue, lastValue, status;
- business semantics: productionDate, measureUnit, agingTime, stockTime, paymentTerm, cashFlowId.

EVO MUST separate these concerns instead of reproducing one calculation table with 63 generic columns.

## Canonical split

BusinessData carries source business facts and explicit lineage. PostingInput pins ordering and rule versions. LedgerEntry carries immutable effect measures + explicit dimensions + source lineage. Matching/settlement is explicit governed relation data. Balance is derived. Cost/valuation is a separate deterministic dataset. Runtime execution metadata belongs to runtime control, not enterprise semantic fields.

## Important unresolved boundaries

- `accountSub`: may combine account hierarchy and auxiliary accounting dimension.
- `dealerCode`: must converge into counterparty plus explicit business role rather than infer customer/supplier.
- `storehouseCode`: legacy usage may mean bin/location rather than warehouse; do not normalize by name alone.
- order/process/draft identifiers: likely lineage/reference keys in many contexts, dimensions only where explicit analytical slicing is required.
- `foreign`: must be joined to account/currency/FX evidence before canonical monetary semantics are finalized.

No unresolved item may be silently mapped or deleted.
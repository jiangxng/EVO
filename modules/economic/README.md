# economic module

## Purpose

Low-level semantic contracts for measurements, explicit basis evidence and governed rate observations.

## Owns

- Measurement semantics
- BasisEvidence contracts
- RateObservation / RateDatasetPin contracts
- Economic ordering key contract

## Non-responsibilities

- Business application semantic fields
- Allocation decisions
- Cost calculation
- Ledger posting
- Materialized balances

## Rules

- Measurement never replaces semantic business fields.
- Rate roles must be explicit.
- No authoritative runtime may use an unversioned “latest rate”.
- Public contracts belong under `api/`.
- This module contains semantics, not persistence assumptions.

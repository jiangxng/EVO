# Period-Close / Valuation Replay Input Gap

**Status:** ACTIVE DESIGN GAP  
**Date:** 2026-09-18  
**Scope:** FX period-end valuation, replay, reference-dataset pinning  
**Depends on:** Economic Runtime Architecture Freeze v0.1, AP-FX-001, ER-C05B2

## 1. Problem

The current FX period-end runtime persists:

- `valuation_run`;
- `valuation_result`;
- pinned `rate_dataset_id/version/digest` on the derived valuation run.

These are derived interpretation records.

Full Replay intentionally deletes derived `valuation_run/result` state.

However, there is currently no canonical retained input that states:

- a governed period-end valuation was requested;
- the effective valuation date/period;
- the valuation kind;
- the position/scope to revalue;
- the exact immutable RateDataset pin;
- the valuation policy/precision;
- actor/governance provenance;
- correction/supersession semantics.

Therefore Full Replay cannot deterministically recreate a historical period-end valuation after deleting its derived result.

This also means a checkpoint cannot honestly certify complete reference-dataset pins merely by inspecting valuation runs **after** replay.

## 2. This is not an FX algorithm problem

The FX algorithm itself is already evidence-backed and implemented:

`open foreign position + pinned period-end rate → revalued carrying amount + delta`.

The missing concept is the canonical **reason/instruction to execute that interpretation**.

Legacy archaeology already separated:

`period-close governance / request`

from:

`valuation calculation`.

The new runtime must preserve the same semantic distinction without copying legacy tables.

## 3. Candidate canonical forms

### Option A — Command → BusinessData period-close fact

A governed Command accepts a period-close/revaluation request and emits immutable BusinessData such as:

`valuation.period_end.requested`

containing:

- valuation kind;
- effective date/period;
- scope selector;
- RateDataset pin;
- valuation policy pin/config;
- actor/request provenance.

Replay consumes the accepted BusinessData fact and regenerates `valuation_run/result`.

**Advantages**
- reuses EVO's canonical write boundary;
- already participates in immutable BusinessData history and posting/replay ordering;
- corrections can be additive facts;
- authorization/idempotency already exist.

**Risks**
- not every interpretation request naturally belongs to ordinary Posting;
- requires a governed interpreter/valuation dispatch path separate from Ledger Posting;
- BusinessData ordering and valuation execution phase must remain distinct.

### Option B — dedicated ValuationInstruction canonical store

Persist an append-only `valuation_instruction` owned by Valuation.

**Advantages**
- explicit semantic contract;
- avoids pretending all interpretation instructions are ordinary business transactions;
- natural place for scope/rate/policy pins.

**Risks**
- creates a second canonical write path unless admission is still Command-governed;
- requires separate idempotency/auth/history conventions;
- can drift away from BusinessData if not constitutionally constrained.

## 4. Current direction

**Preferred direction: Option A unless implementation evidence shows a hard contradiction.**

Reason:

> EVO already defines Command as the canonical write boundary and BusinessData as canonical accepted enterprise history.

Therefore a period-close/revaluation instruction should preferably be represented as a governed BusinessData fact produced by Command, while its downstream `valuation_run/result` remain derived/rebuildable.

The canonical fact does not mean the valuation result itself is factual.

It means:

> “The enterprise authorized valuation kind K, for scope S, at effective time T, under pinned dataset/policy P.”

That authorization/governance event is historical enterprise evidence.

## 5. Required separation

Do not collapse:

- PeriodClose / Valuation Request Fact;
- RateDataset;
- Position snapshot/input selection;
- ValuationRun;
- ValuationResult;
- Accounting Projection;
- Period-close registry/materialization.

Expected chain:

`Command`
` → ValuationRequest BusinessData`
` → deterministic scope resolution`
` → ValuationRun`
` → ValuationResult`
` → Accounting/Management Projection`
` → Materialization`.

## 6. Replay consequence

Full Replay must preserve the ValuationRequest fact and delete/rebuild the derived valuation run/results.

Replay input digest must include the canonical request fact automatically through BusinessData.

Reference dataset pins can then be reconstructed from canonical request payloads rather than inferred only from derived historical valuation runs.

## 7. Checkpoint consequence

Until a canonical valuation request exists and replay consumes it, checkpoint safety MUST retain:

- `FULL_REPLAY_DERIVED_RUNTIME_COVERAGE_NOT_CERTIFIED`;
- `REFERENCE_DATASET_PIN_COVERAGE_NOT_CERTIFIED`.

An empty post-replay rate-dataset pin set MUST NOT be interpreted as proof that no external dataset dependency existed.

## 8. Next implementation packet

`ER-C05B3A — Canonical Valuation Request`

Required work:

1. define valuation-request BusinessData semantic contract;
2. define Command admission/example for period-end valuation;
3. pin RateDataset identity/version/digest in the fact;
4. pin valuation policy/precision;
5. define deterministic scope selector;
6. build valuation interpreter/dispatcher from canonical request facts;
7. replay the request after normal posting/cost phases;
8. add FX period-end reference scenario;
9. certify before/after Economic Runtime digest equality;
10. only then remove reference-dataset/replay-coverage blockers.

No incremental mutation work may begin before this closes.

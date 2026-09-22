# EEL-C04 — Manufacturing Execution Reference Loop Certification v0.1

**Status:** CERTIFICATION CANDIDATE — LOCAL POSTGRESQL 18.6 VERIFIED / CI PENDING  
**Date:** 2026-09-22  
**Stage:** Stage E — Enterprise Economic Loops  
**Packet:** EEL-C04  
**Branch:** `evo/eel-c04-full-replay-final-certification-v0.1`  
**Proof boundary:** one bounded single-material / single-finished-product manufacturing execution reference loop; this is not certification of BOM, MRP, APS, MES, routing, quality, capacity, subcontracting, co-product, rework, scrap, or advanced traceability platforms.

## 1. Candidate Certified Business Outcome

EVO can express and deterministically rebuild this manufacturing reference loop without a manufacturing-specific Core Runtime:

```text
Production Demand
→ Raw-material Issue
→ FIFO Cost / Manufacturing WIP
→ Partial Production Completion
→ Final Production Completion
→ Finished-goods Inventory
→ Balance-driven PRODUCE Work Closure
→ Full Replay Equality
```

The reference scenario proves:

- production demand is an explicit canonical fact and opens pending production;
- material issue is a canonical fact and explicitly references its demand;
- raw-material Inventory decreases through posting and valuation;
- two completion facts explicitly fulfill the same demand;
- finished-goods Inventory increases through posting;
- pending production remains open after partial completion and closes only at zero;
- manufacturing input cost is visible through FIFO CostResult and manufacturing WIP;
- Full Replay preserves facts and relationships and rebuilds derived state identically.

## 2. Reference Result

```text
Raw-material receipt              100 units / CNY 1,000
Material issue                     20 units / FIFO CNY 200
Raw-material final                 80 units / CNY 800

Production demand                  50 units
Production completion              20 + 30 units
Finished-goods final               50 units / CNY 200
Manufacturing WIP final             0
Pending production                 50 → 30 → 0
PRODUCE Work final                 DONE
```

Explicit lineage in the isolated C04 loop contains:

- one material-issue `REFERENCES` relation to the production demand;
- two production-completion `FULFILLS` relations to the production demand;
- one goods-receipt `FULFILLS` relation to its purchase order.

No manufacturing relationship is inferred from matching quantity or timestamp.

## 3. Full Replay Evidence

C04.6 executes a Full Replay through the production boundary and proves:

- canonical replay-input digest is unchanged;
- canonical BusinessData facts are unchanged;
- explicit BusinessObjectLink rows are unchanged;
- Ledger entries and balances rebuild identically;
- raw-material Inventory rebuilds to 80 / 800;
- finished-goods Inventory rebuilds to 50 / 200;
- manufacturing WIP rebuilds to zero;
- FIFO material-issue CostResult rebuilds to 200;
- pending production rebuilds to zero;
- PRODUCE Work rebuilds as `DONE`;
- replay run persists `COMPLETED / MATCH`;
- before and after economic-runtime digests are equal.

The local isolated proof produced:

```text
before digest = 2f3bf7fc60b44bb677a05d553eff02f971414bd2b90691368273ea88c2afd29a
after digest  = 2f3bf7fc60b44bb677a05d553eff02f971414bd2b90691368273ea88c2afd29a
```

These digest values identify this single local run; equality and persisted MATCH are the certification property.

## 4. Replay Defect Discovered and Corrected

The first clean PostgreSQL proof found a deterministic-replay defect in Ledger balance metadata.

Normal execution applies the material-issue valuation before later completion postings. Full Replay first rebuilds base postings and then recalculates Cost/Valuation. The late valuation write for posting sequence 4 therefore overwrote the WIP balance's `last_posting_sequence` from 6 to 4 even though quantity and amount were correct.

The valuation posting upsert now retains the semantically latest balance metadata using the deterministic tuple:

```text
(effective_at, posting_priority, posting_sequence)
```

Amounts continue to accumulate exactly as before. The correction prevents a later-executed historical valuation from moving authoritative balance metadata backward.

## 5. Local Evidence Chain

The following isolated PostgreSQL 18.6 validations passed:

```text
migrate                                            PASS
validate:docs                                      PASS
typecheck                                          PASS
build                                              PASS
test — 31 files / 84 tests                         PASS
seed:demo                                          PASS
validate:demo                                      PASS
validate:eel-c04-manufacturing-execution-bundle   PASS
validate:eel-c04-full-replay                       PASS
```

CI job added:

```text
eel-c04-full-replay
```

It uses PostgreSQL 18 and an isolated database service.

## 6. Explicitly Not Certified

This candidate does not certify:

- full BOM or multi-level BOM explosion;
- MRP / APS / MES;
- routing or operation scheduling;
- machine/device integration or OEE;
- quality management platform;
- subcontract manufacturing;
- co-product/by-product allocation;
- rework or scrap platform;
- advanced lot/serial traceability;
- capacity optimization;
- statutory General Ledger, Trial Balance, or Financial Statements.

## 7. Finalization Gate

The business and local database evidence are complete. Final `CERTIFIED` status requires:

1. push this branch;
2. open the bounded PR;
3. pass the new `eel-c04-full-replay` CI job and the full required CI matrix;
4. merge to `main`;
5. record the PR, CI run, merge commit, and completed-loop requirement-alignment trigger.


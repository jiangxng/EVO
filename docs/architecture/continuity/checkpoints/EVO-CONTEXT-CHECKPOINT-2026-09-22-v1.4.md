# EVO Context Checkpoint — 2026-09-22 v1.4

**Status: ACTIVE HANDOFF CHECKPOINT**  
**Supersedes as current pointer:** `EVO-CONTEXT-CHECKPOINT-2026-09-22-v1.3.md`  
**Authority scope:** Stage E / EEL-C04 Full Replay and Final Certification

## 1. Current authority

- `main` remains the only authoritative integration branch.
- PR #39 merged C04.2–C04.5 to `main` at `8f58664b697ca785884e1b093f4275f01cf62889`.
- The active provisional branch is `evo/eel-c04-full-replay-final-certification-v0.1`.
- C04.6 Full Replay is locally database-E2E verified.
- C04.7 remains a certification candidate until remote CI succeeds and the branch is merged.

## 2. Local Full Replay result

The isolated PostgreSQL 18.6 scenario proves identical before/after state for:

- canonical production and supply facts;
- explicit purchase/manufacturing relationships;
- raw-material Inventory 80 / 800;
- finished-goods Inventory 50 / 200;
- manufacturing WIP 0;
- pending production 0;
- material-issue FIFO cost 200;
- PRODUCE Work `DONE`;
- full economic-runtime digest.

## 3. Runtime correction

C04.6 exposed and corrected valuation balance metadata regression. A historical valuation executed after later posting rows during Replay can no longer move `last_effective_at`, `last_posting_priority`, or `last_posting_sequence` backward. The upsert retains the maximum semantic ordering tuple while still adding the valuation amount.

## 4. Validation boundary

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

## 5. Immediate next action

Push the active branch, open its PR, wait for the complete CI matrix, and merge only when all required checks pass. After merge, mark EEL-C04 certified/closed and perform the mandatory completed-loop Human–LLM requirement-alignment review before choosing the next Stage E business packet.


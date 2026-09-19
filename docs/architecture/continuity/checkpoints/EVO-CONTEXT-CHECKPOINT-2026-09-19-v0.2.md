# EVO Context Checkpoint — 2026-09-19 v0.2

**Status / 状态：ACTIVE HANDOFF CHECKPOINT**  
**Supersedes for current-state recovery：`EVO-CONTEXT-CHECKPOINT-2026-09-19-v0.1.md`**  
**Historical v0.1 remains preserved.**  
**Branch：`evo/apm-certification-enterprise-template-v0.1`**  
**Snapshot HEAD：`571fb4281e7edcbb7d5fc2626475690995b2a163`**  
**Creation rule：ADDITIVE — DO NOT OVERWRITE**

---

## 1. Current business goal

正在认证：

> 一笔外币销售应收经历期末重估、实际收款和明确来源核销以后，EVO 能否删除可重建的 Allocation / Valuation / Ledger / Balance 等派生状态，仅依靠 canonical business facts、AllocationInstruction、PositionDefinition、固定政策和 RateDataset 完整重建同一经济结果。

Reference result:

- USD receivable: 1000
- original carrying: CNY 7000
- period-end rate: 7.2
- period-end carrying: CNY 7200
- unrealized revaluation delta: +200 CNY
- actual settlement local amount: CNY 7300
- realized settlement delta: +100 CNY

Active packet:

`ER-C05B3.2B — Canonical FX Realized Settlement Full Replay`

Validation level:

`IMPLEMENTED / UNIT VERIFIED PATH / TRUE E2E IN PROGRESS`

---

## 2. True E2E standard

CI must pass all:

```text
migrate
→ typecheck
→ build
→ unit tests
→ seed:demo
→ validate:demo
```

No packet is E2E-certified based only on compile/unit tests.

---

## 3. Defect progression since v0.1 checkpoint

### Defect A — JSONB array PostgreSQL encoding

Real PostgreSQL seed exposed:

`22P02 invalid input syntax for type json`

Cause:

JS arrays passed directly to JSONB columns can be encoded by pg as PostgreSQL array literals.

Affected runtime/store fields fixed:

- position_definition.dimensions
- position_definition.source_rules
- allocation_relation.measurements
- valuation_result.source_business_data_ids
- valuation_result.source_measurements
- valuation_result.target_measurements

Invariant:

`JSON.stringify(array)::jsonb`

at PostgreSQL persistence boundary.

### Defect B — Kysely JsonArray InsertExpression typing

After explicit serialization, typecheck failed because SQL expressions were typed as:

`RawBuilder<JsonValue>`

while database columns are:

`JsonArray = readonly unknown[]`.

Fixed by typing SQL expressions as:

`sql<readonly unknown[]>`

Commits:

- Allocation store: `5cdc2991ce63473e196c260a69ff043df182681d`
- Position store: `82db20c34158d4add27d3c46f1d4026d43971c1a`
- Valuation store: `30d921e8bb7a1267b50191fdbad49bcf885388ef`

Evidence from CI run `35403906545`:

- migrate — PASS
- typecheck — PASS
- build — PASS
- unit tests — PASS
- seed:demo — FAIL
- validate:demo — SKIPPED

This proves the Kysely typing blocker is closed.

### Defect C — direct seed JSONB array writes

Run `35403906545` then exposed another real PostgreSQL boundary:

`allocation_policy.dimensions`

was written directly by `seed-demo.ts` as a JS array.

Also identified:

`command_definition.preconditions`.

Both now use one explicit helper:

```ts
jsonArray(value)
→ JSON.stringify(value)::jsonb
→ sql<readonly unknown[]>
```

Commit:

`571fb4281e7edcbb7d5fc2626475690995b2a163`

---

## 4. Current exact next step

Do not add new architecture concepts.

Wait for / trigger CI against:

`571fb4281e7edcbb7d5fc2626475690995b2a163`

Then:

1. require migrate PASS;
2. require typecheck PASS;
3. require build PASS;
4. require unit tests PASS;
5. inspect seed:demo:
   - if fail, fix only real persistence/reference-semantic defect;
6. once seed passes, inspect validate:demo:
   - period-end delta must be +200;
   - realized settlement delta must be +100;
   - Full Replay must rebuild both canonical valuation requests;
   - dependency graph must be complete;
   - Economic Runtime digest must MATCH;
   - ReplayCoverageCertification must become CERTIFIED.

Do not mark ER-C05B3.2B CLOSED before this proof.

---

## 5. After ER-C05B3.2B

Business next problem:

Full Replay is a correctness oracle but is too expensive for a long-running enterprise after every backdated change.

Next main line:

`Checkpoint Promotion → Impact Closure → Safe Incremental Replay → equivalence with Full Replay`

Business outcome:

historical corrections, policy changes and backdated facts can recalculate only affected history while preserving the exact result of a complete replay.

# ER-C05B3.2B — Canonical FX Full Replay Certification v0.1

**Status: CERTIFIED / CLOSED**  
**Date: 2026-09-19**  
**Certified code head: `571fb4281e7edcbb7d5fc2626475690995b2a163`**  
**GitHub Actions run: `35404108068`**  
**Validation: TRUE E2E — PostgreSQL 18 + seed:demo + validate:demo**

---

## 1. Business problem

企业已经发生外币销售以后，系统可能经历：

- 外币应收形成；
- 期末汇率变化；
- 未实现汇兑重估；
- 客户实际付款；
- 明确核销某一笔应收；
- 已实现汇兑损益；
- 成本、账本、工作项等后续派生。

企业长期运行时，规则、算法、系统版本或派生数据库都可能变化。

EVO 必须证明：

> 派生结果不是唯一真相。只要原始业务事实、明确业务意图以及当时固定的规则/政策/参考数据仍然存在，就可以重新解释并重建相同的经济结果。

---

## 2. Reference business scenario

Canonical receivable:

- foreign quantity: USD 1000
- original local carrying value: CNY 7000

Period-end valuation:

- pinned period-end rate: 7.2 CNY/USD
- rebuilt carrying value: CNY 7200
- period-end valuation delta: **+200 CNY**

Settlement:

- actual local settlement amount: CNY 7300
- explicit AllocationInstruction selects the source receivable
- realized FX delta: **+100 CNY**

---

## 3. Canonical replay inputs

Full Replay does not re-execute Commands and does not consume old derived valuation rows as truth.

Replay inputs include:

- canonical BusinessData;
- canonical `valuation.requested` facts;
- canonical AllocationInstruction;
- pinned PositionDefinition id/version/digest;
- pinned AllocationPolicy id/version;
- pinned ValuationPolicy / ValuationRule where required;
- pinned RateDataset id/version/digest;
- deterministic posting order.

Derived state may be deleted and rebuilt.

---

## 4. Certified reconstruction

The E2E reference enterprise proved reconstruction of:

- Posting Projection;
- Allocation;
- Cost Valuation;
- FX Period-End Valuation;
- FX Realized Settlement;
- Work Projection;
- Ledger/materialized runtime state.

Dependency producer-family evidence:

| Family | Observed count |
|---|---:|
| POSTING_PROJECTION | 7 |
| ALLOCATION | 2 |
| COST_VALUATION | 3 |
| FX_PERIOD_END | 1 |
| FX_REALIZED_SETTLEMENT | 1 |
| WORK_PROJECTION | 3 |

---

## 5. Replay equivalence evidence

Validation output:

```text
status: PASS
replayDeterministic: true

beforeDigest:
efb0e84b54a6aa23fb58a603b99bc97559e995183b34b10a9e5a6349411f7061

afterDigest:
efb0e84b54a6aa23fb58a603b99bc97559e995183b34b10a9e5a6349411f7061
```

Therefore:

`beforeDigest == afterDigest`

under the same canonical facts and pinned semantics.

---

## 6. Replay Coverage Certification

Machine result:

```text
status = CERTIFIED

materializationDigestComplete = true
templateBindingComplete = true
referenceDatasetPinsComplete = true
dependencyGraphComplete = true
derivedRuntimeReplayComplete = true

blockers = []
```

This closes the coverage proof for the current reference scenario.

---

## 7. True E2E pipeline

GitHub Actions run `35404108068` passed:

```text
migrate        PASS
typecheck      PASS
build          PASS
unit tests     PASS
seed:demo      PASS
validate:demo  PASS
```

This is the first accepted end-to-end certification after correcting the CI evidence scope.

---

## 8. Important governance boundary

The source ReplayCheckpoint still reports:

`safeForIncremental = false`

This is intentional.

Coverage certification proves that the required evidence is complete.

It does **not** automatically mutate a previously conservative checkpoint into an incremental-replay authority.

The next work packet must create an explicit, auditable promotion process.

---

## 9. Business capability now proven

EVO has now proven, for the certified reference scenario:

> 外币应收从形成、期末重估、收款核销到已实现汇兑损益，其 Allocation / Cost / Valuation / Projection / Materialization 派生状态可以被删除，并从 canonical business history + explicit business intent + pinned semantics 确定性重建。

This is a foundational proof for:

- historical recalculation;
- accounting reposting;
- cost recalculation;
- FX historical revaluation;
- backdated corrections;
- system/model upgrades;
- disaster recovery of derived state;
- explainable audit.

---

## 10. Next packet

`ER-C05B4 — Certified Checkpoint Promotion & Safe Incremental Replay Gate`

Business question:

> Full Replay can prove correctness, but can EVO safely promote a certified historical boundary so future backdated changes only recompute the affected suffix while remaining equivalent to Full Replay?

Promotion must be explicit, reversible/auditable, and must not rely on a manually set boolean.

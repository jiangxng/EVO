# EVO 当前阶段数据库设计（中英双语）v0.4
# EVO Current Database Design (Bilingual) v0.4

**状态 / Status：CURRENT-STAGE ADDITIVE SCHEMA DELTA SNAPSHOT**  
**日期 / Date：2026-09-19**  
**DB Schema Version：15**  
**基线 / Base：v0.3 (Schema v14)**

---

## 1. 当前精确统计 / Current Exact Count

```text
Schema v14: 61 tables / 651 fields
Schema v15: 62 tables / 667 fields

Delta:
+1 table
+16 fields
```

新增表 / New table:

`economic_runtime_dataset`

---

## 2. 为什么需要 Economic Runtime Dataset

中文：

Incremental Replay 不能直接在当前正式派生状态上修改一半、保留一半。否则 CostRun、AllocationRun、ValuationRun 等完整运行审计可能被破坏。

因此引入“派生状态世代”：

- 当前正式世代 CURRENT/ACTIVE；
- 新的局部重算先写入 CANDIDATE/BUILDING；
- 验证通过后变 VERIFIED；
- 只有 VERIFIED 才能原子切换成新的 CURRENT/ACTIVE；
- 旧正式世代归档为 ARCHIVED。

English:

Incremental Replay must not partially mutate the currently authoritative derived state. EconomicRuntimeDataset introduces an isolated materialization generation so candidate interpretations can be built and verified before atomic activation.

---

## 3. `economic_runtime_dataset`

**语义角色 / Semantic Role：DERIVED MATERIALIZATION GENERATION / GOVERNED RUNTIME DATASET**

| # | 字段 / Field | 类型 / Type | 中文说明 | English Description |
|---:|---|---|---|---|
| 1 | `id` | UUID | Runtime Dataset 主键。 | Primary key of the runtime materialization generation. |
| 2 | `enterprise_id` | UUID | 所属企业 ID。 | Owning enterprise ID. |
| 3 | `consistency_domain` | TEXT | 一致性域；当前通常为 enterprise。 | Consistency domain, currently usually enterprise. |
| 4 | `kind` | TEXT enum | 世代用途：CURRENT、CANDIDATE、ARCHIVED。 | Generation purpose: CURRENT, CANDIDATE, or ARCHIVED. |
| 5 | `status` | TEXT enum | 生命周期状态：BUILDING、ACTIVE、VERIFIED、FAILED、ARCHIVED。 | Lifecycle status: BUILDING, ACTIVE, VERIFIED, FAILED, or ARCHIVED. |
| 6 | `parent_dataset_id` | UUID nullable | Candidate 来源的上一代 ACTIVE Dataset。 | Parent ACTIVE dataset from which a candidate derives. |
| 7 | `source_checkpoint_id` | UUID nullable | Candidate 所依据的 ReplayCheckpoint。 | ReplayCheckpoint used as candidate starting authority. |
| 8 | `source_promotion_id` | UUID nullable | 允许该 Checkpoint 用于 Incremental Replay 的 Promotion。 | Promotion authorizing use of the checkpoint for incremental replay. |
| 9 | `incremental_plan_digest` | CHAR(64) nullable | IncrementalReplayPlan 的确定性摘要。 | Deterministic digest of the IncrementalReplayPlan. |
| 10 | `start_sequence` | BIGINT nullable | Candidate 计划开始重算的 posting sequence。 | Posting sequence at which candidate recomputation starts. |
| 11 | `boundary_sequence` | BIGINT nullable | Candidate 计划覆盖到的最大 posting sequence。 | Maximum posting sequence covered by the candidate plan. |
| 12 | `semantic_digest` | CHAR(64) nullable | Candidate 验证后的派生经济状态摘要。 | Semantic digest of the verified derived economic state. |
| 13 | `failure_reason` | TEXT nullable | Candidate 构建/验证失败原因。 | Reason why candidate construction or verification failed. |
| 14 | `verified_at` | TIMESTAMPTZ nullable | Candidate 被验证通过的时间。 | Time when the candidate became VERIFIED. |
| 15 | `activated_at` | TIMESTAMPTZ nullable | Dataset 成为正式 ACTIVE 的时间。 | Time when the dataset became authoritative ACTIVE state. |
| 16 | `created_at` | TIMESTAMPTZ | Dataset 创建时间。 | Dataset creation timestamp. |

---

## 4. 生命周期 / Lifecycle

```text
CURRENT / ACTIVE
        ↓ historical impact
CANDIDATE / BUILDING
        ↓ verification
CANDIDATE / VERIFIED
        ↓ atomic activation
CURRENT / ACTIVE
        +
old CURRENT → ARCHIVED
```

失败 Candidate：

`CANDIDATE / FAILED`

不得替换当前正式状态。

---

## 5. 当前证明等级 / Current Evidence Level

True E2E:

`run 35405169593 — SUCCESS`

已经证明：

- ACTIVE parent 创建；
- Candidate 建立；
- Promotion/Checkpoint/Plan provenance 绑定；
- BUILDING → VERIFIED；
- VERIFIED → CURRENT/ACTIVE；
- previous CURRENT → ARCHIVED；
- 原子生命周期切换。

尚未证明：

- 所有 derived rows 已按 dataset 隔离；
- Checkpoint prefix state restore；
- suffix-only recomputation；
- candidate digest == Full Replay oracle digest。

---

## 6. 版本谱系 / Genealogy

```text
v0.1 Chinese full snapshot
 → v0.2 bilingual full snapshot
 → v0.3 Schema v14 delta: replay_checkpoint_promotion
 → v0.4 Schema v15 delta: economic_runtime_dataset
```

所有旧版本保留，不覆盖。

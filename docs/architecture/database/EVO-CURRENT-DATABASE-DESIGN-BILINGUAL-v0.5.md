# EVO 当前阶段数据库设计（中英双语）v0.5
# EVO Current Database Design (Bilingual) v0.5

**状态 / Status：CURRENT-STAGE ADDITIVE SCHEMA DELTA SNAPSHOT**  
**日期 / Date：2026-09-20**  
**DB Schema Version：22**  
**基线 / Base：v0.4 + Schema v16–v21 migrations**

---

## 1. 本次精确增量 / Exact Delta in This Version

```text
Schema v21 → Schema v22

+1 table
+21 fields
```

新增表 / New table:

`runtime_equivalence_certification`

相关既有表语义变化 / Related existing-table semantic change:

- `economic_runtime_dataset.kind` 在 Schema v21 已加入 `ORACLE`；
- `economic_runtime_dataset.oracle_of_dataset_id` 在 Schema v21 已加入；
- Schema v22 不再允许普通 Candidate 通过通用接口直接 VERIFIED/ACTIVE；
- Candidate 激活必须消费精确的 Candidate↔Oracle 等价认证。

本文件是追加式 delta，不覆盖历史数据库快照。Schema v16–v21 的完整汇总将在下一次全量数据库目录刷新中单独生成。

---

## 2. 为什么需要等价认证表 / Why This Table Exists

中文：

“Candidate 摘要刚好等于 Oracle 摘要”不能只存在于日志或某次函数调用中。生产切换必须保存一份不可变证据，明确绑定：

- 哪个 Candidate；
- 哪个独立 Full Replay Oracle；
- 哪个旧 CURRENT parent；
- 哪个 Checkpoint 与 Promotion；
- 哪个 Incremental Plan；
- 哪个历史边界；
- 两侧完整经济语义摘要；
- 谁以什么原因认证；
- 是否因错配而拒绝。

English:

Digest equality cannot remain an ephemeral log assertion. Production activation needs immutable evidence binding the exact Candidate, isolated Full Replay Oracle, active parent, checkpoint governance, incremental plan, boundary, semantic digests, certifier, reason, and fail-closed result.

---

## 3. `runtime_equivalence_certification`

**语义角色 / Semantic Role：IMMUTABLE CANDIDATE↔ORACLE EQUIVALENCE EVIDENCE AND ACTIVATION AUTHORITY**

| # | 字段 / Field | 类型 / Type | 中文说明 | English Description |
|---:|---|---|---|---|
| 1 | `id` | UUID | 等价认证主键。 | Primary key of the equivalence certification. |
| 2 | `enterprise_id` | UUID | 认证所属企业。 | Enterprise governed by the certification. |
| 3 | `consistency_domain` | TEXT | Candidate、Oracle 与 CURRENT 所属一致性域。 | Consistency domain shared by Candidate, Oracle, and CURRENT. |
| 4 | `candidate_dataset_id` | UUID | 被认证并可能激活的精确 Candidate。每个 Candidate 只能有一份最终认证。 | Exact Candidate being certified and potentially activated; unique per Candidate. |
| 5 | `oracle_dataset_id` | UUID | 与 Candidate 对照的精确隔离 Full Replay Oracle。每个 Oracle 只能用于一份最终认证。 | Exact isolated Full Replay Oracle; unique per Oracle. |
| 6 | `parent_dataset_id` | UUID | 认证时重新锁定并核验的旧 CURRENT Dataset。 | Previous CURRENT dataset locked and revalidated during certification. |
| 7 | `source_checkpoint_id` | UUID | Candidate 使用的 ReplayCheckpoint。 | ReplayCheckpoint used by the Candidate. |
| 8 | `source_promotion_id` | UUID | 授权该 Checkpoint 用于增量重算的有效 Promotion。 | Active Promotion authorizing incremental use of the checkpoint. |
| 9 | `incremental_plan_digest` | CHAR(64) | Candidate 与 Oracle 共同绑定的确定性增量计划摘要。 | Deterministic incremental-plan digest shared by the certified scope. |
| 10 | `boundary_sequence` | BIGINT | Candidate 与 Oracle 共同覆盖的历史边界。 | Common canonical-history boundary covered by both generations. |
| 11 | `candidate_semantic_digest` | CHAR(64) | 认证事务前重新计算的 Candidate 完整经济语义摘要。 | Recomputed complete Candidate economic semantic digest. |
| 12 | `oracle_semantic_digest` | CHAR(64) | 认证事务前重新计算的 Oracle 完整经济语义摘要。 | Recomputed complete Oracle economic semantic digest. |
| 13 | `status` | TEXT enum | `CERTIFIED` 或 `REJECTED`。 | Final outcome: `CERTIFIED` or `REJECTED`. |
| 14 | `blockers` | JSONB array | 拒绝原因代码；CERTIFIED 时必须为空。 | Fail-closed blocker codes; must be empty for CERTIFIED. |
| 15 | `evidence` | JSONB object | family counts、精确摘要比较、parent 复核等机器证据。 | Machine evidence such as family counts, exact digest match, and parent revalidation. |
| 16 | `certification_digest` | CHAR(64) | 认证语义本身的确定性 SHA-256 摘要。 | Deterministic SHA-256 digest of the certification semantics. |
| 17 | `certified_by` | TEXT | 执行认证的人员、服务或治理主体。 | Human, service, or governance actor performing certification. |
| 18 | `reason` | TEXT | 本次认证与激活的业务/治理原因。 | Business or governance reason for certification and activation. |
| 19 | `certified_at` | TIMESTAMPTZ | 最终认证发生时间。 | Time when the final certification was recorded. |
| 20 | `activated_at` | TIMESTAMPTZ nullable | CERTIFIED Candidate 原子成为 CURRENT 的时间；REJECTED 必须为空。 | Atomic Candidate activation time; null for REJECTED records. |
| 21 | `created_at` | TIMESTAMPTZ | 记录创建时间。 | Record creation timestamp. |

---

## 4. 数据库约束 / Database Constraints

```text
CERTIFIED
→ candidate_semantic_digest = oracle_semantic_digest
→ blockers = []
→ activated_at IS NOT NULL

REJECTED
→ blockers is non-empty
→ activated_at IS NULL
```

并且：

- `candidate_dataset_id` unique；
- `oracle_dataset_id` unique；
- `certification_digest` unique；
- Candidate / Oracle / parent / checkpoint / promotion 全部使用外键。

These constraints prevent a successful activation record from existing without exact equality and prevent one generation from being silently reused across multiple final certifications.

---

## 5. 激活事务边界 / Atomic Activation Boundary

认证成功时同一数据库事务执行：

```text
recompute Candidate + Oracle digests
→ lock Candidate / Oracle / active parent
→ revalidate scope and governance
→ insert immutable CERTIFIED evidence
→ Candidate VERIFIED
→ certified suffix PostingInput POSTED
→ posting cursor advances to certified boundary
→ old active LedgerDataset ARCHIVED
→ Candidate LedgerDataset CURRENT / ACTIVE
→ old EconomicRuntimeDataset ARCHIVED
→ Candidate EconomicRuntimeDataset CURRENT / ACTIVE
```

任一条件失败：

```text
REJECTED evidence
→ Candidate FAILED/non-activatable
→ old CURRENT remains ACTIVE
```

---

## 6. 版本谱系 / Genealogy

```text
v0.1 Chinese full snapshot
 → v0.2 bilingual full snapshot
 → v0.3 Schema v14 delta: replay_checkpoint_promotion
 → v0.4 Schema v15 delta: economic_runtime_dataset
 → v0.5 Schema v22 delta: runtime_equivalence_certification
```

所有旧版本保留，不覆盖。/ All historical snapshots remain preserved.

# EVO 当前阶段数据库设计（中英双语）v0.3
# EVO Current Database Design (Bilingual) v0.3

**状态 / Status：CURRENT-STAGE ADDITIVE SCHEMA DELTA SNAPSHOT**  
**日期 / Date：2026-09-19**  
**DB Schema Version：14**  
**基线 / Base snapshot：`EVO-CURRENT-DATABASE-DESIGN-BILINGUAL-v0.2.md`**

---

## 0. 版本关系 / Version Relationship

本文档**不覆盖** v0.2。

This document does **not overwrite** v0.2.

```text
v0.1 — Chinese full snapshot
   ↓ additive
v0.2 — Chinese-English full snapshot
   ↓ additive
v0.3 — Schema v14 delta snapshot
```

v0.2 记录：

- 60 tables
- 635 fields
- DB schema version 13

v0.3 当前精确统计：

- **61 tables / 61 张表**
- **651 fields / 651 个字段**
- **DB schema version 14**

本阶段新增：

- 1 table
- 16 fields

---

# 1. 为什么增加这张表 / Why This Table Was Added

新增表：

`replay_checkpoint_promotion`

业务问题：

Full Replay 正确、Coverage Certification 完整，并不自动意味着一个 Checkpoint 应该立即被生产系统用于 Incremental Replay。

企业需要显式区分：

```text
技术证明完整
        ≠
已经批准用于生产局部重算
```

因此新增独立治理记录：

```text
ReplayCheckpoint
safeForIncremental=false
        ↓
ReplayCoverageCertification
CERTIFIED
        ↓
ReplayCheckpointPromotion
ACTIVE
        ↓
Incremental Planner 才允许使用
```

English:

A technically valid Full Replay checkpoint is not automatically authorized for production incremental replay. The new promotion entity separates machine evidence from operational authorization and provides explicit audit/revocation semantics.

---

# 2. 新增表 / New Table

## `replay_checkpoint_promotion`

**中文说明：**

Replay Checkpoint 的显式治理批准记录。它不会修改原始 Checkpoint 的创建时事实，而是记录：哪一份 Coverage Certification 被用于批准哪个 Checkpoint 进入 Incremental Replay 候选范围、由谁批准、为什么批准、证据是什么，以及批准是否已经撤销。

**English Description:**

Explicit governance authorization for a ReplayCheckpoint. It does not mutate the checkpoint's original validity snapshot. Instead, it records which certified coverage evidence authorized the checkpoint for incremental-replay planning, who approved it, why it was approved, the exact evidence/digest, and whether the authorization was later revoked.

**语义角色 / Semantic Role：GOVERNANCE / CANONICAL AUDIT DECISION**

**字段数 / Field Count：16**

| # | 字段 / Field | 当前类型 / Current Type | 中文说明 | English Description |
|---:|---|---|---|---|
| 1 | `id` | UUID | Promotion 记录主键。 | Primary key of the checkpoint-promotion record. |
| 2 | `enterprise_id` | UUID | 所属企业 ID，保证 Promotion 不能跨企业授权。 | Owning enterprise ID; prevents cross-enterprise checkpoint authorization. |
| 3 | `checkpoint_id` | UUID | 被批准用于 Incremental Replay planning 的 ReplayCheckpoint ID。 | ReplayCheckpoint being authorized for incremental-replay planning. |
| 4 | `certification_id` | UUID | 支撑本次 Promotion 的 ReplayCoverageCertification ID。 | ReplayCoverageCertification that provides the machine evidence for this promotion. |
| 5 | `certification_version` | INTEGER | Promotion 固定使用的 Certification 版本。 | Exact certification version pinned by this promotion. |
| 6 | `certification_semantic_digest` | CHAR(64) | Certification 内容的语义摘要，防止认证内容后来发生漂移。 | Semantic digest of the certification, preventing later evidence drift. |
| 7 | `status` | TEXT enum | Promotion 状态：ACTIVE 或 REVOKED。只有 ACTIVE 才能让 Planner 使用该 Checkpoint。 | Promotion status: ACTIVE or REVOKED. Only ACTIVE promotions make a checkpoint eligible for the planner. |
| 8 | `promoted_by` | TEXT | 执行批准的主体/治理身份。 | Actor/governance identity that approved the checkpoint. |
| 9 | `reason` | TEXT | 为什么允许该 Checkpoint 用于 Incremental Replay 的明确理由。 | Explicit reason for authorizing this checkpoint for incremental replay. |
| 10 | `evidence` | JSONB | Promotion 时重新核验并固化的证据，包括输入摘要、模板版本、运行时语义版本、认证信息等。 | Evidence revalidated and frozen at promotion time, including input digest, template binding, runtime semantics, and certification data. |
| 11 | `promotion_digest` | CHAR(64) | Promotion 全部关键语义输入的确定性摘要，用于审计和漂移检测。 | Deterministic digest of the promotion's semantic inputs for audit and drift detection. |
| 12 | `promoted_at` | TIMESTAMPTZ | Promotion 正式生效时间。 | Time when the promotion became active. |
| 13 | `revoked_at` | TIMESTAMPTZ, nullable | Promotion 被撤销的时间；未撤销时为空。 | Time when the promotion was revoked; null while active. |
| 14 | `revoked_by` | TEXT, nullable | 执行撤销的主体/治理身份。 | Actor/governance identity that revoked the promotion. |
| 15 | `revoke_reason` | TEXT, nullable | 撤销该 Promotion 的原因。 | Reason for revoking the promotion. |
| 16 | `created_at` | TIMESTAMPTZ | 数据库记录创建时间。 | Database record creation timestamp. |

---

# 3. 当前关键约束 / Current Key Constraints

当前 Schema 约束：

- 一个 Checkpoint 同时最多只能存在一条 `ACTIVE` Promotion；
- Promotion 必须绑定实际存在的 Checkpoint；
- Promotion 必须绑定实际存在的 ReplayCoverageCertification；
- Certification version 必须为正整数；
- status 只能是 ACTIVE / REVOKED；
- Promotion Service 会在写入前重新核验 canonical input digest、EnterpriseTemplate、runtime semantic version、dependency graph version 和 Certification coverage。

数据库唯一索引：

`ux_replay_checkpoint_promotion_active`

业务语义：

> 同一个历史 Checkpoint 不能同时拥有两个互相竞争的生产授权。

---

# 4. 对现有表语义的影响 / Impact on Existing Table Semantics

## replay_checkpoint

没有修改原始语义。

No original checkpoint semantics were mutated.

Checkpoint 创建时仍然：

`validity.safeForIncremental = false`

这代表：

> Checkpoint 自身只证明“它来自一次验证通过的 Full Replay”，不证明“已经获得增量重放授权”。

## replay_coverage_certification

继续承担：

> 机器证据是否完整。

它不直接授予生产 incremental authority。

## incremental replay planner

Planner 不再把普通 ACTIVE checkpoint 当作安全点。

它只接受：

`ACTIVE checkpoint + ACTIVE replay_checkpoint_promotion`

读取层会把这种组合解释成：

`safeForIncremental = true`

原 checkpoint row 本身保持不变。

---

# 5. 当前数据库统计 / Current Database Count

```text
Database                  PostgreSQL
DB Schema Version          14
Tables                     61
Fields                     651
New tables since v0.2      1
New fields since v0.2      16
```

权威来源 / Authoritative sources:

- `platform/database/src/types.ts`
- `migrations/schema/202609180070_replay_checkpoint_promotion.sql`
- previous bilingual snapshot v0.2

---

# 6. 后续维护规则 / Future Maintenance

后续新增表/字段继续使用新增版本，不覆盖本文件。

Future table/field changes must create new additive documentation versions rather than overwriting this snapshot.

如果未来变化较小，可以继续使用 delta snapshot。

If changes are small, a delta snapshot is acceptable.

当累计变化较大时，应创建新的完整 bilingual full snapshot，并明确它继承哪些历史版本。

When accumulated changes become substantial, generate a new complete bilingual full snapshot and explicitly preserve its genealogy.

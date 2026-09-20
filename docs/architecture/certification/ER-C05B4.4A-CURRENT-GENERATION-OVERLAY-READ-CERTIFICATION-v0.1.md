# ER-C05B4.4A — Current Generation-Overlay Read Certification v0.1

**Status: CERTIFIED / CLOSED FOR REFERENCE FIFO SCENARIO**  
**Date: 2026-09-20**  
**Certified implementation head: `6fa8abde08b26d1096b2ab89be23425a795f7604`**  
**GitHub Actions run: `35479404204`**  
**DB Schema Version: 22 (unchanged)**

---

## 1. 业务问题 / Business Problem

B4.3B 已证明 Candidate 可以安全、原子地成为新的 CURRENT，但新 CURRENT 的物理存储不是完整历史复制：

- parent 保存已认证历史前缀；
- activated generation 保存从 Checkpoint 恢复的当前余额与重算 suffix；
- 新 Ledger dataset 不重复复制旧历史分录。

因此，只查询 active Ledger dataset 会遗漏历史前缀；不按 generation 过滤又会把 Archived、Candidate 与 Oracle 混入正式查询。

本认证回答：

> 激活后的 CURRENT 能否沿已认证 parent 链组合出完整经济历史，并且得到与激活前 Candidate/Oracle 完全相同的归一化语义？

---

## 2. 读取模型 / Read Model

新增：

`PostgresCurrentEconomicRuntimeViewService`

读取在 PostgreSQL `REPEATABLE READ` 事务中完成，并先锁定唯一 `CURRENT / ACTIVE` generation。

### 历史型 family

按 parent → child generation chain 以及各自 sequence interval 组合：

- LedgerEntry；
- CostResult；
- AllocationRelation；
- ValuationPosition；
- ValuationResult。

### 当前快照型 family

只从 active leaf generation 读取：

- LedgerBalance；
- WorkItem。

这样既保留完整审计历史，也避免把旧余额或旧待办重复叠加到当前状态。

---

## 3. 失败关闭条件 / Fail-Closed Conditions

任何以下情况都会拒绝形成正式 CURRENT 视图：

- 没有唯一 `CURRENT / ACTIVE` generation；
- parent chain 存在循环；
- parent 跨 enterprise 或 consistency domain；
- active generation 缺少 boundary 或 semantic digest；
- parent 不是 `ARCHIVED / ARCHIVED`；
- generation sequence interval 非法或不连续；
- 任意 parent → child 切换缺少 `CERTIFIED` 激活证据；
- 认证记录绑定的 parent 不匹配；
- certification digest 与 child 保存的 semantic digest 不匹配；
- 组合后的完整语义摘要与激活时认证摘要不相等。

服务不会在不完整或不可信时返回“部分结果”。

---

## 4. 真实 PostgreSQL 18 E2E / True Database Evidence

GitHub Actions run `35479404204`：

```text
migrate        PASS — Schema 22
typecheck      PASS
build          PASS
unit tests     PASS — 31 files / 83 tests
seed:demo      PASS
validate:demo  PASS
```

本次运行形成两代正式读取链：

```text
ARCHIVED parent
→ CURRENT / ACTIVE activated Candidate
```

三个独立阶段得到同一摘要：

```text
Incremental Candidate digest
= Full-Replay Oracle digest
= activated CURRENT overlay digest
= 3d39e82014a071558293e96dbe5e38e02689b9d8dc23955242aab98761eed291
```

完整 family counts 也完全相同：

```text
ledgerEntries       = 13
ledgerBalances      = 5
costResults         = 2
allocationRelations = 3
valuationPositions  = 2
valuationResults    = 2
workItems           = 3
```

业务状态同时保持：

```text
activated pending_shipment = 7
activated suffix PostingInput = POSTED
FX period-end delta = +200
FX realized settlement delta = +100
```

---

## 5. 业务意义 / Business Meaning

EVO 现在已证明：局部重算上线后，企业看到的不只是正确的“当前余额”，还可以从不同物理世代中恢复一条完整、可审计、与全量重算等价的正式经济历史。

这避免两类严重问题：

1. 只看新世代而丢失旧订单、旧成本和旧分录；
2. 查询所有数据而把 Oracle、失败 Candidate 或 Archived 状态重复计算。

---

## 6. 当前证明边界 / Current Proof Boundary

本认证关闭的是参考 FIFO 场景中的第一条激活链和统一归一化读取。

尚未关闭：

- Dashboard、LedgerReader 等所有外部读入口统一路由到该模型；
- 两次及以上连续增量激活的真实数据库 E2E；
- LIFO、Moving Average、Specific Identification；
- semantic mismatch / stale parent / revoked governance 的数据库失败矩阵；
- activation 与 Worker 并发；
- crash、retry、idempotency 与恢复。

因此 B4.4 整体仍为进行中，本文件只认证 `B4.4A`。

---

## 7. 下一工作包 / Next Packet

`ER-C05B4.4B — Read Routing & Activation Failure Matrix`

下一步先把 Dashboard、Ledger、Work 等默认正式读取统一接入 CURRENT overlay，再做 mismatch、stale governance、重复请求与并发激活的 PostgreSQL 安全矩阵。

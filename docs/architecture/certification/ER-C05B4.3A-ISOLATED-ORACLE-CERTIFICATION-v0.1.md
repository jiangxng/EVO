# ER-C05B4.3A — Isolated Full Replay Oracle Certification v0.1

**Status: CERTIFIED / CLOSED FOR ISOLATED ORACLE GENERATION**  
**Date: 2026-09-20**  
**Certified implementation head: `2caf3433bc539646cfde9ff4a700e7390cee3162`**  
**GitHub Actions run: `35431321738`**  
**DB Schema Version: 21**

---

## 1. 业务问题 / Business Problem

B4.2C 已证明局部重算 Candidate 可以与完整 Full Replay 得到相同经济状态，但当时的 Full Replay Oracle 会破坏 Candidate 和 CURRENT 派生状态。

企业不能为了验证一份候选账而先破坏当前生产账，也不能在验证结束前丢失待激活的 Candidate。

本认证回答：

> EVO 能否在 CURRENT 和增量 Candidate 都保持原状的情况下，建立一份独立 Full Replay Oracle，并用完整经济语义摘要证明 Candidate 与 Oracle 等价？

---

## 2. 已实现的隔离拓扑 / Isolated Topology

```text
CURRENT / ACTIVE
      ├─ CANDIDATE / BUILDING
      │    └─ 从已提升 Checkpoint 恢复前缀，只重算 suffix
      └─ ORACLE / BUILDING
           └─ 从序列 1 对同一更新后历史执行完整重放

Candidate digest == Oracle digest
      ↓
ORACLE / VERIFIED
Candidate 仍为 BUILDING
CURRENT 仍为 ACTIVE
```

新增 `ORACLE` EconomicRuntimeDataset 与 `ORACLE` materialization context。Posting、Ledger、Cost、Allocation、Valuation、Work 和 Dependency 派生写入均按 runtime generation 隔离。

---

## 3. 认证场景 / Certified Scenario

沿用 B4.2C 的 FIFO 参考场景：

```text
Checkpoint boundary = 6
Checkpoint FIFO prefix = 8 units @ CNY 10
New canonical shipment = 1 unit
Target boundary = 7
```

Candidate 路径只重算序列 7；Oracle 路径在独立 generation 中完整重放序列 1–7。

归一化经济语义摘要保持：

```text
candidateDigest =
eda48c2c2b7a264babf0b975b850bda2f2060ee91ff932d61f0141126b144dbf

isolatedOracleDigest =
eda48c2c2b7a264babf0b975b850bda2f2060ee91ff932d61f0141126b144dbf

incrementalEqualsFullReplay = true
```

---

## 4. 不破坏性证据 / Non-Destructive Evidence

E2E 同时验证：

```text
isolatedOracleStatus = VERIFIED
isolatedOraclePostingInputCount = 7
isolatedOracleCostResultCount = 2
isolatedOracle valuation request count = 2
isolatedOracle Work materialization rebuilt = true

candidateStillIntact = true
Candidate status = BUILDING
Candidate derived Cost state still exists = true

CURRENT suffix PostingInput status = QUEUED
CURRENT pending_shipment quantity = 8
Candidate pending_shipment quantity = 7
```

Oracle 中还重新生成并验证：

- 期末未实现汇兑差额 `+200`；
- 结算已实现汇兑差额 `+100`。

因此隔离 Oracle 覆盖的不只是库存成本，而是完整参考经济运行时语义。

---

## 5. CI 证据 / CI Evidence

GitHub Actions run `35431321738`：

```text
migrate        PASS
typecheck      PASS
build          PASS
unit tests     PASS — 30 files / 79 tests
seed:demo      PASS
validate:demo  PASS
```

本地复核：

```text
typecheck  PASS
build      PASS
unit tests PASS — 30 files / 79 tests
```

本地运行环境没有 Docker/PostgreSQL，因此数据库 E2E 以同一提交的 GitHub Actions PostgreSQL 18 运行作为权威证据。

---

## 6. 当前明确没有证明什么 / Explicit Non-Claims

B4.3A 没有关闭生产激活。

当前通用接口仍允许调用方分别执行：

```text
markVerified(candidateId, digest)
activateVerified(candidateId)
```

它尚未强制要求：

- Candidate 必须绑定一份 VERIFIED Oracle；
- Candidate digest 必须与 Oracle digest 完全一致；
- Oracle 必须指向该 Candidate；
- Candidate 与 Oracle 必须拥有相同 parent、boundary、plan 和治理来源；
- mismatch 必须 fail closed；
- 激活必须消费不可变等价认证证据。

因此不能宣称“任意 Candidate 已可安全生产激活”。

---

## 7. 下一工作包 / Next Packet

`ER-C05B4.3B — Governed Candidate Equivalence Certification & Atomic Activation`

成功条件：

```text
Candidate complete digest
        ==
bound VERIFIED Oracle digest
        ↓
immutable equivalence certification
        ↓
exact Candidate → VERIFIED
        ↓
atomic Candidate → CURRENT / ACTIVE
old CURRENT → ARCHIVED
```

任何 digest、parent、boundary、plan、promotion 或状态不一致：

```text
Candidate → FAILED or remains non-activatable
CURRENT remains ACTIVE
```

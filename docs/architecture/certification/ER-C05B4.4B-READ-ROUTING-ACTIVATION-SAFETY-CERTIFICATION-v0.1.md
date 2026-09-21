# ER-C05B4.4B — Read Routing & Activation Failure Matrix Certification v0.1

**Status: CERTIFIED / CLOSED FOR REFERENCE FIFO ECONOMIC-RUNTIME SCENARIO**  
**Date: 2026-09-22**  
**Certified implementation head: `d3dab3ed7a1d4b2a285d9564ac03f058555bfd64`**  
**GitHub Actions run: `35659612160 — SUCCESS`**  
**PostgreSQL: 18**  
**DB Schema Version: 22 (unchanged)**  
**Depends on: ER-C05B4.4A, ER-C05B4.3B and earlier certified Replay/Activation packets**

---

## 1. 业务问题 / Business Problem

B4.4A 已证明一个已激活增量 generation 可以和 parent 历史组合成完整正式经济视图。
B4.4B 要回答更接近长期生产运行的问题：

> 当 EVO 连续运行、继续发生业务、继续生成新 Candidate，并遇到错误治理证据、重复请求、Worker 并发和事务中断时，系统是否仍然只保留一个可信 CURRENT，并让所有正式读取看到同一条可解释经济历史？

这不是“算法算对一次”的问题，而是正式状态能否长期安全演进的问题。

---

## 2. 本认证关闭的能力边界 / Certified Boundary

参考 FIFO 场景中，以下能力已由真实 PostgreSQL 18 E2E 证明：

### 2.1 正式读取统一服从 CURRENT

- Dashboard 正式余额、Work、Cost 在 generation 生命周期启用后走 CURRENT overlay；
- LedgerReader 精确解析 CURRENT/ACTIVE generation 的 LedgerDataset；
- WorkProjection 默认读取和 refresh 绑定 CURRENT generation；
- generation 尚未存在时允许明确 baseline；
- generation 一旦存在，不允许正式读取偷偷回退旧 baseline。

### 2.2 连续多代 governed activation

已验证：

```text
Baseline
  ↓
Generation 1
  ↓
Generation 2
```

第二代 Candidate 以前一代 CURRENT 为 parent，执行隔离增量重算和独立 Full-Replay Oracle 对照，然后原子激活。

第二代参考场景满足：

```text
Candidate 2 semantic digest
= Full-Replay Oracle 2 semantic digest
= activated CURRENT overlay semantic digest
```

并且正式 Dashboard / Ledger / Work 均得到一致的 `pending_shipment = 6`。

### 2.3 Activation failure matrix

数据库级 fail-closed 已覆盖：

- duplicate activation retry → 同一 certification，幂等；
- semantic digest mismatch → `SEMANTIC_DIGEST_MISMATCH`；
- stale active parent → `STALE_ACTIVE_PARENT`；
- revoked promotion → `PROMOTION_NOT_ACTIVE`；
- invalidated checkpoint → `CHECKPOINT_NOT_ACTIVE`；
- Worker 已把 posting cursor 推过 Candidate boundary → `POSTING_CURSOR_AHEAD_OF_CANDIDATE`。

所有拒绝路径均不得产生第二个 CURRENT。

### 2.4 Worker / Activation 并发

Worker normal Posting 和 Candidate Activation 共享：

`enterprise_runtime_state FOR UPDATE`

作为同一 enterprise consistency domain 的 cutover lock。

真实 E2E 通过 PostgreSQL `pg_stat_activity` 确认事务确实发生 Lock wait，而不是依赖 JavaScript 调度碰巧串行。

已证明：

- Worker 先提交时，Activation 重新读取 runtime cursor 并拒绝过期 Candidate；
- Activation 先持有 cutover transaction 时，Worker 必须等待；
- 激活边界之后的 normal Posting 形成 CURRENT live tail；
- CURRENT overlay 能组合 certified prefix + normal-posting live tail。

### 2.5 Crash / retry atomic recovery

E2E 在真实 Activation 事务的最后 Candidate→CURRENT 更新前安装临时 PostgreSQL trigger，并主动抛出：

`EVO_TEST_ACTIVATION_CRASH`

异常发生时，事务内前序动作已经执行到包括：

- certification insert；
- Candidate VERIFIED；
- PostingInput 状态更新；
- runtime cursor 更新；
- old Ledger archive；
- Candidate Ledger activation；
- old CURRENT runtime archive。

数据库最终证明上述变化全部回滚：

- parent 仍 CURRENT/ACTIVE；
- Candidate 仍 CANDIDATE/BUILDING；
- active Ledger 仍 CURRENT/ACTIVE；
- Candidate Ledger 仍 CANDIDATE/BUILDING；
- certification insert 不存在；
- runtime cursor / mode / replay_required 不变。

删除故障 trigger 后，同一 Candidate/Oracle 可重新提交并成功激活；之后再次提交仍返回同一 certification。

---

## 3. 关键技术不变量 / Invariants Proven

本认证强化以下运行不变量：

1. 正式经济读取只能来自唯一 CURRENT 语义；
2. Candidate 不因为“曾经计算正确”就拥有激活权，激活事务必须重新验证 parent、governance 和 posting cursor；
3. Worker 与 Activation 的生产切换必须共享同一 cutover lock；
4. Candidate/Oracle/CURRENT 的 derived state 保持 generation scoped；
5. 激活事务必须 all-or-nothing，不能留下“账本切了但 runtime 没切”或“认证写了但 CURRENT 没切”的半状态；
6. retry 不得制造第二份认证或第二个 CURRENT；
7. generation chain 的历史组合必须使用稳定 identity 与全序 canonical ordering，而不是数据库偶然行顺序；
8. 正常业务可以在 certified activation boundary 之后继续形成可读 live tail。

---

## 4. 数据库证据 / Database Evidence

B4.4B 证据来自多轮 PostgreSQL 18 CI，而不是单一静态测试。

主要成功运行：

```text
35580699604  read routing
35581245021  first activation failure matrix
35647593407  consecutive multi-generation activation
35659095633  Worker / Activation concurrency implementation
35659216343  concurrency final status
35659482312  activation crash/retry
35659612160  crash/retry + invalidated checkpoint final matrix
```

最终 run `35659612160`：

```text
validate:docs                         PASS
migrate                               PASS
typecheck                             PASS
build                                 PASS
test                                  PASS
seed:demo                             PASS
validate:demo                         PASS
validate:worker-activation-concurrency PASS
validate:activation-crash-retry       PASS
validate:activation-failure-matrix    PASS
```

Schema 仍为 22；本阶段不依赖新增 migration。

---

## 5. 业务意义 / Business Meaning

本阶段之后，EVO 在参考场景中已经不只是“可以重算”。

它已经证明一条可长期运行的正式经济状态演进机制：

```text
不可改写业务事实
      ↓
隔离 Candidate
      ↓
独立 Full-Replay Oracle
      ↓
等价性 + 治理认证
      ↓
与正常 Worker 串行化切换
      ↓
唯一 CURRENT
      ↓
继续接受新业务 live tail
      ↓
下一代 Candidate
```

错误规则、旧 parent、被撤销治理证据、失效 checkpoint、并发新业务和事务中断都不能把企业带入两个正式状态或半切换状态。

---

## 6. 本认证没有证明什么 / Explicit Non-Claims

本文件只关闭 **ER-C05B4.4B 的参考 FIFO Economic Runtime 安全矩阵**。

它不等于整个 EVO 产品已经生产完成，也不证明：

- LIFO / Moving Average / Specific Identification 已达到与 FIFO 相同认证边界；
- 大规模并发吞吐、长时间压力、跨地域容灾；
- 最终权限体系、管理 UI、报表中心、行业模板；
- EC / Eidos 最终集成；
- 所有未来 schema / policy 迁移路径。

这些属于后续独立工作包，不能从本认证自动推导。

---

## 7. 阶段结论 / Closure

`ER-C05B4.4B — Read Routing & Activation Failure Matrix`

**CERTIFIED / CLOSED FOR REFERENCE FIFO ECONOMIC-RUNTIME SCENARIO**

截至本认证，仓库中尚未存在已批准编号的下一 work packet。

下一阶段必须先依据当前 roadmap、业务目标与未认证边界正式定义 packet，再更新 `project.status.json` 和 `context.manifest.json`；不得由接手 LLM 根据编号习惯自行发明 B4.4C/B4.5。

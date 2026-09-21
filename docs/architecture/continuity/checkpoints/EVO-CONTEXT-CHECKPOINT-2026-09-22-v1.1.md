# EVO Context Checkpoint — 2026-09-22 v1.1

**Status: ACTIVE HANDOFF CHECKPOINT**  
**Historical checkpoints remain preserved.**  
**Authority scope: post-B4.4B continuation handoff**

## 1. Newly certified milestone

`ER-C05B4.4B — Read Routing & Activation Failure Matrix`

Certification:

`docs/architecture/certification/ER-C05B4.4B-READ-ROUTING-ACTIVATION-SAFETY-CERTIFICATION-v0.1.md`

Certified implementation head before certification-document updates:

`d3dab3ed7a1d4b2a285d9564ac03f058555bfd64`

Final PostgreSQL 18 evidence:

`35659612160 — SUCCESS`

Schema remains version 22.

## 2. Business capability now proven

For the reference FIFO Economic Runtime scenario, EVO now proves a governed long-running official-state lifecycle:

- official reads resolve CURRENT generation semantics;
- a later Candidate can build from an already activated generation;
- two consecutive governed activations remain equivalent to independent Full Replay;
- semantic mismatch, stale parent, invalid checkpoint, revoked promotion and cursor-ahead cases fail closed;
- duplicate activation is idempotent;
- Worker normal Posting and Activation serialize on the same enterprise cutover lock;
- normal business after activation forms a CURRENT live tail;
- an exception at the deepest activation cutover point rolls back the entire transaction;
- retrying the same Candidate/Oracle after rollback succeeds without duplicate certification or duplicate CURRENT.

## 3. Current architecture boundary

The reference FIFO generation/replay/activation safety line is closed through B4.4B.

This does **not** certify all cost policies or production-scale operation.

Still outside this certification boundary:

- LIFO;
- Moving Average;
- Specific Identification;
- broader scale/performance/HA/DR;
- productized permissions, UI, reports and industry packages;
- final EC/Eidos integration.

## 4. Repository continuation rule

No B4.4C or B4.5 packet is currently approved in the repository.

A fresh LLM must not invent the next packet from numbering conventions.

Before new implementation:

1. read `project.status.json`;
2. read `branch.topology.json`;
3. inspect the current roadmap and certified non-claims;
4. define the next bounded business/technical packet explicitly;
5. update router/status only after that packet is accepted into repository reality.

## 5. Current business-language status

> **EVO 已在参考 FIFO 场景中完成“正式读取 → 连续多代增量重算 → 独立 Full Replay 对照 → 治理认证 → Worker 并发切换 → 崩溃全回滚 → 同 Candidate 安全重试”的数据库级闭环。当前不再有 B4.4B 未完成 Gate；下一步应先正式定义新的工作包，而不是沿编号惯性继续开发。**

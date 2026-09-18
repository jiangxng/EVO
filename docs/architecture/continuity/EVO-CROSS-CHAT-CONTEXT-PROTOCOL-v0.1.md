# EVO 跨聊天窗口上下文连续性协议 / Cross-Chat Context Continuity Protocol v0.1

**Status / 状态：ACTIVE PROJECT PROTOCOL**  
**Date / 日期：2026-09-19**  
**Scope / 范围：EVO 全项目，适用于当前及未来所有 ChatGPT / LLM 工作窗口**

---

# 0. 目的 / Purpose

EVO 是一个预计持续多年甚至更久的大模型原生企业系统项目。

聊天窗口是临时工作空间，不是项目记忆本身。聊天可能因为：

- 会话过长；
- 浏览器性能；
- 模型切换；
- 工作阶段切换；
- 人工主动换窗口；
- 平台上下文压缩；

而无法长期承载完整工程上下文。

因此 EVO 必须满足：

> **任何新的 LLM / 新聊天窗口，只依赖 Git 仓库中的 durable context，就能够恢复项目当前状态并继续工作，而不要求重新阅读全部历史聊天。**

This protocol makes repository-backed context, rather than chat memory, the authoritative continuity mechanism.

---

# 1. 权威顺序 / Authority Order

发生信息冲突时，按以下优先级判断：

```text
1. 当前 Git 仓库真实代码 / migrations / tests
2. 已提交的 Architecture ADR / Contracts / Freeze
3. 最新 Context Checkpoint / Continuation documents
4. 当前 Business + Technical Progress document
5. Archaeology evidence packets
6. 当前聊天上下文
7. 模型记忆 / 历史聊天摘要
```

核心规则：

> **Repository reality > chat memory.**

聊天中曾经认为正确、但后来代码或证据已经修正的结论，必须以后来的仓库事实为准。

---

# 2. 已确认的聊天血缘 / Confirmed Chat Lineage

截至本协议建立时，EVO 已经历四个连续工作窗口：

```text
Stage 0
6a8ff0bd-afc4-83ec-bb15-a3180a05d80e

    ↓

Stage 1
6aab9633-04d0-83ec-b996-5953fe703f1b

    ↓

Stage 2
6aabf5d5-4a24-83ec-8cc8-96129e5c5387

    ↓

Stage 3
6aacb907-3b08-83ec-aaa5-499d1887d128
```

这四个 ID 只作为历史 lineage 标签保存。

未来 Stage 4、Stage 5……不要求依赖这些聊天页面本身。

历史语义已由 durable documents 承接。

---

# 3. 新聊天必须执行 Context Handshake

任何未来新聊天收到类似：

> “继续 EVO。”

或：

> “读取项目文档，从上次继续。”

不得立即凭模型记忆开始编码。

必须执行以下 Context Handshake。

## Step 1 — 确认 Repository Reality

读取：

- repository；
- 当前工作 branch；
- branch HEAD；
- 最近重要 commits；
- 最近 CI / workflow 状态。

目的：

确认聊天摘要没有落后于 Git。

---

## Step 2 — 读取历史 Handoff

读取：

`docs/architecture/legacy/EVO-WORK-STAGE-HANDOFF-v0.1.md`

目的：

恢复：

- 项目初心；
- Stage 0→1→2→3 演进；
- 关键考古结论；
- 旧系统与 EVO 的边界；
- 已发生的重要 CORRECTION。

不要重新进行已经完成的 broad archaeology。

---

## Step 3 — 读取执行 Continuation

读取最新 continuation / context checkpoint。

当前入口：

`docs/architecture/legacy/EVO-WORK-CONTINUATION-PLAN-v0.1.md`

未来若出现新的 Context Checkpoint，则优先读取最新 checkpoint，再按其中指针读取必要文档。

目的：

恢复：

- 哪些 gate 已 CLOSED；
- 哪个 work packet 正在进行；
- 最新 green checkpoint；
- 未解决 blocker；
- 下一步准确动作。

---

## Step 4 — 读取业务 + 技术状态

读取：

`docs/architecture/status/EVO-CURRENT-PROGRESS-BUSINESS-AND-TECH-v0.1.md`

目的：

新 LLM 不仅要知道“代码做到哪里”，还必须知道：

- 当前解决什么企业业务问题；
- 已经形成什么业务能力；
- 技术路线是什么；
- 验证等级到哪里；
- 为什么下一步值得做。

---

## Step 5 — 按当前任务读取专题文档

按任务需要再读取：

### Economic Runtime

- Economic Runtime Architecture Freeze ADR；
- Allocation / Cost / FX / Replay contracts；
- relevant evidence packets。

### Database

优先读取最新：

`docs/architecture/database/EVO-CURRENT-DATABASE-DESIGN-*.md`

### Enterprise Template

读取 Template ADR / convergence / package documents。

### Archaeology

只有存在明确 evidence gap 时才重新打开 Asloop / bookkeeping 原始代码。

---

## Step 6 — 输出 Context Alignment Summary

在开始重要实现前，新 LLM 应形成内部或用户可见的简洁对齐结果：

```text
Repository / Branch:
HEAD:
Latest verified checkpoint:

Business goal:
Active work packet:
Current validation level:

Closed gates:
Open blockers:

Next implementation step:
Why it matters to business:
```

如果仓库事实与旧聊天摘要冲突：

> 先纠正上下文，再继续工作。

---

# 4. 换聊天窗口前必须执行 Handoff Checkpoint

如果出现以下任一情况：

- ChatGPT 明确提示聊天过长；
- 浏览器已经明显变慢；
- 用户准备主动换窗口；
- 当前工作形成重要阶段边界；
- 上下文复杂度明显影响准确性；

必须先保存 durable checkpoint。

## 新增法规则

**不得覆盖旧 checkpoint。**

创建类似：

```text
docs/architecture/continuity/checkpoints/
  EVO-CONTEXT-CHECKPOINT-2026-09-19-v0.1.md
  EVO-CONTEXT-CHECKPOINT-2026-10-02-v0.1.md
  EVO-CONTEXT-CHECKPOINT-2026-10-02-v0.2.md
  ...
```

每次 checkpoint 必须至少包含：

- 当前 branch / HEAD；
- 最近 verified CI；
- 当前业务目标；
- 当前技术路线；
- 当前 active work packet；
- 已 CLOSED gates；
- 当前 blocker；
- 尚未验证的假设；
- 最近重要 corrections；
- 下一步准确执行顺序；
- 必读文档列表。

旧 checkpoint 永远保留为 genealogy。

---

# 5. 新聊天 Bootstrap Phrase

未来推荐使用：

> 继续 EVO。请先按 `EVO-CROSS-CHAT-CONTEXT-PROTOCOL-v0.1.md` 执行 Context Handshake，读取最新 Context Checkpoint、Continuation 和 Business+Technical Progress，以当前 Git 仓库为准，从最新未完成 gate 继续。

如果用户只说：

> “继续。”

LLM 在 EVO 上下文已经明确时，也应该自动遵守本协议。

---

# 6. 上下文不得只保存“做了什么”

Handoff 必须同时保存三类知识。

## 6.1 Decision / 决策

例如：

- BusinessData 为什么是 canonical；
- AllocationInstruction 为什么不同于 AllocationRelation；
- 为什么 Replay 不重新执行 Command；
- 为什么 Cost / FX 必须 pin policy / dataset；
- 为什么 PostgreSQL 是当前物理实现而不是核心语义本身。

## 6.2 Evidence / 证据

例如：

- Asloop / bookkeeping 的历史证据；
- migration / schema；
- unit test；
- E2E seed / validation；
- Replay digest；
- CI run。

## 6.3 Current State / 当前状态

例如：

- IMPLEMENTED；
- UNIT VERIFIED；
- E2E VERIFIED；
- CERTIFIED；
- BLOCKED。

不能把“设计决定”和“已经验证”混为一谈。

---

# 7. 业务上下文必须随技术上下文一起传承

未来 handoff 不允许只有：

```text
ER-C05B3.2B
commit abc...
CI xxx...
```

同时必须写清楚：

```text
业务问题：
为什么企业需要这个能力？

业务能力：
完成后企业能做什么？

技术实现：
EVO 如何表示？

验证等级：
目前只是实现、单测、E2E 还是认证？

下一步：
为什么业务上还需要继续？
```

这是防止长期项目变成“只剩工程编号、忘了为什么做”的机制。

---

# 8. 文档采用新增法 / Additive Documentation Rule

从本协议开始，重要阶段文档默认执行：

> **新增，不覆盖历史。**

适用：

- Context Checkpoint；
- Architecture Decision；
- Database Design Snapshot；
- Archaeology Evidence Packet；
- Certification Packet；
- Business/Technical Stage Summary。

如果旧文档有错误：

1. 不静默修改历史结论；
2. 新建 CORRECTION / SUPERSEDED 文档，或在新的阶段文档明确引用旧版本；
3. 说明为什么修正；
4. 给出新的 authority。

代码中的普通说明文档可按工程需要维护，但涉及架构 genealogy / stage evidence 的文档必须保留历史。

---

# 9. “当前”与“历史”必须明确区分

文件名建议：

```text
...-v0.1.md
...-v0.2.md
...-v1.0.md
```

每一版都必须说明：

- snapshot date；
- branch / commit（能确定时）；
- supersedes / depends on；
- status；
- authority scope。

“CURRENT”只表示该版本创建时的当前状态。

未来出现 v0.2 后，v0.1 仍然是历史阶段证据，不应删除。

---

# 10. LLM 切换规则

EVO 不能依赖某一个模型的隐性记忆。

换模型时：

```text
Old LLM knowledge
      ↓
Repository documents + contracts + tests
      ↓
New LLM Context Handshake
      ↓
Recover decisions / evidence / current gate
      ↓
Continue implementation
```

新 LLM 可以推翻旧结论，但必须：

- 给出新的证据；
- 明确标记 CORRECTED；
- 保留旧结论 genealogy；
- 不通过“我觉得更合理”直接替换已经认证的架构。

---

# 11. 当前固定入口 / Current Bootstrap Index

截至 2026-09-19，新窗口最低读取集合为：

1. `docs/architecture/continuity/EVO-CROSS-CHAT-CONTEXT-PROTOCOL-v0.1.md`
2. `docs/architecture/legacy/EVO-WORK-STAGE-HANDOFF-v0.1.md`
3. `docs/architecture/legacy/EVO-WORK-CONTINUATION-PLAN-v0.1.md`
4. `docs/architecture/status/EVO-CURRENT-PROGRESS-BUSINESS-AND-TECH-v0.1.md`
5. 最新 Economic Runtime Freeze / relevant active packet documents
6. 当前 Git HEAD + CI

如果当前任务涉及数据库，再读最新 Database Design Snapshot。

---

# 12. 当前项目连续性的核心原则

> **聊天是工作缓存，Git 是工程记忆。**

> **Context compression 可以发生，architecture genealogy 不能丢。**

> **Repository reality 高于模型记忆。**

> **新模型应该继承决策和证据，而不是继承未经验证的结论。**

> **每次换窗口都应该比上一次更容易恢复，而不是重新讲一遍整个项目。**

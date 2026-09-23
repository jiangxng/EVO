# EVO Core Public API for 3EC v0.1

**Status: DRAFT CONTRACT BASELINE**  
**Purpose:** 为 3EC、Eidos 及其他外部消费者提供最小、稳定、机器可测试的 EVO Core 能力边界。

## 1. Role Alignment

```text
EVO  = 底层企业运行能力
Eidos = 界面 / Experience Layer
3EC  = 实例 / 经验与实例生成、契约测试消费者
```

3EC 不依赖 EVO 私有代码、数据库结构或内部 class。

3EC 只依赖：

- Public HTTP API；
- OpenAPI / JSON Schema；
- Event / Change Feed Contract；
- Package Manifest Contract；
- deterministic test fixtures。

## 2. Phase-0 APIs — 可立即测试

### GET /health/live

验证 EVO API 进程可用。

### GET /health/ready

验证 EVO Core 依赖已就绪。

### GET /api/v1/core/capabilities

用途：

- 发现当前 Core protocol version；
- 发现已公开能力；
- 区分 AVAILABLE / DRAFT / PLANNED；
- 禁止 3EC 假设 Sales / Finance / Manufacturing 永远存在。

当前返回能力族：

- business-data；
- posting；
- ledger；
- balance；
- replay；
- package-installation；
- snapshot-change-feed。

## 3. Phase-1 Protocol Freeze

下一阶段必须冻结以下 Core API family。

### BusinessData

目标接口能力：

- append canonical BusinessData；
- bounded history query；
- get by stable identity；
- bulk export / snapshot participation。

必须支持：

- enterprise scope；
- schema/version identity；
- idempotency；
- occurred/effective time；
- stable source identity；
- posting/replay-required values；
- digest/provenance。

### Ledger Definition

- create/validate definition；
- version；
- activate/retire；
- query；
- import/export。

### Posting Rule

- define；
- validate；
- version；
- activate；
- query；
- import/export。

### Posting

- request/process posting；
- idempotency/status；
- failure contract；
- deterministic sequence exposure。

### Ledger Entry

- bounded query；
- source/rule provenance；
- movement query；
- pagination/cursor。

### Balance

- current；
- as-of；
- by dimensions；
- validation/rebuild status。

### Replay

- request replay；
- status；
- result digest；
- before/after equivalence evidence。

### Provenance

- BusinessData → Posting Rule → Ledger Entry；
- Ledger Entry → BusinessData / Rule Version。

## 4. Phase-2 Package APIs

3EC 应能够准备安装测试：

```text
Bare Core
→ validate package
→ plan install
→ install
→ discover capability
→ execute test fixture
→ verify ledger/balance
```

最低需要：

- package schema discovery；
- validate；
- plan；
- install/deploy；
- installed package inventory；
- capability registry；
- deactivate/uninstall；
- version/upgrade later。

现有基线：

- `contracts/enterprise-package-api-v0.1.openapi.yaml`
- `contracts/enterprise-package-v0.1.schema.json`

这些契约将在 Core Boundary migration 中继续收敛，不能把旧 Enterprise/Application 元数据全部视为 Kernel 必选能力。

## 5. Recommended 3EC Contract Tests

### CT-00 Core Discovery

```text
GET /health/live → 200
GET /health/ready → 200
GET /api/v1/core/capabilities → valid schema
```

### CT-01 No Domain Assumption

验证 Bare Core capability catalog 不要求存在：

- sales；
- purchase；
- manufacturing；
- finance；
- reporting。

### CT-02 Package Validation

向 Package Validate API 提交：

- valid minimal package → valid；
- invalid schema → stable error；
- unsupported version → stable compatibility error。

### CT-03 Install Plan

安装包 plan 必须返回：

- additions；
- updates；
- removals；
- dependencies；
- blockers；
- warnings；
- side-effect-free result。

### CT-04 Trading Lite Installation

后续第一份真实安装测试：

```text
Bare Core
→ install evo.trading-lite
→ capability appears
→ ingest fixture
→ posting occurs
→ expected balance appears
```

### CT-05 Replay Determinism

```text
fixture input
→ first posting digest
→ replay
→ same digest
```

## 6. Test Fixture Philosophy

3EC 的测试用例必须依赖语义，不依赖数据库行。

推荐 fixture：

```json
{
  "fixtureId": "trading-lite-001",
  "requiredProtocol": "0.1",
  "requiredCapabilities": ["business-data","posting","ledger","balance"],
  "inputs": [],
  "expected": {
    "ledgerMovements": [],
    "balances": [],
    "replayDigest": "..."
  }
}
```

这样即使 EVO 内部从 PostgreSQL 改成分区、分库或其他存储，3EC 测试仍然成立。

## 7. Eidos Relationship

Eidos 可以复用相同 Capability Discovery / Package Discovery contract，但职责不同：

```text
3EC:
contract test / instance knowledge / fixture generation

Eidos:
render capability / package / application experience
```

Eidos 不应通过 Core Console HTML 做集成，而应调用同一 Public API。

## 8. Near-term Delivery Target

下一阶段可见交付：

```text
EVO Core Console
+
Core Capability API
+
Core OpenAPI v0.1
+
Package Contract
+
3EC Contract Test Fixtures
+
IC-00 Bare Core Test
```

这将是 EVO / Eidos / 3EC 三项目第一次稳定契约对接基线。

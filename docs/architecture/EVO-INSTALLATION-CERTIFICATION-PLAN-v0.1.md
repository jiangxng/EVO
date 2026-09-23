# EVO Installation Certification Plan v0.1
# EVO 安装能力认证计划 v0.1

**Status: ACTIVE PLAN**  
**Date: 2026-09-23**  
**Goal:** 验证 EVO 不只是“数据能跑通”，而是真正支持企业从一人公司开始，通过安装能力持续生长，并同时支持本地部署与云租户。

## 1. Why Installation Is a First-class Acceptance Target

EVO 的目标不是固定功能 ERP。

核心产品承诺是：

```text
Install EVO Core
→ install first capability
→ operate
→ company grows
→ install more capabilities
→ keep the same core and authoritative history
```

因此测试体系必须同时证明两件事：

1. Runtime correctness：数据、记账、余额、Replay 正确；
2. Installation correctness：能力可以被发现、校验、计划、安装、升级、停用，并且安装后立即成为可用能力。

只做第一类测试不足以证明 EVO 愿景成立。

## 2. Current Repository Readiness

仓库已经存在 Enterprise Package v0.1 基础：

- JSON Schema；
- OpenAPI contract；
- Definition-only package model；
- Validate；
- Plan；
- Deploy application service；
- Export；
- dependency reference validation；
- deterministic side-effect-free plan；
- stale base version rejection；
- idempotent deployment semantics；
- in-memory roundtrip tests。

当前仍缺少真实安装闭环的关键部分：

- PostgreSQL-backed EnterpriseDefinitionSource；
- PostgreSQL-backed EnterpriseDefinitionTarget；
- package installation registry；
- installed-package inventory；
- activation/deactivation state；
- dependency resolver across installed packages；
- Package API runtime routes；
- install audit / receipt persistence；
- upgrade lifecycle；
- uninstall/deactivate lifecycle；
- runtime-extension registration；
- UI installation flow；
- local/cloud dual-topology certification。

因此当前能力评级为：

> **INSTALL-L1 — Contract/Planner verified, real runtime installation not yet certified.**

## 3. Installation Certification Ladder

### INSTALL-L0 — Schema

Prove:

- package schema is machine-readable；
- invalid package fails closed；
- unknown/forbidden runtime data rejected；
- semantic digest can be stable。

Status: substantially available.

### INSTALL-L1 — Deterministic Plan

Prove:

```text
same tenant state
+ same package
= same install plan
```

Also:

- dependencies visible；
- ADD/UPDATE/REMOVE diff visible；
- stale base rejected；
- deploy is idempotent。

Status: unit-level implementation already exists.

### INSTALL-L2 — Real Database Install

First important new certification.

Test:

```text
empty enterprise
→ deploy package through real target
→ definitions committed atomically
→ installation receipt persisted
→ version inventory updated
→ retry same idempotency key
→ no duplicate effect
```

Must use PostgreSQL 18 E2E, not in-memory fake.

This is the next installation milestone.

### INSTALL-L3 — Public API Install

Prove no code-level integration is required.

```text
HTTP client
→ validate
→ plan
→ deploy
→ query installed packages
→ query installed capability
```

Test must start EVO as a service and use only Public API.

No test code may import package deployer implementation.

Passing INSTALL-L3 proves the first true runtime boundary.

### INSTALL-L4 — Capability Becomes Usable

This is the first business-level install proof.

Reference scenario: **One-person Trading Pack**.

Before install:

```text
GET capability
→ not installed
posting rules / ledgers absent
```

Install through Public API:

```text
Install Trading Pack
→ Inventory ledger
→ Cash ledger
→ Receivable
→ Payable
→ basic purchase/sales rules
```

Then submit canonical BusinessData and prove:

```text
BusinessData
→ Posting
→ Ledger Entry
→ Balance
```

No server restart and no source-code modification allowed.

This is the first milestone that proves the user vision.

### INSTALL-L5 — Growth-by-Installation

Reference growth test:

```text
Stage A: One-person company
Core + Trading

Stage B: Small team
+ Identity/Policy + Workflow

Stage C: Small company
+ Finance Accounting

Stage D: Management/reporting
+ Finance Reporting
```

Assertions:

- earlier BusinessData remains unchanged；
- prior Ledger history remains valid；
- newly installed capability can consume history through supported contract；
- no Core source change；
- no tenant-specific branch；
- upgrade preserves installed package lineage。

### INSTALL-L6 — Local / Cloud Parity

Run the same package artifact in:

1. local/on-prem single-enterprise deployment；
2. cloud multi-tenant deployment。

Assertions:

```text
same package id/version
same semantic definitions
same install lifecycle
same business result
different deployment topology allowed
```

Cloud additionally proves tenant isolation:

- Tenant A install does not affect Tenant B；
- package versions may differ by tenant；
- installed capability inventory is tenant-scoped。

### INSTALL-L7 — Upgrade / Deactivate / Uninstall

Test:

```text
install v1
→ operate
→ plan v2
→ upgrade
→ operate
→ deactivate
→ Core remains healthy
→ reactivate
```

Uninstall semantics must preserve canonical historical facts.

No package uninstall may silently delete authoritative BusinessData / Ledger history.

## 4. Reference Installation Pack

The first real installation certification should NOT use Finance Reporting.

Use:

> **EVO Simple Trading Pack v0.1**

because it directly proves the one-person-company business rationale.

It should contain only enough definitions to prove growth-by-installation:

- inventory quantity ledger；
- inventory value ledger if needed；
- cash ledger；
- receivable ledger；
- payable ledger；
- purchase receipt posting rule；
- sales/shipment posting rule；
- receipt rule；
- payment rule；
- minimal application definitions only if the Application Platform Pack is part of that test stage。

Avoid manufacturing, workflow, Finance statements, EC and advanced costing in the first proof.

## 5. Installation API Surface Needed for L2/L3

Minimum public protocol:

```text
GET  /package/capabilities
POST /package/validate
POST /tenants/{tenant}/packages/plan
POST /tenants/{tenant}/packages/install
GET  /tenants/{tenant}/packages
GET  /tenants/{tenant}/packages/{packageId}
POST /tenants/{tenant}/packages/{packageId}/activate
POST /tenants/{tenant}/packages/{packageId}/deactivate
```

Upgrade can initially reuse install with expected current version and later receive an explicit operation.

Names may change; semantics are the invariant.

## 6. Installation Data Model Needed

Minimum persisted installation state:

```text
installed_package
├─ tenant/enterprise
├─ package_id
├─ package_version
├─ package_digest
├─ status
├─ installed_at
├─ activated_at
├─ compatibility version
└─ source/provenance

package_installation_run
├─ run_id
├─ idempotency_key
├─ plan_digest
├─ before_version
├─ after_version
├─ status
├─ actor
└─ error / receipt
```

Definition records remain versioned in their owning subsystem.

## 7. Critical Architecture Test

Every installation certification after L3 must fail if the tested pack:

- imports EVO Core implementation；
- connects directly to EVO Core private tables；
- requires source-code edits to Core；
- requires tenant-specific branch；
- bypasses Package/Public API；
- mutates canonical history outside supported commands/contracts。

This is as important as business result validation.

## 8. When We Can Start Each Test

### Now

We can immediately run/strengthen:

- L0 Schema；
- L1 Validate/Plan/Idempotency unit tests；
- package export/import roundtrip。

### Next physical implementation slice

Implement real Package Registry + Postgres Definition Target.

Then immediately certify:

> **INSTALL-L2 Real Database Install**

### Following slice

Wire the existing OpenAPI semantics to Core Service Public API.

Then certify:

> **INSTALL-L3 Public API Install**

### Immediately after L3

Build Simple Trading Pack and run:

> **INSTALL-L4 One-person Company installation E2E**

At that point we can visibly demonstrate:

```text
clean EVO
→ install Trading
→ submit business facts
→ get balances
```

with zero code modification.

That is the first strong proof that the architecture supports the product vision.

## 9. Release Gate

EVO should not claim “Installable Application Platform” until INSTALL-L4 passes.

EVO should not claim “Growth-by-Installation” until INSTALL-L5 passes.

EVO should not claim “Local + Cloud same product model” until INSTALL-L6 passes.

## 10. Recommended Work Order

```text
Core Boundary Audit
→ freeze Core Protocol
→ Package Registry / real DB target
→ INSTALL-L2
→ Package Public API
→ INSTALL-L3
→ Simple Trading Pack
→ INSTALL-L4
→ add Team/Finance packs
→ INSTALL-L5
→ Local/Cloud parity
→ INSTALL-L6
→ Upgrade/uninstall lifecycle
→ INSTALL-L7
```

This installation certification ladder runs in parallel with existing business/replay/finance certifications; it does not replace them.

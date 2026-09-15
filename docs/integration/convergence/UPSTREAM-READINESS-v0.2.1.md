# EVO Upstream Readiness for Architecture Convergence v0.2.1

Status: WORKING BRANCH — upstream readiness only  
EVO baseline: `main@45f77e448e4fe4ce6b5e828c40dea8cfbe2d073a` (`1.0.0-alpha.2`)  
Convergence authority: EVO-EC-Eidos-Convergence v0.2.1 G4/G5 candidate schemas, fixtures and certification.  

This document does **not** define or freeze cross-repository schemas. It maps the current EVO implementation to the canonical Convergence contract families and identifies the smallest upstream work needed to consume Convergence-owned schemas/fixtures without importing another repository's internals.

## Non-negotiable boundary

- EVO remains the deterministic enterprise runtime and operational-truth authority.
- EC/Eidos/Host must not access EVO PostgreSQL/Kysely, workers, private modules, aggregates or internal services.
- Cross-system integration terminates at EVO-owned public boundaries.
- Convergence owns canonical cross-repository schemas, golden/invalid fixtures and certification authority.
- EVO adapters may translate a canonical contract into EVO public/internal ports, but the adapter does not create a second write path.
- All operational mutation still reaches the normal EVO Command admission/execution path.

## 1. Convergence Adoption Inventory

| Convergence capability | Status | Current EVO asset | Readiness conclusion |
|---|---|---|---|
| Shared Envelope | **PARTIAL** | `ExecuteCommandRequest` already carries enterprise, actor, correlation, causation, idempotency and effective time; `AppError` is structured | Missing Convergence canonical envelope adapter, delegation/service context, contract/version negotiation and cross-system error normalization. Do not invent them locally; consume Convergence schema when supplied. |
| Enterprise Observation provider | **PARTIAL** | Command transaction creates `outbox_event` atomically with `BusinessData`; correlation/causation are persisted | No canonical Observation projection/provider yet; current outbox payload is an internal event shape and lacks canonical observation identity/time/redaction/checkpoint semantics. |
| Command Proposal admission | **PARTIAL** | Stable Command service, capability resolver, authorization at API layer, idempotent command transaction, command catalog | No proposal admission adapter; current `CommandService` does not validate input against published `command_definition.input_schema`; proposal identity/lifecycle does not exist. |
| ActionRequest -> EVO Command Host mapping | **GAP** | EVO has Command boundary and a demo AI capability catalog exposing command code/name/application/input schema | No Host-neutral ActionRequest mapping profile/adapter, no stable public CommandDefinition projection and demo endpoints are not production public contracts. |
| Enterprise Context provider | **PARTIAL** | `EnterpriseQuery.dashboard`, balance digest, demo dashboard and AI catalog expose deterministic reads | Current query types are broad `unknown`, endpoints are demo-only, and there is no governed field/scope/version/redaction projection suitable as a stable cross-system provider. |
| Operational Change Proposal admission/governance | **GAP** | Versioned metadata, published definitions, application-definition versions and explicit no-implicit-rebase principles exist | No public proposal intake, review/approve/publish workflow, stale-base admission contract or role-separated governance boundary exists. Readiness only; do not implement at scale yet. |
| Enterprise Simulation deterministic calculator | **PARTIAL** | Cost, valuation, ledger, replay and deterministic calculators exist internally | There is no isolated `HYPOTHETICAL` public runtime/snapshot namespace. Replay is explicitly not Simulation. Reuse calculators later behind a dedicated boundary; do not expose internals now. |

Status meanings:

- **READY** — current public boundary can accept canonical fixtures with adapter-level work only.
- **PARTIAL** — reusable implementation asset exists but a public/provider/admission boundary is incomplete.
- **GAP** — no suitable boundary exists yet; implementation work is required.
- **BLOCKED** — cannot progress without an external/frozen contract decision. No product-runtime item is currently BLOCKED; certification is intentionally waiting for Convergence canonical schemas/fixtures.

## 2. Public Boundary Mapping

The names below describe EVO-owned boundary roles, not new cross-repository schema names.

| Convergence contract | EVO terminal public boundary | Internal assets allowed behind boundary | Forbidden dependency for consumer |
|---|---|---|---|
| Shared Envelope | API/integration adapter at EVO ingress/egress | identity authorization port, `AppError`, correlation/causation fields | DB schema, Kysely types, internal identity implementation |
| Enterprise Observation | EVO Integration/Observation provider | governed projection of BusinessData/Command outcome/metrics/flow + outbox publisher | `outbox_event` table, `business_data` table, worker internals |
| Command Proposal | EVO Command Proposal admission adapter -> existing Command boundary | CommandDefinition public projection, auth, schema validator, `CommandService` | command transaction implementation, metadata repository, Kysely |
| ActionRequest mapping | Host-owned mapping profile -> EVO public Command boundary | published CommandDefinition projection + normal Command authorization/validation | EVO internal service/class imports, direct BusinessData writes |
| Enterprise Context | EVO governed Query/Context provider | query module/read projections, published operational definitions | dashboard SQL/Kysely/repository internals |
| Operational Change Proposal | EVO governance admission boundary | metadata versioning, target-specific governed mutation ports, approval/audit | direct definition-table writes or EC-authored mutation engine |
| Enterprise Simulation | EVO deterministic simulation provider | isolated wrappers around cost/inventory/ledger/capacity/schedule calculators | Replay internals as public API; writes to Actual BusinessData/Ledger |

### Current public/private distinction

`modules/*/api` is an EVO repository module boundary; it is **not automatically a cross-repository public API**. Cross-repo consumers must use stable HTTP/event/transport contracts or another explicitly published EVO public interface.

The current `/api/v1/demo/*` routes are reference validation endpoints. They are useful implementation evidence but are not the final Convergence public contracts.

## 3. Provider / Consumer Test Hooks

EVO will consume Convergence canonical schemas and fixtures **by path/reference at test time**. EVO must not copy or fork the fixture corpus.

Prepared hook rules:

1. Canonical fixtures remain owned by Convergence.
2. EVO tests receive external fixture paths through test configuration/environment or CI checkout paths.
3. EVO provider tests validate EVO-produced payloads against Convergence schemas/fixtures.
4. EVO consumer/admission tests feed Convergence valid/invalid fixtures into EVO adapters and assert admission, authorization, idempotency, stale-state and error behavior.
5. Fixture identity/hash/version is recorded in test output so certification can tie results to an exact Convergence revision.
6. If fixture/schema is absent, local unit tests may skip the external certification suite; CI certification must fail closed when the certification job declares the fixture set required.
7. No test may import Convergence product-runtime code or another product's internal module.

A repository-local generic external JSON fixture loader is added under `platform/testing/convergence/`; it intentionally contains no Convergence schema semantics.

## 4. First Real Upstream Closed Loop

Target:

```text
Enterprise Observation
-> EC Command Proposal
-> Eidos ActionRequest / Host mapping
-> EVO Command
-> BusinessData
-> new Enterprise Observation
```

### Required EVO slice

**A. Observation provider**

Build a governed projection from EVO operational truth to the Convergence-provided Enterprise Observation schema. Initial source should be the atomic Command -> BusinessData -> Outbox path, not DB access by EC.

Required behavior to prove:

- `observation_id != delivery_id`
- distinct `effective_at`, `observed_at`, `published_at`
- retry/replay can deliver the same semantic observation multiple times
- backdated BusinessData retains business effective time
- out-of-order delivery does not alter observation identity
- enterprise/tenant scoping and redaction are enforced before egress
- checkpoint/recovery is transport/provider state, not observation identity
- correlation/causation/lineage/provenance survive projection

**B. Command Proposal admission**

Add an adapter that accepts the Convergence canonical Command Proposal and terminates at the existing EVO Command boundary.

Required behavior to prove:

- EC never defines EVO Command input semantics
- `proposed_input` validates against the EVO-published Command schema/version
- `proposal_id != command_idempotency_key`
- proposal is not authorization
- revoked delegation/actor fails authorization at admission/execution
- expired proposal fails closed
- retired/unsupported Command or input-schema version fails closed
- duplicate proposal admission cannot create duplicate BusinessData
- proposal -> CommandExecution -> BusinessData lineage is observable

**C. ActionRequest -> EVO mapping**

Do not put Eidos semantics into EVO. The Host mapping profile resolves the Host-neutral ActionRequest against an EVO-published CommandDefinition projection and then calls EVO Command admission. EVO re-authenticates/re-authorizes and validates current state/idempotency.

Required behavior to prove:

- stale presented state/version can fail closed where Command policy requires it
- confirmation evidence is not authorization
- Host mapping cannot bypass Command schema validation
- duplicate ActionRequest is mapped to controlled Command idempotency

## 5. Current Command Catalog / APM Gap

The alpha.2 demo seed currently defines these CommandDefinitions:

- `approve-sales-order` -> `sales_order.approved`
- `complete-production` -> `production.completed`
- `ship-sales-order` -> `sales_shipment.created`
- `receive-inventory` -> `inventory.received` (legacy compatibility/demo only)

The current reference API exposes sales-order approval, production completion, shipment creation, cost recalculation, replay/dashboard and AI catalog endpoints. There is **no published procurement application/capability or formal `procurement.use-alternate-supplier` Command** in current `main`.

### EVO-owned implementation plan for the APM gap

Do not add a special integration write path. If APM certification requires the action, implement it as a normal EVO operational capability:

1. introduce/confirm Procurement domain + transaction type + application definition/version/instance;
2. define a published EVO-owned CommandDefinition for the alternate-supplier business action;
3. define a real input schema and resulting BusinessData semantic type;
4. add permission code and authorization checks;
5. use normal Command execution/idempotency/BusinessData/outbox flow;
6. expose it through the same public CommandDefinition projection used by Command Proposal/Host mapping;
7. publish Enterprise Observation from the resulting operational fact/outcome;
8. add provider/consumer/integration fixtures only after Convergence provides canonical contract fixtures.

This is an EVO implementation gap, not permission to modify EC/Eidos internals or to bypass Command.

## 6. Important Existing Implementation Gaps

### Command input schema enforcement

`command_definition.input_schema` exists and the AI catalog exposes it, but current seed schemas are only `{ "type": "object" }`, and `CommandService` validates idempotency/business-object/effective-time rather than validating `request.input` against the published command schema. This must be corrected before Command Proposal admission can be certified.

### Public CommandDefinition projection

The AI catalog is a useful seed asset but lacks stable contract identifiers/schema-version/status/capability metadata required for certified cross-system discovery. Create a public projection; do not expose metadata tables/repositories.

### Observation provider

Current `outbox_event` is implementation infrastructure. Its payload is not the Convergence Enterprise Observation contract. Build a deterministic projection/adapter and keep transport delivery metadata separate from semantic observation identity.

### Enterprise Context

The dashboard is a composite validation read model, not a governed cross-system context contract. A future provider needs explicit projections, scopes, versions, pagination/snapshot semantics and redaction.

### Operational Change Proposal / Simulation

Both remain later-phase gaps. Do not expand them before the first closed loop is certified.

## 7. Compatibility / Migration / Rollback

This readiness phase is additive and documentation/test-hook focused.

- No BusinessData/Ledger migration is required.
- No existing Command semantics are changed.
- No v0.2.0 Convergence artifact is modified.
- New adapters/providers must be disableable independently.
- Observation publisher rollback stops the new projection/delivery path; it never rewrites operational facts.
- Proposal/Action adapters rollback by disabling admission/mapping; existing Command API remains authoritative.
- Any later database additions for provider checkpoints/proposal audit must use normal EVO migration/versioning rules and remain EVO-internal.

## 8. Upstream Adoption Priority

Keep the agreed order:

1. Shared Envelope adapter support
2. Enterprise Observation provider
3. Command Proposal admission
4. ActionRequest -> EVO Host mapping profile support
5. Enterprise Context provider
6. Operational Change Proposal admission/governance
7. Enterprise Simulation deterministic provider

Do not expand architecture vocabulary during this phase.

## 9. Cross-Repo Blocking Assessment

**No blocking Architecture/Ownership/Contract Semantic issue is identified.**

Executable implementation/certification is intentionally dependent on Convergence supplying the canonical schemas, golden/invalid fixtures and certification revision. EVO will consume those artifacts; it will not invent competing schemas.

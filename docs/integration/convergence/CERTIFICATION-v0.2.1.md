# EVO Consumer / Provider Certification — Convergence v0.2.1

Convergence source: `jiangxng/EVO-EC-Eidos-Convergence@certification/v0.2.1-proof`  
Fixture root: `fixtures/v0.2.1/`  
EVO baseline: `main@45f77e448e4fe4ce6b5e828c40dea8cfbe2d073a` (`1.0.0-alpha.2`)  
Status: UPSTREAM READINESS / EXECUTABLE EVIDENCE

No canonical fixture is copied into EVO. `platform/testing/convergence/canonical-fixture-readiness.test.ts` reads the Convergence-owned fixture tree through `EVO_CONVERGENCE_FIXTURE_ROOT`.

## Certification result

| Area | Status | Canonical evidence | EVO result |
|---|---|---|---|
| Shared Envelope | **PARTIAL** | `shared-envelope/human-context.valid.json` | Current EVO has enterprise/actor/correlation/causation primitives, but no canonical profile adapter/delegation resolver yet. Fixture is readable; runtime admission not yet certified. |
| Enterprise Observation provider | **PARTIAL** | `business-fact.valid.json`, `duplicate-delivery.valid.json`, `cross-tenant.invalid.json` | Semantics are compatible with current BusinessData/outbox lineage. EVO can prove identity/tenant invariants at fixture level, but cannot yet emit the canonical shape because the provider/projection is not implemented. |
| Command Proposal admission | **PARTIAL** | `use-alternate-supplier.valid.json`, `fake-authorization.invalid.json` | Invalid authorization semantics are understood and must fail closed. Full valid admission cannot pass because the referenced EVO Command is absent and current CommandService does not enforce published input JSON schema. |
| ActionRequest -> Host -> EVO Command | **GAP** | `approve-action.valid.json`, `tampered-confirmation.invalid.json` | Canonical confirmation semantics are compatible; EVO correctly treats authorization as its own responsibility. No Host mapping adapter/public mapping profile exists yet. |
| Operational Change | **GAP** | `sop-change.valid.json`, `stale-base-version.invalid.json`, `json-patch.invalid.json` | Current versioned SOP assets support readiness reasoning, but no public governance admission exists. No runtime refactor is required for v0.2.1. |
| Enterprise Simulation | **PARTIAL** | `fifo-cost.valid.json`, `actual-write.invalid.json` | Existing deterministic cost/valuation assets are reusable. There is no isolated HYPOTHETICAL provider/snapshot namespace; Actual-write fixture must remain rejected by design. |
| APM causal chain | **GAP** | `integration/apm-causal-chain.valid.json` | Correlation/causation and EVO reauthorization semantics align, but chain cannot execute end-to-end until `procurement.use-alternate-supplier` exists and proposal/action adapters are implemented. |

## Canonical fixture checks currently passing

These checks are executable against the external Convergence checkout and do not assert unsupported runtime behavior:

- `enterprise-observation/duplicate-delivery.valid.json`: same semantic `observationId`, distinct `deliveryId`.
- `enterprise-observation/cross-tenant.invalid.json`: source enterprise mismatch is detectable and must fail closed.
- `command-proposal/fake-authorization.invalid.json`: untrusted authorization claim is detected; it must never map to EVO authorization state.
- `command-proposal/use-alternate-supplier.valid.json`: `proposalId != commandIdempotencyKey`; referenced command code is recognized as the APM target but is not currently available in EVO.
- `action-request/approve-action.valid.json`: confirmation evidence contains confirmation, not authorization.
- `action-request/tampered-confirmation.invalid.json`: injected `authorized` confirmation semantics are detectable and must be rejected by the adapter.
- `operational-change/stale-base-version.invalid.json`: stale base/current version mismatch and expected `STALE_BASE_VERSION` are recognized.
- `operational-change/json-patch.invalid.json`: arbitrary JSON Patch vocabulary is recognized as invalid for the governed adapter.
- `simulation/fifo-cost.valid.json` / `simulation/actual-write.invalid.json`: HYPOTHETICAL vs forbidden ACTUAL-write semantics are recognized.
- `integration/apm-causal-chain.valid.json`: causal lineage is preserved and Command admission explicitly requires `EVO_REEVALUATES` authorization.

These are **fixture semantic/readiness checks**, not a claim that missing providers/adapters already execute the contracts.

## Canonical fixtures not yet passable end-to-end

### `enterprise-observation/business-fact.valid.json`

Cannot yet be emitted byte/shape-equivalently by an EVO provider. Current internal outbox event is `business_data.created` with aggregate/payload delivery infrastructure. A deterministic provider must derive canonical `observationId`, keep delivery identity separate, map `effectiveAt` from BusinessData, set observed/published times at the appropriate provider stages, preserve source object version/tenant/correlation/provenance and apply redaction before egress.

### `command-proposal/use-alternate-supplier.valid.json`

Cannot be admitted successfully today because:

1. `procurement.use-alternate-supplier` is absent from the alpha.2 Command catalog;
2. the alpha.2 demo Command schemas are weak (`{type: "object"}`);
3. `CommandService` does not yet validate `proposedInput`/Command input against the published Command schema/version;
4. no Command Proposal adapter exists to enforce expiry, contract/schema version and independent EVO authorization.

### `action-request/approve-action.valid.json`

Cannot execute through the canonical chain because the Host mapping adapter/public EVO mapping profile is absent and the target procurement Command is absent. Confirmation evidence must remain non-authoritative.

### `operational-change/sop-change.valid.json`

Readiness only. EVO has versioned SOP definitions but no cross-system governance admission/review/publish boundary. Do not implement this before the first operational loop.

### `simulation/fifo-cost.valid.json`

Readiness only. Existing FIFO/cost/valuation calculation assets are not yet exposed in an isolated HYPOTHETICAL snapshot provider. Replay must not be repurposed as Simulation.

### `integration/apm-causal-chain.valid.json`

Cannot pass end-to-end until the alternate-supplier Command plus Observation/Proposal/Action adapters exist. No semantic conflict was found in the chain itself.

## Security/admission requirements for first implementation slice

The first adapter implementation must fail closed for:

- enterprise/source enterprise mismatch;
- fake authorization claims in EC proposal;
- authorization claims embedded in confirmation evidence;
- revoked/expired delegation after envelope resolution;
- expired proposal;
- retired/unsupported EVO Command contract/input schema version;
- stale presented state/definition where target Command requires optimistic validation;
- duplicate proposal/action delivery while preserving EVO Command idempotency;
- out-of-order observation delivery without changing semantic observation identity.

## APM public Command gap

Confirmed: current alpha.2 seed has no Procurement application and no formal public `procurement.use-alternate-supplier` Command. This remains an EVO implementation GAP, not a contract semantic conflict. It must be implemented through normal EVO CommandDefinition -> authorization -> CommandService -> BusinessData -> outbox/Observation flow.

## Semantic conflict assessment

**NONE FOUND.**

The canonical fixtures are consistent with the frozen Architecture/Ownership/Contract semantics already reconciled. Current failures are adapter/provider/product-capability gaps. Do not reopen architecture vocabulary for them.

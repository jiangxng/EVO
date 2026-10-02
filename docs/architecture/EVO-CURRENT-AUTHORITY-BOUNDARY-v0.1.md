# EVO Current Authority Boundary v0.1

**Status:** CURRENT_AUTHORITY  
**Purpose:** fast ownership classification before implementation

## Fresh-task rule

Before changing EVO, answer:

> Does this belong to deterministic BusinessData → PostingRule → Ledger → Balance execution?

If **no**, the default owner is outside EVO Ledger Runtime.

## EVO owns

- BusinessData ingestion/runtime dataset semantics;
- deterministic PostingRule evaluation;
- Posting / LedgerEntry / Balance execution;
- replay/recalculation and deterministic ordering;
- runtime export/query needed to operate that deterministic engine;
- the smallest routing anchors required by those semantics.

## EVO does not own by default

- identity, login, session, users, roles or authorization policy;
- Package/Feature lifecycle, Provider resolution or plugin governance;
- LLM/vendor integrations;
- Enterprise Context governance and enterprise organization;
- Human UI, Workbench, UIDL or Designer;
- ChatGPT/Claude/MCP/OpenAPI product compatibility;
- rich application-definition lifecycle;
- long-term enterprise knowledge/learning.

Default owners for these are EVO App Platform/provider plugins, Eidos, Experience Compiler, or an owning business plugin.

## Placement rule

~~~text
deterministic ledger-runtime truth
  -> EVO Ledger Runtime

replaceable platform/vendor service
  -> App Platform Provider Plugin

business/domain product composition
  -> App Platform Application Plugin

Human-facing interaction/design
  -> Eidos Experience

external product/protocol compatibility
  -> Integration Adapter outside EVO runtime

persistent advisory intelligence/learning
  -> Experience Compiler
~~~

Repository location is not ownership. Historical code/docs may remain in EVO without authorizing new runtime responsibility.

## Documentation loading rule

For ordinary work, load current authority first:

1. `LLM.md`
2. `INVARIANTS.md`
3. `architecture.manifest.json`
4. this document
5. only the directly relevant current architecture/contract files

Load decisions/checkpoints/certifications/legacy archaeology only when the task needs rationale, compatibility, migration or forensic history.

Historical evidence is preserved; current authority is allowed to evolve.

## Drift signal

Stop and reassess ownership when a change would add any of these to EVO Core:

- vendor/product branching;
- Human product page logic;
- enterprise membership/permission policy;
- Provider configuration/secrets;
- external Agent compatibility;
- business workflow/product lifecycle unrelated to deterministic posting/ledger execution.

Such pressure is evidence that another owner boundary is being crossed.


## Compatibility API interpretation rule

Current compatibility endpoints and repository modules may expose richer platform behavior during convergence. They are retained implementation assets, not authority expansion.

When `PUBLIC-API.md` documents both target and current alpha surfaces, target Core classification is determined by `project.status.json.targetCoreBoundary` and the accepted minimal-runtime architecture decisions.

Do not infer target ownership from endpoint existence alone.

# EVO Ecosystem Project Boundaries v0.1

**Status:** CURRENT_AUTHORITY  
**Current repository:** EVO  
**Purpose:** identify the four current owner projects and prevent cross-project ownership drift

## Current project set

The active EVO ecosystem has four owner repositories:

| Project | Canonical ownership |
| --- | --- |
| **EVO-App-Platform** | Application/Plugin control plane: Package/Feature lifecycle, capability/provider resolution, identity/session integration, authorization orchestration, Enterprise Context governance, External Agent governance/protocol projection |
| **EVO** | Deterministic business runtime: BusinessData -> PostingRule -> Posting/LedgerEntry -> Balance, replay/recalculation and minimal runtime anchors |
| **Eidos** | Deterministic Human Experience framework: Experience/UIDL contracts, renderers/runtime, Workbench/App Host, Designer-facing capabilities, design language and interaction semantics |
| **Experience-Compiler** | Persistent advisory intelligence: knowledge, memory, learning methods, context compilation, research/reasoning, diagnosis/recommendation/proposals and outcome learning |

These projects cooperate only through public contracts/capabilities.

## Placement rule

Before implementing a new feature, classify ownership first:

~~~text
Package / Feature / Provider / identity / authorization / Enterprise Context governance
  -> EVO-App-Platform

BusinessData / PostingRule / Ledger / Balance deterministic execution
  -> EVO

Human UI / Experience / UIDL / reusable interaction / Designer runtime
  -> Eidos

Persistent enterprise/industry knowledge / learning / reasoning / advisory intelligence
  -> Experience-Compiler
~~~

Further refinement:

~~~text
replaceable supplier / deployment-specific implementation
  -> Provider Plugin (EVO-App-Platform)

external product/protocol compatibility only
  -> Integration Adapter, not business semantics

Human-facing product UI
  -> Experience layer rendered by Eidos

generic hosting/resolution/security/composition mechanism
  -> App Platform Core only when no plugin/provider/Experience owner fits
~~~

## Cross-project rule

A repository MUST NOT absorb another project's private implementation merely because a local feature needs it.

Use:

- public contracts;
- versioned capability/command/query interfaces;
- stable identifiers;
- explicit adapters at the boundary.

If a needed reusable Human interaction is missing, extend Eidos first.  
If a needed replaceable platform service is missing, add a Provider Plugin in EVO-App-Platform.  
If a needed deterministic ledger/runtime semantic is missing, change EVO.  
If a needed persistent intelligence/learning semantic is missing, change Experience-Compiler.

## Data / design separation

~~~text
authoritative data/rules
  -> owning runtime/provider/application

public command/query/capability
  -> stable boundary

Experience / UIDL / Designer output
  -> Human interaction only

Eidos
  -> deterministic rendering/runtime
~~~

Experience/Designer output never becomes authoritative enterprise data merely because it initiates a mutation.

## External Agent / model rule

- OpenAI / Anthropic / DeepSeek / Gemini / local model implementations are replaceable Provider concerns.
- ChatGPT / Claude / other product-specific compatibility is an Integration Adapter concern.
- Capability/business semantics remain owned by the originating plugin/runtime.
- External Agent adapters do not grant authority or own Enterprise Context membership.

## Retired convergence repository

`EVO-EC-Eidos-Convergence` is historical convergence evidence only. It is **not** one of the current owner projects and MUST NOT be used as current architecture authority or as the destination for new product functionality.

## Documentation loading

Fresh work should read this current boundary plus the current repository's own LLM/invariant/current-authority files.

Historical ADRs, checkpoints, certifications and migration evidence are loaded only when rationale, compatibility, archaeology or forensic history is actually needed.

Current authority may evolve; important historical decisions remain preserved in the owning repository's decision/history mechanism.

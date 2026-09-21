# EVO LLM Context Contract

Status: Authoritative
Context Contract Version: 1.2

This file is model-agnostic. It is intended for GPT, Claude, Gemini, local/open models, coding agents and future systems.

## Goal: LLM Context Determinism

Different LLMs are allowed to propose different implementations. They are not allowed to reinterpret EVO's canonical philosophy, concepts, invariants or public contracts without an explicit architecture change.

A model must be able to understand EVO from the repository without relying on prior chat history, account memory, hidden prompts or undocumented conventions.

## Deterministic Bootstrap

`AGENTS.md` is the concise, automatically discoverable cross-model entry point.
This file defines the deeper project contract. `context.manifest.json` is the
machine-readable router; `project.status.json` is the maintained machine-readable
pointer to current packet, evidence, closed gates, open gates, and next action;
`requirements.status.json` is the machine-readable business-intent, acceptance,
deferred-scope, and anti-overdesign boundary.

Do not use one mandatory read list for every task. Select one read profile from
`context.manifest.json`:

- `boundedModuleChange` for a local implementation or bug fix;
- `crossModuleArchitecture` for architecture/contracts spanning modules;
- `continuation` for "continue" or a new chat/model handoff;
- `archaeology` only for a named legacy-evidence question.

Module `CONTEXT.md` is optional. Read it when present; do not invent it or scan
the repository because a module does not have one.

Stop broad reading once you can identify the business goal, active packet,
owner module, affected invariant/interface, evidence level, and next validation.

## Two-Axis Authority

Do not force all conflicts into one total priority list.

### Executable reality

Current code, migrations, database constraints, executable tests, and verified CI
determine what EVO actually does now.

### Normative intent

Current Architecture Changes/ADRs, global Invariants, public contracts, and
accepted freezes determine what EVO is required to do.

Latest checkpoints/status documents determine current progress and next work.
Certification packets prove only their named scenario and boundary. Comments,
examples, legacy documents, chat history, and model memory are lower-authority
context.

If executable reality and normative intent conflict, report document or
implementation drift. Do not silently redefine architecture from an accidental
test, and do not claim an unimplemented ADR is runtime reality.

## Required Change Behavior

Before changing code, state internally:

- owner module
- impacted public interfaces
- impacted invariants
- data migration impact
- replay/determinism impact
- compatibility impact
- required tests

Do not create a new core concept solely to simplify implementation.

Before a material change, classify the evidence target as one of:

`DESIGN ONLY`, `IMPLEMENTED`, `STATIC VERIFIED`, `UNIT VERIFIED`,
`DATABASE E2E VERIFIED`, or `CERTIFIED — named scenario/boundary`.

## Forbidden Assumptions

- Do not assume BusinessData is a mutable current-state table.
- Do not replay by calling Commands.
- Do not let AI directly insert Actual BusinessData.
- Do not infer fulfillment/causation from equal quantities or matching timestamps.
- Do not write derived Cost results directly into balances without a declared valuation-posting interface.
- Do not treat Application as the enterprise truth model.
- Do not silently select latest metadata/rules for historical reconstruction.

## Output Expectations for Coding Agents

A code change should include, when relevant:

- implementation
- interface/schema changes
- migration
- contract tests
- architecture/invariant tests
- documentation/ADR update
- compatibility statement
- reproducible validation command

The repository, not the conversation, is EVO's long-term memory.

## Documentation Lifecycle

Versioned ADRs, freezes, checkpoints, database snapshots, certifications, and
genealogy evidence are additive. Root instruction/router files, index READMEs,
and ordinary module README/CONTEXT files are maintained pointers and may be
updated in place.

The detailed rules live in the manifest-designated documentation standard.
Run `npm run validate:docs` after changing bootstrap, routing, current pointers,
or versioned evidence paths.


## Code Progress Markers

Use `project.status.json` as the only authoritative machine-readable current progress pointer. Code-local `EVO-WORK-PACKET`, `EVO-INVARIANT`, `EVO-EVIDENCE`, and `EVO-TODO-GATE` comments are optional navigation aids and must follow `docs/architecture/continuity/EVO-CODE-PROGRESS-MARKER-STANDARD-v0.1.md`. Do not encode percentages, chat-window state, or branch names as durable code progress comments.


## Branch Analysis Determinism

Before branch merge/delete/revival decisions, read `branch.topology.json`. Branch authority must not be inferred from branch names, age, commit counts, or PR openness. Use GitHub compare results plus the topology class. If GitHub reality conflicts with the topology file, report `BRANCH_TOPOLOGY_DRIFT` and repair the topology before recommending a merge.


## Human–LLM Requirement Alignment

LLMs own technology selection and implementation inside confirmed business intent.
They do not own silent requirement reinterpretation.

Before material architecture/generalization work, establish:

- the current requirement and business problem;
- observable acceptance outcome;
- why existing capability is insufficient;
- the smallest sufficient change;
- explicit non-goals;
- evidence target.

Use the four anti-overdesign questions in `requirements.status.json`. "May be
useful later", "more generic", or "best practice" is not sufficient by itself.

When an alignment trigger fires, use the manifest-designated Human–LLM Requirement
Alignment Protocol before expanding scope.

Default progress explanation order:

`BUSINESS → PRODUCT → TECHNICAL`

A human stakeholder must be able to judge requirement alignment without first
understanding internal class names, replay topology, database mechanics, or other
implementation detail.

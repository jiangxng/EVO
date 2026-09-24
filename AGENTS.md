# EVO Repository Instructions for AI Agents

These instructions are model-agnostic. They apply to Codex, Claude, Copilot,
Gemini, local models, and future coding agents working in this repository.

## Mission

This repository preserves the broader **EVO product knowledge space** and currently contains the implementation of the **EVO Ledger Runtime** (Chinese product alias: **EVO 账本引擎**).

The repository is intentionally broader than the Ledger Runtime. Do not delete valid product requirements merely because they are outside the Ledger Runtime boundary.
The EVO Ledger Runtime minimal target is BusinessData submission(applicationId) → ApplicationAnchor → current PostingRules(applicationId) → LedgerEntry → LedgerBalance,
plus runtime recalculation, clear, export and generic result/status queries.

Identity, permissions, rich Application/Package/Feature lifecycle, capability discovery,
rule-version governance, finance/statutory accounting, audit/archive and UI/Agent
orchestration are outside the EVO Ledger Runtime by default. Do not expand Core merely because
an implementation module currently exists in this repository.

## Start here — do not read all documents

1. Read `LLM.md`.
2. Read `context.manifest.json`; it is the machine-readable router.
3. Read `project.status.json`; it is the maintained machine-readable current progress pointer.
4. Read `requirements.status.json`; it is the machine-readable business requirement and anti-overdesign boundary.
5. Read `branch.topology.json` before analyzing, comparing, merging, deleting, or reviving branches.
6. Select exactly one read profile before opening more documents.
7. For a bounded change, read only the target module `README.md`, its
   `CONTEXT.md` if present, relevant public interfaces/ADRs, and nearby tests.
8. Read `docs/architecture/legacy/**` only for an explicit archaeology or
   genealogy question. Legacy documents are evidence, not current instructions.

If a path in the manifest is missing or contradictory, stop and report document
drift. Do not guess a replacement from file names.

## Two-axis authority model

There is no single total ordering for every conflict:

- **Repository reality** — current code, migrations, executable tests, database
  constraints, and verified CI decide what the system actually does now.
- **Normative intent** — current ADRs, Invariants, public contracts, and accepted
  architecture freezes decide what the system is required to do.

If reality and intent disagree, classify it as drift. Do not silently treat the
implementation as a new architecture decision, and do not claim unexecuted
design text is implemented.

Progress documents and checkpoints report validation state; certification
packets prove only their named scenario and boundary. Chat history and model
memory are hints only.

## EVO Ledger Runtime boundary

Before adding a Core responsibility, ask:

> Can generic BusinessData → PostingRule → Ledger → Balance still function if this capability is outside EVO?

If yes, keep it outside Core by default.

The EVO Ledger Runtime owns only minimal ApplicationAnchor/applicationId routing. It does not own identity, permissions, rich enterprise/application lifecycle, Package/Feature lifecycle, capability discovery, Command orchestration, PostingRule versions, finance/accounting governance, workflow, SOP, metrics, audit/archive or UI/Agent concerns.

Read `docs/architecture/decisions/2026-09-24-evo-minimal-runtime-plugin-boundary-v0.1.md` and its refinement `docs/architecture/decisions/2026-09-24-minimal-application-routing-anchor-v0.1.md`.

BusinessData.applicationId and PostingRule.applicationId are mandatory routing anchors; never infer rule ownership from payload shape.

Repository-scope authority: `docs/architecture/decisions/2026-09-24-evo-repository-vs-ledger-runtime-scope-v0.1.md`.

When reading a broad EVO requirement, classify ownership before implementation. Preserve the document even when ownership is outside the Ledger Runtime.

## Human + LLM operability

All configurable business capability must satisfy `docs/architecture/principles/HUMAN-LLM-OPERABILITY-v0.1.md`.

Do not assume a human developer role. Treat LLMs as the default engineers for design, implementation, extension, migration, tests, documentation and maintenance. Do not design a normal business workflow that requires SQL, source-code edits, hidden APIs, or knowledge of internal class/AST structures.

Prefer one business-readable semantic source that can be validated/compiled into machine form. Preserve domain terminology, explanations, examples and business-facing errors.

## Required working behavior

- Preserve unrelated user changes and inspect the worktree before editing.
- Identify the confirmed business requirement, acceptance outcome, owning module,
  affected invariants/interfaces, migration impact, replay/determinism impact,
  compatibility impact, and required evidence.
- Before introducing a material abstraction/generalization, answer the four anti-overdesign questions in `requirements.status.json`.
- Prefer small explicit contracts and bounded modules over hidden conventions.
- Never perform hidden Core selection of PostingRule versions; rule lifecycle/selection belongs to the supplying plugin. For any other retained versioned inputs, deterministic reconstruction must use explicit inputs.
- Never rewrite BusinessData in place while it exists in the active runtime dataset. Explicit Clear Cache may remove that runtime data.
- Recalculate retained BusinessData deterministically; Command replay is not a Core requirement.
- Candidate/Oracle/CURRENT derived state must remain generation-scoped.
- A design, implementation, unit test, database E2E, and certification are
  different evidence levels. State the exact level reached.
- Important architecture, checkpoint, database snapshot, archaeology, and
  certification documents are additive. Correct them with a new version or an
  explicit superseding document, not a silent rewrite.

## Ambiguous vocabulary

- **Oracle / Full-Replay Oracle** means an independent full-replay reference
  result used to judge Candidate correctness. It does not mean Oracle Database.
- **CURRENT** means the authoritative active runtime generation, or "current at
  snapshot time" when used in an old document. Check the document date/status.
- **Candidate** means an isolated proposed derived generation, not canonical
  BusinessData.

## Branch and PR pacing

Use short-lived bounded work branches by default, but do not mechanically create one branch per numbered sub-slice.

Closely related slices inside the same confirmed business loop may be combined into one **bundle branch** when:

- they share one business acceptance story;
- included sub-gates and non-goals are explicit;
- one coherent database-E2E scenario can prove the bundle;
- failures remain localizable;
- the PR remains reviewable;
- no unrelated platform/generalization work is mixed in.

`main` is the only authoritative integration branch. ACTIVE_WORK branches are provisional. After merge, classify the source branch as MERGED_MILESTONE and never reuse it for new work.

Before branch merge/delete/revival decisions, follow `branch.topology.json` and live GitHub reality.

## Validation commands

Use Node `24.20.x` and PostgreSQL 18 for the certified pipeline.

```bash
npm install
npm run validate:docs
npm run migrate
npm run typecheck
npm run build
npm test
npm run seed:demo
npm run validate:demo
```

Run the smallest relevant checks while iterating, then the full applicable
sequence before claiming database E2E or certification. If PostgreSQL/Docker is
unavailable, say so and do not relabel local static checks as database evidence.

## Requirement alignment

Technical autonomy operates inside confirmed business intent. A future-use-only benefit is not enough to justify present complexity. Use the manifest-designated Human–LLM Requirement Alignment Protocol when a Stage changes, a business loop closes, a new core abstraction/cross-module infrastructure is proposed, or the human stakeholder reports a comprehension/confidence gap.

Progress communication should default to Business → Product → Technical.

## Stop and escalate when

- two same-level normative sources conflict;
- the manifest points to missing or stale current documents;
- a requested change weakens an invariant or crosses module ownership without an
  explicit architecture decision;
- required credentials, permissions, production data, or destructive authority
  are missing;
- validation cannot reproduce the claimed evidence boundary.

The repository is EVO's durable memory. Keep this file concise; detailed and
versioned policy belongs in the documents routed by `context.manifest.json`.

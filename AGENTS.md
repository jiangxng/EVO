# EVO Repository Instructions for AI Agents

These instructions are model-agnostic. They apply to Codex, Claude, Copilot,
Gemini, local models, and future coding agents working in this repository.

## Mission

EVO is an AI-native Enterprise Operating System. Preserve immutable business
history, deterministic posting/replay, explicit version and policy pins, module
ownership, and auditable evidence. Do not simplify these invariants away.

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

## Required working behavior

- Preserve unrelated user changes and inspect the worktree before editing.
- Identify the confirmed business requirement, acceptance outcome, owning module,
  affected invariants/interfaces, migration impact, replay/determinism impact,
  compatibility impact, and required evidence.
- Before introducing a material abstraction/generalization, answer the four anti-overdesign questions in `requirements.status.json`.
- Prefer small explicit contracts and bounded modules over hidden conventions.
- Never use "latest" implicitly for historical rules, policies, metadata, rates,
  templates, or reference datasets.
- Never rewrite BusinessData history; corrections and reversals are new facts.
- Replay historical facts; do not re-execute historical Commands.
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

# EVO LLM Documentation Operating Standard v0.1

**Status: ACTIVE PROJECT STANDARD**  
**Date: 2026-09-20**  
**Authority scope: LLM documentation routing, lifecycle, evidence labels, and readability**  
**Depends on: `LLM.md`, `context.manifest.json`, repository invariants**

## 1. Purpose

EVO must remain understandable to models with different context windows,
reasoning ability, tool access, instruction discovery, and persistence.

The goal is not to make every model read every document. The goal is to let a
model load the smallest sufficient, non-contradictory context and know when it
has enough information to act safely.

## 2. Failure modes this standard prevents

| Common failure | EVO control |
|---|---|
| Agent never discovers project instructions | Root `AGENTS.md`; adapters for Claude and Copilot |
| Context window is consumed by broad documentation | Task-specific read profiles and explicit stop conditions |
| Old handoff is mistaken for current state | Machine pointer to one current checkpoint |
| Design text is mistaken for implementation | Separate reality, intent, progress, and evidence authority |
| Passing unit tests is called production proof | Fixed evidence-level vocabulary |
| Historical failure is copied as current guidance | Historical/evidence classification and supersession metadata |
| Similar terms are reinterpreted | Required glossary for ambiguous project terms |
| Instructions conflict across files | Two-axis authority model and stop-on-conflict rule |
| Model invents missing paths or versions | Manifest path validation in CI |
| Documentation silently becomes stale | `npm run validate:docs` plus explicit current pointers |

## 3. Document classes

Every important document belongs primarily to one class.

| Class | Purpose | Mutability | Examples |
|---|---|---|---|
| Instruction | Agent behavior and bootstrap | Maintained in place, concise | `AGENTS.md`, `LLM.md` |
| Router | Machine-readable current pointers | Maintained in place, validated | `context.manifest.json` |
| Normative | Required architecture behavior | Versioned/superseded | ADR, Invariants, Contract, Freeze |
| Reality | Actual executable behavior | Changes with implementation | code, migration, test, DB constraint |
| Progress | Current stage and next packet | Append or new checkpoint | status, current checkpoint |
| Evidence | Proof within named boundary | Immutable/additive | certification packet, CI run |
| Historical | Genealogy and discarded/superseded state | Immutable, not default reading | legacy, archaeology history |

One document may reference other classes, but must not blur them. For example, a
certification proves a scenario; it does not automatically redefine the global
architecture.

## 4. Required metadata for new important documents

New versioned architecture, checkpoint, database, correction, and certification
documents must state near the top:

- `Status`;
- date or snapshot date;
- authority scope;
- `Supersedes`, `Depends on`, or `Historical only`, when applicable;
- implementation commit and CI run when claiming executable evidence;
- explicit proof boundary and what remains unproven.

Do not retrofit all historical documents merely for formatting. Add a correction
or router annotation when old metadata could mislead current work.

## 5. Reading profiles and budgets

The router defines the exact files for each profile.

### Bounded module change

Load:

1. root instructions and router;
2. target module README;
3. target module CONTEXT if it exists;
4. relevant interface/ADR/invariant;
5. nearby tests and implementation.

Do not load the architecture series or legacy directory by default.

### Cross-module architecture change

Load the canonical architecture set, latest checkpoint/current status, the
specific ADR/contract, affected module contexts, then tests/schema.

### Continuation / "continue"

Load repository reality, the current protocol, exactly one manifest-designated
checkpoint, current status, and current packet/certification. Open legacy handoff
only when the checkpoint explicitly identifies an unresolved genealogy gap.

### Archaeology

Load pinned legacy evidence only for the named question. Historical evidence may
inform a decision but cannot override current verified reality by age or volume.

Initial bootstrap should normally stay at or below the manifest's
`maxInitialDocuments`. A stronger model may read more, but extra reading is not a
substitute for selecting the correct authority class.

## 6. Stop conditions for reading

Stop broad reading and begin the task when the model can state:

- repository/branch/HEAD and latest verified CI, if relevant;
- business goal and active packet;
- owner module and affected interfaces/invariants;
- current validation level and open gap;
- exact next action and validation command.

If one item is missing, search only for that item. Do not respond by ingesting all
106 documents.

## 7. Evidence levels

Use only these labels:

```text
DESIGN ONLY
IMPLEMENTED
STATIC VERIFIED
UNIT VERIFIED
DATABASE E2E VERIFIED
CERTIFIED — named scenario/boundary
BLOCKED
REJECTED
SUPERSEDED
HISTORICAL ONLY
```

`CERTIFIED` must name the scenario and point to immutable evidence. It never means
all algorithms, failure modes, scales, or deployments are production complete.

## 8. Vocabulary discipline

Ambiguous terms must be defined in `context.manifest.json` and repeated at the
first material use when confusion is likely.

Current mandatory clarification:

> Full-Replay Oracle is an independent reference computation used to judge a
> Candidate. It is unrelated to the Oracle Database product.

Do not introduce a second term for an existing concept solely because another
model prefers different wording. Propose a versioned terminology decision first.

## 9. Additive history and maintained pointers

Versioned decisions, certifications, checkpoints, database snapshots, and
genealogy evidence are additive.

The following are intentional maintained-pointer exceptions:

- `AGENTS.md`;
- `CLAUDE.md`;
- `.github/copilot-instructions.md`;
- `LLM.md`;
- `context.manifest.json`;
- index README files and ordinary module README/CONTEXT files.

These files must point to versioned evidence and may be updated in place so a new
agent does not begin from a stale route.

## 10. Review checklist

Before accepting a documentation change, check:

1. Does it state whether it is instruction, intent, reality, progress, evidence,
   or history?
2. Is its proof boundary explicit?
3. Does it create a second current pointer or contradict the router?
4. Can a weaker model determine what to read next without semantic guessing?
5. Are commands exact and ordered, with prerequisites stated?
6. Are failures preserved as evidence but clearly not current instructions?
7. Does `npm run validate:docs` pass?

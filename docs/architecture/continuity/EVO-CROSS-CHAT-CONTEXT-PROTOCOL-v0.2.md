# EVO Cross-Chat and Cross-Model Context Protocol v0.2

**Status: ACTIVE / SUPERSEDES v0.1 FOR CURRENT RECOVERY**  
**Date: 2026-09-20**  
**Authority scope: current chat/model handoff procedure**  
**Preserves: v0.1 as historical protocol evidence**

## 1. Core rule

Chat is a temporary work cache. Git is durable engineering memory.

New models must recover current state from the repository without reading every
historical chat or document. Different model capability changes how deeply a
task may be reasoned about; it must not change EVO's canonical meanings or proof
labels.

## 2. Deterministic handshake

For "continue EVO" or a new work window:

1. inspect branch, HEAD, worktree, recent commits, and relevant CI;
2. read `AGENTS.md` and `LLM.md`;
3. read `context.manifest.json`;
4. select the `continuation` profile;
5. read exactly the manifest-designated current checkpoint, current status, and
   current certification/packet;
6. load only task-relevant module/interface/test context;
7. state the alignment summary below before material implementation.

Do not automatically read the old 70 KB continuation plan or the full Stage
0→3 handoff. Those files are `HISTORICAL ONLY` unless the current checkpoint
identifies a specific unresolved genealogy question.

## 3. Alignment summary

```text
Repository / branch / HEAD:
Latest verified CI:
Business goal:
Active work packet:
Current validation level:
Closed boundary:
Open gap or blocker:
Next action:
Why it matters to the business:
```

If a field cannot be filled, retrieve only the missing evidence.

## 4. Conflict handling

Use two authority axes:

- executable reality: code, migrations, tests, DB constraints, verified CI;
- normative intent: current ADRs, invariants, public contracts, freezes.

Checkpoint/status documents describe progress. Certification documents prove
only their stated scope. Legacy/chat/model memory is non-authoritative context.

When reality and intent differ, report drift and decide whether the correct task
is an implementation fix or a versioned architecture change. Never silently
rewrite one from the other.

## 5. Handoff checkpoint

Create a new additive checkpoint when:

- a major work packet closes;
- the active packet changes materially;
- a correction changes the next model's route;
- the conversation is being moved or compacted;
- unresolved risk would otherwise depend on chat memory.

Every checkpoint must include branch/HEAD, verified CI, business goal, technical
route, evidence level, closed boundaries, open assumptions/blockers, current
packet, next exact actions, and required reading.

After creating it, update the maintained pointer in `context.manifest.json` and
run `npm run validate:docs`.

## 6. Additive correction

Do not silently overwrite versioned architecture, certification, checkpoint,
database snapshot, or genealogy evidence. Create a new version or correction
that names the prior document and the reason.

Maintained bootstrap/router/module files may be updated in place because their
job is to point to current versioned evidence. Their exception is defined by the
LLM Documentation Operating Standard.

## 7. Capability fallback

If a model has a small context window or weak repository tooling:

- use the manifest `continuation` or `boundedModuleChange` profile;
- do not ask it to summarize the entire architecture series;
- give one owner module, one contract boundary, and one validation target;
- require it to report uncertainty rather than invent missing context.

If a model cannot execute tests or access PostgreSQL, it may produce design or
static evidence but must not claim database E2E or certification.

## 8. Current bootstrap pointer

This protocol intentionally does not embed a checkpoint filename, active packet,
commit, or CI number. Those time-sensitive values live only in
`context.manifest.json`, where CI validates their paths.

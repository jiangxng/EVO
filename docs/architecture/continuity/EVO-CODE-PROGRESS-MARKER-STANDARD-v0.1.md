# EVO Code Progress Marker Standard v0.1

**Status: ACTIVE PROJECT STANDARD**  
**Date: 2026-09-21**  
**Authority scope: code-local progress markers, work-packet traceability, and LLM handoff**  
**Depends on: `AGENTS.md`, `LLM.md`, `context.manifest.json`, `project.status.json`**

## 1. Purpose

EVO is developed through many bounded work packets and may be continued by different
LLMs with different context windows. The repository must reveal not only what the
code does, but also which work packet owns an unfinished boundary and what evidence
has actually been reached.

The authoritative current progress pointer is:

`project.status.json`

Code comments are secondary local navigation aids. They must never become a second
source of truth for project status.

## 2. Allowed markers

Use only when the marker materially helps a future maintainer or LLM understand a
non-obvious boundary.

```ts
// EVO-WORK-PACKET: ER-C05B4.4B
// EVO-INVARIANT: Official reads must resolve the unique CURRENT/ACTIVE generation.
// EVO-EVIDENCE: DATABASE E2E VERIFIED — scripts/validate-activation-failure-matrix.ts
// EVO-TODO-GATE: Worker concurrency certification remains open.
```

### EVO-WORK-PACKET

Use at the implementation seam where a named packet materially changes behavior.
Do not stamp every file touched by a packet.

### EVO-INVARIANT

Use for durable architectural rules that would be dangerous to accidentally
simplify away. Prefer an existing invariant/ADR reference when available.

### EVO-EVIDENCE

Use only beside a validation harness, safety gate, or implementation whose proof
boundary would otherwise be unclear. Name the exact evidence level or script.

### EVO-TODO-GATE

Use only for an explicit unclosed evidence gate that is intentionally left in the
code path. It must name the gate, not a vague future improvement.

## 3. Forbidden markers

Do not write volatile comments such as:

- "70% complete";
- "current branch is ...";
- "we discussed this in ChatGPT window 4";
- "almost certified";
- "temporary until next model";
- whole-project completion claims inside a local module.

These become stale quickly and mislead weaker models.

## 4. Update rule

When a work packet advances:

1. update `project.status.json`;
2. update the maintained current status document;
3. add or revise code-local markers only where the implementation boundary changed;
4. add immutable certification/checkpoint evidence when the evidence level warrants it;
5. run `npm run validate:docs`.

A code marker does not replace tests, CI, a certification packet, or the current
status document.

## 5. Branch lifecycle

Prefer:

```text
small work-packet branch
→ bounded implementation
→ exact validation
→ explicit evidence status
→ merge verified slice to main
→ next short-lived branch
```

Do not keep a broad integration branch alive merely because the overall program
phase is unfinished. A verified bounded slice may merge while the parent work
packet remains open, provided `project.status.json` and the progress document say
exactly which gates remain.

## 6. Fresh-LLM bootstrap

A continuation agent should be able to answer these questions after reading
`AGENTS.md`, `LLM.md`, `context.manifest.json`, and `project.status.json`:

- What is the active packet?
- What evidence level is reached?
- What is already verified?
- What remains open?
- What is the authoritative branch?
- What should be implemented next?

If those answers disagree with code/tests/CI, classify the status pointer as drift
and repair it before claiming further progress.

# EVO LLM Documentation Audit — 2026-09-20 v0.1

**Status: COMPLETED / REMEDIATION IMPLEMENTED**  
**Authority scope: documentation-system audit, not product-runtime certification**  
**Repository baseline inspected: `23df7e3f0825cb779585a3045f37b632dffba6e9`**

## 1. Conclusion

EVO's documentation has unusually strong architecture, invariants, evidence,
version history, and business explanations. It is already better than a typical
LLM-maintained repository at preserving why decisions exist.

Its main risk was not missing detail. It was routing ambiguity: 106 documents,
large historical files, stale current pointers, and no automatically discovered
cross-model instruction file could cause weaker models to load the wrong context
or mistake history for current work.

## 2. Findings

| Severity | Finding | Risk |
|---|---|---|
| High | No root `AGENTS.md` | Some agents never load `LLM.md` before acting |
| High | v0.1 continuity protocol points to legacy continuation as current | Model resumes an old gate |
| High | Conflicting total authority orders | Model silently chooses design or code depending on preference |
| Medium | `LLM.md` says contract v1.0 while manifest says v1.1 | Bootstrap contract appears internally inconsistent |
| Medium | One mandatory read order for both tiny and cross-module tasks | Excess context and instruction dilution |
| Medium | Module `CONTEXT.md` is described as mandatory but absent in many modules | Model invents or searches broadly |
| Medium | Several implemented module READMEs still say `M0 placeholder` | Current capability is understated or misunderstood |
| Medium | `Oracle` can be confused with the database vendor | Terminology error for non-project-aware models |
| Low | Architecture README lists a series but not the current task route | Sequential numbering is mistaken for mandatory reading |
| Low | Current document pointers were not CI validated | Renames and stale paths can survive review |

## 3. Remediation

- added concise `AGENTS.md` as the shared automatic instruction source;
- added Claude and Copilot adapters without duplicating policy;
- replaced one-size-fits-all reading with bounded, architecture, continuation,
  and archaeology profiles;
- defined separate executable-reality and normative-intent authority axes;
- designated one machine-readable current checkpoint/status/certification route;
- added explicit terminology for Full-Replay Oracle;
- added a v0.2 cross-chat/cross-model protocol without deleting v0.1;
- added a documentation operating standard and evidence vocabulary;
- added `npm run validate:docs` and CI enforcement;
- corrected active module status text where placeholder wording was stale.

## 4. Remaining limitations

- Historical documents have heterogeneous headers. They are preserved rather
  than mechanically rewritten.
- Not every module needs a `CONTEXT.md`; the router now treats it as optional.
- Semantic contradiction detection still requires review; CI validates routing
  structure and critical markers, not the truth of every paragraph.
- Model compliance cannot be guaranteed by prose alone. Database constraints,
  architecture tests, and CI remain the enforcement layer.

## 5. Recommended maintenance

At every major checkpoint:

1. create additive versioned evidence;
2. update only the maintained current pointers;
3. keep `AGENTS.md` concise and free of commit-specific state;
4. run `npm run validate:docs`;
5. test that a fresh agent can state the current packet without opening legacy.

## 6. External compatibility basis

The remediation deliberately uses the common denominator supported by major
coding-agent ecosystems rather than relying on one model's prompt behavior:

- [OpenAI Codex AGENTS.md guidance](https://developers.openai.com/codex/guides/agents-md)
  documents automatic repository instruction discovery, directory-scoped
  layering, and a bounded combined instruction size;
- [Anthropic Claude Code project memory guidance](https://docs.anthropic.com/en/docs/claude-code/memory)
  documents project instruction layering and support for `AGENTS.md`, with
  `CLAUDE.md` import available as a compatibility route;
- [GitHub Copilot repository custom instructions](https://docs.github.com/en/copilot/how-tos/configure-custom-instructions/add-repository-instructions)
  recommends concise repository instructions that state validated build order,
  project layout, prerequisites, failures, and workarounds.

These mechanisms improve discovery, but prose remains advisory. EVO therefore
keeps invariants enforceable in code, database constraints, tests, and CI.

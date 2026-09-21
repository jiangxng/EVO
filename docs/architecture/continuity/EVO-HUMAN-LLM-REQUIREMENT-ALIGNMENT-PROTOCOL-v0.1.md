# EVO Human–LLM Requirement Alignment Protocol v0.1

**Status: ACTIVE PROJECT STANDARD**  
**Date: 2026-09-22**  
**Authority scope: requirement alignment, human comprehensibility, anti-overdesign control**

## 1. Principle

EVO is LLM-native.

LLMs may choose technologies and implementation structures, but they must not
silently redefine the business problem to fit a preferred technology.

Technical autonomy operates inside confirmed business intent.

## 2. Mandatory artifacts

The alignment layer consists of:

- `docs/product/EVO-BUSINESS-REQUIREMENT-BASELINE-v0.1.md`
- `docs/architecture/status/EVO-REQUIREMENT-CAPABILITY-EVIDENCE-MATRIX-v0.1.md`
- `requirements.status.json`

The human-readable documents explain intent. The JSON file gives every model the
same machine-readable alignment state.

## 3. Pre-change requirement gate

Before a material architecture/generalization change, the implementing LLM must
be able to state:

- requirementId;
- business problem;
- acceptance outcome;
- why current implementation is insufficient;
- smallest sufficient change;
- what is explicitly not being solved;
- evidence target.

If it cannot, the change is not ready for implementation.

## 4. Anti-overdesign gate

A material design is blocked unless at least one current requirement would be
unmet without it.

"May be useful later", "more elegant", "more generic", and "industry best
practice" are not sufficient by themselves.

Prefer:

```text
current confirmed need
→ smallest sufficient capability
→ evidence
→ later generalization when second/third real use case appears
```

over:

```text
generic framework
→ hypothetical future flexibility
→ search for current use case
```

## 5. Alignment triggers

Perform a formal alignment review when any of these occurs:

- Stage transition;
- completed enterprise business loop;
- 3–5 completed work packets since last review;
- new core abstraction;
- new major database family;
- new cross-module infrastructure;
- local mechanism proposed as generic framework;
- human stakeholder reports loss of confidence or comprehension;
- explicit request for requirement alignment.

## 6. Alignment review output

Every review must produce a concise business-language answer for:

1. final project goal;
2. current Stage goal;
3. active packet business acceptance;
4. satisfied requirements;
5. unmet requirements;
6. necessary technical design;
7. deferred design;
8. suspected overdesign;
9. next step and why it matters.

## 7. Three-layer explanation rule

Progress communication should default to:

1. **Business** — what enterprise capability changed?
2. **Product** — what behavior/result will users observe?
3. **Technical** — how is it implemented/proven?

Do not require the human stakeholder to understand the technical layer before
they can judge requirement alignment.

## 8. Drift classes

Use explicit drift labels:

- `REQUIREMENT_DRIFT`: implementation no longer maps to confirmed requirement;
- `SCOPE_DRIFT`: packet grows beyond accepted acceptance boundary;
- `OVERDESIGN_RISK`: complexity is primarily justified by hypothetical future use;
- `COMPREHENSION_GAP`: progress cannot be explained in business/product language;
- `STATUS_DRIFT`: repository current pointers disagree with GitHub/runtime reality.

A drift does not automatically mean code is wrong. It means alignment must be
repaired before expanding scope.

## 9. Human approval semantics

Human understanding is required at the level of:

- business problem;
- acceptance result;
- important tradeoff;
- irreversible constraint.

Human approval is **not** required for every library, table index, algorithmic
implementation detail, or internal class name when those remain inside the
accepted boundary.

## 10. LLM handoff requirement

A fresh model must not start significant new architecture work until it can
answer from repository artifacts:

- What user/business need does the active packet serve?
- What exact acceptance outcome defines done?
- Which requirements are already evidenced?
- Which are still open?
- Which adjacent ideas are intentionally deferred?
- What would count as overdesign here?

If answers are missing or contradictory, report alignment drift before coding.


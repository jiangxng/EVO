# ADR — Minimal Application Routing Anchor in EVO Core v0.1

**Status: ACCEPTED**  
**Date: 2026-09-24**  
**Refines:** `2026-09-24-evo-minimal-runtime-plugin-boundary-v0.1.md`

---

## 1. Correction

The minimal-runtime decision moved Application ownership too far outside EVO Core.

EVO does **not** own rich Application lifecycle/metadata, but it MUST own a minimal stable Application routing anchor so incoming BusinessData can be matched to the correct PostingRules.

Canonical Core concept:

```text
ApplicationAnchor
= applicationId
```

The anchor may physically contain only a stable identifier.

It is not:

- an App Platform package manifest;
- an Application UI definition;
- installation/activation state;
- permissions;
- fields/forms/pages;
- command definitions;
- application version history.

---

## 2. Why the anchor is required

An EVO instance may contain tens, hundreds, or more PostingRules.

When BusinessData arrives, EVO needs a deterministic first routing key before evaluating rule conditions.

Therefore:

```text
BusinessDataSubmission.applicationId
        ↓
select PostingRules where rule.applicationId == submission.applicationId
        ↓
deterministic ordering
        ↓
evaluate each rule condition
        ↓
emit Ledger effects for matching rules
```

Without `applicationId`, Core would have to evaluate unrelated rule sets or infer business ownership from payload shape, both of which are rejected.

---

## 3. Minimal BusinessDataSubmission

Target logical input:

```text
scopeKey
applicationId
businessDataType
businessObjectKey
effectiveAt
payload
correlation/idempotency identity
```

`scopeKey` isolates the runtime/tenant dataset.

`applicationId` identifies the Core ApplicationAnchor used for PostingRule routing.

EVO Core does not need the Host's rich Application definition in order to interpret either key.

---

## 4. PostingRule ownership

PostingRules themselves are current executable configuration inside EVO Core.

Minimal logical PostingRule:

```text
ruleId
applicationId
priority
conditionAst
effectAst
ruleSchemaVersion
```

The mandatory relationship is:

```text
PostingRule.applicationId
→ ApplicationAnchor.applicationId
```

A rule plugin/package may register, replace, or otherwise manage the current rules supplied to EVO.

Core does **not** own:

- rule business versions;
- draft/publish history;
- effective-date history;
- approvals;
- rollback history.

Those are plugin governance concerns.

Core may store the currently executable rule document and stable rule identity/hash required to execute and diagnose the current runtime.

---

## 5. Deterministic rule routing

For each accepted BusinessData item:

1. validate that `applicationId` identifies a registered ApplicationAnchor;
2. persist BusinessData with that `applicationId`;
3. select candidate PostingRules by exact `applicationId`;
4. order candidates deterministically, initially by `priority + stable ruleId`;
5. evaluate each candidate condition;
6. apply effects for every matching rule;
7. atomically produce/update runtime posting/ledger results according to existing Posting invariants.

Multiple rules may match one BusinessData item.

No rule may be selected merely because its payload fields happen to resemble the submitted data.

---

## 6. ApplicationAnchor ownership boundary

EVO Core owns only the routing identity.

Example:

```text
ApplicationAnchor
{
  applicationId: "trading-lite"
}
```

The Host/App Platform may separately own:

```text
displayName
packageId
featureId
installation state
activation scope
permissions
navigation
pages
commands/actions
application configuration
application version
publisher
upgrade lifecycle
```

The Host's rich Application object and EVO's ApplicationAnchor may share the same stable ID, but they are different contracts.

---

## 7. Installation / contribution model

An installable business App that uses EVO may contribute:

```text
Application package
→ register EVO ApplicationAnchor(applicationId)
→ register current PostingRules(applicationId)
→ submit BusinessData(applicationId)
```

App Manager owns package/application lifecycle.

EVO only receives the runtime anchor and current executable rules.

---

## 8. Clear Cache

Clear Cache removes runtime business data/results, including application-scoped BusinessData and derived Posting/Ledger/Balance state.

Clear Cache MUST preserve:

- ApplicationAnchor;
- current PostingRules;
- Ledger/runtime definitions required to process new BusinessData.

This allows:

```text
clear application runtime data
→ keep applicationId + current rules
→ resubmit source data
→ EVO routes to the same application rule set
→ automatic Posting
```

ApplicationAnchor and PostingRules are Core configuration, not cache data.

---

## 9. Recalculation

EVO-side recalculation uses retained BusinessData.applicationId to route each item back to its current supplied rule set.

Application-side recalculation may clear an application-scoped runtime dataset and resubmit BusinessData with the same `applicationId`.

EVO does not interpret the caller's motive.

---

## 10. Error behavior

At minimum, the target runtime contract should fail explicitly for:

```text
APPLICATION_ANCHOR_NOT_FOUND
APPLICATION_ID_REQUIRED
POSTING_RULE_APPLICATION_MISMATCH
```

Whether an Application has zero PostingRules may be valid; it means accepted BusinessData produces no rule-derived Ledger effects unless another explicit runtime contract says otherwise.

---

## 11. Core boundary after correction

Target minimal EVO Core becomes:

```text
ApplicationAnchor
+ BusinessData
+ current PostingRules
+ Posting
+ LedgerEntry
+ LedgerBalance
+ recalculation
+ clear
+ export
+ generic result/status query
```

Still outside Core:

```text
identity / permissions
rich Application definition
Package / Feature lifecycle
capability discovery
Command/workflow/approval
PostingRule version governance
UI / Agent orchestration
audit/archive
domain-specific higher-order engines by default
```

---

## 12. Key invariant

> Application identity is a Core routing key; Application lifecycle is not a Core responsibility.

This is the durable distinction future implementations and LLMs must preserve.

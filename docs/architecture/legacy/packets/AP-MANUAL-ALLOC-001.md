# AP-MANUAL-ALLOC-001 — Manual vs Automatic Allocation

**Status:** SEMANTIC GATE CLOSED — one legacy mixed-mode implementation inconsistency preserved  
**Date:** 2026-09-18  
**Scope:** Asloop-Backend → EVO Allocation / Matching semantics  
**Branch:** `evo/apm-certification-enterprise-template-v0.1`

---

## 0. Question

Which source-consumption relations are explicit business/human decisions, and which are algorithm-generated interpretation results?

This distinction determines what EVO must preserve canonically versus what can be deterministically rebuilt.

---

## 1. Sources inspected

Primary source objects:

- `MatchedConfiguration.java`
- `CostMatchStrategy.java`
- `CalcDetailSearchHandler.java`
- `DataClassification.java`
- `ClassifyInfo.java`
- `LocationBindingStrategy.java`
- `AbstractVerificationCalculate.java`
- `VerificationCalculateImpl.java`
- `NegativeVerificationCalculateImpl.java`
- `ActiveMatchRevokerImpl.java`
- `MatchedRevokerImpl.java`
- `NoMatchRevokerImpl.java`
- `CalcDetailMapper.java/xml`
- `TransDetail.java`
- current `c_component`, `calc_rel`, `trans_type` definition data

This packet intentionally does **not** treat the separate `impl/manual` package for manual accounting entries as proof of manual source allocation. “Manual journal entry” and “manual matching/allocation” are different semantics.

---

## 2. OBSERVED — legacy defines three match modes

`MatchedConfiguration.MatchType` defines:

- `AUTO_MATCH(1)`
- `MANUAL_MATCH(2)`
- `MANUAL_TO_AUTO_MATCH(3)`

Therefore manual versus automatic selection is an explicit runtime policy dimension, not an accidental UI behavior.

---

## 3. OBSERVED — manual selection originates from business transaction fields

`TransDetail` contains:

`TRANS_MATCHED_CODE / transMatchedCode`

with the direct source comment:

> 核销单号，用于手动核销

`MatchedConfiguration.buildDefaultMatch()` reads the manual target from the current business transaction.

If `Component.manuallyField` is configured, it can map:

`query-side field [, current-business-side field]`

Example:

`processCode,transMatchedCode`

means:

- query the historical source using `PROCESS_CODE`;
- take the selection value from current transaction `transMatchedCode`.

If no custom mapping exists, manual match defaults to `transMatchedCode`.

**Observed implication:** the selected source identity/constraint is part of the business transaction input, not invented by the allocation engine after the fact.

---

## 4. OBSERVED — manual selection becomes a candidate-set constraint

`CalcDetailMapper.findCalcData()` applies:

- equality against the configured manual query field when a manual target exists;
- exclusion of that target when mixed manual→auto mode falls back to automatic matching.

`MatchedConfiguration` converts camel-case manual fields to database fields and stores:

- `manuallyField`;
- `underManuallyField`;
- `transMatchedCodeValue`.

For strict manual matching, a missing target raises:

`手动核销必须指定被核销交易号`.

Therefore strict manual mode is not merely a preferred ordering.

It is a **hard source-selection constraint**.

---

## 5. OBSERVED — automatic matching selects from eligible historical open state

Automatic matching:

1. binds container/dimension fields;
2. applies collector conditions;
3. applies configured sorting;
4. queries historical `trans_detail_calc`;
5. accumulates candidates until required quantity/amount is covered;
6. splits final source where partial consumption is required;
7. generates verification/matching results.

The exact selected source rows are therefore an output of:

`facts + policy + dimensions + ordering + current open state`.

**Normalized:** automatic source choice is an `AllocationInterpretationResult`, not a new business fact.

---

## 6. OBSERVED — generated matching edges and balances are runtime results

Verification and revoke code manipulates derived calculation fields including:

- `PARENT_ID`;
- `TRANS_MATCHED_DETAIL_ID`;
- `TRANS_MATCHED_CODE` on calculation rows;
- `TRANS_MATCHED_SEQ`;
- `MATCH_APP_ID`;
- `ORIGIN_ID`;
- `QTY_WATER_BAL`;
- `AMNT_WATER_BAL`;
- `QTY_TB_MATCHED`;
- `AMNT_TB_MATCHED`.

`MatchedRevokerImpl` clears/restores these calculation-level links/balances when a matched result is revoked.

`ActiveMatchRevokerImpl` reconstructs the match queue and restores derived open balances / sequence state.

This is strong evidence that these are calculation/materialization state, not immutable source business truth.

---

## 7. OBSERVED — revoke does not erase the business-side manual instruction

The revoke implementation operates on `CalcDetailPojo / trans_detail_calc`.

It clears calculation lineage and restores matching balances.

The original `TransDetail.TRANS_MATCHED_CODE` business field is not the target of these revoke operations.

**Interpretation:** replaying the same immutable business occurrence can reapply the same manual source-selection instruction.

This is the key persistence distinction.

---

## 8. Manual selection is not necessarily one final allocation edge

A manual instruction may identify:

- a transaction code;
- a process/work-order code;
- another configured business field.

The selected value may still resolve to multiple eligible calculation rows and may still require splitting.

Therefore:

`Manual Instruction != Generated Allocation Edge`

A manual instruction constrains source identity/scope.

The calculation engine can then derive one or more allocation edges under the pinned matching policy.

This distinction is important for EVO because persisting only the final edge loses the user's business intent; persisting only a generic “manual=true” flag loses the target constraint.

---

## 9. Mixed manual→automatic behavior

`CostMatchStrategy` explicitly defines intended mixed behavior:

1. if a manual target exists, consume it first;
2. if the requirement remains uncovered, exclude that selected source from the next search;
3. automatically select additional sources for the residual.

Semantic model:

`Manual allocation constraint`
` → deterministic allocation against selected source`
` → residual requirement`
` → automatic allocation policy`
` → additional derived edges`

This is a valuable EVO behavior because explicit business intent and deterministic completion can coexist.

### Legacy inconsistency U-MANUAL-001

Current inspected `MatchedConfiguration.buildDefaultMatch()` only initializes `transMatchedCodeValue` inside the strict `MANUAL_MATCH(2)` branch.

Yet `CostMatchStrategy` has explicit `MANUAL_TO_AUTO_MATCH(3)` logic that expects `transMatchedCodeValue` to exist.

No second initialization path was recovered in the inspected matching source set.

Therefore one of these is true:

- another population path exists outside the recovered source set;
- mode 3 is partially broken/dead in this revision;
- mode 3 historically depended on a different initialization flow.

**Do not normalize this inconsistency into EVO behavior.**

Preserve the semantic intent of “manual first, automatic residual” because the responsibility chain explicitly defines it, but design EVO's implementation independently and test it directly.

---

## 10. Legacy examples show manual matching is broad, not AR/AP-only

Recovered `c_component` rows use manual match semantics across operational and financial/resource relations.

Examples include:

- 销售出库 → 待交付的订单;
- 原料采购进货 → 待验收采购订单;
- 工单任务派工 → 工单待派工;
- 工单验收 → 待验收加工订单;
- 增值税收票 → 待收票;
- 增值税开票 → 待开票;
- production/work-order close paths;
- inventory/facility/resource consumption paths;
- current-account matching.

This further confirms that the canonical concept is **Allocation / Source Consumption**, not “receivable write-off”.

---

## 11. Classification matrix

| Relation kind | Source of decision | Canonical evidence | Rebuild behavior | EVO candidate |
|---|---|---|---|---|
| Explicit user/business-selected settlement/source | business occurrence field such as target transaction/process code | preserve selection instruction + actor/time/business occurrence | regenerate derived edges from pinned facts/policy | **Allocation Instruction / Constraint** |
| Automatic ordered source choice | matching policy + dimensions + ordering + open state | preserve facts + policy/version, not necessarily every edge as truth | deterministic rebuild | **Allocation Interpretation Result** |
| Deterministic cost allocation | valuation/cost method + eligible source basis | preserve source facts + policy/version | deterministic rebuild | **Derivation / Valuation Allocation Result** |
| Mixed manual + automatic | explicit selected source first, policy fills residual | preserve manual instruction; preserve policy/version | rebuild selected leg then residual leg | **Instruction + Interpretation Result** |
| Corrective reallocation | new business/governance instruction or additive correction | preserve new correction fact/instruction | rebuild subsequent derived edges | **New canonical instruction/fact, never silent mutation** |
| Open/residual quantity/value after allocation | result of applied allocations | no independent business truth | rebuild | **Residual Position Projection / Materialization** |

---

## 12. EVO semantic distinctions

### 12.1 Allocation Fact

Use only when the allocation itself is the business event being asserted.

Example candidate:

“Business operator explicitly assigns receipt R to order O as an approved business relationship.”

If the business meaning requires preserving that relationship independently of any algorithm, it may be represented as a canonical fact.

Not every manual UI selection automatically deserves this status.

### 12.2 Allocation Instruction / Constraint

Canonical input that tells the runtime:

- which source/source group must be consumed;
- perhaps priority/maximum/minimum/scope;
- actor;
- business occurrence;
- effective time;
- optional reason;
- policy/context version.

This best matches legacy `TRANS_MATCHED_CODE / MANUALLY_FIELD` behavior.

### 12.3 Allocation Interpretation Result

Derived edge produced by the allocation runtime:

`source position → consumer occurrence → allocated measure(s)`

with lineage back to:

- instruction/constraint, if any;
- allocation policy/version;
- source and consumer facts;
- ordering boundary;
- calculation run.

Automatic matching lives here.

The split edges produced from a manual instruction usually live here too.

### 12.4 Residual Position Projection

Remaining open quantity/value after applying allocation results.

Legacy WaterBal/TbMatched/open balances are evidence for this category.

They are rebuildable materialized/projection state.

---

## 13. Provenance requirements for EVO

Legacy provenance is insufficient for the future system.

EVO Allocation Instruction should support explicit provenance:

- `instruction_id`;
- `enterprise_id`;
- `consumer_fact_id`;
- selected source identity or selector;
- mode: explicit / preferred / mixed;
- actor / actor type;
- effective time;
- recorded time;
- reason / note;
- policy/version context;
- supersedes/corrects relation, if applicable;
- idempotency key.

Derived Allocation Result should additionally record:

- run/version;
- exact source position/version;
- allocated quantity/value;
- ordering rank;
- residual before/after;
- instruction lineage;
- policy lineage.

---

## 14. Correction / reallocation semantics

Legacy revoke restores calculated matching state and removes/clears derived match links.

EVO should not model correction as editing prior Allocation Results in place.

Preferred model:

`Original Fact/Instruction`
` + Correction/Reallocation Instruction`
` → deterministic replay/rebuild`
` → new derived Allocation Results`

The historical instruction lineage remains queryable.

This is consistent with EVO's append-only business-history rule.

---

## 15. Replay contract

### Explicit/manual path

Replay consumes the preserved business instruction.

`Facts + AllocationInstruction + pinned policy/version`
` → same constrained candidate set`
` → same deterministic split/allocation results`

### Automatic path

`Facts + pinned AllocationPolicy + deterministic ordering`
` → same candidate selection`
` → same results`

### Mixed path

`Facts + explicit instruction + pinned residual policy`
` → constrained selected-source allocation`
` → deterministic residual automatic allocation`

No replay path may depend on an unversioned “current matching rule”.

---

## 16. What must NOT be collapsed

Do not collapse these into one table/concept:

- business causality;
- manual source-selection instruction;
- generated allocation edge;
- cost/valuation derivation;
- open residual balance;
- accounting projection.

Likewise, do not use one overloaded `source_id` for all of them.

---

## 17. Gate decision

The packet can answer the required distinction:

1. **Allocation Fact** — only when allocation relationship itself is asserted as business truth;
2. **Allocation Instruction / Constraint** — canonical explicit selection or source constraint from business/user input;
3. **Allocation Interpretation Result** — generated source-consumption edge;
4. **Residual Position Projection** — rebuildable open-state result.

**AP-MANUAL-ALLOC-001 semantic gate: CLOSED.**

The unresolved mode-3 legacy implementation inconsistency is preserved as genealogy and does not block EVO because the semantic distinction is independently evidenced.

Next gate:

`AP-COST-METHOD-001 — FIFO / LIFO / Average / Specific Identification genealogy`

The next task is to prove that all required cost methods can be expressed as policies over the same Allocation + Valuation substrate without creating four incompatible runtimes.

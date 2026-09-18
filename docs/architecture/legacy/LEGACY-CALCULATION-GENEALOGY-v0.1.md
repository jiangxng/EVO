# Legacy Calculation Genealogy — Evidence, Data Assets, Hypotheses

Status: LIVING ARCHAEOLOGY RECORD
Date: 2026-09-17
Scope: Asloop-Backend + bookkeeping -> EVO

## 0. Constitutional preservation rule

This document is intentionally not a clean final architecture specification. It preserves the investigation itself.

Rules:
1. Legacy definition/configuration data is an enterprise template asset. It MUST NOT be discarded merely because EVO will not reuse the legacy implementation.
2. Enterprise instance transactions are not template data. Example: one sale of product A, quantity 100, amount 1000, must not be embedded in an Enterprise Template.
3. Atomic definition data is different: transaction types, fields, field attributes, forms, form views, lists, list views, menus, reports, components, expressions, posting rules, accounts/ledgers, matching definitions, dimensions, calculation configuration, etc. If present in the legacy systems, every recoverable attribute must be inventoried before normalization.
4. Raw evidence, interpretation, hypothesis, accepted design, rejected design, and unresolved questions MUST remain distinguishable.
5. A hypothesis later proven wrong MUST NOT simply disappear. Mark it SUPERSEDED/REJECTED and link the correcting evidence. This preserves reasoning genealogy for future LLMs.
6. Legacy code is evidence of business intent, not constitutional implementation. EVO may reimplement it completely in an LLM-native form.
7. No source asset is considered safely migrated until it is represented in a loss ledger/crosswalk: PRESERVED, NORMALIZED, SUPERSEDED-WITH-LINEAGE, INSTANCE-DATA-EXCLUDED, or UNRESOLVED.

## 1. Historical relationship of the two systems

Asloop is the older and broader enterprise system. bookkeeping was a later attempt to extract and simplify the accounting/calculation capability into a service usable by other enterprise websites. bookkeeping therefore does NOT replace Asloop capabilities such as Form, FormView, List, ListView, WebMenu, reports, and other application/web metadata.

Consequently, absence from bookkeeping is not evidence that an Asloop asset is obsolete.

## 2. Confirmed Asloop data-asset example

A migration SQL file under `roleplay-localize/roleplay-localize-provider/src/main/resources/db/1499252611845.sql` contains real definition evolution, not transaction instances. It adds dashboard/card structures and modifies application/list/process/permission/transaction-type metadata. It also contains a large set of transaction-type definitions/tags.

Recovered examples include:
- 委外加工完工入库 — 物流、生产
- 存货盘盈 — 物流
- 采购订单 — 交付计划
- 存货盘亏 — 物流
- 委外加工退料 — 物流、生产
- 采购入库 — 物流
- 采购退货出库 — 物流
- 委外加工订单 — 交付计划
- 在途调拨入库 / 在库调拨 / 在途调拨出库 — 物流
- 即时销售出库单 / 销售退货入库 — 物流、销售
- 货品简单拆分 / 货品简单组合 — 物流
- 委外加工领料 — 物流
- 付供应商欠款 / 收客户欠款 — 钱流
- 现货销售订单 / 备品订单 / 交付计划单 / 内部加工订单 / 部门排程单 / 客户供料订单 — 交付计划 or related tags
- 内部加工领料 / 内部加工完工入库 / 内部加工退料 / 内部加工领客户料 / 内部加工退客户料 — 物流、生产
- 客户供料入库 / 客户供料退料出库 — 物流
- 期间费用报销 / 制造费用报销 / 期间费用计提 / 制造费用计提
- 制造/非制造部门工资与奖金计提
- 制造/非制造部门固定资产折旧计提
- 计提委外加工费 / 计提企业所得税
- 预收客户款 / 预付供应商款 / 退预收客户款 / 收预付供应商款
- 付员工报销欠款 / 付员工备用金 / 收回员工备用金

This is evidence that the Enterprise Template must be much richer than a semantic skeleton. The exact full source set still requires exhaustive extraction; this list is deliberately marked partial.

## 3. Economic-flow model recovered from bookkeeping and discussion

Candidate abstraction, supported by legacy behavior but not yet frozen:

- Physical/economic-resource flow primarily carries quantity. Amount/value may be absent.
- Money flow primarily carries monetary measures; quantity is not inherently required.
- A physical/resource flow can later acquire monetary interpretation (valuation/cost basis).
- Foreign currency may be treated as an economic resource when held/exchanged, while currency also remains a unit of account/measurement.
- Converting a resource flow into a money/value interpretation must preserve reverse lineage for reconciliation.

Do NOT collapse these into one `amount` field or one generic `source_id`.

## 4. Asloop Matching / Water Balance archaeology

### Evidence recovered so far

Asloop calculation metadata includes concepts such as Component, Calc Relation, Match Relation, Match Field, Expression, Data Collector, Query Param, check/match direction, locking/negative-state policy, and quantity/amount calculation fields.

Historical collector configuration distinguishes at least:
- quantity matching source / target
- amount positive/negative matching source / target
- combined quantity+amount matching source / target

Collector/query behavior uses open-state fields including:
- `QTY_WATER_BAL`
- `QTY_TB_MATCHED`
- `AMNT_WATER_BAL`
- `AMNT_TB_MATCHED`

and orders candidates using `EFFECTIVE_TIME`.

### Current hypothesis H-MATCH-001
Status: CANDIDATE — NOT FROZEN

The old mechanism appears to model a generalized resource allocation/matching problem:

Current occurrence -> Component -> Collector eligibility -> ordered historical candidates -> source/target match -> expression-based quantity/amount allocation -> remaining/open state.

Potential EVO generalization:

`AllocationDefinition = eligibility + dimensions + ordering + measures + partial-allocation + remainder + negative-state + lineage policies`.

This may underlie inventory layer consumption, receivable/payable settlement, order fulfillment, production material allocation, and other open-item processes. However, different business semantics MUST remain explicit; not everything is FIFO and not every valuation method is allocation-by-layer.

### Unresolved question U-MATCH-001

The exact state machine and semantic distinction between Water Balance and To-Be-Matched Balance has not yet been fully reconstructed. Do not normalize these fields away until expression-level behavior is proven.

## 5. bookkeeping Balance / CostMwa archaeology

### Evidence/interpretation

bookkeeping strongly converged the Asloop accounting portion. A balance is keyed by account plus calculation dimensions/values; cost granularity is therefore not merely a product field but a configurable valuation/balance scope.

Moving-average price is derived from quantity/value state (`amount / quantity`) rather than treated as an independent primary fact.

Candidate conceptual split:

Immutable Movement/Entry -> Materialized Balance -> Valuation/Cost State -> Historical Snapshot/Checkpoint.

### Residual closure

Legacy cost behavior contains an important conservation mechanism: when an outbound occurrence consumes the remaining quantity of a valuation pool, the remaining value is consumed rather than blindly multiplying rounded unit price by quantity. Cost splitting similarly reconciles rounding difference so allocated child values equal the source value.

EVO must preserve the invariant, not necessarily the legacy implementation:

- quantity/value pools close without ghost residuals;
- sum(allocated value) == source value within the declared exact policy;
- rounding and residual assignment are explicit, versioned policies.

Candidate policy vocabulary:
- precision
- rounding mode
- allocation basis
- residual/remainder policy
- residual recipient policy

## 6. Cost lineage and multiple graph types

Current evidence supports keeping at least these identities/graphs distinct:

1. Business Causality Graph — which business fact caused another fact.
2. Allocation/Matching Lineage Graph — which open resource/state was allocated to which consumer.
3. Cost/Valuation Lineage Graph — which source costs/pools contributed to a derived cost.
4. Accounting Projection Lineage — which fact/rule/version generated which ledger projection.
5. Calculation Dependency Graph — what must be computed before what, and what is affected by a change.

Earlier notes sometimes grouped allocation and cost lineage together. Preserve that older interpretation, but current working model separates them because they may have different cardinality, lifecycle, and replay semantics.

Do not use one overloaded `source_id` for all of them.

## 7. Replay versus incremental financial trial calculation

Correction to an earlier interpretation is preserved here deliberately.

Earlier hypothesis: legacy diff-update procedures were mainly evidence of the danger of mutable history.

Corrected interpretation: they also address a legitimate performance/business requirement — local financial trial recalculation. If two years of full recomputation takes hours, changing an unrelated cash receipt should not force inventory/production cost recomputation.

EVO principle:

- Full deterministic replay is the correctness/reference path.
- Impact-scoped/incremental replay is an optimization path.
- Correctness MUST NOT depend on incremental calculation.
- Incremental result should be verifiable against full replay for the same facts/rules/order boundary.

Candidate invariant:
`digest(incremental(changes)) == digest(fullReplay(canonicalFacts))` for equivalent calculation scope/version.

Calculation Dependency DAG may serve both ordering and impact analysis.

## 8. Foreign currency / settlement archaeology

Current evidence suggests two distinct concepts in Asloop:
- exchange-rate metadata/configuration;
- period/entity settlement-exchange processing.

Candidate distinction:
`FX transaction != period-end FX revaluation/settlement`.

This is NOT yet fully proven at behavior level. The creation/call chain and generated transactions must still be recovered before freezing the semantics.

Foreign currency remains a dual-role candidate:
- Economic Resource when held/transferred/exchanged;
- Unit of Measure / denomination for monetary valuation.

## 9. Candidate EVO calculation genealogy

Current non-final convergence:

Business Fact / Economic Fact
 -> Movement / Measurement
 -> Matching / Allocation
 -> Cost Basis / Valuation
 -> Cost & Allocation Lineage
 -> Accounting / Operational Projection
 -> Materialized Balance
 -> Checkpoint

Orthogonal graphs:
- Business causality
- Calculation dependency / impact
- Projection lineage

This is a working model, not yet a Constitution-level frozen interface.

## 10. Data preservation ledger — initial state

The archaeology must maintain a machine-readable preservation inventory later. Until that artifact exists, use these states in notes:

- PRESERVED_RAW: source definition captured unchanged or addressable by immutable source reference.
- INVENTORIED: atomic attributes enumerated.
- NORMALIZED: mapped to an EVO-native concept with loss analysis.
- SUPERSEDED_WITH_LINEAGE: old concept replaced, original semantics/evidence retained.
- INSTANCE_DATA_EXCLUDED: real enterprise transaction instance intentionally not part of template.
- UNRESOLVED: meaning not yet established; MUST NOT discard.

No legacy atomic definition should move to a hidden/implicit `discarded` state.

## 11. Next archaeology targets

1. Reconstruct expression-level transitions for QTY/AMNT Water Balance and To-Be-Matched fields.
2. Recover actual `c_match_rel`, `c_match_field`, Component, Collector, Query Param records across SQL migration history, not only final schema.
3. Trace `lastStockOut()` and equivalent cost-selection functions.
4. Trace `trans_settlement_exchange` creation/call/generated transactions and exchange-difference rules.
5. Build an exhaustive legacy data-asset inventory covering Asloop Forms/FormViews/Lists/ListViews/WebMenu/reports/fields/transaction types plus bookkeeping Account/Policy/Balance/Cost metadata.
6. Produce a source-to-EVO loss ledger before declaring the Enterprise Template complete.

## 12. Rule for future LLMs

Do not clean this document by deleting wrong turns. Archaeology is evidence accumulation. When a conclusion changes, append the correction, status the old conclusion, and preserve why it once appeared plausible. The repository, not chat memory, is the durable development memory.

## 13. 2026-09-18 archaeology continuity protocol

A dedicated operating protocol now exists at:

`docs/architecture/legacy/LEGACY-ARCHAEOLOGY-WORK-METHOD-v0.1.md`

Future LLMs MUST consult that file before reopening large legacy sources. It contains the Analysis Ledger mapping already-inspected source files/code objects to conclusions, evidence status, known gaps, and re-analysis conditions.

The operating rule is now:

```text
Repository index
→ current packet
→ named evidence gap
→ minimal raw source
→ analysis
→ immediate durable summary
→ inventory/genealogy update
→ commit
```

Do not repeatedly reread `计算初始化脚本.sql`, `1499252611845.sql`, bookkeeping balance/cost SQL, or already-recorded code objects merely to reconstruct chat context.

Re-analysis is justified only when at least one is true:

- a new source/ref/version has been discovered;
- an exact raw record is missing from the atomic inventory;
- current evidence contradicts an earlier interpretation;
- an unresolved caller/state transition requires surrounding implementation;
- certification requires stronger source-level proof.

The next named packet is `AP-WB-001`: reconstruct the Water Balance / To-Be-Matched state machine and persist a collector/state-transition matrix before proceeding to broader matching generalization.


## 14. 2026-09-18 AP-FX-001 closure

Packet:

`docs/architecture/legacy/packets/AP-FX-001-FOREIGN-CURRENCY-SETTLEMENT.md`

Commit:

`0e003907e5d14839c8658ab6f9fb50694f18c422`

### Correction to Section 8

The earlier statement that FX transaction versus period-end settlement/revaluation was not fully proven is now **SUPERSEDED**.

Observed legacy behavior now proves:

- `9005 外币往来` and `2004 外币资金` carry foreign/resource measurement semantics;
- `9001 往来余额` and `2003 货币资金` carry local-currency carrying-value semantics;
- `ForeignExchangeSettlementFunction` realizes residual local carrying value when foreign settlement closes an open position;
- `YW205 汇兑损益` performs month-end revaluation without changing the foreign quantity/resource position;
- month-end valuation uses open foreign residual × `EXCHANGE_RATE_END` minus current local carrying amount;
- exchange-rate semantic roles must be explicit and versioned in EVO;
- period-close governance is distinct from settlement and valuation calculation.

Current normalized distinction:

`Economic Fact → Foreign Measurement → Position → Allocation/Settlement → Carrying Basis / Valuation → FX Result → Projection`

Realized settlement difference and period-end revaluation difference are separate derived results.

Residual legacy genealogy gaps remain:

- exact provider/population chain for transaction-level `rates`;
- exact current service/controller caller enforcing `trans_settlement_exchange` duplicate/reversal governance.

These no longer block Economic Runtime semantic modeling.

### Next gate

The next unresolved semantic blocker is:

`AP-MANUAL-ALLOC-001 — Manual vs Automatic Allocation`

The key question is whether a source-consumption relation is:

- explicit business/human evidence;
- a constraint/instruction that pins an algorithm;
- a deterministic interpretation result;
- or a residual/materialized projection.

Do not freeze Allocation persistence contracts before this gate closes.

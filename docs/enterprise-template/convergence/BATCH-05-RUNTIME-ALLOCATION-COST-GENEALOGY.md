# Batch 05 — Runtime Matching, Residual Balance, Allocation and Cost Genealogy

Status: IN PROGRESS — runtime behavior is now evidence-backed; FX/settlement closure still pending.

Source baselines:

- Asloop-Backend `main`, current release baseline previously pinned at `c9703eb4ab98e4637f0a7f2953b3f3c18f942833`.
- Asloop runtime implementation under `roleplay-corebiz/roleplay-calc*`.
- Asloop `release-data.sql` / `recall-data.sql`.
- bookkeeping `main`.
- EVO branch `evo/apm-certification-enterprise-template-v0.1`.

This batch continues Batch 04. It closes several runtime questions that were previously schema-only hypotheses.

## 1. Earlier semantic constraints carried forward

The archaeology must preserve the earlier Economic Flow constraints:

- physical/logistics flow and monetary/cash flow are distinct;
- `amount` on a physical transaction does not automatically mean monetary flow;
- a physical flow is quantity-primary and may optionally carry value;
- a monetary flow is value-primary and does not require physical quantity;
- conversion from physical/resource flow into monetary flow must preserve bidirectional lineage;
- foreign currency held as a resource may behave like a quantity-bearing economic resource; exchange/settlement is the conversion event into another monetary/value representation.

Therefore legacy field names must never be promoted directly into EVO canonical semantics.

## 2. Runtime execution graph is now verified

Implementation evidence closes the earlier schema-only graph.

Observed path:

`TransactionType / App / FG detail`
` -> Component selection + filter + sort`
` -> component binding / merge / validation`
` -> matching-data discovery`
` -> CalculatePrepare`
` -> CalculateObject`
` -> BalanceCalculate`
` -> VerificationCalculate`
` -> NegativeVerification`
` -> merge`
` -> DataStore`

Important implementation anchors:

- `CalcBuildServiceImpl.classifyTransDetail()` resolves start Components by transaction type + app and then builds bound details.
- `BindingChainHandler` selects details by FG + data filter and dispatches merge/default binding.
- `CalculatePrepareImpl` constructs current and matched `CalculateObject` instances and attaches calculation/matching rules.
- `AbstractInvoker.execute()` performs prepare -> calculate -> validate -> merge -> store.
- `VerificationCalculateImpl` splits a consuming/current object against multiple matched source objects and calculates both sides.
- `DataStoreImpl` inserts newly produced calculation rows and updates/inserts matched source rows.

This is no longer a hypothetical call graph.

## 3. `WaterBal` and `TbMatched` semantics are explicit in code

`BaseCalcDetailPojo` documents the fields directly:

- `QTY_WATER_BAL`: for a matchable/source row, records the balance at that occurrence; for a consuming/matching row, records the remaining balance during each matching step.
- `QTY_TB_MATCHED`: the current quantity remaining available to be matched/consumed.
- `AMNT_WATER_BAL`: same role for amount.
- `AMNT_TB_MATCHED`: current amount remaining available to be matched/consumed.
- `TRANS_MATCHED_DETAIL_ID`: matched source detail identity.
- `ORIGIN_ID`: source lineage; comments explicitly cite transfer-cost tracing back to the first inbound record.
- `PARENT_ID`: fast matching-sequence/source positioning; source rows point to self, consuming rows point to the matched source row.
- `TRANS_MATCHED_SEQ`: matching sequence.

The calculation expressions confirm the distinction:

- `qtyTbMatched` is reduced as matched quantity is consumed.
- `amntTbMatched` is reduced proportionally when quantity and amount are consumed together.
- `qtyWaterBal / amntWaterBal` preserve stepwise residual/history semantics on the consuming/matching side.

High-confidence interpretation:

> `TbMatched` is mutable/current residual state in the legacy engine; `WaterBal` is stepwise residual/history evidence used to reconstruct the matching sequence.

EVO must not copy this mutable model as source-of-truth state. The semantic requirement is the durable allocation/source-consumption relation plus deterministic residual projection.

## 4. Matching is already a quantity allocation algorithm

`VerificationCalculateImpl.doSplit()` iterates matched source rows in order, consumes their matchable amount/quantity, splits the current occurrence when one source is insufficient, and creates a negative/uncovered remainder when allowed.

This means legacy matching is materially closer to allocation than to a boolean reconciliation flag.

For quantity + amount:

- quantity is the primary split driver;
- amount is allocated from the matched source proportionally by source remaining amount / source remaining quantity;
- source residual quantity and amount are updated after consumption.

This strongly supports the EVO distinction:

`AllocationRelation`
- source position/source occurrence;
- target occurrence;
- allocated measure(s);
- allocation sequence;
- policy/algorithm provenance;
- effective dataset/version provenance.

versus

`AllocationPolicy`
- candidate selection;
- ordering;
- eligibility/filtering;
- manual vs automatic choice;
- negative/uncovered handling;
- precision/rounding/residual policy.

The relation and the policy are not the same object.

## 5. `c_match_rel` is not the runtime core in the current data snapshot

Current release schema still defines `c_match_rel`, but:

- current `release-data.sql` contains zero `c_match_rel` rows;
- `recall-data.sql` does not provide active `c_match_rel` evidence;
- runtime behavior is instead demonstrably driven through Component configuration, matched-data collection, directions, expressions and source/current objects.

Therefore Batch 04's uncertainty is resolved downward:

> `c_match_rel` is a historical/configuration extension point, not sufficient evidence for a canonical EVO matching object.

Do not map `MATCH_REL` one-to-one to EVO Allocation.

## 6. Real purchase and sales genealogy confirms Position consumption/creation

Representative current release configuration:

### Purchase order

`YW6 采购订单`

- consume `7502 待下单的采购`;
- create `8502 待验收采购订单`;
- create additional pending-invoice / prepayment positions where applicable.

### Purchase receipt

`YW133 原料采购进货`

- consume `8502 待验收采购订单`;
- create inventory positions;
- create returnable-purchase position;
- update invoice/settlement/current-account related positions;
- project by warehouse/project/organization dimensions.

### Sales order

`YW1 货品销售订单`

- create pending-delivery positions;
- create pre-receipt / invoice-demand positions.

### Sales issue

`YW12 销售出库`

- consume pending-delivery positions;
- consume inventory and warehouse-position quantity/value;
- create returnable-sale position;
- create receivable/current-account/invoice positions;
- derive sales revenue and sales cost;
- derive project/organization revenue and cost;
- create downstream delivery/logistics positions where configured.

This is evidence against a status-mutation model. One business occurrence creates/consumes multiple economic positions and projections.

## 7. bookkeeping is a later simplification of the same economic ideas

bookkeeping compresses the architecture into:

`App -> Policy -> TransdataAccount -> Balance -> CostMwa`

Important semantic evidence:

- `TransdataAccount.quantityFactor` and `amountFactor` are occurrence measures.
- Amount may be deferred as a formula such as `成本`, because the value is derived after the physical occurrence.
- `成本` queries the latest cost/value context for the relevant account/object/dimensions and quantity.
- `借方成本 / 贷方成本` retrieves value from the opposite-side related entry.
- `成本合计`, `贷方`, `借方`, `分摊成本` are explicit cross-entry/value-derivation concepts.
- weighted-average cost is described in code as persistence of amount/quantity balance history; the code itself notes `cost_mwa` could be simplified because average cost is derivable from balance history.
- cost path functions preserve source material/value lineage.

This is consistent with Asloop's source lineage but implemented through a simpler balance/value model.

## 8. Allocation conservation is independently confirmed

bookkeeping `proc_part_cost_split`:

1. obtains total source/product cost;
2. allocates proportionally across target debit entries;
3. recomputes the allocated total;
4. assigns the rounding residual to one target row.

This independently validates the previously recorded invariant:

> allocation must conserve source quantity/value exactly; precision, rounding and residual assignment must be deterministic and versioned.

## 9. Candidate EVO decomposition — stronger confidence, not yet constitutional

The evidence now supports the following decomposition with high confidence:

`Occurrence`
- immutable business/economic fact.

`Position`
- derived current open/remaining quantity or value state.

`AllocationRelation`
- durable or rebuildable provenance relation describing how a source position/value was consumed by a target occurrence.

`AllocationPolicy`
- deterministic rules for selection, ordering, matching, manual override, residual/negative behavior and precision.

`DerivationRelation`
- traces one derived result/value to another without pretending every derivation is a source-consumption allocation.

`Valuation`
- gives value to quantity/resource flow under a pinned valuation dataset/policy.

`Projection`
- projects the same economic facts into operational, management, project, organization and statutory/accounting views.

Still unresolved:

- which AllocationRelation classes are immutable business facts versus rebuildable interpretation results;
- exact manual matching persistence/provenance;
- FX settlement, realized/unrealized exchange gain/loss and currency-resource conversion;
- FIFO/LIFO/specific-identification genealogy versus the weighted-average path shown in bookkeeping;
- final Cost -> Valuation -> Accounting Projection contract.

No canonical EVO runtime contract changes are made in this batch.

## 10. Exact next archaeology gate

Continue with:

1. FX/foreign-currency runtime functions and transaction configurations;
2. manual matching versus automatic matching persistence;
3. inventory cost source lineage for FIFO/LIFO/specific-identification candidates;
4. compare Asloop allocation lineage with bookkeeping cost-path lineage;
5. decide which relations are immutable Allocation Facts versus rebuildable Allocation Interpretations;
6. only then update `docs/architecture/decisions/2026-09-17-economic-flow-valuation-and-materialization.md`.

## 11. Continuation checkpoint

Stable facts for the next chat/work window:

- physical flow, monetary flow and valuation remain separate semantics;
- `amount` is not synonymous with money flow;
- `TbMatched` is current matchable residual state;
- `WaterBal` preserves stepwise residual/matching history;
- `TRANS_MATCHED_DETAIL_ID / ORIGIN_ID / PARENT_ID / TRANS_MATCHED_SEQ` prove explicit source-consumption lineage;
- matching runtime performs ordered split/allocation;
- `c_match_rel` is not the current runtime core;
- bookkeeping confirms deferred value derivation, source-cost lineage and deterministic allocation conservation;
- AllocationRelation and AllocationPolicy must remain separate in EVO;
- no canonical object should be frozen until FX/manual matching/cost-method genealogy closes.

# EVO Canonical Concepts

Status: Authoritative
Context Version: 1.0

| Concept | Meaning | Not This |
|---|---|---|
| Enterprise | tenant / enterprise operating boundary | a department |
| Domain | semantic grouping such as Sales or Inventory | execution engine |
| Capability | stable description of what the enterprise can do | workflow instance |
| Flow | traceable cross-domain value/object/state/responsibility chain | one screen or one module |
| Transaction Type | high-level business occurrence category | UI page |
| Application | executable tool around business capability/process | source of independent truth |
| Command | authorized request to perform a business action | replayable event |
| CommandExecution | audit of one command attempt | business fact itself |
| BusinessData | preserved actual business history | mutable current row |
| PostingInput | ordered bridge from BusinessData to posting | user command |
| Posting | deterministic rule evaluation producing ledger effects | AI reasoning |
| LedgerEntry | immutable derived accounting/operational effect | original business fact |
| LedgerBalance | projection of ledger entries | source of history |
| CostResult | deterministic valuation result | arbitrary mutation of balance |
| WorkItem | current actionable work derived from governed state | durable business fact |
| SOP | how work should be performed | process runtime |
| Process | how work is coordinated | SOP document |
| Metric | governed semantic measurement | ad-hoc dashboard formula |
| Replay | reconstruction of Actual derived state from preserved history and pinned versions | re-running commands |
| Scenario | hypothetical calculation namespace | Actual ledger |

## Canonical Runtime Spine

Command → BusinessData → PostingInput → Posting → Ledger → Cost → Work → Replay

## Enterprise Operating Loop

Enterprise Model → Capability → Flow → Process/Application/Tool → Command → BusinessData → Posting → Ledger/Cost/Work → Metrics → Management Intelligence → Decision → Command

## Reference Relationship Semantics

Business relationships must be explicit. Equal quantities, matching names, or temporal proximity are not sufficient evidence of causation or fulfillment.

Use governed lineage/link semantics such as `CAUSES`, `FULFILLS`, `ALLOCATES_TO`, `DERIVES_FROM`, and Flow Trace.

## v1.0.0-alpha.2 — Analytical Dimensions and Valuation Posting

### DimensionDefinition
A governed analytical/accounting dimension key such as `product_id`, `warehouse`, `project`, `department`, `profit_center`, or `cost_center`. A DimensionDefinition does not replace the corresponding enterprise object; it defines how that semantic may participate in analysis/accounting.

### Ledger Dimension Policy
`LedgerDefinition.dimension_schema` declares which dimensions are required, optional, or forbidden for that ledger. Measurement semantics (`quantity`, `amount`) remain orthogonal to analytical dimensions.

### Explicit Dimension Mapping
Posting and valuation rules map source semantics into dimension values. Source fields do not automatically propagate merely because they exist on BusinessData.

### Valuation Posting
A deterministic derived-accounting step that transforms a persisted `CostResult` into ledger value effects. It writes `LedgerEntry`, never BusinessData, and never invokes Command.

Canonical chain:
`BusinessData -> CostRun -> CostResult -> ValuationPosting -> LedgerEntry -> LedgerBalance`.

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

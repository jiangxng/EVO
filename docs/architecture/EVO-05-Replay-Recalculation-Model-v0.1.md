# EVO-05 — Replay & Recalculation Model

**Version:** 0.1  
**Status:** Draft / Architecture Design  
**Project:** EVO — Enterprise Operating System

---

## 1. Purpose

EVO-05 defines the system-level lifecycle for rebuilding posting, balances and cost results from business data.

The core requirement is:

> **Business data is retained; derived posting and calculation results can be discarded and rebuilt.**

Canonical rebuild flow:

```text
Normal Mode
    ↓
Enter Replay Mode
    ↓
Pause Real-Time Posting
    ↓
Clear Derived Results
    ↓
Replay Business Data
    ↓
Rebuild Ledger
    ↓
Rebuild Balance
    ↓
Recalculate Cost
    ↓
Validate
    ↓
Publish
    ↓
Resume Normal Mode
```

---

## 2. Source Data vs Derived Data

Replay depends on a strict boundary.

### Source / Business Data

Business records created by enterprise applications.

These are the inputs to replay.

### Derived Data

Results that can be regenerated:

```text
Ledger Entries
Ledger Balances
Cost Layers
Cost Matches
Cost Results
Calculation Results
Derived Runtime State
```

The initial replay strategy allows derived data to be cleared completely.

---

## 3. Replay Is an Operating Mode

Replay is not merely a background calculation.

EVO enters a controlled system mode:

```text
NORMAL
    ↓
ENTERING_REPLAY
    ↓
REPLAY
    ↓
VALIDATING
    ↓
PUBLISHING
    ↓
NORMAL
```

Failure may move the system to:

```text
REPLAY_FAILED
```

until recovery or another replay is performed.

---

## 4. Real-Time Posting Is Paused

Historical replay and real-time posting do not execute concurrently in the initial architecture.

When Replay Mode begins:

```text
New business operations may continue to be recorded
        ↓
but
        ↓
Real-time posting is paused
```

Any posting-relevant data created during the pause must wait in the posting queue and must not be lost.

Before returning to NORMAL mode, EVO must ensure those inputs are included or subsequently posted in deterministic order.

---

## 5. Replay Lock

Only one authoritative full replay may run for an Enterprise at a time.

Conceptually:

```text
ReplayLock
    enterprise
    replay_run
    acquired_at
    owner
    status
```

The lock prevents:

```text
Two simultaneous full replays
Replay and uncontrolled live posting
Multiple writers replacing active derived results
```

---

## 6. Replay Run

A Replay Run is the system-level execution record.

Conceptually:

```text
ReplayRun
    id
    enterprise
    mode
    source_metadata_version
    posting_rule_version
    valuation_policy_version
    started_at
    completed_at
    status
```

Possible statuses:

```text
Pending
Preparing
Posting
Costing
Validating
Publishing
Completed
Failed
```

---

## 7. Replay Input Snapshot

Replay must operate against a known input boundary.

At replay start, EVO establishes a logical source boundary:

```text
Replay Input Boundary
=
All posting-relevant business data
up to a deterministic sequence position
```

This prevents the replay dataset from changing unpredictably while it is being processed.

Business records created after the boundary may wait for normal posting after replay publication.

---

## 8. Full Rebuild Strategy

Initial EVO strategy:

```text
1. Pause real-time posting
2. Acquire Replay Lock
3. Establish input boundary
4. Clear / replace derived posting data
5. Replay all business inputs in sequence
6. Rebuild ledger balances
7. Recalculate all cost data
8. Validate results
9. Publish rebuilt results
10. Process waiting inputs
11. Resume normal posting
```

No partial historical optimization is required for v0.x.

---

## 9. Posting Run

Posting Run represents the accounting/posting calculation phase.

```text
Business Data
+ Posting Rules
+ Posting Sequence
        ↓
Posting Run
        ↓
Ledger Dataset
```

Conceptually:

```text
PostingRun
    id
    replay_run
    enterprise
    input_boundary
    rule_version
    started_at
    completed_at
    status
```

---

## 10. Ledger Dataset

A Ledger Dataset is the complete ledger result produced by a Posting Run.

It may include:

```text
Ledger Entries
Ledger Balances
Posting Metadata
Input Boundary
Rule Version
```

Conceptually:

```text
LedgerDataset
    id
    posting_run
    enterprise
    rule_version
    input_boundary
    status
```

The initial physical implementation may use active tables rather than physically isolated datasets, but the conceptual boundary remains.

---

## 11. Cost Run

After ledger results are available:

```text
Ledger Dataset
+ Valuation Policy
        ↓
Cost Run
        ↓
Cost Dataset
```

The Cost Run follows EVO-04.

It rebuilds:

```text
Cost Pools
Cost Layers
Cost Matches
Cost Results
```

---

## 12. Cost Dataset

A Cost Dataset is the valuation result associated with a Ledger Dataset and Valuation Policy version.

Conceptually:

```text
CostDataset
    id
    cost_run
    ledger_dataset
    valuation_policy_version
    status
```

This preserves the dependency:

```text
Cost Dataset
depends on
Ledger Dataset
```

not directly on arbitrary mutable balances.

---

## 13. Rebuild Order

The canonical dependency order is:

```text
Business Data
    ↓
Posting Run
    ↓
Ledger Entries
    ↓
Ledger Balances
    ↓
Cost Run
    ↓
Cost Layers / Matches / Results
    ↓
Downstream Derived State
```

A downstream layer must not be rebuilt before its upstream dependency is stable.

---

## 14. Validation

Replay is not considered successful merely because all code executed.

Before publication, EVO validates the rebuilt result.

Initial validation should include:

```text
No unhandled posting failures
All posting inputs within boundary processed
Ledger balances reconcile with entries
Cost quantities reconcile with cost-bearing ledger quantities
No unexplained unmatched cost quantity
Required cost results exist
No invalid numeric values
No unresolved replay errors
```

Domain-specific validators may be added later.

---

## 15. Publish

A completed calculation should become active only after validation.

Conceptually:

```text
Candidate Ledger Dataset
Candidate Cost Dataset
        ↓
Validation Passed
        ↓
Publish
        ↓
Active Ledger Dataset
Active Cost Dataset
```

This avoids exposing partially rebuilt results as authoritative state.

---

## 16. Atomic Switch

Preferred long-term model:

```text
Active Dataset A
        ↓
Replay builds Candidate Dataset B
        ↓
Validate B
        ↓
Atomic Active Pointer Switch
        ↓
Active Dataset B
```

This is safer than exposing partially rebuilt tables.

However, the initial implementation may use clear-and-rebuild tables if operational simplicity is more important.

The conceptual architecture should still preserve the possibility of dataset switching.

---

## 17. Clear-and-Rebuild Implementation

The simplest first implementation may be:

```text
Pause Posting
↓
DELETE Ledger Entries
DELETE Ledger Balances
DELETE Cost Layers
DELETE Cost Matches
DELETE Cost Results
↓
Rebuild
↓
Validate
↓
Resume
```

This is acceptable for early EVO versions if the system is operationally paused and failed replay can be rerun.

Dataset isolation/atomic switching can be introduced when scale and availability require it.

---

## 18. Waiting Business Data

Business applications may create new records while posting is paused.

These records must receive deterministic posting sequence information and wait.

Example:

```text
Replay boundary = sequence 1,000,000

During replay:
    new input = 1,000,001
    new input = 1,000,002
```

After the rebuilt dataset through `1,000,000` is published:

```text
1,000,001
1,000,002
```

are posted normally in sequence.

This prevents replay from requiring the entire enterprise to stop recording business operations unless a particular application requires stronger locking.

---

## 19. Failure Handling

If replay fails:

```text
ReplayRun = Failed
```

EVO must preserve:

```text
Failure phase
Posting sequence position
Input identity
Rule version
Error details
Cost position if applicable
```

The system must not silently declare partially rebuilt results active.

Recovery options initially are simple:

```text
Fix data/rule/system issue
↓
Run full replay again
```

---

## 20. Rule Changes and Replay

Changing posting rules does not require rewriting business data.

Example:

```text
Business History
    +
Posting Rules v1
        ↓
Ledger Dataset v1
```

Later:

```text
Same Business History
    +
Posting Rules v2
        ↓
Ledger Dataset v2
```

This is the fundamental reason EVO separates source business data from posting results.

---

## 21. Cost Policy Changes and Recalculation

Similarly:

```text
Ledger Dataset
    +
FIFO
        ↓
Cost Dataset A
```

or:

```text
Same Ledger Dataset
    +
Moving Average
        ↓
Cost Dataset B
```

A valuation-policy change does not require rewriting the Ledger Entries unless posting rules themselves also changed.

---

## 22. Full Replay vs Cost-Only Recalculation

Although the initial user-facing rebuild operation may perform both posting and cost recalculation, the architecture distinguishes:

### Full Replay

```text
Business Data
↓
Re-Post
↓
Rebuild Ledger
↓
Recalculate Cost
```

### Cost-Only Recalculation

```text
Existing Valid Ledger Dataset
↓
Recalculate Cost
```

Cost-only recalculation is safe when the Ledger Dataset remains valid and only valuation policy/calculation changes.

This distinction can reduce future processing time without introducing partial posting replay complexity.

---

## 23. Determinism

Replay must satisfy:

```text
Same Business Input Set
+ Same Metadata
+ Same Posting Rules
+ Same Posting Sequence
+ Same Valuation Policy
+ Same Calculation Rules
=
Same Result
```

This applies to:

```text
Ledger Entries
Balances
Cost Layers
Cost Matches
Cost Results
```

within explicitly defined precision and rounding rules.

---

## 24. Replay Audit

Replay itself should be auditable.

At minimum retain:

```text
Replay Run ID
Enterprise
Input Boundary
Metadata Version
Posting Rule Version
Valuation Policy Version
Start / End Time
Status
Validation Result
Failure Information
Published Dataset Identity
```

Derived detail data may be replaceable; replay execution history should remain available for operational diagnosis and audit.

---

## 25. System Availability Strategy

Initial strategy prioritizes correctness:

```text
Posting temporarily unavailable
Business recording may remain available
```

Later EVO may support:

```text
Shadow Replay
Candidate Dataset Build
Atomic Dataset Switch
Near-Zero Posting Downtime
```

These are optimizations, not foundational requirements.

---

## 26. Relationship to AI

AI may assist with:

```text
Explaining replay failures
Identifying the first inconsistent posting input
Comparing rule-version results
Explaining cost differences
Suggesting validation checks
Analyzing dataset differences
```

AI must not bypass deterministic replay rules.

The authoritative result remains produced by the posting and calculation engines.

---

## 27. Architectural Invariants

1. Business data is the replay source.
2. Ledger, balance and cost data are rebuildable derived results.
3. Full replay pauses authoritative real-time posting.
4. One Enterprise has at most one authoritative full replay at a time.
5. Replay establishes a deterministic input boundary.
6. Posting inputs are replayed in deterministic order.
7. Ledger is rebuilt before dependent cost calculation.
8. Cost Dataset depends on a Ledger Dataset.
9. Replay results must be validated before becoming authoritative.
10. Partial failed results must not silently become active.
11. New business data created during replay must not be lost.
12. Initial recovery strategy may simply rerun full replay.
13. Posting-rule changes can regenerate accounting without changing business history.
14. Valuation-policy changes can regenerate cost without changing business history.
15. Cost-only recalculation is conceptually distinct from full posting replay.
16. Dataset switching is a future availability optimization, not an initial requirement.

---

## 28. Initial Implementation Scope

Implement first:

```text
Replay Mode
Replay Lock
Input Boundary
Full Posting Replay
Ledger Rebuild
Balance Rebuild
Full Cost Recalculation
Validation
Failure State
Waiting Posting Queue
Resume Posting
```

Keep simple:

```text
One active result set
Full rebuild
Manual/controlled replay initiation
Rerun on failure
```

Reserve for later:

```text
Shadow Dataset
Atomic Dataset Switch
Partial Posting Replay
Impact Analysis
Distributed Replay
Parallel Replay
Incremental Cost Backfill
```

---

## 29. Next Stage

**EVO-06 — Command, Process & Work Model**

The next layer moves above posting and answers how enterprise work is executed:

```text
User / AI Intent
      ↓
Command
      ↓
Business Application
      ↓
Business Data
      ↓
Posting
      ↓
Ledger Balance / State
      ↓
Process / Work Item / Plan
      ↓
Next Command
```

EVO-06 will define:

```text
Command
Process
Process Step
Work Item
Plan
Trigger
Human Action
AI Action
Automation
Permission / Approval Boundary
```

---

**End of EVO-05 v0.1**

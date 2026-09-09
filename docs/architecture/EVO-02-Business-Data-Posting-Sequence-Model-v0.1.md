# EVO-02 — Business Data & Posting Sequence Model

**Version:** 0.1  
**Status:** Draft / Architecture Design  
**Project:** EVO — Enterprise Operating System

---

## 1. Purpose

EVO-02 defines how business data becomes deterministic posting input.

The core requirement is not to classify every runtime record as a “fact” or “event”. The core requirement is:

> **Any business-data change must be able to participate in posting again, so accounting and downstream calculations can be fully rebuilt.**

```text
Business Data
    ↓
Posting Input
    ↓
Posting Sequence
    ↓
Posting Queue
    ↓
Conditional Posting
    ↓
Ledger Entry
```

---

## 2. 新增数据法

EVO uses newly-added business data to express subsequent changes.

Examples:

```text
Order +100
Adjustment -20
Current business result = 80
```

```text
Order +100
Cancellation -100
Current business result = 0
```

The posting engine does not require mandatory relationships such as:

```text
correction_of
reversal_of
replace_of
```

If the business application needs those relationships for explanation or UI, they belong to the business-description layer, not the ledger kernel.

---

## 3. Responsibility Boundary

### Business / Application Layer

Responsible for:

```text
Why was this record created?
What business action does it represent?
What fields and semantics does it contain?
What process caused it?
```

### Posting Layer

Responsible for:

```text
Read posting input
Determine posting order
Select posting rules
Evaluate conditions
Generate ledger entries
```

The posting layer does not reconstruct business intent.

---

## 4. Posting Input

A Posting Input is any posting-relevant runtime business record.

Conceptually:

```text
PostingInput
    id
    enterprise
    application
    transaction_type
    business_data
    effective_time
    posting_priority
    sequence_number
    metadata_version
```

Physical schema is deferred.

---

## 5. Posting Sequence

Posting order must be deterministic.

EVO defines it conceptually as:

```text
Posting Sequence
=
Business Effective Time
+ Explicit Posting Priority
+ Stable Sequence Number
```

### Business Effective Time

When the business entry should take effect for posting.

It is not necessarily database creation time.

### Explicit Posting Priority

Used when business inputs at the same effective time require a defined order.

Examples:

```text
Opening Balance before Receipt
Receipt before Issue
Production Completion before Shipment
```

### Stable Sequence Number

Provides final deterministic ordering when time and priority are identical.

The same input set must always produce the same sequence.

---

## 6. Posting Queue

Posting inputs are logically processed in sequence.

```text
Input 1
   ↓
Input 2
   ↓
Input 3
   ↓
Input 4
```

This does not permanently forbid parallel implementation.

It means:

> **The logical result must be equivalent to deterministic sequential posting whenever order affects balance, matching or cost.**

---

## 7. Multiple Records from One Business Object

One business object may continuously produce multiple posting inputs.

```text
Sales Order
    ↓
Approved
    ↓
Adjusted
    ↓
Allocated
    ↓
Shipped
    ↓
Cancelled Remaining Quantity
```

Each posting-relevant occurrence becomes another ordered input.

The ledger engine does not merge these into one mutable “current transaction”.

---

## 8. Real-Time Posting

Normal mode:

```text
New Business Data
      ↓
Resolve Posting Sequence
      ↓
Posting Queue
      ↓
Conditional Posting
      ↓
Ledger Entries
      ↓
Balance / Runtime Result
```

---

## 9. Replay Mode

Historical replay does not run concurrently with real-time posting.

```text
Enter Replay Mode
      ↓
Pause Real-Time Posting
      ↓
Clear Existing Ledger Results
      ↓
Clear Existing Balance Results
      ↓
Clear Existing Cost Results
      ↓
Read All Posting-Relevant Business Data
      ↓
Sort by Posting Sequence
      ↓
Re-Post All Inputs
      ↓
Rebuild Balances
      ↓
Recalculate Costs
      ↓
Exit Replay Mode
      ↓
Resume Real-Time Posting
```

This avoids complex live/replay concurrency in the initial architecture.

---

## 10. Full Rebuild First

EVO v0.x prioritizes correctness and determinism.

Initial replay strategy:

```text
Clear ledger results
Clear balance results
Clear cost results
Replay all posting inputs
Recalculate all derived results
```

Deferred optimizations:

```text
Partial Replay
From-Date Replay
Impact-Based Replay
Incremental Ledger Rebuild
Incremental Cost Rebuild
```

---

## 11. Reproducibility

The same:

```text
Business Data
+ Metadata Version
+ Posting Rule Version
+ Posting Sequence
```

must produce the same posting result.

```text
PostingResult =
f(
  BusinessData,
  MetadataVersion,
  PostingRuleVersion,
  PostingSequence
)
```

---

## 12. Ordering Must Not Depend on Database Accident

Posting order must not depend only on:

```text
auto_increment_id
insert_time
physical row order
thread scheduling
message arrival race
```

These may exist as implementation details, but they are not sufficient business-order semantics.

---

## 13. Posting Failure

A posting input may conceptually have:

```text
Queued
Processing
Posted
Failed
```

A failure must retain enough information to reproduce and diagnose it:

```text
Input identity
Rule version
Failure reason
Failure position
```

Detailed retry design is deferred.

---

## 14. Architectural Decisions Locked by EVO-02

1. Replayability matters more than Fact/Event philosophical classification.
2. Business changes are expressed through newly added business data.
3. Posting engine does not require correction/reversal graphs.
4. Business semantics belong to the application layer.
5. Every posting-relevant record becomes an ordered Posting Input.
6. Posting order must be deterministic.
7. Posting order uses effective time, explicit priority and stable sequence.
8. Multiple occurrences from one business object are posted in sequence.
9. Historical replay pauses real-time posting.
10. Initial replay strategy is full rebuild.
11. Ledger, balance and cost results may all be cleared before replay.
12. Same inputs, versions and sequence must reproduce the same result.
13. Incremental replay is deferred as an optimization.

---

## 15. Next Stage

**EVO-03 — Ledger & Conditional Posting Model**

```text
Posting Input
    ↓
Conditional Posting
    ↓
Ledger Definition
    ↓
Ledger Entry
    ↓
Balance / State
```

---

**End of EVO-02 v0.1**

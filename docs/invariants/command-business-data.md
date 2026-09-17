# Command / BusinessData Invariants

1. Human, AI, Automation and External System actors use the same Command boundary.
2. A successful Command creates durable BusinessData through one controlled transaction.
3. BusinessData is never overwritten to represent a later business change.
4. Business-object history is represented by increasing `business_object_version`.
5. A completed idempotent retry must not create duplicate BusinessData.
6. CommandExecution + BusinessData + PostingInput + OutboxEvent commit atomically.
7. Posting sequence allocation is deterministic and serialized per initial Enterprise consistency domain.
8. Canonical posting order is `(effective_at, posting_priority, posting_sequence)`.
9. A newly created candidate with canonical key `<=` authoritative posting high-water is retroactive.
10. Retroactive input must not be live-posted out of canonical order.
11. Retroactive input sets `replay_required`.
12. BusinessData may continue to be recorded while replay is required/replaying; PostingInput is blocked as necessary.
13. Posting arrival/creation order is not authoritative business order.
14. `expectedBusinessVersion` mismatch fails rather than silently racing.
15. Outbox publication is downstream; creation of the OutboxEvent is part of the Command transaction.

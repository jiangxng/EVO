# EVO Core Invariants

These are not implementation suggestions. Changes require explicit architecture review and an ADR.

1. **Business History Is Preserved.**
2. Business changes are represented by additional BusinessData.
3. Command is the controlled business-write boundary.
4. Commands create BusinessData; Posting creates Ledger results.
5. Posting order is deterministic.
6. Posting order does not depend solely on database insertion timing.
7. LedgerEntry is derived runtime data.
8. LedgerBalance is a rebuildable projection.
9. Cost is derived and recalculable.
10. Cost calculation remains separate from posting-rule evaluation.
11. Replay never re-executes historical Commands.
12. Same canonical inputs + versions + ordering must reproduce the same derived result within defined rounding rules.
13. AI cannot bypass permissions, approvals, Commands or deterministic accounting engines.
14. Modules may not bypass ownership by directly mutating another module's persistence.
15. Enterprise scope is explicit on enterprise-owned runtime state.
16. Interfaces and compatibility changes are versioned and documented.
17. Repository state—not chat memory—is authoritative engineering context.

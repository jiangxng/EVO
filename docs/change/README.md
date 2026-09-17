# EVO Change Management

Requirement and design changes are first-class engineering artifacts.

## Material change flow

```text
Requirement Change
→ Impact Analysis
→ ADR / Design Change
→ Interface/Data Compatibility
→ Migration Plan
→ Implementation
→ Contract/Invariant Tests
→ Gray Release
→ Observe
→ Complete or Roll-forward
```

## Never rely on memory

A material decision that exists only in a chat, meeting or person's memory is not an accepted EVO engineering decision.

## Required locations

- Requirement changes: `docs/change/requirements/`
- Design changes: `docs/change/design/`
- Migration plans: `docs/change/migrations/`
- Compatibility notes: `docs/change/compatibility/`
- Release/gray rollout: `docs/change/releases/`
- Architectural decisions: `docs/adr/`

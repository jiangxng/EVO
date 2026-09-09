# EVO — Enterprise Operating System

**Version:** 0.9.0 Production Candidate / Validation Build

EVO is an AI-native, metadata-driven enterprise operating system built around:

```text
Metadata
→ Command
→ BusinessData
→ Posting
→ Ledger
→ Balance / Cost / State
→ Work
→ Next Command
```

## Fastest start

Install Docker Desktop, then:

```bash
docker compose up -d --build
```

Open:

```text
http://localhost:3000
```

See [`DEPLOY.md`](./DEPLOY.md).

## Included in v0.9

- Enterprise Metadata / Template / Application Instance foundation
- Human / AI / Automation common Command boundary
- Actor permission grants
- Idempotent CommandExecution
- append-only BusinessData history
- deterministic PostingInput ordering
- retroactive posting detection / replay-required state
- controlled posting JSON AST
- generic LedgerEntry / LedgerBalance
- deterministic dimension hashing
- WorkItem projection from ledger state
- FIFO / LIFO / Moving Average / Specific Identification cost engine foundation
- Full Replay and deterministic digest validation
- AI command capability catalog
- transactional Outbox with worker publication
- feature flag foundation
- migration/version/compatibility metadata
- Windows/Linux repository path invariant
- Docker deployment
- browser Validation Console

## Status

This is the first integrated candidate intended for validation.

It is **not claimed to be production-proven v1.0** until it has been exercised with real workloads, failure injection, migration exercises and enterprise scenarios.

## Architecture

Current implementation context:

```text
ARCHITECTURE.md
```

Versioned architecture history:

```text
docs/architecture/
```
